import cors from 'cors';
import express from 'express';
import { z } from 'zod';
import { pingDatabase, query } from './db.js';
import { config } from './config.js';
import { generateQuestions } from './services/aiService.js';
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
import { parseEnglishNotes } from './services/aiService.js';

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
