<template>
  <AppShell>
    <section class="home-grid">
      <div class="control-panel">
        <div class="section-title">
          <BookMarked :size="22" aria-hidden="true" />
          <h1>课堂快速检测</h1>
        </div>

        <p class="muted">选择单元后直接进入投屏或学生练习流程。</p>

        <div v-if="store.error" class="notice error">{{ store.error }}</div>
        <div v-else-if="store.loading" class="notice">正在读取单元...</div>

        <UnitSelect v-if="store.units.length" v-model="selectedUnitId" :units="store.units" />

        <div class="action-row">
          <RouterLink class="primary-button" to="/class">
            <MonitorPlay :size="20" aria-hidden="true" />
            <span>课堂快闪</span>
          </RouterLink>
          <RouterLink class="secondary-button" :to="{ path: '/student/quiz', query: { unitId: selectedUnitId } }">
            <PenLine :size="20" aria-hidden="true" />
            <span>学生练习</span>
          </RouterLink>
          <RouterLink class="secondary-button" to="/teacher/tools">
            <WandSparkles :size="20" aria-hidden="true" />
            <span>教师工具</span>
          </RouterLink>
        </div>
      </div>

      <div class="status-panel">
        <h2>原型能力</h2>
        <div class="metric-grid">
          <div>
            <strong>3</strong>
            <span>课堂模式</span>
          </div>
          <div>
            <strong>2s</strong>
            <span>出答案</span>
          </div>
          <div>
            <strong>TTS</strong>
            <span>语音朗读</span>
          </div>
        </div>
        <ul class="compact-list">
          <li>教师大屏快闪展示和手动切换</li>
          <li>TTS 朗读、音量和语速控制</li>
          <li>学生单机在线提交并查看结果</li>
          <li>知识图谱按课堂语料生成和缓存</li>
        </ul>
      </div>
    </section>
  </AppShell>
</template>

<script setup>
import { BookMarked, MonitorPlay, PenLine, WandSparkles } from '@lucide/vue';
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import AppShell from '../components/AppShell.vue';
import UnitSelect from '../components/UnitSelect.vue';
import { useUnitsStore } from '../stores/units.js';

const route = useRoute();
const store = useUnitsStore();
const selectedUnitId = ref(Number(route.query.unitId) || 0);

const firstUnitId = computed(() => store.firstUnit?.id || 0);

watch(firstUnitId, (id) => {
  if (!selectedUnitId.value && id) {
    selectedUnitId.value = id;
  }
});

onMounted(async () => {
  await store.loadUnits();
  if (!selectedUnitId.value && store.firstUnit) {
    selectedUnitId.value = store.firstUnit.id;
  }
});
</script>
