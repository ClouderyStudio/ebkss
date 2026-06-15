import { execute, query } from '../db.js';
import { classroomGraphFallback, classroomNotesGraphFallback } from '../data/classroomSeedData.js';
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

function normalizeTags(tags) {
  if (Array.isArray(tags)) {
    return tags.map((tag) => String(tag).trim()).filter(Boolean);
  }

  if (typeof tags === 'string') {
    return tags
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  return [];
}

function mapClassroomCorpusRow(row) {
  return {
    id: row.id,
    english: row.english,
    chinese: row.chinese,
    englishExplain: row.english_explain,
    phonetic: row.phonetic,
    tags: parseJson(row.tags, []),
    groupName: row.group_name,
    sortOrder: row.sort_order,
    sourceKey: row.source_key,
    graphNodeId: graphNodeIdFromEnglish(row.english)
  };
}

function fallbackGraphForGroup(group, corpus = []) {
  if (group === 'class-notes' && corpus.length > 0) {
    return buildClassNotesGraph(corpus);
  }

  return group === 'class-notes' ? classroomNotesGraphFallback : classroomGraphFallback;
}

function buildClassNotesGraph(corpus) {
  const labels = {
    structure: '结构与组成',
    reasoning: '理由与推理',
    'word-senses': '词汇辨析',
    'word-family': '词族辨析',
    appeal: '呼吁与吸引',
    place: '家与发源地',
    try: '尝试表达',
    article: '冠词用法',
    applause: '鼓掌与喝彩',
    phrase: '高频短语',
    proposal: '辨认与提议',
    'verb-form': '动词变化',
    culture: '文化与认同',
    give: 'give 短语',
    'confusing-words': '易混词',
    adjective: '形容词'
  };

  const categoryIds = new Set(corpus.map((item) => item.tags?.[0] || 'phrase'));
  const nodes = [
    { id: 'class_notes', name: '课堂词组', type: 'root', meaning: '本轮新增语料' },
    ...Array.from(categoryIds).map((tag) => ({
      id: `cat_${tag.replace(/[^a-z0-9]+/g, '_')}`,
      name: labels[tag] || tag,
      type: 'category',
      meaning: labels[tag] || tag
    })),
    ...corpus.map((item) => ({
      id: item.graphNodeId,
      name: item.english,
      type: 'phrase',
      meaning: item.chinese,
      description: item.englishExplain
    }))
  ];

  const edges = [
    ...Array.from(categoryIds).map((tag) => ({
      source: 'class_notes',
      target: `cat_${tag.replace(/[^a-z0-9]+/g, '_')}`,
      label: '分类'
    })),
    ...corpus.map((item) => {
      const tag = item.tags?.[0] || 'phrase';
      return {
        source: `cat_${tag.replace(/[^a-z0-9]+/g, '_')}`,
        target: item.graphNodeId,
        label: '包含'
      };
    })
  ];

  return { nodes, edges };
}

export async function getClassroomCorpus(groupName = 'give') {
  const group = normalizeGroupName(groupName);
  const rows = await query(
    `
      SELECT id, english, chinese, english_explain, phonetic, tags, group_name, sort_order, source_key
      FROM classroom_corpus
      WHERE group_name = ?
      ORDER BY sort_order, id
    `,
    [group]
  );

  return rows.map(mapClassroomCorpusRow);
}

export async function getClassroomGroups() {
  const rows = await query(
    `
      SELECT group_name, COUNT(*) AS item_count
      FROM classroom_corpus
      GROUP BY group_name
      ORDER BY group_name
    `
  );

  return rows.map((row) => ({
    groupName: row.group_name,
    itemCount: Number(row.item_count)
  }));
}

export async function invalidateClassroomGraph(groupName) {
  const group = normalizeGroupName(groupName);
  await execute('DELETE FROM classroom_knowledge_graphs WHERE group_name = ?', [group]);
}

export async function createClassroomCorpusItem(input) {
  const group = normalizeGroupName(input.groupName);
  const [maxRow] = await query('SELECT COALESCE(MAX(sort_order), 0) AS max_order FROM classroom_corpus WHERE group_name = ?', [
    group
  ]);
  const sortOrder = input.sortOrder ?? Number(maxRow?.max_order || 0) + 1;

  const result = await execute(
    `
      INSERT INTO classroom_corpus
        (english, chinese, english_explain, phonetic, tags, group_name, sort_order, source_key)
      VALUES (?, ?, ?, ?, CAST(? AS JSON), ?, ?, ?)
    `,
    [
      input.english,
      input.chinese || '',
      input.englishExplain || '',
      input.phonetic || '',
      JSON.stringify(normalizeTags(input.tags)),
      group,
      sortOrder,
      input.sourceKey || `manual-${group}-${Date.now()}`
    ]
  );

  await invalidateClassroomGraph(group);
  const [created] = await query('SELECT * FROM classroom_corpus WHERE id = ?', [result.insertId]);
  return mapClassroomCorpusRow(created);
}

export async function updateClassroomCorpusItem(id, input) {
  const [existing] = await query('SELECT * FROM classroom_corpus WHERE id = ?', [id]);
  if (!existing) {
    throw new Error('Classroom corpus item not found');
  }

  const group = normalizeGroupName(input.groupName ?? existing.group_name);
  await execute(
    `
      UPDATE classroom_corpus
      SET english = ?,
          chinese = ?,
          english_explain = ?,
          phonetic = ?,
          tags = CAST(? AS JSON),
          group_name = ?,
          sort_order = ?
      WHERE id = ?
    `,
    [
      input.english ?? existing.english,
      input.chinese ?? existing.chinese ?? '',
      input.englishExplain ?? existing.english_explain ?? '',
      input.phonetic ?? existing.phonetic ?? '',
      JSON.stringify(normalizeTags(input.tags ?? parseJson(existing.tags, []))),
      group,
      input.sortOrder ?? existing.sort_order ?? 0,
      id
    ]
  );

  await invalidateClassroomGraph(existing.group_name);
  if (group !== existing.group_name) {
    await invalidateClassroomGraph(group);
  }

  const [updated] = await query('SELECT * FROM classroom_corpus WHERE id = ?', [id]);
  return mapClassroomCorpusRow(updated);
}

export async function deleteClassroomCorpusItem(id) {
  const [existing] = await query('SELECT * FROM classroom_corpus WHERE id = ?', [id]);
  if (!existing) {
    throw new Error('Classroom corpus item not found');
  }

  await execute('DELETE FROM classroom_corpus WHERE id = ?', [id]);
  await invalidateClassroomGraph(existing.group_name);
  return { deleted: true, id };
}

export async function getClassroomGraph(groupName = 'give') {
  const group = normalizeGroupName(groupName);
  const [cached] = await query('SELECT graph_data FROM classroom_knowledge_graphs WHERE group_name = ?', [group]);

  if (cached) {
    return { cached: true, graph: parseJson(cached.graph_data, fallbackGraphForGroup(group)) };
  }

  const corpus = await getClassroomCorpus(group);
  if (corpus.length === 0) {
    throw new Error('Classroom corpus group not found');
  }

  let graph;
  try {
    graph = await generateClassroomKnowledgeGraph({ groupName: group, corpus });
  } catch (error) {
    if (group !== 'give' && group !== 'class-notes') {
      throw error;
    }
    graph = fallbackGraphForGroup(group, corpus);
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
