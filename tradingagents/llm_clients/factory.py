from typing import Optional

from .base_client import BaseLLMClient
from .provider_keys import normalize_provider_key


_OPENAI_COMPATIBLE = {
    "openai",
    "deepseek",
    "qwen",
    "glm",
    "qianfan",
    "ollama",
    "custom_openai",
}


def create_llm_client(
    provider: str,
    model: str,
    base_url: Optional[str] = None,
    **kwargs,
) -> BaseLLMClient:
    provider_lower = normalize_provider_key(provider)

    if provider_lower in _OPENAI_COMPATIBLE:
        from .openai_client import OpenAIClient

        return OpenAIClient(model, base_url, provider=provider_lower, **kwargs)

    raise ValueError(f"Unsupported LLM provider: {provider}")
