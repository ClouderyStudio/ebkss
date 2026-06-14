# 英语基础知识学习系统

课堂 5 分钟英语基础知识快速检测系统原型，包含课堂快闪投屏、TTS 朗读、知识图谱、学生在线练习、AI 出题和 AI 评分。

## Quick Start

```bash
npm install
Copy-Item server/.env.example server/.env
npm run migrate
npm run seed
npm run precache:tts
npm run dev
```

前端默认运行在 `http://localhost:5173`，后端默认运行在 `http://localhost:3000`。

## Environment

后端只从 `server/.env` 读取数据库与 AI 配置。真实密码和 API Key 不应提交到源码。

## Scripts

- `npm run dev`：同时启动前后端开发服务
- `npm run stop:dev`：清理本项目占用的 `3000/5173/5174` dev 进程
- `npm run migrate`：创建或补齐数据库表结构
- `npm run seed`：写入幂等测试数据
- `npm run precache:tts`：预生成 give 词组 0.7/0.9 两档语速音频
- `npm run test`：运行前后端测试
- `npm run build`：构建前端并检查后端源码

## Classroom Mode

- `/class`：课堂快闪投屏入口
- `/api/corpus?group=give`：读取课堂语料
- `/api/tts?text=give%20up&speed=0.7`：读取或生成缓存音频
- `/api/graph?group=give`：读取或生成课堂知识图谱

## Port Conflicts

如果看到 `Port 3000 is already in use` 或 Vite 自动切到 `5174`，通常是上一次 dev server 还在后台运行。先执行：

```bash
npm run stop:dev
npm run dev
```
