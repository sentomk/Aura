<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useAnalysisStore, type TaskState } from '../../stores/analysis';

const store = useAnalysisStore();

const stockCode = ref('');
const marketType = ref('A股');
const researchDepth = ref(3);
const submitting = ref(false);
const submitError = ref('');
const now = ref(Date.now());
let clockTimer: ReturnType<typeof setInterval> | null = null;

const activeTab = ref<'active' | 'completed' | 'failed'>('active');

const depthLabels: Record<number, string> = {
  1: '快速',
  2: '基础',
  3: '标准',
  4: '深度',
  5: '全面',
};

function countTasks(tab: 'active' | 'completed' | 'failed'): number {
  if (tab === 'active') return store.activeTasks().length;
  if (tab === 'completed') return store.completedTasks().length;
  return store.failedTasks().length;
}

function displayedTasks(): TaskState[] {
  switch (activeTab.value) {
    case 'active': return store.activeTasks();
    case 'completed': return store.completedTasks();
    case 'failed': return store.failedTasks();
  }
}

async function handleSubmit() {
  if (!stockCode.value) return;
  submitting.value = true;
  submitError.value = '';

  try {
    store.submit(stockCode.value, {
      market_type: marketType.value,
      research_depth: depthLabels[researchDepth.value],
      selected_analysts: ['market', 'fundamentals', 'news', 'social'],
    });
    stockCode.value = '';
  } catch (e: any) {
    submitError.value = e.message || '提交失败';
  } finally {
    submitting.value = false;
  }
}

function viewInReports(taskId: string) {
  store.viewReport(taskId);
}

function removeTask(taskId: string) {
  store.removeTask(taskId);
}

function retryTask(taskId: string) {
  store.resumeTask(taskId);
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    pending: '等待中',
    processing: '分析中',
    running: '分析中',
    submitting: '提交中',
    completed: '已完成',
    failed: '失败',
    cancelled: '已取消',
  };
  return map[status] || status;
}

function elapsed(task: TaskState): string {
  const endTime = task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled'
    ? task.endedAt || now.value
    : now.value;
  const sec = Math.max(0, Math.floor((endTime - task.createdAt) / 1000));
  if (sec < 60) return `${sec}秒`;
  const min = Math.floor(sec / 60);
  return `${min}分${sec % 60}秒`;
}

onMounted(() => {
  clockTimer = setInterval(() => {
    now.value = Date.now();
  }, 1000);
  store.loadTasks().catch((e: any) => {
    submitError.value = e.message || '加载任务列表失败';
  });
});

onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer);
});
</script>

<template>
  <div class="page">
    <h2>股票分析</h2>

    <!-- Form -->
    <div class="analysis-form">
      <div class="form-row">
        <div class="form-group">
          <label>市场</label>
          <select v-model="marketType" class="input">
            <option>A股</option>
            <option>港股</option>
            <option>美股</option>
          </select>
        </div>
        <div class="form-group">
          <label>股票代码</label>
          <input
            v-model="stockCode"
            class="input"
            placeholder="例: 000001 / AAPL / 00700"
            @keyup.enter="handleSubmit"
          />
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>研究深度</label>
          <select v-model.number="researchDepth" class="input">
            <option :value="1">1 - 快速概览 (2-4分钟)</option>
            <option :value="2">2 - 简要分析 (4-6分钟)</option>
            <option :value="3">3 - 标准分析 (6-10分钟)</option>
            <option :value="4">4 - 深度研究 (10-15分钟)</option>
            <option :value="5">5 - 全面分析 (15-25分钟)</option>
          </select>
        </div>
      </div>
      <button class="btn-primary" :disabled="submitting || !stockCode" @click="handleSubmit">
        {{ submitting ? '提交中...' : '开始分析' }}
      </button>
      <p v-if="submitError" class="error">{{ submitError }}</p>
    </div>

    <!-- Tabs -->
    <div class="task-tabs">
      <button
        v-for="tab in [
          { k: 'active' as const, label: '进行中' },
          { k: 'completed' as const, label: '已完成' },
          { k: 'failed' as const, label: '失败' },
        ]"
        :key="tab.k"
        :class="['tab-btn', { active: activeTab === tab.k }]"
        @click="activeTab = tab.k"
      >
        {{ tab.label }}
        <span class="tab-count">{{ countTasks(tab.k) }}</span>
      </button>
    </div>

    <!-- Task list -->
    <div v-if="displayedTasks().length === 0" class="empty-list">
      暂无{{ activeTab === 'active' ? '进行中的' : activeTab === 'completed' ? '已完成的' : '失败的' }}分析任务
    </div>

    <div v-else class="task-list">
      <div
        v-for="task in displayedTasks()"
        :key="task.taskId"
        :class="['task-card', { clickable: task.status === 'completed' }]"
        @click="task.status === 'completed' ? viewInReports(task.taskId) : undefined"
      >
        <div class="task-head">
          <div class="task-left">
            <span class="stock-badge">{{ task.stockCode }}</span>
            <span class="depth-badge">{{ task.researchDepth }}分析</span>
            <span :class="['status-badge', task.status]">{{ statusLabel(task.status) }}</span>
          </div>
          <div class="task-right">
            <span class="elapsed">{{ elapsed(task) }}</span>
            <button
              class="btn-icon"
              @click.stop="removeTask(task.taskId)"
              :title="task.status === 'completed' ? '删除' : '取消'"
            >×</button>
          </div>
        </div>
        <div class="progress-bar-track" v-if="task.status !== 'completed' && task.status !== 'failed'">
          <div class="progress-bar-fill" :style="{ width: task.progress + '%' }"></div>
        </div>
        <p class="task-msg" v-if="task.message">
          {{ task.message }}
          <span v-if="task.status !== 'completed' && task.status !== 'failed'" class="progress-pct">{{ task.progress }}%</span>
        </p>
        <div v-if="task.status === 'failed'" class="task-failed">
          <p class="task-msg error-msg">{{ task.error || '分析失败' }}</p>
          <button class="btn-retry" @click.stop="retryTask(task.taskId)">重试</button>
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

