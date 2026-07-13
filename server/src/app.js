import cors from 'cors';
import express from 'express';
import { z } from 'zod';
import { execute, pingDatabase, query } from './db.js';
import { config } from './config.js';
import { generateQuestions, generateQuestionsStream, parseEnglishNotes } from './services/aiService.js';
import {
  createNote,
  createNoteFromDocx,
  createQuestionGroup as createStandaloneQuestionGroup,
  deleteStandaloneNote,
  deleteStandaloneQuestion,
  deleteStandaloneQuestionGroup,
  generateCorpusForNote,
  generateQuestionsForNote,
  getNotes,
  getQuestionGroups as getStandaloneQuestionGroups,
  getQuestions as getStandaloneQuestions,
  getQuizByGroup,
  parseNoteEntries,
  saveQuestions,
  submitContentQuiz,
  updateNote,
  updateStandaloneQuestion
} from './services/contentService.js';
import { signToken, verifyToken } from './services/authService.js';
import { getAllSettings, getGroupedSettings, updateSettings } from './services/settingsService.js';
import {
  createClassroomCorpusItem,
  createClassroomGroup,
  deleteClassroomCorpusItem,
  deleteClassroomGroup,
  getClassroomCorpus,
  getClassroomCorpusByGrammarPoint,
  getClassroomGraph,
  getClassroomGroups,
  invalidateClassroomGraph,
  updateClassroomCorpusItem
} from './services/classroomService.js';
import { getOrCreateSpeech } from './services/ttsService.js';
import { parseDocx } from './utils/docxParser.js';
import { parseNotesLines } from './utils/notesParser.js';

