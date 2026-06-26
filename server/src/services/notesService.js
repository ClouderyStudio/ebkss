import { execute, query } from '../db.js';
import { parseEnglishNotes } from './aiService.js';
import { normalizeGroupName, createClassroomCorpusItem, invalidateClassroomGraph } from './classroomService.js';
import { parseDocx } from '../utils/docxParser.js';
import { parseNotesLines } from '../utils/notesParser.js';

// ── 笔记管理 ─────────────────────────────────────────────

/**
 * 获取某个语法点下的所有已导入笔记
 */
export async function getImportedNotes(grammarPointId) {
  const rows = await query(
    `SELECT id, grammar_point_id, title, raw_content, parsed_entries, source_type, source_key, created_at, updated_at
     FROM imported_notes
     WHERE grammar_point_id = ?
     ORDER BY created_at DESC`,
    [grammarPointId]
  );
  return rows.map(mapNoteRow);
}

/**
 * 获取单条笔记
 */
export async function getNoteById(id) {
  const [row] = await query(
    `SELECT id, grammar_point_id, title, raw_content, parsed_entries, source_type, source_key, created_at, updated_at
     FROM imported_notes WHERE id = ?`,
    [id]
  );
  if (!row) throw new Error('笔记不存在');
  return mapNoteRow(row);
}

function mapNoteRow(row) {
  return {
    id: row.id,
    grammarPointId: row.grammar_point_id,
    title: row.title,
    rawContent: row.raw_content,
    parsedEntries: parseJsonSafe(row.parsed_entries),
    sourceType: row.source_type,
    sourceKey: row.source_key,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function parseJsonSafe(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return null; }
  }
  return value;
}

/**
 * 导入笔记（原始文本/文档内容存入 imported_notes）
 * @param {number} grammarPointId - 所属语法点 ID
 * @param {string} rawContent - 原始笔记文本
 * @param {string} title - 笔记标题（可选，默认取前 80 字符）
 * @param {string} sourceType - 来源类型 'docx' | 'text'
 * @param {string} sourceKey - 来源标识
 */
