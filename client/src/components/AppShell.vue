<template>
  <div class="app-shell">
    <header class="topbar">
      <RouterLink class="brand" to="/">
        <BookOpen :size="22" aria-hidden="true" />
        <span>英语基础知识学习系统</span>
      </RouterLink>
      <nav class="nav-links" aria-label="主导航">
        <RouterLink to="/class">
          <MonitorPlay :size="18" aria-hidden="true" />
          <span>课堂快闪</span>
        </RouterLink>
        <RouterLink to="/student/quiz">
          <PenLine :size="18" aria-hidden="true" />
          <span>学生练习</span>
        </RouterLink>
        <RouterLink to="/teacher/tools">
          <WandSparkles :size="18" aria-hidden="true" />
          <span>教师工具</span>
        </RouterLink>
        <RouterLink to="/teacher/corpus">
          <Database :size="18" aria-hidden="true" />
          <span>语料管理</span>
        </RouterLink>
      </nav>
    </header>
    <main class="shell-main">
      <slot />
    </main>
  </div>
</template>

<script setup>
import { BookOpen, Database, MonitorPlay, PenLine, WandSparkles } from '@lucide/vue';
</script>
