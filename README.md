# 英语基础知识学习系统

课堂英语教学综合平台，集课堂快闪投屏、TTS 朗读、知识图谱、学生练习、AI 出题评分、语料管理于一体。

---

## 架构

```
ebkss/
├── client/              # Vue 3 + Vite 前端
│   ├── src/
│   │   ├── views/       # 页面组件
│   │   │   ├── HomeView.vue          # 首页
│   │   │   ├── TeacherQuizView.vue   # 课堂快闪 + 学生练习
│   │   │   ├── StudentQuizView.vue   # 学生答题
│   │   │   ├── AdminView.vue         # 管理工具（语料管理 + AI出题）
│   │   │   └── LoginView.vue         # 管理员登录
│   │   ├── components/  # 通用组件
│   │   ├── api.js       # API 客户端
│   │   └── config.js    # 前端配置
│   └── public/favicon.svg
├── server/              # Node.js + Express 后端
│   ├── src/
│   │   ├── app.js       # 路由 + 中间件
│   │   ├── index.js     # 入口（内置前端静态文件）
│   │   ├── config.js    # 环境变量配置
│   │   ├── services/    # 业务逻辑
│   │   │   ├── aiService.js        # AI 出题/评分/笔记解析
│   │   │   ├── authService.js      # JWT 认证
│   │   │   ├── classroomService.js # 课堂语料/图谱
│   │   │   ├── quizService.js      # 出题/评卷
│   │   │   ├── ttsService.js       # DashScope TTS
│   │   │   └── graphService.js     # 知识图谱
│   │   ├── utils/       # 工具
│   │   ├── data/        # 种子数据
│   │   └── scripts/     # 脚本（迁移/种子/预缓存/doxc解析）
│   └── tests/
└── scripts/             # 开发辅助脚本
```

---

## 技术栈

| 层 | 技术 |
|---|------|
| 前端 | Vue 3 + Vite + Pinia + ECharts + lucide-vue |
| 后端 | Node.js (Express) + Zod |
| 数据库 | MySQL 8.0 |
| AI LLM | 硅基流动 DeepSeek-V4-Flash / V3 / Qwen3-32B |
| TTS | 阿里云 DashScope qwen3-tts-vd-2026-01-26（声音设计模型） |

---

## 功能矩阵

| 功能 | 路由 | 说明 |
|------|------|------|
| 🏠 首页 | `/` | 导航入口 |
| 📺 课堂快闪 | `/class` / `/teacher/quiz` | 三种模式、TTS 朗读、知识图谱跟随 |
| ✏️ 学生练习 | `/student/quiz` | 六种题型、AI 评分 |
| 🔧 管理工具 | `/admin` | 语料管理 + AI 出题（需登录） |
| 🔑 登录 | `/login` | 管理员登录（JWT） |

### 课堂快闪三种模式

| 模式 | 流程 | TTS |
|------|------|-----|
| 英语说汉 | 显示英语 → 间隔 → 显示中文 | ❌ |
| 英语说英 | 显示英语 → 朗读 → 显示英文解释 | ✅ |
| 听英语说汉 | 先朗读 → 显示中英文 | ✅ |

### 六种题型（学生练习）

| 题型 | 校验方式 |
|------|---------|
| 固定搭配 (collocation) | 规则匹配 |
| 中英互译 (translation) | 多答案匹配 |
| 同义词 (synonym) | 多答案匹配 |
| 短语 (phrase) | 规则匹配 |
| 词形变化 (morphology) | 精确匹配 |
| 类似结构 (analogy) | AI 评分 |

### 管理工具

- **语料管理**：Word 导入（规则/AI 双模式）、增删改、语料组管理
- **AI 出题**：AI 生成题目、已有题目管理、知识图谱生成

---

## Quick Start

```bash
# 安装依赖（根目录）
npm install

# 配置环境
Copy-Item server/.env.example server/.env
# 编辑 server/.env 填入数据库密码和 API Key

# 数据库初始化
npm run migrate
npm run seed

# 开发模式
npm run dev          # 同时启动前后端（前端 :5173, 后端 :3000）
```

