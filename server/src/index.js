import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createApp } from './app.js';
import { config } from './config.js';

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
      `Port ${config.port} is already in use. Stop the existing server or set PORT in server/.env.`
    );
    process.exit(1);
  }

  throw error;
});