/* ---- Form ---- */
.analysis-form {
  background: #ffffff;
  border-radius: 8px;
  padding: 32px;
  border: 1px solid #e8e4db;
  max-width: 600px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.02);
  margin-bottom: 32px;
}
.form-row {
  display: flex;
  gap: 24px;
  margin-bottom: 24px;
}
.form-group {
  flex: 1;
}
.form-group label {
  display: block;
  font-size: 14px;
  color: #5c5855;
  margin-bottom: 8px;
  font-weight: 500;
}
.input {
  width: 100%;
  padding: 12px 16px;
  border-radius: 6px;
  border: 1px solid #d5d0c5;
  background: #fdfcf9;
  color: #2c2a29;
  font-size: 15px;
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.2s;
  font-family: inherit;
}
.input:focus { border-color: #8a8270; background: #ffffff; }
select.input {
  cursor: pointer;
  appearance: none;
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%235c5855' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
  background-repeat: no-repeat;
  background-position: right 12px center;
  background-size: 16px;
  padding-right: 40px;
}
.btn-primary {
  padding: 12px 32px;
  border-radius: 6px;
  border: none;
  background: #2c2a29;
  color: #ffffff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
  font-family: inherit;
  margin-top: 8px;
}
.btn-primary:hover { background: #1a1818; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.error {
  color: #c43228;
  font-size: 14px;
  margin: 16px 0 0;
}

/* ---- Tabs ---- */
.task-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 24px;
}
.tab-btn {
  padding: 8px 18px;
  border-radius: 6px;
  border: 1px solid #d5d0c5;
  background: #fdfcf9;
  color: #5c5855;
  font-size: 14px;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s;
}
.tab-btn:hover { border-color: #8a8270; color: #2c2a29; }
.tab-btn.active {
  background: #c9c3ac;
  color: #1a1818;
  border-color: #c9c3ac;
}
.tab-count {
  margin-left: 6px;
  font-size: 12px;
  opacity: 0.7;
}

/* ---- Empty ---- */
.empty-list {
  color: #8c8780;
  font-size: 15px;
  padding: 48px 0;
  text-align: center;
}

/* ---- Task cards ---- */
.task-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.task-card {
  background: #ffffff;
  border-radius: 8px;
  padding: 20px 24px;
  border: 1px solid #e8e4db;
  transition: border-color 0.2s, box-shadow 0.2s;
}
.task-card.clickable {
  cursor: pointer;
}
.task-card.clickable:hover {
  border-color: #8a8270;
  box-shadow: 0 2px 12px rgba(0,0,0,0.04);
}
.task-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.task-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.task-right {
  display: flex;
  align-items: center;
  gap: 10px;
}
.stock-badge {
  background: #edeae0;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 15px;
  font-weight: 600;
  color: #2c2a29;
}
.depth-badge {
  background: #f7f5f0;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 13px;
  color: #8c8780;
}
.status-badge {
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}
.status-badge.pending,
.status-badge.processing,
.status-badge.running,
.status-badge.submitting {
  background: #e8f0fe;
  color: #3c6eb4;
}
.status-badge.completed {
  background: #e6f4ea;
  color: #1e7e34;
}
.status-badge.failed,
.status-badge.cancelled {
  background: #fce8e6;
  color: #c43228;
}
.elapsed {
  font-size: 13px;
  color: #8c8780;
}
.btn-icon {
  border: none;
  background: none;
  color: #b0a89c;
  font-size: 18px;
  cursor: pointer;
  padding: 0 4px;
  line-height: 1;
}
.btn-icon:hover { color: #c43228; }
.progress-bar-track {
  height: 8px;
  border-radius: 4px;
  background: #edeae0;
  overflow: hidden;
  margin-top: 12px;
}
.progress-bar-fill {
  height: 100%;
  background: #2c2a29;
  border-radius: 4px;
  transition: width 0.3s ease;
}
.task-msg {
  font-size: 14px;
  color: #5c5855;
  margin: 10px 0 0;
}
.progress-pct {
  margin-left: 8px;
  font-size: 12px;
  color: #8c8780;
}
.task-failed {
  margin-top: 8px;
}
.error-msg {
  color: #c43228;
  margin: 0;
}
.btn-retry {
  margin-top: 8px;
  padding: 4px 14px;
  border-radius: 4px;
  border: 1px solid #d5d0c5;
  background: #fdfcf9;
  color: #5c5855;
  font-size: 13px;
  cursor: pointer;
  font-family: inherit;
}
.btn-retry:hover {
  border-color: #2c2a29;
  color: #2c2a29;
}
</style>
