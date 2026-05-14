<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { health } from '../../api';

const healthStatus = ref('检查中...');
const healthData = ref<any>(null);

onMounted(async () => {
  try {
    const res = await health.check();
    healthStatus.value = res.data.status;
    healthData.value = res.data;
  } catch {
    healthStatus.value = '离线';
  }
});
</script>

<template>
  <div class="page">
    <h2>概览</h2>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">后端状态</div>
        <div :class="['stat-value', healthStatus === 'ok' ? 'text-green' : 'text-red']">
          {{ healthStatus === 'ok' ? '运行中' : healthStatus }}
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-label">服务</div>
        <div class="stat-value">{{ healthData?.service || '-' }}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">版本</div>
        <div class="stat-value">{{ healthData?.version || '-' }}</div>
      </div>
    </div>
    <p class="welcome">
      Aura AI 股票分析桌面端
    </p>
  </div>
</template>

<style scoped>
.page h2 {
  margin: 0 0 32px;
  font-size: 28px;
  font-weight: 700;
  color: #1a1818;
}
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 24px;
  margin-bottom: 32px;
}
.stat-card {
  background: #ffffff;
  border-radius: 8px;
  padding: 24px;
  border: 1px solid #e8e4db;
  box-shadow: 0 2px 8px rgba(0,0,0,0.02);
}
.stat-label {
  font-size: 14px;
  color: #8c8780;
  margin-bottom: 12px;
}
.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: #2c2a29;
}
.text-green { color: #2d7a4d; }
.text-red { color: #c43228; }
.welcome {
  color: #5c5855;
  font-size: 15px;
  line-height: 1.6;
}
</style>
