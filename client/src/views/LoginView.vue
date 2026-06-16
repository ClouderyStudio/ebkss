<template>
  <div class="login-page">
    <form class="login-card" @submit.prevent="handleLogin">
      <div class="login-title">
        <BookOpen :size="32" aria-hidden="true" />
        <h1>英语学习系统</h1>
        <p>请输入管理密码</p>
      </div>

      <label class="field">
        <input
          v-model.trim="password"
          type="password"
          placeholder="密码"
          autofocus
          :disabled="loading"
        />
      </label>

      <div v-if="error" class="notice error">{{ error }}</div>

      <button class="primary-button full-width" type="submit" :disabled="!password || loading">
        {{ loading ? '登录中...' : '登录' }}
      </button>
    </form>
  </div>
</template>

<script setup>
import { BookOpen } from '@lucide/vue';
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api.js';

const router = useRouter();
const password = ref('');
const loading = ref(false);
const error = ref('');

async function handleLogin() {
  loading.value = true;
  error.value = '';
  try {
    await api.auth.login(password.value);
    router.push('/');
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: var(--bg, #0f172a);
}
.login-card {
  background: var(--card-bg, #1e293b);
  border: 1px solid var(--border, #334155);
  border-radius: 16px;
  padding: 2.5rem;
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}
.login-title {
  text-align: center;
}
.login-title h1 {
  margin: 0.5rem 0 0.25rem;
  font-size: 1.5rem;
  color: var(--text, #f1f5f9);
}
.login-title p {
  color: var(--text-secondary, #94a3b8);
  margin: 0;
}
.field input {
  width: 100%;
  padding: 0.75rem 1rem;
  font-size: 1rem;
  border: 1px solid var(--border, #334155);
  border-radius: 8px;
  background: var(--input-bg, #0f172a);
  color: var(--text, #f1f5f9);
}
.field input:focus {
  outline: 2px solid var(--accent, #3b82f6);
  outline-offset: -1px;
}
</style>
