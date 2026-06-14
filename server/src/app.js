import cors from 'cors';
import express from 'express';
import { z } from 'zod';
import { pingDatabase, query } from './db.js';
import { config } from './config.js';
import { generateQuestions } from './services/aiService.js';
import { getClassroomCorpus, getClassroomGraph } from './services/classroomService.js';
import { getKnowledgeGraph } from './services/graphService.js';
import { getQuiz, getUnits, saveGeneratedQuestions, submitQuiz } from './services/quizService.js';
import { getOrCreateSpeech } from './services/ttsService.js';

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: config.clientOrigin,
      credentials: false
    })
  );
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
