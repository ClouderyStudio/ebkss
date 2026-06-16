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
  background: linear-gradient(135deg, #e0f2fe 0%, #f0fdf4 50%, #fefce8 100%);
}
.login-card {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  padding: 2.5rem;
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  box-shadow: 0 4px 24px rgba(0,0,0,0.06);
}
.login-title {
  text-align: center;
}
.login-title h1 {
  margin: 0.5rem 0 0.25rem;
  font-size: 1.5rem;
  color: #1e293b;
}
.login-title p {
  color: #64748b;
  margin: 0;
}
.field input {
  width: 100%;
  padding: 0.75rem 1rem;
  font-size: 1rem;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #f8fafc;
  color: #1e293b;
}
.field input:focus {
  border-color: #3b82f6;
  outline: 2px solid #bfdbfe;
  outline-offset: -1px;
}
</style>
