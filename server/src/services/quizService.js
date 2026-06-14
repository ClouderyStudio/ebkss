import { z } from 'zod';
import { execute, query, withTransaction } from '../db.js';
import { checkAnswer, parseAcceptableAnswers } from '../utils/answerMatcher.js';
import { gradeAnalogy } from './aiService.js';
import { mapCorpusRow, toDbQuestion } from './corpusMapper.js';

const QUESTION_TYPES = ['collocation', 'translation', 'synonym', 'analogy', 'morphology', 'phrase'];

const submitSchema = z.object({
  unitId: z.coerce.number().int().positive(),
  studentName: z.string().max(80).optional().default('匿名学生'),
  mode: z.enum(['student', 'teacher']).optional().default('student'),
  answers: z
    .array(
      z.object({
        questionId: z.coerce.number().int().positive(),
        answer: z.string().optional().default('')
      })
    )
    .min(1)
});

const bulkQuestionSchema = z.object({
  grammarPointId: z.coerce.number().int().positive(),
  questions: z
    .array(
      z.object({
        questionType: z.enum(QUESTION_TYPES).optional(),
        question_type: z.enum(QUESTION_TYPES).optional(),
        questionText: z.string().optional(),
        question_text: z.string().optional(),
        acceptableAnswers: z.array(z.string()).optional(),
        acceptable_answers: z.array(z.string()).optional(),
        template: z.string().optional().nullable(),
        matchRule: z.enum(['exact', 'case_insensitive', 'trim']).optional(),
        match_rule: z.enum(['exact', 'case_insensitive', 'trim']).optional(),
        difficulty: z.number().int().min(1).max(5).optional(),
        requiresAi: z.boolean().optional(),
        requires_ai: z.boolean().optional()
      })
    )
    .min(1)
});

export async function getUnits() {
  const units = await query(`
    SELECT id, name, grade_level
    FROM units
    ORDER BY id
  `);

  const grammarPoints = await query(`
    SELECT id, unit_id, name, description, notes_content
    FROM grammar_points
    ORDER BY id
  `);

  return units.map((unit) => ({
    id: unit.id,
    name: unit.name,
    gradeLevel: unit.grade_level,
    grammarPoints: grammarPoints
      .filter((point) => point.unit_id === unit.id)
      .map((point) => ({
        id: point.id,
        unitId: point.unit_id,
        name: point.name,
        description: point.description,
        notesContent: point.notes_content
      }))
  }));
}

export async function getQuiz(unitId, { count = 4, mode = 'student' } = {}) {
  const safeCount = Math.min(Math.max(Number.parseInt(count, 10) || 4, 1), 20);
  const includeAnswers = mode === 'teacher';

  const rows = await query(
    `
      SELECT *
      FROM corpus
      WHERE unit_id = ?
      ORDER BY RAND()
      LIMIT ?
    `,
    [unitId, safeCount]
  );

  return rows.map((row) => mapCorpusRow(row, { includeAnswers }));
}

export async function getCorpusByIds(questionIds) {
  if (questionIds.length === 0) {
    return [];
  }

  const placeholders = questionIds.map(() => '?').join(',');
  return query(`SELECT * FROM corpus WHERE id IN (${placeholders})`, questionIds);
}

export async function scoreAnswer(row, userAnswer) {
  const correctAnswers = parseAcceptableAnswers(row.acceptable_answers);

  if (row.question_type === 'analogy' || row.requires_ai) {
    try {
      const aiResult = await gradeAnalogy({
        questionText: row.question_text,
        template: row.template,
        userAnswer
      });

      return {
        questionId: row.id,
        questionType: row.question_type,
        questionText: row.question_text,
        userAnswer,
        correctAnswers,
        ...aiResult
      };
    } catch (error) {
      return {
        questionId: row.id,
        questionType: row.question_type,
        questionText: row.question_text,
        userAnswer,
        correctAnswers,
        isCorrect: false,
        score: 0,
        feedback: `AI评分失败：${error.message.slice(0, 32)}`
      };
    }
  }

  const isCorrect = checkAnswer(userAnswer, correctAnswers, row.match_rule);
  return {
    questionId: row.id,
    questionType: row.question_type,
    questionText: row.question_text,
    userAnswer,
    correctAnswers,
    isCorrect,
    score: isCorrect ? 100 : 0,
    feedback: isCorrect ? '正确' : '再看答案'
  };
}

export async function submitQuiz(payload) {
  const input = submitSchema.parse(payload);
  const rows = await getCorpusByIds(input.answers.map((answer) => answer.questionId));
  const rowById = new Map(rows.map((row) => [row.id, row]));

  const results = [];
  for (const answer of input.answers) {
    const row = rowById.get(answer.questionId);
    if (!row) {
      results.push({
        questionId: answer.questionId,
        questionType: 'unknown',
        questionText: '',
        userAnswer: answer.answer,
        correctAnswers: [],
        isCorrect: false,
        score: 0,
        feedback: '题目不存在'
      });
      continue;
    }

    results.push(await scoreAnswer(row, answer.answer));
  }

  const totalQuestions = results.length;
  const correctCount = results.filter((result) => result.isCorrect).length;
  const totalScore =
    totalQuestions === 0
      ? 0
      : Math.round(results.reduce((sum, result) => sum + result.score, 0) / totalQuestions);

  const recordId = await withTransaction(async (connection) => {
    const [recordResult] = await connection.execute(
      `
        INSERT INTO quiz_records
          (unit_id, student_name, total_questions, correct_count, score, mode)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
      [input.unitId, input.studentName || '匿名学生', totalQuestions, correctCount, totalScore, input.mode]
    );

    for (const result of results) {
      await connection.execute(
        `
          INSERT INTO quiz_record_answers
            (quiz_record_id, corpus_id, question_type, user_answer, is_correct, score, feedback, correct_answers)
          VALUES (?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON))
        `,
        [
          recordResult.insertId,
          result.questionId,
          result.questionType,
          result.userAnswer,
          result.isCorrect ? 1 : 0,
          result.score,
          result.feedback,
          JSON.stringify(result.correctAnswers)
        ]
      );
    }

    return recordResult.insertId;
  });

  return {
    recordId,
    totalQuestions,
    correctCount,
    score: totalScore,
    accuracy: totalQuestions === 0 ? 0 : correctCount / totalQuestions,
    results
  };
}

export async function saveGeneratedQuestions(payload) {
  const input = bulkQuestionSchema.parse(payload);
  const [grammarPoint] = await query('SELECT * FROM grammar_points WHERE id = ?', [input.grammarPointId]);

  if (!grammarPoint) {
    throw new Error('Grammar point not found');
  }

  const questions = input.questions.map((question) => toDbQuestion(question, grammarPoint));
  const insertedIds = [];

  for (const question of questions) {
    if (!question.questionText || question.acceptableAnswers.length === 0) {
      throw new Error('Question text and acceptable answers are required');
    }

    const result = await execute(
      `
        INSERT INTO corpus
          (unit_id, grammar_point_id, question_type, question_text, acceptable_answers, template, match_rule, requires_ai, difficulty, source_key)
        VALUES (?, ?, ?, ?, CAST(? AS JSON), ?, ?, ?, ?, ?)
      `,
      [
        question.unitId,
        question.grammarPointId,
        question.questionType,
        question.questionText,
        JSON.stringify(question.acceptableAnswers),
        question.template,
        question.matchRule,
        question.requiresAi ? 1 : 0,
        question.difficulty,
        question.sourceKey
      ]
    );

    insertedIds.push(result.insertId);
  }

  return { insertedCount: insertedIds.length, insertedIds };
}

