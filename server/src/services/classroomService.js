import { execute, query } from '../db.js';
import { classroomGraphFallback } from '../data/classroomSeedData.js';
import { generateClassroomKnowledgeGraph } from './aiService.js';

function parseJson(value, fallback) {
  if (!value) {
    return fallback;
  }

  if (typeof value === 'string') {
    return JSON.parse(value);
  }

  return value;
}

export function normalizeGroupName(groupName = 'give') {
  return String(groupName || 'give').trim().toLowerCase();
}

export function graphNodeIdFromEnglish(english) {
  return String(english).trim().toLowerCase().replace(/\s+/g, '_');
}

export async function getClassroomCorpus(groupName = 'give') {
  const group = normalizeGroupName(groupName);
  const rows = await query(
    `
      SELECT id, english, chinese, english_explain, phonetic, tags, group_name
      FROM classroom_corpus
      WHERE group_name = ?
      ORDER BY sort_order, id
    `,
    [group]
  );

  return rows.map((row) => ({
    id: row.id,
    english: row.english,
    chinese: row.chinese,
    englishExplain: row.english_explain,
    phonetic: row.phonetic,
    tags: parseJson(row.tags, []),
    groupName: row.group_name,
    graphNodeId: graphNodeIdFromEnglish(row.english)
  }));
}

export async function getClassroomGraph(groupName = 'give') {
  const group = normalizeGroupName(groupName);
  const [cached] = await query('SELECT graph_data FROM classroom_knowledge_graphs WHERE group_name = ?', [group]);

  if (cached) {
    return { cached: true, graph: parseJson(cached.graph_data, classroomGraphFallback) };
  }

  const corpus = await getClassroomCorpus(group);
  if (corpus.length === 0) {
    throw new Error('Classroom corpus group not found');
  }

  let graph;
  try {
    graph = await generateClassroomKnowledgeGraph({ groupName: group, corpus });
  } catch (error) {
    if (group !== 'give') {
      throw error;
    }
    graph = classroomGraphFallback;
  }

  await execute(
    `
      INSERT INTO classroom_knowledge_graphs (group_name, graph_data)
      VALUES (?, CAST(? AS JSON))
      ON DUPLICATE KEY UPDATE graph_data = VALUES(graph_data), updated_at = CURRENT_TIMESTAMP
    `,
    [group, JSON.stringify(graph)]
  );

  return { cached: false, graph };
}

