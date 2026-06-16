import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
      '/audio': 'http://localhost:3001'
    }
  },
  test: {
    environment: 'jsdom',
    globals: true
  }
});
