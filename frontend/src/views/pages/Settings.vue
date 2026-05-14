<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { setBaseUrl, getConfiguredUrl, testBackendUrl, config, type LLMProvider } from '../../api';
import { useAuth } from '../../stores/auth';

const router = useRouter();
const { logout } = useAuth();
const backendUrl = ref(getConfiguredUrl());
const savingUrl = ref(false);
const urlMessage = ref('');
const urlMessageType = ref<'success' | 'error'>('success');

async function saveUrl() {
  savingUrl.value = true;
  urlMessage.value = '';
  try {
    const normalized = await testBackendUrl(backendUrl.value);
    const result = setBaseUrl(normalized);
    backendUrl.value = result.url;
    urlMessageType.value = 'success';
    urlMessage.value = result.changed ? '已保存，请重新登录' : '已保存';
    if (result.changed) {
      logout();
      setTimeout(() => router.push('/login'), 600);
    }
  } catch (e: any) {
    urlMessageType.value = 'error';
    urlMessage.value = e.message || '后端连接失败';
  } finally {
    savingUrl.value = false;
  }
}

// API Key config
interface ProviderForm {
  id: string;
  name: string;
  display_name: string;
  description: string;
  api_key: string;
  is_active: boolean;
  exists: boolean;
  default_base_url: string;
  api_doc_url: string;
}

const DESIRED_PROVIDERS: Omit<ProviderForm, 'id' | 'api_key' | 'exists'>[] = [
  {
    name: 'deepseek',
    display_name: 'DeepSeek',
    description: 'DeepSeek 大模型 API',
    is_active: true,
    default_base_url: 'https://api.deepseek.com',
    api_doc_url: 'https://platform.deepseek.com/api_keys',
  },
];

const providerForms = ref<ProviderForm[]>([]);
const loading = ref(false);
const saving = ref<Record<string, boolean>>({});
const testing = ref<Record<string, boolean>>({});
const testResult = ref<Record<string, string>>({});

async function loadProviders() {
  loading.value = true;
  try {
    const res = await config.getProviders();
    const existing = (res.data || []) as LLMProvider[];

    providerForms.value = DESIRED_PROVIDERS.map((desired) => {
      const found = existing.find(
        (p) => p.name.toLowerCase() === desired.name.toLowerCase()
      );
      if (found) {
        return {
          id: found.id,
          name: found.name,
          display_name: found.display_name || desired.display_name,
          description: found.description || desired.description,
          api_key: '',
          is_active: found.is_active,
          exists: true,
          default_base_url: found.default_base_url || desired.default_base_url,
          api_doc_url: desired.api_doc_url,
        };
      }
      return {
        id: '',
        ...desired,
        api_key: '',
        exists: false,
      };
    });
  } catch {
    providerForms.value = DESIRED_PROVIDERS.map((d) => ({
      id: '',
      ...d,
      api_key: '',
      exists: false,
    }));
  } finally {
    loading.value = false;
  }
}

async function saveApiKey(form: ProviderForm) {
  saving.value[form.name] = true;
  try {
    if (form.exists) {
      const data: Record<string, any> = {
        name: form.name,
        display_name: form.display_name,
      };
      if (form.api_key) data.api_key = form.api_key;
      await config.updateProvider(form.id, data);
    } else {
      const res = await config.createProvider({
        name: form.name,
        display_name: form.display_name,
        description: form.description,
        is_active: form.is_active,
        default_base_url: form.default_base_url,
        api_key: form.api_key,
      });
      form.id = res.data.id;
      form.exists = true;
    }
    testResult.value[form.name] = '已保存';
  } catch (e: any) {
    testResult.value[form.name] = '保存失败: ' + (e.message || '未知错误');
  } finally {
    saving.value[form.name] = false;
  }
}

async function testApiKey(form: ProviderForm) {
  if (!form.exists) return;
  testing.value[form.name] = true;
  testResult.value[form.name] = '';
  try {
    const res = await config.testProvider(form.id);
    testResult.value[form.name] = res.data.success ? '测试通过' : res.data.message || '测试失败';
  } catch (e: any) {
    testResult.value[form.name] = '测试失败: ' + (e.message || '未知错误');
  } finally {
    testing.value[form.name] = false;
  }
}

onMounted(loadProviders);
</script>

