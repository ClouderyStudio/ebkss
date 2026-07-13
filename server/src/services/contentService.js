import { execute, query, withTransaction } from '../db.js';
import { generateQuestions, gradeAnalogy, parseEnglishNotes } from './aiService.js';
import { createClassroomCorpusItem } from './classroomService.js';
import { mapCorpusRow, toDbQuestion } from './corpusMapper.js';
import { checkAnswer, parseAcceptableAnswers } from '../utils/answerMatcher.js';
import { parseNotesLines } from '../utils/notesParser.js';

export async function getNotes() {
  const rows = await query('SELECT id, title, raw_content, parsed_entries, source_type, source_key, created_at, updated_at FROM imported_notes ORDER BY created_at DESC');
  return rows.map((row) => ({ id: row.id, title: row.title, rawContent: row.raw_content, parsedEntries: row.parsed_entries ? JSON.parse(row.parsed_entries) : null, sourceType: row.source_type, sourceKey: row.source_key, createdAt: row.created_at, updatedAt: row.updated_at }));
}

export async function createNote({ title = '', rawContent, sourceType = 'text', sourceKey }) {
  if (!rawContent?.trim()) throw new Error('笔记内容不能为空');
  const result = await execute('INSERT INTO imported_notes (grammar_point_id, title, raw_content, source_type, source_key) VALUES (NULL, ?, ?, ?, ?)', [title || rawContent.slice(0, 80), rawContent, sourceType, sourceKey || `note-${Date.now()}`]);
  const [note] = await getNotesByIds([result.insertId]);
  return note;
}

export async function updateNote(id, { title = '', rawContent }) {
  if (!rawContent?.trim()) throw new Error('笔记内容不能为空');
  const result = await execute(
    'UPDATE imported_notes SET title = ?, raw_content = ?, parsed_entries = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
    [title, rawContent, id]
  );
  if (!result.affectedRows) throw new Error('笔记不存在');
  const [note] = await getNotesByIds([id]);
  return note;
}