### 环境变量（server/.env）

```env
PORT=3000
CLIENT_ORIGIN=http://localhost:5173
DB_HOST=your-db-host
DB_PORT=3306
DB_NAME=ess
DB_USER=ess
DB_PASSWORD=your-password
DB_CONNECTION_LIMIT=10

# AI — 硅基流动
AI_BASE_URL=https://api.siliconflow.cn/v1
AI_API_KEY=sk-your-key
AI_MODEL=deepseek-ai/DeepSeek-V4-Flash
AI_TIMEOUT_MS=12000

# TTS — 阿里云 DashScope
DASHSCOPE_API_KEY=sk-your-dashscope-key
TTS_MODEL=qwen3-tts-vd-2026-01-26
TTS_VOICE=沉稳清晰的女教师声音

# 管理员密码（不设则默认 ebkss2026）
ADMIN_PASSWORD=your-password
```

---

## 部署（1Panel / 生产环境）

```bash
# 构建前端 + 启动
npm run deploy

# 或分步：
npm run build:client    # 构建前端到 client/dist
npm start               # 启动 Express（端口 3000）

# Express 会自动检测 client/dist，存在则内置为静态文件
# 单进程同时提供 API + 前端
```

生产环境可设 `SERVE_CLIENT=false` 关闭内置前端（由 Nginx 提供）。

### 前端部署到 Netlify

仓库已包含根目录 `netlify.toml`，会构建 `client` 工作区并发布 `client/dist`。Netlify 只托管静态前端；浏览器通过 HTTPS 请求部署在你服务器上的 Node.js API，后端再访问 MySQL、AI 和 TTS 服务。

1. 为后端配置公网 HTTPS 地址，例如 `https://api.example.com`，并在服务器上运行迁移、种子数据和 Node.js 服务。
2. 在 Netlify 选择 **Add new project**，导入此 Git 仓库；构建命令为 `npm run build -w client`，发布目录为 `client/dist`。
3. 在 Netlify 的 **Environment variables** 添加 `VITE_API_BASE=https://api.example.com`，不要以 `/` 结尾，然后重新部署。该变量会写入前端构建产物，只能包含公开的 API 地址。
4. 在服务器数据库的 `settings` 表把 `app_client_origin` 设为 Netlify 域名，例如 `https://your-site.netlify.app`；同时把 `app_serve_client` 设为 `false` 并重启后端。使用自定义前端域名后，将该值更新为自定义域名。
5. 部署后测试首页、答题、TTS 和 Word 导入。TTS 的相对音频地址会自动使用 `VITE_API_BASE` 指向后端。

数据库连接信息、JWT 密钥、AI Key 和 TTS Key 只能保留在服务器的 `.env` 或数据库设置表中，不能添加到 Netlify 环境变量或任何 `VITE_*` 变量。

---

## Scripts

| 命令 | 说明 |
|------|------|
| `npm run dev` | 同时启动前后端开发服务 |
| `npm run dev:server` | 仅后端 |
| `npm run dev:client` | 仅前端 |
| `npm run build` | 构建前端 + 检查后端源码 |
| `npm run deploy` | 构建前端 + 启动生产服务 |
| `npm start` | 启动生产服务 |
| `npm run migrate` | 创建/更新数据库表 |
| `npm run seed` | 写入种子数据 |
| `npm run precache:tts` | 预生成 TTS 音频 |
| `npm run test` | 运行所有测试 |
| `npm run stop:dev` | 清理 dev 进程 |

---

## 详细文档

参见 [`项目总文档.md`](项目总文档.md) — 包含完整 API 清单、数据库设计、AI 提示词模板、开发状态总表。

---

> 部署域名：`es.cldery.com`

## License

This project is licensed under the GNU Affero General Public License v3.0 only. See [LICENSE](LICENSE).
