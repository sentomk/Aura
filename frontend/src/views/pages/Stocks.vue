<script setup lang="ts">
import { computed, ref } from 'vue';
import { screening, type ScreeningCondition, type ScreeningResultItem } from '../../api';
import { useAnalysisStore } from '../../stores/analysis';

type StrategyKey = 'steady' | 'active' | 'large';

interface Strategy {
  key: StrategyKey;
  name: string;
  description: string;
  conditions: ScreeningCondition[];
  order_by: Array<{ field: string; direction: 'asc' | 'desc' }>;
}

const strategies: Strategy[] = [
  {
    key: 'steady',
    name: '价格稳健',
    description: '用当前已有行情数据筛选价格不高、跌幅有限的候选股。',
    conditions: [
      { field: 'close', operator: 'between', value: [1, 20], field_type: 'fundamental' },
      { field: 'pct_chg', operator: '>=', value: -5, field_type: 'fundamental' },
    ],
    order_by: [{ field: 'volume', direction: 'desc' }],
  },
  {
    key: 'active',
    name: '活跃强势',
    description: '按最新行情的涨跌幅排序，优先查看近期表现更强的标的。',
    conditions: [
      { field: 'pct_chg', operator: '>=', value: -10, field_type: 'fundamental' },
    ],
    order_by: [{ field: 'pct_chg', direction: 'desc' }],
  },
  {
    key: 'large',
    name: '成交活跃',
    description: '按成交量排序，适合从本地已有行情中找交易更活跃的股票。',
    conditions: [
      { field: 'volume', operator: '>=', value: 0, field_type: 'fundamental' },
    ],
    order_by: [{ field: 'volume', direction: 'desc' }],
  },
];

const store = useAnalysisStore();
const selectedStrategy = ref<StrategyKey>('steady');
const limit = ref(30);
const loading = ref(false);
const error = ref('');
const items = ref<ScreeningResultItem[]>([]);
const total = ref(0);
const tookMs = ref<number | undefined>();
const source = ref('');
const analysisMessage = ref('');

const currentStrategy = computed(() => strategies.find((s) => s.key === selectedStrategy.value) || strategies[0]);

function stockCode(item: ScreeningResultItem): string {
  const raw = item.code || item.symbol || item.ts_code || '';
  return String(raw).replace(/\.(SZ|SH|BJ)$/i, '').padStart(6, '0');
}

function formatNumber(value: unknown, digits = 2): string {
  if (value === undefined || value === null || value === '') return '-';
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return n.toFixed(digits);
}

function formatMoney(value: unknown): string {
  if (value === undefined || value === null || value === '') return '-';
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  if (Math.abs(n) >= 10000) return `${(n / 10000).toFixed(2)}万亿`;
  return `${n.toFixed(2)}亿`;
}

