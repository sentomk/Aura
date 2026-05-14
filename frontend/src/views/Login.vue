<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { auth as authApi, getConfiguredUrl, setBaseUrl, testBackendUrl } from '../api';
import { useAuth } from '../stores/auth';

const router = useRouter();
const { login } = useAuth();

const username = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);
const backendUrl = ref(getConfiguredUrl());
const backendMessage = ref('');
const backendMessageType = ref<'success' | 'error'>('success');
const savingBackend = ref(false);

async function saveBackendUrl(): Promise<boolean> {
  savingBackend.value = true;
  backendMessage.value = '';
  try {
    const normalized = await testBackendUrl(backendUrl.value);
    const result = setBaseUrl(normalized);
    backendUrl.value = result.url;
    backendMessageType.value = 'success';
    backendMessage.value = '后端连接正常';
    return true;
  } catch (e: any) {
    backendMessageType.value = 'error';
    backendMessage.value = e.message || '后端连接失败';
    return false;
  } finally {
    savingBackend.value = false;
  }
}

async function handleLogin() {
  error.value = '';
  if (!username.value || !password.value) {
    error.value = '请输入用户名和密码';
    return;
  }
  const backendReady = await saveBackendUrl();
  if (!backendReady) return;

  loading.value = true;
  try {
    const res = await authApi.login(username.value, password.value);
    login(res.data.user, res.data.access_token, res.data.refresh_token);
    router.push('/');
  } catch (e: any) {
    error.value = e.message || '登录失败';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-wrapper">
    <div class="login-card">
      <div class="login-header">
        <h1>Aura</h1>
        <p>AI 股票分析平台</p>
      </div>
      <form @submit.prevent="handleLogin">
        <div class="field">
          <input
            v-model="username"
            type="text"
            placeholder="用户名"
            :disabled="loading"
            autocomplete="username"
            autocapitalize="off"
            autocorrect="off"
            spellcheck="false"
          />
        </div>
        <div class="field">
          <input
            v-model="password"
            type="password"
            placeholder="密码"
            :disabled="loading"
            autocomplete="current-password"
          />
        </div>
        <p v-if="error" class="error">{{ error }}</p>
        <button type="submit" :disabled="loading || savingBackend" class="btn-primary">
          {{ loading ? '登录中...' : '登 录' }}
        </button>
      </form>
      <div class="backend-panel">
        <label>后端地址</label>
        <div class="backend-row">
          <input
            v-model="backendUrl"
            type="url"
            placeholder="http://localhost:8000"
            :disabled="loading || savingBackend"
            autocomplete="off"
            autocapitalize="off"
            autocorrect="off"
            spellcheck="false"
          />
          <button type="button" :disabled="loading || savingBackend" @click="saveBackendUrl">
            {{ savingBackend ? '测试中' : '保存' }}
          </button>
        </div>
        <p v-if="backendMessage" :class="['backend-message', backendMessageType]">
          {{ backendMessage }}
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100vh;
  background: #f7f5f0;
}
.login-card {
  background: #ffffff;
  border-radius: 12px;
  padding: 48px 40px;
  width: 380px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.04);
  border: 1px solid #e8e4db;
}
.login-header {
  text-align: center;
  margin-bottom: 40px;
}
.login-header h1 {
  font-family: 'Noto Serif', 'Noto Serif SC', serif;
  font-size: 32px;
  font-weight: 700;
  color: #1a1818;
  margin: 0;
  letter-spacing: 1px;
}
.login-header p {
  font-size: 15px;
  color: #8c8780;
  margin: 12px 0 0;
}
.field {
  margin-bottom: 20px;
}
.field input {
  width: 100%;
  padding: 14px 16px;
  border-radius: 6px;
  border: 1px solid #d5d0c5;
  background: #fdfcf9;
  color: #2c2a29;
  font-size: 15px;
  outline: none;
  transition: all 0.2s;
  box-sizing: border-box;
  font-family: inherit;
}
.field input:focus {
  border-color: #8a8270;
  background: #ffffff;
}
.error {
  color: #c43228;
  font-size: 14px;
  margin: 0 0 16px;
  text-align: center;
}
.btn-primary {
  width: 100%;
  padding: 14px;
  border-radius: 6px;
  border: none;
  background: #2c2a29;
  color: #ffffff;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
  font-family: inherit;
}
.btn-primary:hover {
  background: #1a1818;
}
.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.backend-panel {
  border-top: 1px solid #edeae0;
  margin-top: 28px;
  padding-top: 24px;
}
.backend-panel label {
  display: block;
  font-size: 13px;
  color: #5c5855;
  margin-bottom: 8px;
  font-weight: 500;
}
.backend-row {
  display: flex;
  gap: 8px;
}
.backend-row input {
  flex: 1;
  min-width: 0;
  padding: 12px 14px;
  border-radius: 6px;
  border: 1px solid #d5d0c5;
  background: #fdfcf9;
  color: #2c2a29;
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
  font-family: inherit;
}
.backend-row input:focus {
  border-color: #8a8270;
  background: #ffffff;
}
.backend-row button {
  width: 72px;
  border: 1px solid #d5d0c5;
  border-radius: 6px;
  background: #ffffff;
  color: #5c5855;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
}
.backend-row button:hover {
  border-color: #2c2a29;
  color: #2c2a29;
}
.backend-row button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.backend-message {
  font-size: 13px;
  margin: 10px 0 0;
}
.backend-message.success {
  color: #2d7a4d;
}
.backend-message.error {
  color: #c43228;
}
</style>
