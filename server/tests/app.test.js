import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/db.js', () => ({
  pingDatabase: vi.fn(async () => ({ ok: true })),
  query: vi.fn(async (sql) => {
    if (sql.includes('FROM grammar_points')) {
      return [{ name: '现在完成时', notes_content: 'have/has done' }];
    }
    return [];
  })
}));

vi.mock('../src/services/quizService.js', () => ({
  getUnits: vi.fn(async () => [
    {
      id: 1,
      name: 'Unit 1 - 现在完成时',
      gradeLevel: '初中',
      grammarPoints: [{ id: 1, name: '现在完成时', notesContent: 'have/has done' }]
    }
  ]),
  getQuiz: vi.fn(async () => [
    {
      id: 1,
      unitId: 1,
      questionType: 'translation',
      questionText: '在过去的几年里',
      matchRule: 'case_insensitive'
    }
  ]),
  submitQuiz: vi.fn(async () => ({
    recordId: 1,
    totalQuestions: 1,
    correctCount: 1,
    score: 100,
    accuracy: 1,
    results: []
  })),
  saveGeneratedQuestions: vi.fn(async () => ({ insertedCount: 1, insertedIds: [9] }))
}));

vi.mock('../src/services/aiService.js', () => ({
  generateQuestions: vi.fn(async () => [
    {
      questionType: 'phrase',
      questionText: '辨认出',
      acceptableAnswers: ['make out'],
      matchRule: 'case_insensitive',
      requiresAi: false,
      difficulty: 1
    }
  ])
}));

vi.mock('../src/services/classroomService.js', () => ({
  createClassroomCorpusItem: vi.fn(async (input) => ({ id: 2, ...input, tags: input.tags, graphNodeId: 'new_word' })),
  updateClassroomCorpusItem: vi.fn(async (id, input) => ({ id, ...input, graphNodeId: 'updated_word' })),
  deleteClassroomCorpusItem: vi.fn(async (id) => ({ deleted: true, id })),
  getClassroomCorpus: vi.fn(async () => [
    {
      id: 1,
      english: 'give up',
      chinese: '放弃',
      englishExplain: 'to quit or stop trying',
      phonetic: '/ɡɪv ʌp/',
      tags: ['phrase'],
      groupName: 'give',
      graphNodeId: 'give_up'
    }
  ]),
  getClassroomGroups: vi.fn(async () => [{ groupName: 'give', itemCount: 5 }]),
  getClassroomGraph: vi.fn(async () => ({
    cached: true,
    graph: { nodes: [{ id: 'give_up', name: 'give up', type: 'phrase', meaning: '放弃' }], edges: [] }
  })),
  invalidateClassroomGraph: vi.fn(async () => undefined)
}));

vi.mock('../src/services/graphService.js', () => ({
  getKnowledgeGraph: vi.fn(async () => ({
    cached: true,
    graph: { nodes: [{ id: '1', name: '现在完成时' }], edges: [] }
  }))
}));

vi.mock('../src/services/ttsService.js', () => ({
  getOrCreateSpeech: vi.fn(async () => ({
    url: '/audio/cache/give_up_anna_speed0.7.mp3',
    cached: true,
    text: 'give up',
    speed: 0.7,
    voice: 'anna'
  }))
}));

const { createApp } = await import('../src/app.js');

describe('api routes', () => {
  let app;

  beforeEach(() => {
    app = createApp();
  });

  it('returns health status', async () => {
    const response = await request(app).get('/api/health').expect(200);
    expect(response.body.database.ok).toBe(true);
  });

  it('returns units and quiz questions', async () => {
    const units = await request(app).get('/api/units').expect(200);
    expect(units.body.units[0].grammarPoints[0].name).toBe('现在完成时');

    const quiz = await request(app).get('/api/quiz/1?count=4&mode=student').expect(200);
    expect(quiz.body.questions[0].questionType).toBe('translation');
  });

  it('returns classroom corpus, tts urls, and classroom graphs', async () => {
    const corpus = await request(app).get('/api/corpus?group=give').expect(200);
    expect(corpus.body.items[0].graphNodeId).toBe('give_up');

    const groups = await request(app).get('/api/corpus/groups').expect(200);
    expect(groups.body.groups[0].groupName).toBe('give');

    const tts = await request(app).get('/api/tts?text=give%20up&speed=0.7').expect(200);
    expect(tts.body.cached).toBe(true);

    const graph = await request(app).get('/api/graph?group=give').expect(200);
    expect(graph.body.graph.nodes[0].id).toBe('give_up');
  });

  it('manages classroom corpus items', async () => {
    const created = await request(app)
      .post('/api/corpus')
      .send({ english: 'new word', chinese: '新词', groupName: 'class-notes', tags: ['phrase'] })
      .expect(201);
    expect(created.body.item.english).toBe('new word');

    const updated = await request(app)
      .put('/api/corpus/2')
      .send({ english: 'updated word', chinese: '更新' })
      .expect(200);
    expect(updated.body.item.id).toBe(2);

    const deleted = await request(app).delete('/api/corpus/2').expect(200);
    expect(deleted.body.deleted).toBe(true);

    const invalidated = await request(app).delete('/api/graph?group=class-notes').expect(200);
    expect(invalidated.body.invalidated).toBe(true);
  });

  it('submits answers and saves generated corpus', async () => {
    const submit = await request(app)
      .post('/api/submit')
      .send({ unitId: 1, answers: [{ questionId: 1, answer: 'over the past few years' }] })
      .expect(200);
    expect(submit.body.score).toBe(100);

    const save = await request(app)
      .post('/api/corpus/bulk')
      .send({
        grammarPointId: 1,
        questions: [{ questionType: 'phrase', questionText: '辨认出', acceptableAnswers: ['make out'] }]
      })
      .expect(200);
    expect(save.body.insertedCount).toBe(1);
  });

  it('generates questions and returns graphs', async () => {
    const generated = await request(app)
      .post('/api/ai/generate')
      .send({ grammarPointId: 1, count: 1 })
      .expect(200);
    expect(generated.body.questions[0].acceptableAnswers).toEqual(['make out']);

    const graph = await request(app).get('/api/graph/1').expect(200);
    expect(graph.body.graph.nodes[0].name).toBe('现在完成时');
  });
});
