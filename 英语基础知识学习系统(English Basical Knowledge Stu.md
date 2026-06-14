英语基础知识学习系统(English Basical Knowledge Study System) - 最终执行计划

一、项目定位

课堂5分钟快速检测系统

· 投屏展示，自动翻页，2秒出答案
· 六种题型全覆盖（固定搭配/中英互译/同义词/类似结构/词形变化/短语）
· AI辅助出题 + AI评分 + 知识图谱
· 语料基于老师提供的PDF笔记

---

二、技术栈（最终确认）

层 技术
前端 Vue 3 + Vite + Pinia + ECharts
后端 Node.js (Express)
数据库 MySQL 8.4.8
156.238.224.129:3306
数据库 ess 账户ess 密码 IgiA1Vo@%I30
AI API 硅基流动 (DeepSeek V4F)
https://api.siliconflow.cn/v1
deepseek-ai/DeepSeek-V4-Flash
sk-ytwzkqfyoayldkohvoaoigpmrntmhjntxevwqodymjnzunpk
部署 已有域名 es.cldery.com + CDN亚太 + 服务器

---

三、六种题型定义与处理方式

题型 代码标识 展示方式 校验方式 是否AI
固定搭配 collocation 句子 + ___ 规则匹配 ❌
中英互译 translation 中文 → "英文：___" 多答案匹配 ❌
同义词 synonym "x的同义词是？" 多答案匹配 ❌
短语 phrase 中文释义 → "英文短语：___" 规则匹配 ❌
词形变化 morphology 原词 → "变形：___" 精确匹配 ❌
类似结构 analogy 模板 + 关键词 → 造句 AI评分 ✅

---

四、数据库设计

```sql
-- 单元表
CREATE TABLE units (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100),
  grade_level VARCHAR(20)
);

-- 语法点表
CREATE TABLE grammar_points (
  id INT PRIMARY KEY AUTO_INCREMENT,
  unit_id INT,
  name VARCHAR(100),
  description TEXT,
  FOREIGN KEY (unit_id) REFERENCES units(id)
);

-- 语料表（核心）
CREATE TABLE corpus (
  id INT PRIMARY KEY AUTO_INCREMENT,
  unit_id INT,
  grammar_point_id INT,
  question_type ENUM('collocation','translation','synonym','analogy','morphology','phrase'),
  question_text TEXT,
  acceptable_answers JSON,  -- ["to"] 或 ["TCM","Traditional Chinese Medicine"]
  template TEXT,            -- 仅analogy类型，存储模板例句
  match_rule VARCHAR(50) DEFAULT 'exact',  -- exact/case_insensitive/trim
  requires_ai BOOLEAN DEFAULT FALSE,
  difficulty TINYINT DEFAULT 1,
  FOREIGN KEY (unit_id) REFERENCES units(id)
);

-- 知识图谱缓存表
CREATE TABLE knowledge_graphs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  grammar_point_id INT,
  graph_data JSON,  -- {nodes: [], edges: []}
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (grammar_point_id) REFERENCES grammar_points(id)
);
```

---

五、API接口清单

方法 路径 功能 是否需AI
GET /api/units 获取单元列表 ❌
GET /api/quiz/:unitId 获取检测题目 ❌（从语料库读取）
POST /api/submit 提交答案并评分 ✅（analogy类型）
POST /api/ai/generate AI生成新题目 ✅
GET /api/graph/:grammarPointId 获取知识图谱 ✅（首次）
POST /api/quiz/record 记录检测结果（可选） ❌

---

六、AI功能详细规格

6.1 AI生成题目提示词模板

```
你是英语老师。基于以下语法点和笔记内容，生成{count}道题目。

语法点：{grammar_point}
笔记内容：{notes_content}

要求：
1. 题型从以下六种中随机选择：collocation, translation, synonym, analogy, morphology, phrase
2. 不要选择题，不要选择题，不要选择题
3. 每道题输出JSON格式：
   {
     "question_type": "collocation",
     "question_text": "add A ___ B",
     "acceptable_answers": ["to"],
     "match_rule": "exact"
   }
4. 对于analogy类型，额外提供template字段
5. 对于translation/synonym类型，acceptable_answers可以是多个同义词
6. 难度适合初中生
```

6.2 AI评分提示词模板

```
判断学生的造句是否正确。

题目要求：{question_text}
标准模板参考：{template}
学生答案：{user_answer}

输出JSON：
{
  "is_correct": true/false,
  "feedback": "一句话反馈（中文，10字以内）",
  "score": 0-100
}

评判标准：结构相似、语法正确、意思通顺即可给正确。不要过于严格。
```

6.3 AI知识图谱提示词模板

```
基于语法点“{grammar_point_name}”和以下笔记内容，生成知识图谱。

笔记内容：{notes_content}

输出JSON格式：
{
  "nodes": [
    {"id": "1", "name": "节点名", "description": "简短说明"}
  ],
  "edges": [
    {"source": "1", "target": "2", "label": "关系类型（前置/后置/易混淆）"}
  ]
}

要求：
1. 包含前置知识（需要先掌握什么）
2. 包含后续拓展（学完可以学什么）
3. 包含2个易混淆的相关语法点
4. 共5-7个节点
```

---

七、前端检测模式核心参数（可配置）

```javascript
// config.js
export const QUIZ_CONFIG = {
  autoAdvance: true,           // 自动翻页
  showAnswerDelay: 2000,       // 2秒显示答案（毫秒）
  answerHoldDelay: 1500,       // 答案停留1.5秒
  defaultQuestionCount: 4,     // 每次检测4题
  fullscreen: true,            // 全屏模式
  fontSize: 48,                // 正文字号(px)
  answerFontSize: 36,          // 答案字号(px)
  backgroundColor: '#1a1a2e',  // 背景色
  accentColor: '#ff6b6b'       // 答案高亮色
}
```

---

八、测试数据（基于你的笔记）

Unit 1 - 现在完成时（grammar_point_id=1）

题型 题目 可接受答案
collocation I haven't seen him ___ (截止到现在) yet, up to now
translation 在过去的几年里 over the past few years, over the last few years
phrase 用before造一个现在完成时的句子 I have met him before.
morphology strike的过去分词 struck

Unit 2 - strike用法（grammar_point_id=2）

题型 题目 可接受答案
collocation It ___ sb that + 句子 struck
translation 我突然想到 It struck me that, It occurred to me that
morphology strike的过去式 struck

Unit 3 - 连词+分词（grammar_point_id=3）

题型 题目 可接受答案
analogy 模仿 When asked about his plan, he kept silent 结构，用"invite"造句 When invited to the party, she was very happy.
collocation while ___ (identify) me as an introvert identifying

Unit 4 - make相关短语（grammar_point_id=4）

题型 题目 可接受答案
phrase 辨认出 make out
collocation 散发出(气味/光) give off
synonym give away的含义（两个） 赠送, 泄露

---

九、测试验收标准

功能验收

· 自动翻页模式：4题全自动完成，无需点击
· 2秒出答案：时间误差 < 0.3秒
· 手动模式：上/下一题正常，答案仍按时显示
· 六种题型：每种至少2道题可正常展示和评分
· 多答案：TCM / Traditional Chinese Medicine 都接受
· AI生成：3-8秒内返回合规题目
· AI评分：造句题3秒内返回判断结果
· 知识图谱：点击按钮后1秒内渲染完成

性能验收

· 首屏加载 < 2秒
· 题目切换无白屏闪烁
· iPad投屏时文字清晰可读（> 36px）
· CDN静态资源加载 < 500ms

兼容性验收

· Chrome（最新版）
· Safari（iPadOS）
· 手机Chrome（响应式布局）

---

十、两周执行时间表

天数 模块 负责人 产出
1-2 环境搭建 + 数据库 后端 可访问的API根路径
3-4 规则匹配题型（4种） 后端 collocation/translation/synonym/phrase/morphology可用
5 AI评分接口 后端 analogy类型可批改
6-7 AI生成接口 后端 老师可动态出题
8 前端检测模式 前端 自动翻页+2秒答案完整流程
9 前端结果页 + 图谱集成 前端 检测结束展示正确率+按钮
10 知识图谱接口联调 全栈 按钮点击展示图谱
11 多答案测试 + 边界测试 测试 测试报告
12-13 移动端适配 + 部署 前端+运维 es.cldery.com可访问
14 整体验收 + 文档 全员 可演示原型

---

十一、后续扩展方向（本轮不做）

1. OCR自动导入语料（老师新PDF可一键导入）
2. 学生登录 + 个人错题本
3. 学情分析报表（班级正确率趋势）
4. 课堂手势控制（左右滑动翻页）
5. 语音输入答案（适合造句题）
