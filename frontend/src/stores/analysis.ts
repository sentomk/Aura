import { reactive } from 'vue';
import { analysis, type AnalysisResult } from '../api';

export interface TaskState {
  taskId: string;
  stockCode: string;
  marketType: string;
  researchDepth: string;
  status: string;
  progress: number;
  message: string;
  error: string;
  result: AnalysisResult | null;
  createdAt: number;
  endedAt?: number;
}

interface StoreState {
  tasks: Record<string, TaskState>;
  pollers: Record<string, ReturnType<typeof setInterval>>;
}

const state = reactive<StoreState>({
  tasks: {},
  pollers: {},
});

function taskKey(taskId: string): string {
  return taskId;
}

export const reportNav = reactive({
  taskId: '',
});

export function useAnalysisStore() {
  function getTask(taskId: string): TaskState | undefined {
    return state.tasks[taskKey(taskId)];
  }

  function submit(stockCode: string, params: {
    market_type: string;
    research_depth: string;
    selected_analysts: string[];
  }): TaskState {
    const placeholder: TaskState = {
      taskId: '',
      stockCode,
      marketType: params.market_type,
      researchDepth: params.research_depth,
      status: 'submitting',
      progress: 0,
      message: '正在提交...',
      error: '',
      result: null,
      createdAt: Date.now(),
    };

    analysis.submit({ symbol: stockCode, parameters: params })
      .then((res) => {
        const data = res.data;
        const id = data.task_id;
        delete state.tasks['']; // remove placeholder
        const task: TaskState = {
          taskId: id,
          stockCode,
          marketType: params.market_type,
          researchDepth: params.research_depth,
          status: data.status || 'pending',
          progress: data.progress || 0,
          message: data.message || data.current_step || '任务已提交',
          error: '',
          result: null,
          createdAt: Date.now(),
          endedAt: undefined,
        };
        state.tasks[id] = task;
        startPolling(id);
      })
      .catch((e) => {
        delete state.tasks[''];
        // Store as failed placeholder
        const id = 'error-' + Date.now();
        state.tasks[id] = {
          ...placeholder,
          taskId: id,
          status: 'failed',
          message: '',
          error: e.message || '提交失败',
        };
      });

    state.tasks[''] = placeholder;
    return placeholder;
  }

  function startPolling(taskId: string) {
    if (state.pollers[taskId]) return;

    const poll = async () => {
      const task = state.tasks[taskId];
      if (!task) {
        stopPolling(taskId);
        return;
      }

      try {
        const res = await analysis.getStatus(taskId);
        const t = res.data;
        task.status = t.status;
        task.progress = t.progress || 0;
        task.message = t.message || t.current_step || '';

        if (t.status === 'completed') {
          task.endedAt = t.end_time ? new Date(t.end_time).getTime() : Date.now();
          stopPolling(taskId);
          await fetchResult(taskId);
        } else if (t.status === 'failed') {
          task.endedAt = t.end_time ? new Date(t.end_time).getTime() : Date.now();
          stopPolling(taskId);
          task.error = t.message || '分析失败';
        } else if (t.status === 'cancelled') {
          task.endedAt = t.end_time ? new Date(t.end_time).getTime() : Date.now();
          stopPolling(taskId);
          task.error = '分析已取消';
        }
      } catch {
        // keep polling on transient errors
      }
    };

    poll();
    state.pollers[taskId] = setInterval(poll, 2000);
  }

  async function loadTasks() {
    const res = await analysis.getTasks({ limit: 50 });
    for (const item of res.data.tasks) {
      const taskId = item.task_id;
      if (!taskId) continue;

      const existing = state.tasks[taskId];
      const startTime = item.start_time ? new Date(item.start_time).getTime() : Date.now();
      const endTime = item.end_time ? new Date(item.end_time).getTime() : undefined;
      const task: TaskState = existing || {
        taskId,
        stockCode: item.stock_code || item.stock_symbol || item.symbol || '',
        marketType: item.parameters?.market_type || '',
        researchDepth: item.parameters?.research_depth || '',
        status: item.status,
        progress: item.progress || 0,
        message: item.message || item.current_step || '',
        error: '',
        result: null,
        createdAt: Number.isFinite(startTime) ? startTime : Date.now(),
        endedAt: endTime && Number.isFinite(endTime) ? endTime : undefined,
      };

      task.stockCode = item.stock_code || item.stock_symbol || item.symbol || task.stockCode;
      task.marketType = item.parameters?.market_type || task.marketType;
      task.researchDepth = item.parameters?.research_depth || task.researchDepth;
      task.status = item.status;
      task.progress = item.progress || 0;
      task.message = item.message || item.current_step || task.message;
      task.endedAt = endTime && Number.isFinite(endTime) ? endTime : task.endedAt;
      if (item.status === 'failed') {
        task.error = item.message || '分析失败';
      }

      state.tasks[taskId] = task;

      if (item.status === 'pending' || item.status === 'processing' || item.status === 'running') {
        startPolling(taskId);
      }
    }
  }

  function stopPolling(taskId: string) {
    const timer = state.pollers[taskId];
    if (timer) {
      clearInterval(timer);
      delete state.pollers[taskId];
    }
  }

  async function fetchResult(taskId: string) {
    const task = state.tasks[taskId];
    if (!task) return;
    try {
      const res = await analysis.getResult(taskId);
      task.result = res.data;
    } catch (e: any) {
      task.error = e.message || '获取结果失败';
    }
  }

  function removeTask(taskId: string) {
    stopPolling(taskId);
    delete state.tasks[taskId];
  }

  function resumeTask(taskId: string) {
    const task = state.tasks[taskId];
    if (!task || (task.status !== 'pending' && task.status !== 'processing' && task.status !== 'running')) return;
    startPolling(taskId);
  }

  function validTasks(): TaskState[] {
    return Object.values(state.tasks).filter((t) => t.taskId !== '');
  }

  function activeTasks(): TaskState[] {
    return validTasks().filter(
      (t) =>
        t.status === 'pending' ||
        t.status === 'processing' ||
        t.status === 'running' ||
        t.status === 'submitting'
    ).sort((a, b) => b.createdAt - a.createdAt);
  }

  function completedTasks(): TaskState[] {
    return validTasks().filter(
      (t) => t.status === 'completed'
    ).sort((a, b) => b.createdAt - a.createdAt);
  }

  function failedTasks(): TaskState[] {
    return validTasks().filter(
      (t) => t.status === 'failed' || t.status === 'cancelled'
    ).sort((a, b) => b.createdAt - a.createdAt);
  }

  function viewReport(taskId: string) {
    reportNav.taskId = taskId;
  }

  function clearReportNav() {
    reportNav.taskId = '';
  }

  return {
    state,
    getTask,
    loadTasks,
    submit,
    startPolling,
    stopPolling,
    fetchResult,
    removeTask,
    resumeTask,
    activeTasks,
    completedTasks,
    failedTasks,
    viewReport,
    clearReportNav,
  };
}
