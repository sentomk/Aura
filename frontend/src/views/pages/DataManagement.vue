<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { sync, type DataSourceStatus, type SyncStatus, type SyncHistoryRecord } from '../../api';

const sources = ref<DataSourceStatus[]>([]);
const syncStatus = ref<SyncStatus | null>(null);
const history = ref<SyncHistoryRecord[]>([]);
const historyTotal = ref(0);
const loading = ref(false);
const syncing = ref(false);
const syncingQuotes = ref(false);
const message = ref('');
const messageType = ref<'success' | 'error'>('success');

const availableSources = computed(() => sources.value.filter((s) => s.available));
const unavailableSources = computed(() => sources.value.filter((s) => !s.available));

async function loadAll() {
  loading.value = true;
  try {
    const [srcRes, statusRes, histRes] = await Promise.all([
      sync.sourcesStatus().catch(() => null),
      sync.getStatus().catch(() => null),
      sync.getHistory({ page_size: '5' }).catch(() => null),
    ]);
    if (srcRes?.data) sources.value = srcRes.data;
    if (statusRes?.data) syncStatus.value = statusRes.data;
    if (histRes?.data) {
      history.value = histRes.data.records || [];
      historyTotal.value = histRes.data.total || 0;
    }
  } finally {
    loading.value = false;
  }
}

async function runSync() {
  syncing.value = true;
  message.value = '';
  try {
    const res = await sync.runStockBasics(true);
    syncStatus.value = res.data;
    showMessage('success', `基础数据同步完成: ${res.message}`);
    await loadAll();
    await runQuotesSync();
  } catch (e: any) {
    showMessage('error', e.message || '基础数据同步失败');
  } finally {
    syncing.value = false;
  }
}

async function runQuotesSync() {
  syncingQuotes.value = true;
  try {
    const res = await sync.runQuotes();
    showMessage('success', `行情同步完成: ${res.message}`);
    await loadAll();
  } catch (e: any) {
    showMessage('error', e.message || '行情同步失败');
  } finally {
    syncingQuotes.value = false;
  }
}

function showMessage(type: 'success' | 'error', msg: string) {
  messageType.value = type;
  message.value = msg;
}

function formatDate(s?: string): string {
  if (!s) return '-';
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString('zh-CN');
}

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    success: '成功',
    failed: '失败',
    running: '运行中',
    idle: '空闲',
    success_with_errors: '部分成功',
  };
  return map[s] || s;
}