export async function importNotes({ grammarPointId, rawContent, title, sourceType = 'text', sourceKey }) {
  if (!rawContent || !rawContent.trim()) {
    throw new Error('笔记内容不能为空');
  }

  const key = sourceKey || `note-${grammarPointId}-${Date.now()}`;

  // 先查是否存在同 sourceKey
  const [existing] = await query('SELECT id FROM imported_notes WHERE source_key = ?', [key]);
  if (existing) {
    // 已存在则更新
    await execute(
      `UPDATE imported_notes SET raw_content = ?, title = ?, parsed_entries = NULL, source_type = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [rawContent, title || rawContent.slice(0, 80), sourceType, existing.id]
    );
    const [updated] = await query('SELECT * FROM imported_notes WHERE id = ?', [existing.id]);
    return mapNoteRow(updated);
  }

  const result = await execute(
    `INSERT INTO imported_notes (grammar_point_id, title, raw_content, source_type, source_key) VALUES (?, ?, ?, ?, ?)`,
    [grammarPointId, title || rawContent.slice(0, 80), rawContent, sourceType, key]
  );
  const [created] = await query('SELECT * FROM imported_notes WHERE id = ?', [result.insertId]);
  return mapNoteRow(created);
}

/**
 * 从 docx 文件导入笔记（解析 docx → 存入 imported_notes）
 */
export async function importNotesFromDocx(grammarPointId, base64File, title) {
  const fileBuffer = Buffer.from(base64File, 'base64');
  const lines = await parseDocx(fileBuffer);
  if (lines.length === 0) {
    throw new Error('Word 文件内容为空或无法解析');
  }
  const rawContent = lines.join('\n');
  return importNotes({
    grammarPointId,
    rawContent,
    title: title || '',
    sourceType: 'docx',
    sourceKey: `docx-${grammarPointId}-${Date.now()}`
  });
}

/**
 * 删除笔记
 */
export async function deleteNote(id) {
  const [existing] = await query('SELECT * FROM imported_notes WHERE id = ?', [id]);
  if (!existing) throw new Error('笔记不存在');
  await execute('DELETE FROM imported_notes WHERE id = ?', [id]);
  return { deleted: true, id };
}

// ── 从笔记生成课堂语料 ──────────────────────────────────

/**
 * AI 解析笔记 → 生成课堂语料条目（不直接入库，返回解析结果）
 * @param {number} noteId - 笔记 ID
 * @param {'rule'|'ai'} mode - 解析模式
 */
export async function parseNoteToEntries(noteId, mode = 'ai') {
  const note = await getNoteById(noteId);
  const rawContent = note.rawContent;

  let entries;
  if (mode === 'ai') {
    // 使用 AI 解析笔记（逐批处理长文本）
    const lines = rawContent.split('\n').filter(Boolean);
    const allEntries = [];
    const chunkSize = 20;

    for (let i = 0; i < lines.length; i += chunkSize) {
      const chunk = lines.slice(i, i + chunkSize).join('\n');
      try {
        const chunkEntries = await parseEnglishNotes(chunk, `grammar-${note.grammarPointId}`);
        allEntries.push(...chunkEntries);
      } catch {
        // 某块解析失败，继续下一块
      }
    }
    entries = allEntries;
  } else {
    // 规则解析
    entries = parseNotesLines(lines);
  }

  if (entries.length === 0) {
    throw new Error('未能从笔记中提取出有效条目');
  }

  // 保存解析结果到笔记记录
  await execute('UPDATE imported_notes SET parsed_entries = CAST(? AS JSON) WHERE id = ?', [
    JSON.stringify(entries),
    noteId
  ]);

  return entries;
}

/**
 * 从笔记生成课堂语料（解析 + 写入 classroom_corpus）
 * @param {number} noteId - 笔记 ID
 * @param {'rule'|'ai'} mode - 解析模式
 * @param {number} grammarPointId - 语法点ID（用于 group_name 推断）
 */
export async function generateCorpusFromNote(noteId, mode = 'ai', grammarPointId) {
  const note = await getNoteById(noteId);
  const gpid = grammarPointId || note.grammarPointId;

  // 获取 grammar_point name 作为 group_name
  const [gp] = await query('SELECT name FROM grammar_points WHERE id = ?', [gpid]);
  const groupName = normalizeGroupName(gp ? gp.name : `grammar-${gpid}`);

  // 解析笔记
  const entries = await parseNoteToEntries(noteId, mode);

  // 先清除该语法点旧的语料（避免重复）
  await deleteCorpusForGrammarPoint(gpid);

  // 写入 classroom_corpus
  const created = [];
  for (const entry of entries) {
    const item = await createClassroomCorpusItem({
      english: entry.english,
      chinese: entry.chinese || '',
      englishExplain: entry.englishExplain || '',
      phonetic: entry.phonetic || '',
      tags: entry.tags || [],
      groupName,
      grammarPointId: gpid,
      sourceKey: `note-${noteId}-${entry.english.slice(0, 30)}-${Date.now()}`
    });
    created.push(item);
  }

  await invalidateClassroomGraph(groupName);

  return { noteId, groupName, grammarPointId: gpid, imported: created.length, items: created };
}

/**
 * 从笔记生成题目（AI 解析 + 写入 corpus 表）
 * @param {number} noteId - 笔记 ID
 * @param {number} count - 题目数量
 */
export async function generateQuestionsFromNote(noteId, count = 4) {
  const note = await getNoteById(noteId);

  // 获取语法点信息
  const [gp] = await query('SELECT id, unit_id, name, notes_content FROM grammar_points WHERE id = ?', [
    note.grammarPointId
  ]);
  if (!gp) throw new Error('语法点不存在');

  const { generateQuestions } = await import('./aiService.js');

  const questions = await generateQuestions({
    grammarPoint: gp.name,
    notesContent: note.rawContent,
    count
  });

  const { toDbQuestion } = await import('./corpusMapper.js');
  const insertedIds = [];

  for (const q of questions) {
    const dbQ = toDbQuestion(q, { id: gp.id, unit_id: gp.unit_id });
    const result = await execute(
      `INSERT INTO corpus (unit_id, grammar_point_id, question_type, question_text, acceptable_answers, template, match_rule, requires_ai, difficulty, source_key)
       VALUES (?, ?, ?, ?, CAST(? AS JSON), ?, ?, ?, ?, ?)`,
      [
        dbQ.unitId,
        dbQ.grammarPointId,
        dbQ.questionType,
        dbQ.questionText,
        JSON.stringify(dbQ.acceptableAnswers),
        dbQ.template || null,
        dbQ.matchRule,
        dbQ.requiresAi ? 1 : 0,
        dbQ.difficulty,
        `note-question-${noteId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      ]
    );
    insertedIds.push(result.insertId);
  }

  return { noteId, grammarPointId: gp.id, generated: questions.length, insertedIds, questions };
}

/**
 * 删除指定语法点下的所有课堂语料
 */
export async function deleteCorpusForGrammarPoint(grammarPointId) {
  const [gp] = await query('SELECT name FROM grammar_points WHERE id = ?', [grammarPointId]);
  const groupName = normalizeGroupName(gp ? gp.name : `grammar-${grammarPointId}`);
  await execute('DELETE FROM classroom_corpus WHERE grammar_point_id = ?', [grammarPointId]);
  await invalidateClassroomGraph(groupName);
}

/**
 * 获取所有导入笔记的概览（按语法点分组计数）
 */
export async function getNotesOverview() {
  const rows = await query(`
    SELECT gp.id AS grammar_point_id, gp.name AS grammar_point_name,
           u.id AS unit_id, u.name AS unit_name,
           COUNT(inotes.id) AS note_count
    FROM grammar_points gp
    JOIN units u ON u.id = gp.unit_id
    LEFT JOIN imported_notes inotes ON inotes.grammar_point_id = gp.id
    GROUP BY gp.id, gp.name, u.id, u.name
    ORDER BY u.id, gp.id
  `);
  return rows.map(r => ({
    grammarPointId: r.grammar_point_id,
    grammarPointName: r.grammar_point_name,
    unitId: r.unit_id,
    unitName: r.unit_name,
    noteCount: Number(r.note_count)
  }));
}