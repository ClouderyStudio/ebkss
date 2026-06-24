import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { config, loadConfigFromDb } from './config.js';
import { getPool, query } from './db.js';
import { initSettingsFromEnv } from './services/settingsService.js';

// ── 启动流程 ────────────────────────────────────
// 1. 建立数据库连接池（使用 .env 中的 DB_* 配置）
// 2. 将 .env 中的非 DB 配置同步到数据库（首次）
// 3. 从数据库加载运行时配置（DB 优先于 .env）
// 4. 创建 App 实例（此时 config getter 已指向 DB 值）
async function bootstrap() {
  // 预热连接池，确保 DB 可达
  try {
    getPool();
    console.log('[bootstrap] Database pool created.');
  } catch (err) {
    console.error('[bootstrap] Failed to create database pool:', err.message);
    console.error('[bootstrap] Ensure DB_HOST/DB_NAME/DB_USER/DB_PASSWORD are set in server/.env');
    process.exit(1);
  }

  // 将 .env 中的配置同步到 settings 表（首次初始化）
  try {
    await initSettingsFromEnv();
  } catch (err) {
    console.warn('[bootstrap] Settings init warning:', err.message);
  }

  // 从数据库加载运行时配置
  await loadConfigFromDb(query);

  // 创建 App
  const { createApp } = await import('./app.js');
  const app = createApp();

  // ── 生产模式：内置前端静态文件 ──────────────────
  if (config.serveClient && fs.existsSync(config.clientDistPath)) {
    console.log(`[prod] Serving client from ${config.clientDistPath}`);
    app.use(express.static(config.clientDistPath));

    // SPA fallback：所有非 API 路径返回 index.html
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/audio')) {
        return next();
      }
      res.sendFile(path.join(config.clientDistPath, 'index.html'));
    });
  } else if (config.serveClient) {
    console.warn(`[prod] Client dist not found at ${config.clientDistPath}. Run 'npm run build' first.`);
  }

  const server = app.listen(config.port, () => {
    console.log(`Server listening on http://localhost:${config.port}`);
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(
        `Port ${config.port} is already in use. Stop the existing server or set PORT in server/.env or settings table.`
      );
      process.exit(1);
    }

    throw error;
  });
}

bootstrap().catch((err) => {
  console.error('[bootstrap] Fatal error:', err);
  process.exit(1);
});
