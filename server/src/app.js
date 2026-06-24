import cors from 'cors';
import express from 'express';
import { z } from 'zod';
import { pingDatabase, query } from './db.js';
import { config } from './config.js';
import { generateQuestions, parseEnglishNotes } from './services/aiService.js';
import { signToken, verifyToken, requireAuth as _requireAuth } from './services/authService.js';
import { getAllSettings, getGroupedSettings, updateSettings } from './services/settingsService.js';
import {
  createClassroomCorpusItem,
  deleteClassroomCorpusItem,
  getClassroomCorpus,
  getClassroomGraph,
  getClassroomGroups,
  invalidateClassroomGraph,
  updateClassroomCorpusItem
} from './services/classroomService.js';
import { getKnowledgeGraph } from './services/graphService.js';
import { getQuiz, getUnits, saveGeneratedQuestions, submitQuiz } from './services/quizService.js';
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

  app.get('/api/units', async (_req, res, next) => {
    try {
      res.json({ units: await getUnits() });
    } catch (error) {
      next(error);
    }
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
      const result = await query('SELECT COUNT(*) AS count FROM classroom_corpus WHERE group_name = ?', [groupName]);
      const count = Number(result[0]?.count || 0);
      if (count === 0) {
        res.status(404).json({ error: `语料组 "${groupName}" 不存在` });
        return;
      }
      await query('DELETE FROM classroom_corpus WHERE group_name = ?', [groupName]);
      await query('DELETE FROM classroom_knowledge_graphs WHERE group_name = ?', [groupName]);
      res.json({ deleted: true, groupName, count });
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

  app.get('/api/quiz/:unitId', async (req, res, next) => {
    try {
      const params = z.object({ unitId: z.coerce.number().int().positive() }).parse(req.params);
      const queryParams = z
        .object({
          count: z.coerce.number().int().positive().max(20).optional(),
          mode: z.enum(['teacher', 'student']).optional().default('student')
        })
        .parse(req.query);

      res.json({ questions: await getQuiz(params.unitId, queryParams) });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/submit', async (req, res, next) => {
    try {
      res.json(await submitQuiz(req.body));
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/ai/generate', async (req, res, next) => {
    try {
      const input = z
        .object({
          grammarPointId: z.coerce.number().int().positive(),
          notesContent: z.string().optional(),
          count: z.coerce.number().int().min(1).max(12).default(4)
        })
        .parse(req.body);

      const [grammarPoint] = await query('SELECT name, notes_content FROM grammar_points WHERE id = ?', [
        input.grammarPointId
      ]);

      if (!grammarPoint) {
        res.status(404).json({ error: 'Grammar point not found' });
        return;
      }

      const questions = await generateQuestions({
        grammarPoint: grammarPoint.name,
        notesContent: input.notesContent || grammarPoint.notes_content || '',
        count: input.count
      });

      res.json({ questions });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/corpus/bulk', async (req, res, next) => {
    try {
      res.json(await saveGeneratedQuestions(req.body));
    } catch (error) {
      next(error);
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

  app.get('/api/graph/:grammarPointId', async (req, res, next) => {
    try {
      const params = z.object({ grammarPointId: z.coerce.number().int().positive() }).parse(req.params);
      res.json(await getKnowledgeGraph(params.grammarPointId));
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