export function createApp() {
  const app = express();

  // 生产模式（内置前端）不需要 CORS；开发模式允许 Vite 跨域
  if (config.serveClient) {
    app.use(cors({ origin: true, credentials: false }));
  } else {
    app.use(cors({ origin: config.clientOrigin, credentials: false }));
  }
  app.use(express.json({ limit: '1mb' }));
  app.use('/audio/cache', express.static(config.tts.cachePath));

  // ── 认证 ───────────────────────────────────────────
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { password } = z.object({ password: z.string().min(1) }).parse(req.body);
      const crypto = await import('node:crypto');

      // 优先从 config（运行时配置）读取密码hash，其次从 DB，最后用环境变量
      let expectedHash = config.adminPasswordHash;

      if (!expectedHash) {
        try {
          const [row] = await query("SELECT value FROM settings WHERE `key` = 'admin_password_hash'");
          if (row) expectedHash = row.value;
        } catch { /* 表可能不存在 */ }
      }

      if (!expectedHash) {
        // fallback: 环境变量或默认密码
        const plainPassword = process.env.ADMIN_PASSWORD || 'ebkss2026';
        expectedHash = crypto.createHash('sha256').update(plainPassword).digest('hex');
      }

      const inputHash = crypto.createHash('sha256').update(password).digest('hex');

      if (inputHash !== expectedHash) {
        // 防御性修复：DB 中可能存了明文密码（旧版 bug 遗留数据）
        // SHA256 hex 固定 64 字符 [0-9a-f]；明文密码不会是 64 位 hex
        const isHashFormat = /^[0-9a-f]{64}$/.test(expectedHash);
        if (!isHashFormat && crypto.createHash('sha256').update(expectedHash).digest('hex') === inputHash) {
          // DB 存的是明文，自动修正为 SHA256 哈希
          const hashed = crypto.createHash('sha256').update(expectedHash).digest('hex');
          await execute(
            "INSERT INTO settings (`key`, `value`) VALUES ('admin_password_hash', ?) ON DUPLICATE KEY UPDATE `value` = ?",
            [hashed, hashed]
          );
          console.log('[auth] Auto-healed: DB plaintext password hashed to SHA256.');
          res.json({ token: signToken() });
          return;
        }

        res.status(401).json({ error: '密码错误' });
        return;
      }

      res.json({ token: signToken() });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Invalid request', details: error.flatten() });
        return;
      }
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/auth/verify', async (req, res) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const payload = verifyToken(token);
    res.json({ valid: !!payload });
  });

  // ── 系统设置管理 ────────────────────────────────
  // 获取所有设置（需认证）
  app.get('/api/settings', async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
      if (!verifyToken(token)) {
        res.status(401).json({ error: '请先登录' });
        return;
      }
      res.json({ groups: await getGroupedSettings() });
    } catch (error) {
      next(error);
    }
  });

  // 批量更新设置（需认证）
  app.put('/api/settings', async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
      if (!verifyToken(token)) {
        res.status(401).json({ error: '请先登录' });
        return;
      }
      const input = z.record(z.string(), z.string()).parse(req.body);
      res.json({ settings: await updateSettings(input) });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Invalid request', details: error.flatten() });
        return;
      }
      next(error);
    }
  });

  app.get('/api/health', async (_req, res) => {
    const database = await pingDatabase();
    res.json({
      ok: true,
      service: 'english-basical-knowledge-study-system',
      database
    });
  });

  // ── 独立笔记、语料、题目模型 ─────────────────────────
  app.get('/api/content/notes', async (_req, res, next) => {
    try { res.json({ notes: await getNotes() }); } catch (error) { next(error); }
  });

  app.post('/api/content/notes', async (req, res, next) => {
    try {
      const input = z.object({ title: z.string().max(200).optional().default(''), rawContent: z.string().min(1) }).parse(req.body);
      res.status(201).json({ note: await createNote(input) });
    } catch (error) { next(error); }
  });

  app.post('/api/content/notes/import-docx', async (req, res, next) => {
    try {
      const input = z.object({ title: z.string().max(200).optional().default(''), file: z.string().min(1) }).parse(req.body);
      const lines = await parseDocx(Buffer.from(input.file, 'base64'));
      if (!lines.length) throw new Error('Word 文件内容为空或无法解析');
      res.status(201).json({ note: await createNoteFromDocx({ title: input.title, rawContent: lines.join('\n') }) });
    } catch (error) { next(error); }
  });

  app.put('/api/content/notes/:id', async (req, res, next) => {
    try {
      const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
      const input = z.object({ title: z.string().trim().max(200).default(''), rawContent: z.string().trim().min(1) }).parse(req.body);
      res.json({ note: await updateNote(id, input) });
    } catch (error) { next(error); }
  });

  app.delete('/api/content/notes/:id', async (req, res, next) => {
    try { const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(req.params); res.json(await deleteStandaloneNote(id)); } catch (error) { next(error); }
  });

  app.post('/api/content/notes/:id/generate-corpus', async (req, res, next) => {
    try {
      const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
      const input = z.object({ groupName: z.string().trim().min(1).max(100), mode: z.enum(['rule', 'ai']).default('ai') }).parse(req.body);
      res.json({ result: await generateCorpusForNote(id, input.groupName, input.mode) });
    } catch (error) { next(error); }
  });

  app.post('/api/content/notes/:id/generate-questions', async (req, res, next) => {
    try {
      const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
      const input = z.object({ questionGroup: z.string().trim().min(1).max(100), count: z.coerce.number().int().min(1).max(12).default(4) }).parse(req.body);
      res.json(await generateQuestionsForNote(id, input.questionGroup, input.count));
    } catch (error) { next(error); }
  });

  app.get('/api/content/question-groups', async (_req, res, next) => {
    try { res.json({ groups: await getStandaloneQuestionGroups() }); } catch (error) { next(error); }
  });

  app.post('/api/content/question-groups', async (req, res, next) => {
    try { const { groupName } = z.object({ groupName: z.string().trim().min(1).max(100) }).parse(req.body); res.status(201).json({ group: await createStandaloneQuestionGroup(groupName) }); } catch (error) { next(error); }
  });

  app.delete('/api/content/question-groups/:groupName', async (req, res, next) => {
    try { const { groupName } = z.object({ groupName: z.string().trim().min(1) }).parse(req.params); res.json(await deleteStandaloneQuestionGroup(groupName)); } catch (error) { next(error); }
  });

  app.get('/api/content/questions', async (req, res, next) => {
    try { const { group } = z.object({ group: z.string().trim().min(1) }).parse(req.query); res.json({ questions: await getStandaloneQuestions(group) }); } catch (error) { next(error); }
  });

  app.get('/api/content/quiz', async (req, res, next) => {
    try {
      const input = z.object({ group: z.string().trim().min(1), count: z.coerce.number().int().min(1).max(20).optional() }).parse(req.query);
      res.json({ questions: await getQuizByGroup(input.group, input.count) });
    } catch (error) { next(error); }
  });

  app.post('/api/content/submit', async (req, res, next) => {
    try { res.json(await submitContentQuiz(req.body)); } catch (error) { next(error); }
  });

  app.post('/api/content/questions', async (req, res, next) => {
    try { res.status(201).json(await saveQuestions(req.body)); } catch (error) { next(error); }
  });

  app.put('/api/content/questions/:id', async (req, res, next) => {
    try {
      const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
      const input = z.object({
        questionType: z.enum(['collocation', 'translation', 'synonym', 'analogy', 'morphology', 'phrase']),
        questionText: z.string().trim().min(1),
        acceptableAnswers: z.array(z.string().trim().min(1)).min(1).max(20),
        template: z.string().trim().nullable().optional(),
        matchRule: z.enum(['exact', 'case_insensitive', 'trim']).default('exact'),
        difficulty: z.coerce.number().int().min(1).max(5).default(1)
      }).parse(req.body);
      res.json({ question: await updateStandaloneQuestion(id, input) });
    } catch (error) { next(error); }
  });

  app.delete('/api/content/questions/:id', async (req, res, next) => {
    try { const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(req.params); res.json(await deleteStandaloneQuestion(id)); } catch (error) { next(error); }
  });

  app.get('/api/corpus', async (req, res, next) => {
    try {
      const input = z
        .object({
          group: z.string().trim().min(1).default('give')
        })
        .parse(req.query);

      res.json({ group: input.group, items: await getClassroomCorpus(input.group) });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/corpus/groups', async (_req, res, next) => {
    try {
      res.json({ groups: await getClassroomGroups() });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/corpus/groups', async (req, res, next) => {
    try {
      const { groupName } = z.object({ groupName: z.string().trim().min(1).max(100) }).parse(req.body);
      res.status(201).json({ group: await createClassroomGroup(groupName) });
    } catch (error) {
      next(error);
    }
  });

  const classroomCorpusBodySchema = z.object({
    english: z.string().trim().min(1),
    chinese: z.string().optional().default(''),
    englishExplain: z.string().optional().default(''),
    phonetic: z.string().optional().default(''),
    tags: z.union([z.array(z.string()), z.string()]).optional().default([]),
    groupName: z.string().trim().min(1).default('class-notes'),
    sortOrder: z.coerce.number().int().min(0).optional(),
    sourceKey: z.string().optional()
  });

  app.post('/api/corpus', async (req, res, next) => {
    try {
      res.status(201).json({ item: await createClassroomCorpusItem(classroomCorpusBodySchema.parse(req.body)) });
    } catch (error) {
      next(error);
    }
  });

  app.put('/api/corpus/:id', async (req, res, next) => {
    try {
      const params = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
      res.json({ item: await updateClassroomCorpusItem(params.id, classroomCorpusBodySchema.partial().parse(req.body)) });
    } catch (error) {
      next(error);
    }
  });

  // 删除整个语料组及其所有条目
  app.delete('/api/corpus/group/:groupName', async (req, res, next) => {
    try {
      const { groupName } = z.object({ groupName: z.string().trim().min(1) }).parse(req.params);
      res.json(await deleteClassroomGroup(groupName));
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/corpus/:id', async (req, res, next) => {
    try {
      const params = z.object({ id: z.coerce.number().int().positive() }).parse(req.params);
      res.json(await deleteClassroomCorpusItem(params.id));
    } catch (error) {
      next(error);
    }
  });

  // ── 一键导入 Word 文件 ──────────────────────────────────
  // mode: "rule"（规则解析，快速）| "ai"（AI 增强，精度高但慢）
  const importWordSchema = z.object({
    file: z.string().min(1),
    groupName: z.string().trim().min(1).default('class-notes'),
    mode: z.enum(['rule', 'ai']).default('rule')
  });

  async function processImport(base64File, groupName, mode) {
    const fileBuffer = Buffer.from(base64File, 'base64');
    const lines = await parseDocx(fileBuffer);
    if (lines.length === 0) {
      throw new Error('Word 文件内容为空或无法解析');
    }

    let entries;
    if (mode === 'ai') {
      const notesText = lines.join('\n');
      entries = await parseEnglishNotes(notesText, groupName);
    } else {
      entries = parseNotesLines(lines);
    }

    if (entries.length === 0) {
      throw new Error('未能从笔记中提取出有效条目');
    }

    const created = [];
    for (const entry of entries) {
      const item = await createClassroomCorpusItem({
        english: entry.english,
        chinese: entry.chinese || '',
        englishExplain: entry.englishExplain || '',
        phonetic: entry.phonetic || '',
        tags: entry.tags || [],
        groupName,
        sourceKey: `word-import-${mode}-${Date.now()}-${entry.english.slice(0, 20)}`
      });
      created.push(item);
    }

    await invalidateClassroomGraph(groupName);
    return { imported: created.length, groupName, mode, items: created };
  }

  app.post('/api/corpus/import-word', async (req, res, next) => {
    try {
      const { file, groupName, mode } = importWordSchema.parse(req.body);
      res.json(await processImport(file, groupName, mode));
    } catch (error) {
      next(error);
    }
  });

  // SSE 实时推送导入进度
  app.post('/api/corpus/import-word/stream', async (req, res) => {
    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // 禁用 nginx 缓冲
    res.flushHeaders();

    const send = (data) => {
      try {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      } catch {
        // 连接已关闭
      }
    };

    try {
      const { file, groupName } = importWordSchema.parse(req.body);

      // 1. 解析 docx
      send({ status: 'parsing', message: '正在解析 Word 文件...' });
      const fileBuffer = Buffer.from(file, 'base64');
      const lines = await parseDocx(fileBuffer);

      if (lines.length === 0) {
        send({ status: 'error', message: 'Word 文件内容为空' });
        res.end();
        return;
      }

      send({ status: 'parsed', message: `已提取 ${lines.length} 行文本` });

      // 2. AI 逐块解析 + 实时推送
      const allLines = lines.filter(Boolean);
      const chunkSize = 20;
      const allEntries = [];

      for (let i = 0; i < allLines.length; i += chunkSize) {
        const chunkLines = allLines.slice(i, i + chunkSize);
        const chunk = chunkLines.join('\n');

        send({
          status: 'ai_chunk',
          message: `AI 解析第 ${i + 1}-${Math.min(i + chunkSize, allLines.length)} 行...`,
          progress: `${i + 1}/${allLines.length}`
        });

        try {
          const entries = await parseEnglishNotes(chunk, groupName);
          allEntries.push(...entries);
          send({
            status: 'ai_progress',
            message: `已提取 ${allEntries.length} 条`,
            total: allEntries.length
          });
        } catch (err) {
          send({ status: 'ai_chunk_error', message: err.message });
        }
      }

      if (allEntries.length === 0) {
        send({ status: 'error', message: 'AI 未能提取有效条目' });
        res.end();
        return;
      }

      // 3. 批量入库
      send({ status: 'saving', message: `正在保存 ${allEntries.length} 条语料...` });
      const created = [];
      for (const entry of allEntries) {
        const item = await createClassroomCorpusItem({
          english: entry.english,
          chinese: entry.chinese || '',
          englishExplain: entry.englishExplain || '',
          phonetic: entry.phonetic || '',
          tags: entry.tags || [],
          groupName,
          sourceKey: `word-import-ssestream-${Date.now()}-${entry.english.slice(0, 20)}`
        });
        created.push(item);
      }

      await invalidateClassroomGraph(groupName);

      send({
        status: 'done',
        message: `完成！共导入 ${created.length} 条语料`,
        imported: created.length,
        groupName
      });
    } catch (err) {
      send({ status: 'error', message: err.message || '导入失败' });
    }

    res.end();
  });

  app.delete('/api/graph', async (req, res, next) => {
    try {
      const input = z
        .object({
          group: z.string().trim().min(1).default('class-notes')
        })
        .parse(req.query);
      await invalidateClassroomGraph(input.group);
      res.json({ invalidated: true, group: input.group });
    } catch (error) {
      next(error);
    }
  });

  app.get('/api/tts', async (req, res, next) => {
    try {
      const input = z
        .object({
          text: z.string().trim().min(1),
          speed: z.coerce.number().min(0.5).max(1.5).optional(),
          voice: z.string().trim().min(1).optional()
        })
        .parse(req.query);

      res.json(await getOrCreateSpeech(input));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/ai/generate', async (req, res, next) => {
    try {
      const input = z
        .object({
          topic: z.string().trim().min(1).optional().default('英语学习'),
          notesContent: z.string().optional(),
          count: z.coerce.number().int().min(1).max(12).default(4)
        })
        .parse(req.body);

      const questions = await generateQuestions({ topic: input.topic, notesContent: input.notesContent || '', count: input.count });

      res.json({ questions });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/ai/generate/stream', async (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const send = (payload) => {
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      }
    };

    const controller = new AbortController();
    req.once('aborted', () => controller.abort());
    res.once('close', () => {
      if (!res.writableEnded) controller.abort();
    });

    try {
      const input = z
        .object({
          topic: z.string().trim().min(1).optional().default('英语学习'),
          notesContent: z.string().optional().default(''),
          count: z.coerce.number().int().min(1).max(12).default(4)
        })
        .parse(req.body);

      send({ status: 'started' });
      const questions = await generateQuestionsStream({
        ...input,
        signal: controller.signal,
        onDelta: (text, phase) => send({ status: 'delta', text, phase })
      });
      send({ status: 'done', questions });
    } catch (error) {
      if (!controller.signal.aborted) {
        send({ status: 'error', message: error.message || 'AI 生成失败' });
      }
    } finally {
      res.end();
    }
  });

  app.get('/api/graph', async (req, res, next) => {
    try {
      const input = z
        .object({
          group: z.string().trim().min(1).default('give')
        })
        .parse(req.query);

      res.json(await getClassroomGraph(input.group));
    } catch (error) {
      next(error);
    }
  });

  app.use((error, _req, res, _next) => {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid request', details: error.flatten() });
      return;
    }

    const status = /not found/i.test(error.message) ? 404 : 500;
    res.status(status).json({ error: error.message || 'Internal server error' });
  });

  return app;
}