onMounted(loadAll);
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2>数据管理</h2>
        <p class="page-subtitle">管理股票基础数据与行情同步，查看数据源状态与同步记录。</p>
      </div>
      <div class="page-actions">
        <button class="btn-primary" :disabled="syncing" @click="runSync">
          {{ syncing ? '同步中...' : '同步股票基础数据' }}
        </button>
        <button class="btn-secondary" :disabled="syncingQuotes" @click="runQuotesSync">
          {{ syncingQuotes ? '同步中...' : '同步行情数据' }}
        </button>
      </div>
    </div>

    <p v-if="message" :class="['message', messageType]">{{ message }}</p>

    <!-- Data Sources -->
    <div class="section">
      <h3>数据源状态</h3>
      <div v-if="loading && sources.length === 0" class="empty-sm">加载中...</div>
      <div v-else class="source-grid">
        <div
          v-for="s in sources"
          :key="s.name"
          :class="['source-card', { available: s.available, unavailable: !s.available }]"
        >
          <div class="source-head">
            <span class="source-name">{{ s.name }}</span>
            <span :class="['source-badge', s.available ? 'badge-on' : 'badge-off']">
              {{ s.available ? '可用' : '不可用' }}
            </span>
          </div>
          <p class="source-desc">{{ s.description }}</p>
          <p class="source-priority">优先级: {{ s.priority }}</p>
        </div>
      </div>
    </div>

    <!-- Sync Status -->
    <div v-if="syncStatus" class="section">
      <h3>同步状态</h3>
      <div class="status-grid">
        <div class="stat">
          <span class="stat-label">状态</span>
          <span :class="['stat-value', syncStatus.status]">{{ statusLabel(syncStatus.status) }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">已新增</span>
          <span class="stat-value">{{ syncStatus.inserted ?? '-' }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">已更新</span>
          <span class="stat-value">{{ syncStatus.updated ?? '-' }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">总数</span>
          <span class="stat-value">{{ syncStatus.total ?? '-' }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">错误数</span>
          <span class="stat-value">{{ syncStatus.errors ?? '-' }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">开始时间</span>
          <span class="stat-value">{{ formatDate(syncStatus.started_at) }}</span>
        </div>
        <div class="stat">
          <span class="stat-label">结束时间</span>
          <span class="stat-value">{{ formatDate(syncStatus.finished_at) }}</span>
        </div>
      </div>
      <p v-if="syncStatus.message" class="status-msg">{{ syncStatus.message }}</p>
    </div>

    <!-- Sync History -->
    <div v-if="history.length > 0" class="section">
      <h3>同步记录</h3>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>状态</th>
              <th>新增/更新/总数</th>
              <th>开始</th>
              <th>结束</th>
              <th>备注</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="h in history" :key="h.started_at || h.finished_at">
              <td>
                <span :class="['sync-badge', h.status]">{{ statusLabel(h.status) }}</span>
              </td>
              <td>{{ h.inserted ?? '-' }} / {{ h.updated ?? '-' }} / {{ h.total ?? '-' }}</td>
              <td>{{ formatDate(h.started_at) }}</td>
              <td>{{ formatDate(h.finished_at) }}</td>
              <td class="msg-cell">{{ h.message || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="historyTotal > history.length" class="hint">
        显示最近 {{ history.length }} 条，共 {{ historyTotal }} 条记录
      </p>
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
.btn-primary:hover { background: #1a1818; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.page-actions { display: flex; gap: 12px; }
.btn-secondary {
  padding: 12px 26px;
  border-radius: 6px;
  border: 1px solid #d4cfc4;
  background: #ffffff;
  color: #2c2a29;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
  font-family: inherit;
  white-space: nowrap;
}
.btn-secondary:hover { background: #f7f5f0; }
.btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }
.message {
  margin: 0 0 20px;
  font-size: 14px;
}
.success { color: #2d7a4d; }
.error { color: #c43228; }

.section {
  background: #ffffff;
  border: 1px solid #e8e4db;
  border-radius: 8px;
  padding: 28px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.02);
}
.section h3 {
  margin: 0 0 20px;
  font-size: 17px;
  font-weight: 600;
  color: #2c2a29;
}
.empty-sm {
  color: #8c8780;
  font-size: 14px;
  padding: 24px 0;
  text-align: center;
}

/* Source cards */
.source-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 12px;
}
.source-card {
  border: 1px solid #e8e4db;
  border-radius: 8px;
  padding: 18px;
}
.source-card.available { border-left: 3px solid #2d7a4d; }
.source-card.unavailable { border-left: 3px solid #c43228; opacity: 0.7; }
.source-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.source-name {
  font-size: 15px;
  font-weight: 600;
  color: #2c2a29;
  text-transform: capitalize;
}
.source-badge {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
}
.badge-on { background: #e8f0e4; color: #2d7a4d; }
.badge-off { background: #f7e8e6; color: #c43228; }
.source-desc {
  font-size: 13px;
  color: #6f6a63;
  margin: 0 0 6px;
  line-height: 1.4;
}
.source-priority {
  font-size: 12px;
  color: #8c8780;
  margin: 0;
}

/* Status grid */
.status-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 16px;
}
.stat {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.stat-label {
  font-size: 13px;
  color: #8c8780;
}
.stat-value {
  font-size: 15px;
  font-weight: 600;
  color: #2c2a29;
}
.stat-value.running { color: #b8860b; }
.stat-value.success { color: #2d7a4d; }
.stat-value.failed { color: #c43228; }
.stat-value.success_with_errors { color: #b8860b; }
.status-msg {
  margin: 16px 0 0;
  font-size: 13px;
  color: #6f6a63;
}

/* History table */
.table-wrap {
  overflow: auto;
}
.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}
.table th {
  text-align: left;
  padding: 12px 14px;
  color: #5c5855;
  font-weight: 600;
  border-bottom: 1px solid #e8e4db;
  background: #fdfcf9;
  white-space: nowrap;
}
.table td {
  padding: 12px 14px;
  border-bottom: 1px solid #e8e4db;
  color: #2c2a29;
}
.table tbody tr:last-child td { border-bottom: none; }
.msg-cell {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sync-badge {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
}
.sync-badge.success { background: #e8f0e4; color: #2d7a4d; }
.sync-badge.failed { background: #f7e8e6; color: #c43228; }
.sync-badge.running { background: #fef3d6; color: #b8860b; }
.sync-badge.success_with_errors { background: #fef3d6; color: #b8860b; }
.hint {
  margin: 16px 0 0;
  font-size: 13px;
  color: #8c8780;
}
</style>
