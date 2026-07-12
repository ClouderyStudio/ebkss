import { query, withTransaction } from '../db.js';
import { invalidateClassroomGraph, normalizeGroupName } from './classroomService.js';

export async function createGrammarPoint({ unitId, name, description = '', notesContent = '' }) {
  const [unit] = await query('SELECT id FROM units WHERE id = ?', [unitId]);
  if (!unit) {
    throw new Error('Unit not found');
  }

  try {
    const result = await query(
      `INSERT INTO grammar_points (unit_id, name, description, notes_content) VALUES (?, ?, ?, ?)`,
      [unitId, name, description, notesContent]
    );
    return { id: result.insertId, unitId, name, description, notesContent };
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw new Error('Grammar point already exists in this unit');
    }
    throw error;
  }
}

export async function deleteGrammarPoint(grammarPointId) {
  const [grammarPoint] = await query('SELECT id, name FROM grammar_points WHERE id = ?', [grammarPointId]);
  if (!grammarPoint) {
    throw new Error('Grammar point not found');
  }

  const groupName = normalizeGroupName(grammarPoint.name);
  const result = await withTransaction(async (connection) => {
    const [questions] = await connection.execute('SELECT id FROM corpus WHERE grammar_point_id = ?', [grammarPointId]);
    const questionIds = questions.map((question) => question.id);
    if (questionIds.length) {
      await connection.query('DELETE FROM quiz_record_answers WHERE corpus_id IN (?)', [questionIds]);
    }

    await connection.execute('DELETE FROM corpus WHERE grammar_point_id = ?', [grammarPointId]);
    await connection.execute('DELETE FROM imported_notes WHERE grammar_point_id = ?', [grammarPointId]);
    await connection.execute('DELETE FROM knowledge_graphs WHERE grammar_point_id = ?', [grammarPointId]);
    await connection.execute('DELETE FROM classroom_corpus WHERE grammar_point_id = ?', [grammarPointId]);
    await connection.execute('DELETE FROM grammar_points WHERE id = ?', [grammarPointId]);
    return { deleted: true, id: grammarPointId, deletedQuestions: questionIds.length };
  });

  await invalidateClassroomGraph(groupName);
  return result;
}
