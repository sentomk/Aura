<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useAnalysisStore, reportNav, type TaskState } from '../../stores/analysis';
import { reports, type ReportItem } from '../../api';
import MarkdownRenderer from '../../components/MarkdownRenderer.vue';

const store = useAnalysisStore();

const reportList = ref<ReportItem[]>([]);
const total = ref(0);
const page = ref(1);
const loading = ref(false);
const error = ref('');

async function loadReports() {
  loading.value = true;
  error.value = '';
  try {
    const res = await reports.list({ page: page.value, page_size: 20 });
    reportList.value = res.data.reports;
    total.value = res.data.total;
  } catch (e: any) {
    error.value = e.message || '加载失败';
  } finally {
    loading.value = false;
  }
}

onMounted(loadReports);

// ---- merged list: store tasks + API reports ----
function allCompleted(): (TaskState | ReportItem)[] {
  const storeItems = store.completedTasks().map(t => ({ ...t, _source: 'store' as const }));
  const apiItems = reportList.value.map(r => ({ ...r, _source: 'api' as const }));
  // dedupe by taskId / analysis_id
  const seen = new Set<string>();
  const merged: (TaskState | ReportItem)[] = [];
  for (const item of [...storeItems, ...apiItems]) {
    const id = (item as any).taskId || (item as any).analysis_id || (item as any).id;
    if (seen.has(id)) continue;
    seen.add(id);
    merged.push(item);
  }
  merged.sort((a: any, b: any) => {
    const da = toTimestamp(a.createdAt || a.created_at);
    const db = toTimestamp(b.createdAt || b.created_at);
    return db - da;
  });
  return merged;
}

function toTimestamp(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
  }
  return 0;
}

// ---- detail ----
const selectedId = ref('');
const viewingStoreTask = ref(false);
const reportDetail = ref<any>(null);
const loadingDetail = ref(false);
const detailError = ref('');

function isStoreItem(item: any): item is TaskState & { _source: 'store' } {
  return item._source === 'store';
}

async function viewItem(item: any) {
  selectedId.value = (item as any).taskId || (item as any).analysis_id || (item as any).id;

  if (isStoreItem(item)) {
    viewingStoreTask.value = true;
    reportDetail.value = item.result;
    if (!reportDetail.value) {
      loadingDetail.value = true;
      try {
        await store.fetchResult(item.taskId);
        reportDetail.value = item.result;
      } catch {
        detailError.value = '加载结果失败';
      } finally {
        loadingDetail.value = false;
      }
    }
  } else {
    viewingStoreTask.value = false;
    loadingDetail.value = true;
    detailError.value = '';
    try {
      const res = await reports.detail((item as ReportItem).analysis_id || (item as ReportItem).id);
      reportDetail.value = res.data;
    } catch (e: any) {
      detailError.value = e.message || '获取报告详情失败';
    } finally {
      loadingDetail.value = false;
    }
  }
}

function backToList() {
  selectedId.value = '';
  reportDetail.value = null;
  viewingStoreTask.value = false;
  detailError.value = '';
}

// Open from analysis nav
watch(() => reportNav.taskId, (id) => {
  if (!id) return;
  const task = store.getTask(id);
  if (task && task.status === 'completed') {
    selectedId.value = id;
    viewingStoreTask.value = true;
    reportDetail.value = task.result;
    reportNav.taskId = '';
  }
}, { immediate: true });

// ---- report sections ----
const reportSections = [
  { key: 'market_report', label: '市场分析' },
  { key: 'fundamentals_report', label: '基本面分析' },
  { key: 'sentiment_report', label: '情绪分析' },
  { key: 'news_report', label: '新闻分析' },
  { key: 'investment_plan', label: '投资计划' },
  { key: 'final_trade_decision', label: '交易决策' },
];

const activeSection = ref('');

function openSection(key: string) {
  activeSection.value = key;
}

function reportLabel(key: string): string {
  const found = reportSections.find((s) => s.key === key);
  return found ? found.label : key;
}
</script>

