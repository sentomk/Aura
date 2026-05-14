<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useAuth } from '../stores/auth';
import { reportNav } from '../stores/analysis';
import Overview from './pages/Overview.vue';
import Analysis from './pages/Analysis.vue';
import Stocks from './pages/Stocks.vue';
import Reports from './pages/Reports.vue';
import DataManagement from './pages/DataManagement.vue';
import Settings from './pages/Settings.vue';

type View = 'overview' | 'stocks' | 'analysis' | 'reports' | 'data' | 'settings';

const router = useRouter();
const { logout } = useAuth();
const currentView = ref<View>('overview');

watch(() => reportNav.taskId, (id) => {
  if (id) currentView.value = 'reports';
});

const viewComponent = computed(() => {
  const map: Record<View, any> = {
    overview: Overview,
    stocks: Stocks,
    analysis: Analysis,
    reports: Reports,
    data: DataManagement,
    settings: Settings,
  };
  return map[currentView.value];
});

const icons: Record<View, string> = {
  overview: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,
  stocks: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="9"/><line x1="12" y1="3" x2="12" y2="9"/><line x1="12" y1="15" x2="12" y2="21"/><line x1="3" y1="12" x2="9" y2="12"/><line x1="15" y1="12" x2="21" y2="12"/></svg>`,
  analysis: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 17 9 11 13 15 21 7"/><polyline points="15 7 21 7 21 13"/></svg>`,
  reports: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>`,
  data: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`,
  settings: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
};

const navItems: { key: View; label: string }[] = [
  { key: 'overview', label: '概览' },
  { key: 'stocks', label: '选股推荐' },
  { key: 'analysis', label: '股票分析' },
  { key: 'reports', label: '分析报告' },
  { key: 'data', label: '数据' },
  { key: 'settings', label: '设置' },
];

function handleLogout() {
  logout();
  router.push('/login');
}
</script>

<template>
  <div class="app-layout">
    <aside class="sidebar">
      <div class="sidebar-brand">
        <h2>Aura</h2>
      </div>
      <nav class="sidebar-nav">
        <a
          v-for="item in navItems"
          :key="item.key"
          :class="['nav-item', { active: currentView === item.key }]"
          @click="currentView = item.key"
        >
          <span class="nav-icon" v-html="icons[item.key]" />
          <span>{{ item.label }}</span>
        </a>
      </nav>
      <div class="sidebar-footer">
        <span class="version">v0.1.0</span>
        <button class="btn-logout" @click="handleLogout">退出</button>
      </div>
    </aside>
    <main class="main-content">
      <KeepAlive>
        <component :is="viewComponent" :key="currentView" />
      </KeepAlive>
    </main>
  </div>
</template>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
body {
  font-family: 'Noto Serif', 'Noto Serif SC', 'Source Han Serif SC', 'Source Han Serif CN', serif;
  background: #f7f5f0;
  color: #2c2a29;
  -webkit-font-smoothing: antialiased;
}
::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: #2d2d44;
  border-radius: 3px;
}
</style>

<style scoped>
.app-layout {
  display: flex;
  height: 100vh;
}
.sidebar {
  width: 220px;
  min-width: 220px;
  background: #edeae0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #d5d0c5;
}
.sidebar-brand {
  padding: 32px 24px 24px;
}
.sidebar-brand h2 {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 1px;
  color: #2c2a29;
  font-family: 'Noto Serif', 'Noto Serif SC', serif;
}
.sidebar-nav {
  flex: 1;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 6px;
  cursor: pointer;
  color: #5c5855;
  font-size: 15px;
  transition: all 0.2s;
  user-select: none;
  font-weight: 500;
}
.nav-item:hover {
  background: #e3dec9;
  color: #2c2a29;
}
.nav-item.active {
  background: #c9c3ac;
  color: #1a1818;
}
.nav-icon {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: inherit;
}
.nav-icon :deep(svg) {
  display: block;
}
.sidebar-footer {
  padding: 16px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.version {
  color: #8c8780;
  font-size: 12px;
}
.btn-logout {
  padding: 6px 12px;
  border-radius: 4px;
  border: 1px solid #d5d0c5;
  background: transparent;
  color: #5c5855;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  font-family: inherit;
}
.btn-logout:hover {
  border-color: #c43228;
  color: #c43228;
}
.main-content {
  flex: 1;
  padding: 48px 56px;
  overflow-y: auto;
  background: #fdfcf9;
}
</style>
