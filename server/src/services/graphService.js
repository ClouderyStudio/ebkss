import { execute, query } from '../db.js';
import { generateKnowledgeGraph } from './aiService.js';

function parseGraph(value) {
  if (typeof value === 'string') {
    return JSON.parse(value);
  }
  return value;
}

export async function getKnowledgeGraph(grammarPointId) {
  const [cached] = await query('SELECT graph_data FROM knowledge_graphs WHERE grammar_point_id = ?', [
    grammarPointId
  ]);

  if (cached) {
    return { cached: true, graph: parseGraph(cached.graph_data) };
  }

  const [grammarPoint] = await query(
    `
      SELECT name, notes_content
      FROM grammar_points
      WHERE id = ?
    `,
    [grammarPointId]
  );

  if (!grammarPoint) {
    throw new Error('Grammar point not found');
  }

  const graph = await generateKnowledgeGraph({
    grammarPointName: grammarPoint.name,
    notesContent: grammarPoint.notes_content || grammarPoint.description || ''
  });

  await execute(
    `
      INSERT INTO knowledge_graphs (grammar_point_id, graph_data)
      VALUES (?, CAST(? AS JSON))
      ON DUPLICATE KEY UPDATE graph_data = VALUES(graph_data), updated_at = CURRENT_TIMESTAMP
    `,
    [grammarPointId, JSON.stringify(graph)]
  );

  return { cached: false, graph };
}

