import { invoke } from '@tauri-apps/api/core';

const BACKEND_URL_STORAGE_KEY = 'aura_backend_url';
const DEFAULT_BACKEND_URL = 'http://localhost:8000';

let baseUrl: string | null = null;

async function getBaseUrl(): Promise<string> {
  if (baseUrl) return baseUrl;

  const saved = localStorage.getItem(BACKEND_URL_STORAGE_KEY);
  if (saved) {
    baseUrl = normalizeBackendUrl(saved);
    return baseUrl;
  }

  const envUrl = import.meta.env.VITE_AURA_BACKEND_URL;
  if (envUrl) {
    baseUrl = normalizeBackendUrl(envUrl);
    return baseUrl;
  }

  try {
    baseUrl = normalizeBackendUrl(await invoke<string>('get_backend_url'));
    return baseUrl;
  } catch {
    baseUrl = DEFAULT_BACKEND_URL;
    return baseUrl;
  }
}

export function normalizeBackendUrl(url: string): string {
  const normalized = url.trim().replace(/\/+$/, '');
  if (!normalized) {
    throw new Error('请输入后端地址');
  }
  if (!/^https?:\/\//i.test(normalized)) {
    throw new Error('后端地址必须以 http:// 或 https:// 开头');
  }
  return normalized;
}

