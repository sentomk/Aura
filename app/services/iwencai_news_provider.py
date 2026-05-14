"""
同花顺问财新闻搜索服务
通过 iwencai OpenAPI 获取财经新闻，集成到 Aura 新闻同步管道。
"""
import logging
import secrets
from typing import List, Dict, Any, Optional

import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)

IWENCAI_SKILL_ID = "news-search"
IWENCAI_SKILL_VERSION = "1.0.0"


class IwencaiNewsProvider:
    """同花顺问财新闻搜索提供者"""

    def __init__(self) -> None:
        self._client: Optional[httpx.AsyncClient] = None
        self._available: Optional[bool] = None

    @property
    def api_key(self) -> str:
        return settings.IWENCAI_API_KEY

    @property
    def base_url(self) -> str:
        return settings.IWENCAI_BASE_URL.rstrip("/")

    def is_available(self) -> bool:
        if self._available is not None:
            return self._available
        if not settings.IWENCAI_ENABLED:
            self._available = False
            return False
        if not self.api_key:
            logger.info("IWENCAI_API_KEY not configured, iwencai news disabled")
            self._available = False
            return False
        self._available = True
        return True

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient(timeout=30.0)
        return self._client

    async def close(self) -> None:
        if self._client:
            await self._client.aclose()
            self._client = None

    def _build_headers(self) -> Dict[str, str]:
        trace_id = secrets.token_hex(32)
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
            "X-Claw-Call-Type": "normal",
            "X-Claw-Skill-Id": IWENCAI_SKILL_ID,
            "X-Claw-Skill-Version": IWENCAI_SKILL_VERSION,
            "X-Claw-Plugin-Id": "none",
            "X-Claw-Plugin-Version": "none",
            "X-Claw-Trace-Id": trace_id,
        }

    async def search_news(
        self, query: str, limit: int = 50
    ) -> List[Dict[str, Any]]:
        """
        搜索财经新闻

        Args:
            query: 搜索关键词（股票代码、公司名、行业等）
            limit: 最大返回条数

        Returns:
            标准化新闻列表
        """
        if not self.is_available():
            return []

        client = await self._get_client()
        url = f"{self.base_url}/v1/comprehensive/search"

        try:
            response = await client.post(
                url,
                headers=self._build_headers(),
                json={
                    "channels": ["news"],
                    "app_id": "AIME_SKILL",
                    "query": query,
                },
            )
            response.raise_for_status()
            data = response.json()

            # 透传API响应，不做二次加工
            news_items = self._parse_response(data, query, limit)
            return news_items[:limit]

        except httpx.HTTPStatusError as e:
            logger.error(f"iwencai API HTTP {e.response.status_code}: {e}")
            return []
        except httpx.RequestError as e:
            logger.error(f"iwencai API request failed: {e}")
            return []
        except Exception as e:
            logger.error(f"iwencai search failed: {e}")
            return []

    def _parse_response(
        self, data: Any, query: str, limit: int
    ) -> List[Dict[str, Any]]:
        """解析问财API响应为标准化新闻格式"""
        items: List[Dict[str, Any]] = []

        # 问财API返回格式: {"status_code":0, "data": [{...}, ...]}
        results = []
        if isinstance(data, dict):
            results = data.get("data", [])
        if isinstance(data, list):
            results = data
        if not isinstance(results, list):
            return []

        for item in results:
            if not isinstance(item, dict):
                continue
            extra = item.get("extra", {}) if isinstance(item.get("extra"), dict) else {}
            items.append({
                "title": item.get("title", ""),
                "content": item.get("summary", ""),
                "summary": item.get("summary", ""),
                "url": item.get("url", ""),
                "source": extra.get("publish_source", "同花顺问财"),
                "publish_time": item.get("publish_date", ""),
                "data_source": "iwencai",
                "query": query,
            })

        return items

    async def get_stock_news(
        self,
        symbol: str,
        limit: int = 50,
        hours_back: int = 24,
    ) -> List[Dict[str, Any]]:
        """
        获取单只股票相关新闻（兼容统一接口）

        Args:
            symbol: 股票代码
            limit: 最大条数
            hours_back: 回溯小时（问财API暂不支持，由调用方过滤）
        """
        # 搜索股票代码 + 公司名相关新闻
        queries = [symbol]
        if len(symbol) == 6 and symbol.startswith(("60", "00")):
            queries.append(symbol)  # 重复搜索确保覆盖面

        all_news: List[Dict[str, Any]] = []
        for q in queries:
            news = await self.search_news(q, limit=limit)
            all_news.extend(news)

        # 去重
        seen = set()
        unique = []
        for n in all_news:
            key = n.get("url") or n.get("title", "")
            if key and key not in seen:
                seen.add(key)
                unique.append(n)

        return unique[:limit]

    async def search_company_news(
        self, company_name: str, limit: int = 50
    ) -> List[Dict[str, Any]]:
        """按公司名搜索新闻"""
        return await self.search_news(company_name, limit=limit)

    async def search_industry_news(
        self, industry: str, limit: int = 50
    ) -> List[Dict[str, Any]]:
        """按行业搜索新闻"""
        return await self.search_news(industry, limit=limit)


# 单例
_iwencai_provider: Optional[IwencaiNewsProvider] = None


async def get_iwencai_provider() -> IwencaiNewsProvider:
    global _iwencai_provider
    if _iwencai_provider is None:
        _iwencai_provider = IwencaiNewsProvider()
    return _iwencai_provider