<template>
  <div class="page">
    <h2>设置</h2>

    <!-- API Key -->
    <div class="settings-section">
      <h3>API 配置</h3>
      <p v-if="loading" class="hint">加载中...</p>
      <div v-for="p in providerForms" :key="p.name" class="provider-card">
        <div class="provider-header">
          <span class="provider-name">{{ p.display_name }}</span>
          <span :class="['provider-status', p.is_active ? 'active' : 'inactive']">
            {{ p.is_active ? '已启用' : '已禁用' }}
          </span>
        </div>
        <p v-if="p.description" class="provider-desc">{{ p.description }}</p>
        <div class="provider-form">
          <label>API Key</label>
          <div class="key-row">
            <input
              v-model="p.api_key"
              type="password"
              class="input"
              :placeholder="p.exists ? '已设置 (留空不修改)' : '请输入 API Key'"
            />
            <button
              class="btn-sm"
              :disabled="saving[p.name]"
              @click="saveApiKey(p)"
            >
              {{ saving[p.name] ? '保存中...' : (p.exists ? '更新' : '创建并保存') }}
            </button>
            <button
              v-if="p.exists"
              class="btn-sm btn-outline"
              :disabled="testing[p.name]"
              @click="testApiKey(p)"
            >
              {{ testing[p.name] ? '测试中...' : '测试' }}
            </button>
          </div>
          <p v-if="testResult[p.name]" :class="['test-msg', testResult[p.name] === '测试通过' ? 'success' : 'error']">
            {{ testResult[p.name] }}
          </p>
        </div>
        <p v-if="p.api_doc_url" class="provider-link">
          获取 API Key: <a :href="p.api_doc_url" target="_blank">{{ p.api_doc_url }}</a>
        </p>
      </div>
      <p v-if="!loading && providerForms.length === 0" class="hint">暂无可配置的 API 厂商</p>
    </div>

    <!-- Backend connection -->
    <div class="settings-section">
      <h3>后端连接</h3>
      <div class="form-group">
        <label>API 地址</label>
        <input v-model="backendUrl" class="input" placeholder="http://localhost:8000" />
      </div>
      <button class="btn-primary" :disabled="savingUrl" @click="saveUrl">
        {{ savingUrl ? '测试中...' : '保存设置' }}
      </button>
      <p v-if="urlMessage" :class="['test-msg', urlMessageType]">{{ urlMessage }}</p>
    </div>

    <!-- About -->
    <div class="settings-section">
      <h3>关于</h3>
      <div class="about-info">
        <p>Aura v0.1.0</p>
        <p>AI 驱动的 A 股股票分析桌面应用</p>
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
.settings-section {
  background: #ffffff;
  border-radius: 8px;
  padding: 32px;
  border: 1px solid #e8e4db;
  margin-bottom: 24px;
  max-width: 640px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.02);
}
.settings-section h3 {
  margin: 0 0 24px;
  font-size: 18px;
  font-weight: 600;
  color: #2c2a29;
}

/* Provider card */
.provider-card {
  padding: 0 0 24px;
  border-bottom: 1px solid #edeae0;
  margin-bottom: 24px;
}
.provider-card:last-child {
  border-bottom: none;
  padding-bottom: 0;
  margin-bottom: 0;
}
.provider-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}
.provider-name {
  font-size: 16px;
  font-weight: 600;
  color: #2c2a29;
}
.provider-status {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 4px;
}
.provider-status.active {
  background: #e8f0e4;
  color: #2d7a4d;
}
.provider-status.inactive {
  background: #f7e8e6;
  color: #c43228;
}
.provider-desc {
  font-size: 14px;
  color: #8c8780;
  margin: 0 0 16px;
}
.provider-form label {
  display: block;
  font-size: 14px;
  color: #5c5855;
  margin-bottom: 8px;
  font-weight: 500;
}
.key-row {
  display: flex;
  gap: 8px;
}
.key-row .input {
  flex: 1;
}
.test-msg {
  font-size: 13px;
  margin: 8px 0 0;
}
.test-msg.success { color: #2d7a4d; }
.test-msg.error { color: #c43228; }
.provider-link {
  font-size: 13px;
  color: #8c8780;
  margin: 12px 0 0;
}
.provider-link a {
  color: #5c5855;
}

.form-group {
  margin-bottom: 24px;
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
  font-family: inherit;
  transition: border-color 0.2s;
}
.input:focus { border-color: #8a8270; background: #ffffff; }
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
}
.btn-primary:hover { background: #1a1818; }
.btn-sm {
  padding: 12px 20px;
  border-radius: 6px;
  border: none;
  background: #2c2a29;
  color: #ffffff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
  transition: background 0.2s;
}
.btn-sm:hover { background: #1a1818; }
.btn-sm:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-outline {
  background: transparent !important;
  border: 1px solid #d5d0c5 !important;
  color: #5c5855 !important;
}
.btn-outline:hover {
  border-color: #2c2a29 !important;
  color: #2c2a29 !important;
}
.hint {
  color: #8c8780;
  font-size: 14px;
}
.about-info p {
  color: #5c5855;
  font-size: 15px;
  margin: 8px 0;
  line-height: 1.6;
}
</style>