async function runScreening() {
  loading.value = true;
  error.value = '';
  analysisMessage.value = '';
  try {
    const res = await screening.enhanced({
      market: 'CN',
      adj: 'qfq',
      conditions: currentStrategy.value.conditions,
      order_by: currentStrategy.value.order_by,
      limit: limit.value,
      offset: 0,
      use_database_optimization: true,
    });
    items.value = res.data.items || [];
    total.value = res.data.total || 0;
    tookMs.value = res.data.took_ms;
    source.value = res.data.source || '';
  } catch (e: any) {
    error.value = e.message || '筛选失败';
    items.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

function startAnalysis(item: ScreeningResultItem) {
  const code = stockCode(item);
  if (!code) return;
  store.submit(code, {
    market_type: 'A股',
    research_depth: '标准',
    selected_analysts: ['market', 'fundamentals', 'news', 'social'],
  });
  analysisMessage.value = `${code} 已提交标准分析`;
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2>选股推荐</h2>
        <p class="page-subtitle">基于后端股票筛选接口生成候选池，再按需进入单股分析。</p>
      </div>
      <button class="btn-primary" :disabled="loading" @click="runScreening">
        {{ loading ? '筛选中...' : '运行筛选' }}
      </button>
    </div>

    <div class="strategy-panel">
      <button
        v-for="s in strategies"
        :key="s.key"
        :class="['strategy-btn', { active: selectedStrategy === s.key }]"
        @click="selectedStrategy = s.key"
      >
        <span class="strategy-name">{{ s.name }}</span>
        <span class="strategy-desc">{{ s.description }}</span>
      </button>
    </div>

    <div class="toolbar">
      <div class="field">
        <label>返回数量</label>
        <select v-model.number="limit" class="input">
          <option :value="20">20</option>
          <option :value="30">30</option>
          <option :value="50">50</option>
          <option :value="100">100</option>
        </select>
      </div>
      <div class="meta">
        <span>匹配 {{ total }} 只</span>
        <span v-if="tookMs !== undefined">耗时 {{ tookMs }}ms</span>
        <span v-if="source">来源 {{ source }}</span>
      </div>
    </div>

    <p v-if="error" class="message error">{{ error }}</p>
    <p v-if="analysisMessage" class="message success">{{ analysisMessage }}</p>

    <div v-if="loading" class="empty">正在筛选股票...</div>
    <div v-else-if="items.length === 0" class="empty">暂无筛选结果，请选择策略后运行筛选</div>
    <div v-else class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th>代码</th>
            <th>名称</th>
            <th>来源</th>
            <th>成交量</th>
            <th>成交额</th>
            <th>PE</th>
            <th>PB</th>
            <th>ROE</th>
            <th>涨跌幅</th>
            <th>收盘价</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in items" :key="stockCode(item)">
            <td class="mono">{{ stockCode(item) }}</td>
            <td>{{ item.name || '-' }}</td>
            <td>{{ item.source || '-' }}</td>
            <td>{{ formatNumber(item.volume, 0) }}</td>
            <td>{{ formatMoney(item.amount) }}</td>
            <td>{{ formatNumber(item.pe) }}</td>
            <td>{{ formatNumber(item.pb) }}</td>
            <td>{{ formatNumber(item.roe) }}</td>
            <td :class="{ red: Number(item.pct_chg) > 0, green: Number(item.pct_chg) < 0 }">
              {{ formatNumber(item.pct_chg) }}%
            </td>
            <td>{{ formatNumber(item.close) }}</td>
            <td class="action-cell">
              <button class="btn-sm" @click="startAnalysis(item)">分析</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.page h2 {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  color: #1a1818;
}
.page-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 24px;
  margin-bottom: 28px;
}
.page-subtitle {
  margin: 8px 0 0;
  color: #6f6a63;
  font-size: 14px;
}
.strategy-panel {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
  margin-bottom: 24px;
}
.strategy-btn {
  text-align: left;
  border: 1px solid #e8e4db;
  background: #ffffff;
  border-radius: 8px;
  padding: 18px;
  cursor: pointer;
  font-family: inherit;
  transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
}
.strategy-btn:hover {
  border-color: #c9c3ac;
}
.strategy-btn.active {
  border-color: #8a8270;
  background: #f7f5f0;
  box-shadow: 0 2px 10px rgba(0,0,0,0.03);
}
.strategy-name {
  display: block;
  color: #1a1818;
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 8px;
}
.strategy-desc {
  display: block;
  color: #6f6a63;
  font-size: 13px;
  line-height: 1.5;
}
.toolbar {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 16px;
}
.field label {
  display: block;
  color: #5c5855;
  font-size: 13px;
  margin-bottom: 6px;
}
.input {
  width: 140px;
  padding: 10px 14px;
  border-radius: 6px;
  border: 1px solid #d5d0c5;
  background: #ffffff;
  color: #2c2a29;
  font-size: 14px;
  outline: none;
  font-family: inherit;
}
.meta {
  display: flex;
  gap: 14px;
  color: #8c8780;
  font-size: 13px;
}
.btn-primary {
  padding: 12px 26px;
  border-radius: 6px;
  border: none;
  background: #2c2a29;
  color: #ffffff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
  font-family: inherit;
  white-space: nowrap;
}
.btn-primary:hover {
  background: #1a1818;
}
.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.message {
  margin: 0 0 14px;
  font-size: 14px;
}
.error {
  color: #c43228;
}
.success {
  color: #2d7a4d;
}
.empty {
  color: #8c8780;
  font-size: 15px;
  text-align: center;
  padding: 64px 0;
  background: #ffffff;
  border-radius: 8px;
  border: 1px solid #e8e4db;
}
.table-wrap {
  background: #ffffff;
  border: 1px solid #e8e4db;
  border-radius: 8px;
  overflow: auto;
  box-shadow: 0 2px 8px rgba(0,0,0,0.02);
}
.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
  min-width: 980px;
}
.table th {
  text-align: left;
  padding: 14px 16px;
  color: #5c5855;
  font-weight: 600;
  border-bottom: 1px solid #e8e4db;
  background: #fdfcf9;
  white-space: nowrap;
}
.table td {
  padding: 14px 16px;
  border-bottom: 1px solid #e8e4db;
  color: #2c2a29;
  white-space: nowrap;
}
.table tbody tr:last-child td {
  border-bottom: none;
}
.table tbody tr:hover {
  background: #fdfcf9;
}
.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-weight: 600;
}
.red {
  color: #c43228;
}
.green {
  color: #2d7a4d;
}
.action-cell {
  text-align: right;
}
.btn-sm {
  padding: 6px 12px;
  border-radius: 4px;
  border: 1px solid #d5d0c5;
  background: #fdfcf9;
  color: #2c2a29;
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
}
.btn-sm:hover {
  border-color: #2c2a29;
}
@media (max-width: 760px) {
  .page-head,
  .toolbar {
    flex-direction: column;
    align-items: stretch;
  }
  .meta {
    flex-wrap: wrap;
  }
}
</style>