async function getNotesByIds(ids) {
  if (!ids.length) return [];
  const rows = await query(`SELECT id, title, raw_content, parsed_entries, source_type, source_key, created_at, updated_at FROM imported_notes WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
  return rows.map((row) => ({ id: row.id, title: row.title, rawContent: row.raw_content, parsedEntries: row.parsed_entries ? JSON.parse(row.parsed_entries) : null, sourceType: row.source_type, sourceKey: row.source_key, createdAt: row.created_at, updatedAt: row.updated_at }));
}

export async function createNoteFromDocx({ rawContent, title = '' }) {
  return createNote({ title, rawContent, sourceType: 'docx', sourceKey: `docx-${Date.now()}` });
}

export async function deleteStandaloneNote(id) {
  const result = await execute('DELETE FROM imported_notes WHERE id = ?', [id]);
  if (!result.affectedRows) throw new Error('笔记不存在');
  return { deleted: true, id };
}

export async function parseNoteEntries(id, mode = 'ai') {
  const [note] = await getNotesByIds([id]);
  if (!note) throw new Error('笔记不存在');
  const entries =
    mode === 'ai'
      ? await parseEnglishNotes(note.rawContent, note.title || '笔记')
      : parseNotesLines(note.rawContent.split('\n'));
  if (!entries.length) throw new Error('未能从笔记中提取出有效条目');
  await execute('UPDATE imported_notes SET parsed_entries = CAST(? AS JSON) WHERE id = ?', [JSON.stringify(entries), id]);
  return entries;
}

export async function createQuestionGroup(groupName) {
  await execute('INSERT IGNORE INTO question_groups (group_name) VALUES (?)', [groupName]);
  return { groupName, itemCount: 0 };
}

export async function getQuestionGroups() {
  const rows = await query('SELECT question_groups.group_name, COUNT(corpus.id) AS item_count FROM question_groups LEFT JOIN corpus ON corpus.question_group = question_groups.group_name GROUP BY question_groups.group_name ORDER BY question_groups.group_name');
  return rows.map((row) => ({ groupName: row.group_name, itemCount: Number(row.item_count) }));
}

export async function getQuestions(questionGroup) {
  const rows = await query('SELECT * FROM corpus WHERE question_group = ? ORDER BY created_at DESC, id DESC', [questionGroup]);
  return rows.map((row) => mapCorpusRow(row, { includeAnswers: true }));
}

export async function getQuizByGroup(questionGroup, count = 8) {
  const rows = await query('SELECT * FROM corpus WHERE question_group = ? ORDER BY RAND() LIMIT ?', [questionGroup, Math.min(Math.max(Number(count) || 8, 1), 20)]);
  return rows.map((row) => mapCorpusRow(row));
}

export async function submitContentQuiz({ questionGroup, studentName = '匿名学生', mode = 'student', answers }) {
  if (!questionGroup || !Array.isArray(answers) || !answers.length) throw new Error('题目组和答案不能为空');
  const ids = answers.map((answer) => Number(answer.questionId)).filter(Number.isInteger);
  const rows = ids.length ? await query(`SELECT * FROM corpus WHERE id IN (${ids.map(() => '?').join(',')})`, ids) : [];
  const byId = new Map(rows.map((row) => [row.id, row]));
  const results = [];
  for (const answer of answers) {
    const row = byId.get(Number(answer.questionId));
    if (!row) { results.push({ questionId: answer.questionId, questionText: '', questionType: 'unknown', userAnswer: answer.answer || '', correctAnswers: [], isCorrect: false, score: 0, feedback: '题目不存在' }); continue; }
    const userAnswer = answer.answer || '';
    const correctAnswers = parseAcceptableAnswers(row.acceptable_answers);
    let scored;
    if (row.question_type === 'analogy' || row.requires_ai) {
      try { scored = await gradeAnalogy({ questionText: row.question_text, template: row.template, userAnswer }); }
      catch (error) { scored = { isCorrect: false, score: 0, feedback: `AI评分失败：${error.message.slice(0, 32)}` }; }
    } else {
      const isCorrect = checkAnswer(userAnswer, correctAnswers, row.match_rule);
      scored = { isCorrect, score: isCorrect ? 100 : 0, feedback: isCorrect ? '正确' : '再看答案' };
    }
    results.push({ questionId: row.id, questionText: row.question_text, questionType: row.question_type, userAnswer, correctAnswers, ...scored });
  }
  const correctCount = results.filter((result) => result.isCorrect).length;
  const score = Math.round(results.reduce((total, result) => total + result.score, 0) / results.length);
  const recordId = await withTransaction(async (connection) => {
    const [record] = await connection.execute('INSERT INTO quiz_records (unit_id, question_group, student_name, total_questions, correct_count, score, mode) VALUES (NULL, ?, ?, ?, ?, ?, ?)', [questionGroup, studentName, results.length, correctCount, score, mode]);
    for (const result of results) await connection.execute('INSERT INTO quiz_record_answers (quiz_record_id, corpus_id, question_type, user_answer, is_correct, score, feedback, correct_answers) VALUES (?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON))', [record.insertId, result.questionId, result.questionType, result.userAnswer, result.isCorrect ? 1 : 0, result.score, result.feedback, JSON.stringify(result.correctAnswers)]);
    return record.insertId;
  });
  return { recordId, totalQuestions: results.length, correctCount, score, accuracy: correctCount / results.length, results };
}

export async function saveQuestions({ questionGroup, questions }) {
  await createQuestionGroup(questionGroup);
  const ids = [];
  for (const raw of questions) {
    const question = toDbQuestion(raw, {});
    if (!question.questionText || !question.acceptableAnswers.length) throw new Error('题干和答案不能为空');
    const result = await execute('INSERT INTO corpus (unit_id, grammar_point_id, question_group, question_type, question_text, acceptable_answers, template, match_rule, requires_ai, difficulty, source_key) VALUES (NULL, NULL, ?, ?, ?, CAST(? AS JSON), ?, ?, ?, ?, ?)', [questionGroup, question.questionType, question.questionText, JSON.stringify(question.acceptableAnswers), question.template, question.matchRule, question.requiresAi ? 1 : 0, question.difficulty, question.sourceKey]);
    ids.push(result.insertId);
  }
  return { insertedCount: ids.length, insertedIds: ids };
}

export async function updateStandaloneQuestion(id, input) {
  const rows = await query('SELECT * FROM corpus WHERE id = ?', [id]);
  const existing = rows[0];
  if (!existing) throw new Error('题目不存在');

  const question = toDbQuestion(
    {
      ...input,
      requiresAi: input.questionType === 'analogy'
    },
    {}
  );
  await execute(
    `
      UPDATE corpus
      SET question_type = ?,
          question_text = ?,
          acceptable_answers = CAST(? AS JSON),
          template = ?,
          match_rule = ?,
          requires_ai = ?,
          difficulty = ?
      WHERE id = ?
    `,
    [
      question.questionType,
      question.questionText,
      JSON.stringify(question.acceptableAnswers),
      question.template,
      question.matchRule,
      question.requiresAi ? 1 : 0,
      question.difficulty,
      id
    ]
  );
  const [updated] = await query('SELECT * FROM corpus WHERE id = ?', [id]);
  return mapCorpusRow(updated, { includeAnswers: true });
}

export async function deleteStandaloneQuestion(id) {
  return withTransaction(async (connection) => {
    await connection.execute('DELETE FROM quiz_record_answers WHERE corpus_id = ?', [id]);
    const [result] = await connection.execute('DELETE FROM corpus WHERE id = ?', [id]);
    if (!result.affectedRows) throw new Error('题目不存在');
    return { deleted: true, id };
  });
}

export async function deleteStandaloneQuestionGroup(groupName) {
  const questions = await getQuestions(groupName);
  if (!questions.length) await execute('DELETE FROM question_groups WHERE group_name = ?', [groupName]);
  else await withTransaction(async (connection) => {
    await connection.query('DELETE FROM quiz_record_answers WHERE corpus_id IN (?)', [questions.map((question) => question.id)]);
    await connection.execute('DELETE FROM corpus WHERE question_group = ?', [groupName]);
    await connection.execute('DELETE FROM question_groups WHERE group_name = ?', [groupName]);
  });
  return { deleted: true, groupName, count: questions.length };
}

export async function generateQuestionsForNote(noteId, questionGroup, count) {
  const [note] = await getNotesByIds([noteId]);
  if (!note) throw new Error('笔记不存在');
  const questions = await generateQuestions({ topic: note.title || '导入笔记', notesContent: note.rawContent, count });
  const saved = await saveQuestions({ questionGroup, questions });
  return { ...saved, questions };
}

export async function generateCorpusForNote(noteId, groupName, mode = 'ai') {
  const entries = await parseNoteEntries(noteId, mode);
  const items = [];
  for (const entry of entries) items.push(await createClassroomCorpusItem({ ...entry, groupName, sourceKey: `note-${noteId}-${entry.english}-${Date.now()}` }));
  return { noteId, groupName, imported: items.length, items };
}
