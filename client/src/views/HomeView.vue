<template>
  <AppShell>
    <section class="home-grid">
      <div class="control-panel">
        <div class="section-title"><BookMarked :size="22" /><h1>课堂快速检测</h1></div>
        <p class="muted">笔记、语料与题目独立管理；笔记可生成语料和题目。</p>
        <div class="action-row">
          <RouterLink class="primary-button" to="/class"><MonitorPlay :size="20" />课堂快闪</RouterLink>
          <RouterLink class="secondary-button" to="/student/quiz"><PenLine :size="20" />学生练习</RouterLink>
          <RouterLink class="secondary-button" to="/admin"><WandSparkles :size="20" />内容管理</RouterLink>
        </div>
      </div>
      <div class="status-panel"><h2>内容模型</h2><div class="metric-grid"><div><strong>笔记</strong><span>独立保存</span></div><div><strong>语料</strong><span>按语料组管理</span></div><div><strong>题目</strong><span>按题目组练习</span></div></div></div>
    </section>
  </AppShell>
</template>

<script setup>
import { BookMarked, MonitorPlay, PenLine, WandSparkles } from '@lucide/vue';
import AppShell from '../components/AppShell.vue';
</script>