<template>
  <div class="page">
    <h2>分析报告</h2>

    <!-- List -->
    <div v-if="!selectedId">
      <p v-if="error" class="error">{{ error }}</p>

      <div v-if="allCompleted().length === 0 && !loading" class="empty">
        <p>暂无分析报告</p>
        <p class="hint">在"股票分析"页面提交分析后，完成的报告将显示在这里</p>
      </div>

      <div v-else class="report-list">
        <div
          v-for="item in allCompleted()"
          :key="(item as any).taskId || (item as any).id"
          class="report-item"
          @click="viewItem(item)"
        >
          <div class="report-main">
            <span class="report-title">
              {{ (item as any).stockName || (item as any).stock_name || (item as any).stockCode || (item as any).stock_code }}
            </span>
            <span class="report-badge">{{ (item as any).marketType || (item as any).market_type || '-' }}</span>
            <span class="report-depth">{{ (item as any).researchDepth || (item as any).research_depth || '-' }}分析</span>
          </div>
          <div class="report-meta">
            <span>{{ (item as any).createdAt ? new Date((item as any).createdAt).toLocaleString() : (item as any).created_at?.slice(0, 16) || '' }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Detail -->
    <div v-else>
      <button class="btn-back" @click="backToList">← 返回列表</button>

      <div v-if="loadingDetail" class="loading">加载中...</div>
      <p v-if="detailError" class="error">{{ detailError }}</p>

      <div v-else-if="reportDetail" class="detail-root">
        <!-- Header -->
        <div class="detail-header">
          <h3>{{ reportDetail.stock_name || reportDetail.stock_symbol || reportDetail.stock_code }} 分析报告</h3>
        </div>

        <!-- Decision -->
        <div v-if="reportDetail.decision && reportDetail.decision.action" class="decision-card">
          <div class="decision-action">
            {{ reportDetail.decision.action === 'buy' ? '买入' : reportDetail.decision.action === 'sell' ? '卖出' : '持有' }}
          </div>
          <div v-if="reportDetail.decision.target_price || reportDetail.decision.confidence !== undefined" class="decision-meta">
            <span v-if="reportDetail.decision.target_price">目标价: {{ reportDetail.decision.target_price }}</span>
            <span v-if="reportDetail.decision.confidence !== undefined">置信度: {{ (reportDetail.decision.confidence * 100).toFixed(0) }}%</span>
          </div>
        </div>

        <!-- Stats -->
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">风险等级</div>
            <div class="stat-value">{{ reportDetail.risk_level || '-' }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">置信度</div>
            <div class="stat-value">{{ reportDetail.confidence_score ? (reportDetail.confidence_score * 100).toFixed(0) + '%' : '-' }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">研究深度</div>
            <div class="stat-value">{{ reportDetail.research_depth || '-' }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Token 消耗</div>
            <div class="stat-value">{{ reportDetail.tokens_used?.toLocaleString() || 0 }}</div>
          </div>
        </div>

        <!-- Summary -->
        <div v-if="reportDetail.summary" class="info-card">
          <h4>分析摘要</h4>
          <MarkdownRenderer :content="reportDetail.summary" />
        </div>

        <!-- Recommendation -->
        <div v-if="reportDetail.recommendation" class="info-card">
          <h4>投资建议</h4>
          <MarkdownRenderer :content="reportDetail.recommendation" />
        </div>

        <!-- Key points -->
        <div v-if="reportDetail.key_points && reportDetail.key_points.length" class="info-card">
          <h4>关键要点</h4>
          <ul>
            <li v-for="(pt, i) in reportDetail.key_points" :key="i">{{ pt }}</li>
          </ul>
        </div>

        <!-- Detailed reports -->
        <div v-if="reportDetail.reports && Object.keys(reportDetail.reports).length" class="reports-block">
          <h4>详细报告</h4>
          <div class="report-tabs">
            <button
              v-for="key in Object.keys(reportDetail.reports)"
              :key="key"
              :class="['report-tab', { active: activeSection === key }]"
              @click="openSection(key)"
            >
              {{ reportLabel(key) }}
            </button>
          </div>
          <div v-if="activeSection && reportDetail.reports[activeSection]" class="report-body">
            <MarkdownRenderer :content="reportDetail.reports[activeSection]" />
          </div>
          <div v-else class="report-body report-body-hint">
            请选择一个报告章节查看
          </div>
        </div>

        <!-- Detailed analysis fallback -->
        <div v-if="reportDetail.detailed_analysis && !reportDetail.reports" class="reports-block">
          <h4>详细分析</h4>
          <div class="report-body">
            <MarkdownRenderer :content="typeof reportDetail.detailed_analysis === 'string' ? reportDetail.detailed_analysis : JSON.stringify(reportDetail.detailed_analysis, null, 2)" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page h2 {
  margin: 0 0 32px;
  font-size: 28px;
  font-weight: 700;
  color: #1a1818;
}

.error { color: #c43228; font-size: 14px; margin: 0 0 16px; }
.loading { color: #8c8780; font-size: 15px; }
.empty { padding: 48px 0; text-align: center; color: #8c8780; }
.empty p { margin: 8px 0; }
.empty .hint { font-size: 14px; color: #b8b2a6; }

/* ---- List ---- */
.report-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.report-item {
  background: #ffffff;
  border-radius: 8px;
  padding: 20px 24px;
  border: 1px solid #e8e4db;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.report-item:hover {
  border-color: #8a8270;
  box-shadow: 0 2px 12px rgba(0,0,0,0.04);
}
.report-main {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}
.report-title {
  font-size: 16px;
  font-weight: 600;
  color: #2c2a29;
}
.report-badge {
  padding: 2px 8px;
  border-radius: 4px;
  background: #edeae0;
  font-size: 12px;
  color: #5c5855;
}
.report-depth {
  padding: 2px 8px;
  border-radius: 4px;
  background: #f7f5f0;
  font-size: 12px;
  color: #8c8780;
}
.report-meta {
  display: flex;
  gap: 20px;
  font-size: 13px;
  color: #8c8780;
}

/* ---- Detail ---- */
.btn-back {
  padding: 8px 0;
  margin-bottom: 24px;
  border: none;
  background: transparent;
  color: #5c5855;
  font-size: 15px;
  cursor: pointer;
  font-family: inherit;
}
.btn-back:hover { color: #2c2a29; }

.detail-root {
  max-width: 960px;
}

.detail-header h3 {
  font-size: 22px;
  font-weight: 700;
  color: #1a1818;
  margin: 0 0 24px;
}

/* ---- Decision ---- */
.decision-card {
  background: #2c2a29;
  border-radius: 8px;
  padding: 28px 32px;
  margin-bottom: 24px;
}
.decision-action {
  font-size: 24px;
  font-weight: 700;
  color: #ffffff;
  margin-bottom: 12px;
}
.decision-meta {
  display: flex;
  gap: 24px;
  color: #c9c3ac;
  font-size: 14px;
}

/* ---- Stats ---- */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}
.stat-card {
  background: #ffffff;
  border-radius: 8px;
  padding: 20px;
  border: 1px solid #e8e4db;
  text-align: center;
}
.stat-label {
  font-size: 13px;
  color: #8c8780;
  margin-bottom: 8px;
}
.stat-value {
  font-size: 20px;
  font-weight: 600;
  color: #2c2a29;
}

/* ---- Info cards ---- */
.info-card {
  background: #ffffff;
  border-radius: 8px;
  padding: 24px;
  border: 1px solid #e8e4db;
  margin-bottom: 24px;
}
.info-card h4 {
  font-size: 16px;
  font-weight: 600;
  color: #2c2a29;
  margin: 0 0 12px;
}
.info-card p {
  color: #5c5855;
  font-size: 15px;
  line-height: 1.7;
  white-space: pre-wrap;
}
.info-card ul {
  padding-left: 20px;
  color: #5c5855;
  font-size: 15px;
  line-height: 1.8;
}

/* ---- Reports ---- */
.reports-block h4 {
  font-size: 16px;
  font-weight: 600;
  color: #2c2a29;
  margin: 0 0 16px;
}
.report-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.report-tab {
  padding: 8px 16px;
  border-radius: 6px;
  border: 1px solid #d5d0c5;
  background: #fdfcf9;
  color: #5c5855;
  font-size: 14px;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s;
}
.report-tab:hover { border-color: #8a8270; color: #2c2a29; }
.report-tab.active {
  background: #2c2a29;
  color: #ffffff;
  border-color: #2c2a29;
}
.report-body {
  background: #ffffff;
  border-radius: 8px;
  padding: 32px;
  border: 1px solid #e8e4db;
  max-height: 560px;
  overflow-y: auto;
}
.report-body-hint {
  color: #8c8780;
  font-size: 15px;
  text-align: center;
  padding: 48px 32px;
}
</style>