function clearStoredAuth() {
  localStorage.removeItem('token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
}

export interface SetBaseUrlResult {
  url: string;
  changed: boolean;
}

export function setBaseUrl(url: string): SetBaseUrlResult {
  const normalized = normalizeBackendUrl(url);
  const previous =
    localStorage.getItem(BACKEND_URL_STORAGE_KEY) ||
    baseUrl ||
    import.meta.env.VITE_AURA_BACKEND_URL ||
    DEFAULT_BACKEND_URL;
  const changed = previous.trim().replace(/\/+$/, '') !== normalized;

  baseUrl = normalized;
  localStorage.setItem(BACKEND_URL_STORAGE_KEY, normalized);

  if (changed) {
    clearStoredAuth();
  }

  return { url: normalized, changed };
}

export function getConfiguredUrl(): string {
  return (
    baseUrl ||
    localStorage.getItem(BACKEND_URL_STORAGE_KEY) ||
    import.meta.env.VITE_AURA_BACKEND_URL ||
    DEFAULT_BACKEND_URL
  );
}

export async function testBackendUrl(url: string): Promise<string> {
  const normalized = normalizeBackendUrl(url);
  let res: Response;
  try {
    res = await fetch(`${normalized}/api/health`, { method: 'GET' });
  } catch {
    throw new Error('无法连接后端，请检查地址和网络');
  }

  if (!res.ok) {
    throw new Error(`后端连接失败: HTTP ${res.status}`);
  }

  return normalized;
}

interface ApiResponse<T = any> {
  success: boolean;
  data: T;
  message: string;
}

interface RequestOptions extends RequestInit {
  skipAuth?: boolean;
  skipRefresh?: boolean;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(
  path: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const url = await getBaseUrl();
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (!options.skipAuth && token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${url}${path}`, { ...options, headers });

  if (res.status === 401) {
    if (!options.skipRefresh && path !== '/api/auth/login' && path !== '/api/auth/refresh') {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        return request<T>(path, { ...options, skipRefresh: true });
      }
    }
    clearAuthAndRedirect();
    throw new ApiError(401, 'Unauthorized');
  }

  const body = await res.json();
  if (!res.ok) throw new ApiError(res.status, body.message || 'Request failed');
  return body;
}

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) return false;

  try {
    const url = await getBaseUrl();
    const res = await fetch(`${url}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return false;

    const body = (await res.json()) as ApiResponse<{
      access_token: string;
      refresh_token?: string;
    }>;
    if (!body.success || !body.data?.access_token) return false;

    localStorage.setItem('token', body.data.access_token);
    if (body.data.refresh_token) {
      localStorage.setItem('refresh_token', body.data.refresh_token);
    }
    return true;
  } catch {
    return false;
  }
}

function clearAuthAndRedirect() {
  localStorage.removeItem('token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
  window.location.hash = '#/login';
}

function buildQuery(params?: Record<string, string | number>): string {
  if (!params) return '';
  const qs = Object.entries(params)
    .filter(([_, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return qs ? `?${qs}` : '';
}

export const api = {
  get: <T>(path: string, params?: Record<string, string | number>) =>
    request<T>(path + buildQuery(params)),
  post: <T>(path: string, data?: any) =>
    request<T>(path, { method: 'POST', body: data ? JSON.stringify(data) : undefined }),
  put: <T>(path: string, data: any) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(data) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

export const auth = {
  login: (username: string, password: string) =>
    api.post<{ access_token: string; refresh_token: string; user: any }>('/api/auth/login', { username, password }),
  refresh: (refreshToken: string) =>
    request<{ access_token: string; refresh_token: string }>('/api/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
      skipAuth: true,
      skipRefresh: true,
    }),
};

export const health = {
  check: () => request<{ status: string }>('/api/health', { skipAuth: true, skipRefresh: true }),
};

export interface ScreeningCondition {
  field: string;
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=' | 'between' | 'in' | 'not_in' | 'contains' | 'cross_up' | 'cross_down';
  value: number | string | Array<number | string>;
  field_type?: 'basic' | 'technical' | 'fundamental';
}

export interface ScreeningRequest {
  market?: string;
  date?: string;
  adj?: string;
  conditions?: ScreeningCondition[];
  order_by?: Array<{ field: string; direction: 'asc' | 'desc' }>;
  limit?: number;
  offset?: number;
  use_database_optimization?: boolean;
}

export interface ScreeningResultItem {
  code?: string;
  symbol?: string;
  ts_code?: string;
  name?: string;
  industry?: string;
  area?: string;
  market?: string;
  total_mv?: number;
  circ_mv?: number;
  pe?: number;
  pb?: number;
  pe_ttm?: number;
  pb_mrq?: number;
  roe?: number;
  close?: number;
  pct_chg?: number;
  amount?: number;
  turnover_rate?: number;
  volume_ratio?: number;
  [key: string]: any;
}

export interface ScreeningResponse {
  total: number;
  items: ScreeningResultItem[];
  took_ms?: number;
  optimization_used?: string;
  source?: string;
}

export const screening = {
  enhanced: (data: ScreeningRequest) =>
    api.post<ScreeningResponse>('/api/screening/enhanced', data).then((res: any) =>
      res?.data ? res : { success: true, data: res as ScreeningResponse, message: '' }
    ),
  fields: () => api.get<any[]>('/api/screening/fields'),
  industries: () => api.get<any[]>('/api/screening/industries'),
};

export interface AnalysisRequest {
  symbol: string;
  parameters?: {
    market_type?: string;
    research_depth?: string;
    selected_analysts?: string[];
  };
}

export interface AnalysisTask {
  task_id: string;
  symbol?: string;
  stock_code?: string;
  stock_symbol?: string;
  status: string;
  progress: number;
  message?: string;
  current_step?: string;
  start_time?: string;
  end_time?: string;
  elapsed_time?: number;
  parameters?: {
    market_type?: string;
    research_depth?: string;
    selected_analysts?: string[];
  };
}

export interface AnalysisResult {
  analysis_id: string;
  stock_symbol: string;
  stock_code: string;
  analysis_date: string;
  summary: string;
  recommendation: string;
  confidence_score: number;
  risk_level: string;
  key_points: string[];
  execution_time: number;
  tokens_used: number;
  analysts: string[];
  research_depth: string;
  reports: Record<string, string>;
  decision: {
    action?: string;
    target_price?: string;
    confidence?: number;
  };
  created_at: string;
  status: string;
}

export interface ReportItem {
  id: string;
  analysis_id: string;
  title: string;
  stock_code: string;
  stock_name: string;
  market_type: string;
  model_info: string;
  type: string;
  status: string;
  created_at: string;
  analysis_date: string;
  analysts: string[];
  research_depth: number;
  summary: string;
  task_id: string;
}

export const analysis = {
  submit: (data: AnalysisRequest) =>
    api.post<AnalysisTask>('/api/analysis/single', data),
  getStatus: (taskId: string) =>
    api.get<AnalysisTask>(`/api/analysis/tasks/${taskId}/status`),
  getResult: (taskId: string) =>
    api.get<AnalysisResult>(`/api/analysis/tasks/${taskId}/result`),
  getTasks: (params?: Record<string, string | number>) =>
    api.get<{ tasks: AnalysisTask[]; total: number }>('/api/analysis/tasks', params),
};

export const reports = {
  list: (params?: Record<string, string | number>) =>
    api.get<{ reports: ReportItem[]; total: number; page: number; page_size: number }>('/api/reports/list', params),
  detail: (reportId: string) =>
    api.get<ReportItem>('/api/reports/' + reportId + '/detail'),
};

export interface LLMProvider {
  id: string;
  name: string;
  display_name: string;
  description?: string;
  website?: string;
  api_doc_url?: string;
  is_active: boolean;
  default_base_url?: string;
  api_key?: string | null;
  api_secret?: string | null;
  extra_config?: Record<string, any>;
}

export interface DataSourceStatus {
  name: string;
  priority: number;
  available: boolean;
  description: string;
  token_source?: string;
}

export interface SyncStatus {
  job?: string;
  status: string;
  started_at?: string;
  finished_at?: string;
  total?: number;
  inserted?: number;
  updated?: number;
  errors?: number;
  message?: string | null;
  data_type?: string;
  last_trade_date?: string;
  data_sources_used?: string[];
}

export interface SyncHistoryRecord {
  job: string;
  data_type?: string;
  status: string;
  started_at?: string;
  finished_at?: string;
  total?: number;
  inserted?: number;
  updated?: number;
  errors?: number;
  message?: string | null;
  data_sources_used?: string[];
  last_trade_date?: string;
}

export const sync = {
  sourcesStatus: () =>
    api.get<DataSourceStatus[]>('/api/sync/multi-source/sources/status'),
  currentSource: () =>
    api.get<{ name: string; priority: number; description: string }>('/api/sync/multi-source/sources/current'),
  getStatus: () =>
    api.get<SyncStatus>('/api/sync/multi-source/status'),
  runStockBasics: (force = true) =>
    api.post<SyncStatus>(`/api/sync/multi-source/stock_basics/run?force=${force}`),
  getHistory: (params?: Record<string, string | number>) =>
    api.get<{ records: SyncHistoryRecord[]; total: number; page: number; page_size: number }>('/api/sync/multi-source/history', params),
  testSources: (sourceName?: string) =>
    api.post<{ test_results: DataSourceStatus[] }>('/api/sync/multi-source/test-sources', sourceName ? { source_name: sourceName } : {}),
  clearCache: () =>
    api.delete<{ cleared: boolean; items_cleared: number }>('/api/sync/multi-source/cache'),
  runQuotes: () =>
    api.post<SyncStatus>('/api/sync/multi-source/quotes/run'),
};

export const config = {
  getProviders: () =>
    api.get<LLMProvider[]>('/api/config/llm/providers'),
  createProvider: (data: Record<string, any>) =>
    api.post<any>('/api/config/llm/providers', data),
  updateProvider: (id: string, data: Record<string, any>) =>
    api.put<any>(`/api/config/llm/providers/${id}`, data),
  testProvider: (id: string) =>
    api.post<{ success: boolean; message: string }>(`/api/config/llm/providers/${id}/test`),
};
