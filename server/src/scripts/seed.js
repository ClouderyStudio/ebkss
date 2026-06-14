import { execute, getPool, query } from '../db.js';
import { classroomCorpus, classroomNotesCorpus } from '../data/classroomSeedData.js';
import { seedCorpus, seedUnits } from '../data/seedData.js';

async function upsertUnit(unit) {
  await execute(
    `
      INSERT INTO units (name, grade_level)
      VALUES (?, ?)
      ON DUPLICATE KEY UPDATE grade_level = VALUES(grade_level)
    `,
    [unit.name, unit.gradeLevel]
  );

  const [row] = await query('SELECT id FROM units WHERE name = ? AND grade_level = ?', [unit.name, unit.gradeLevel]);
  return row.id;
}

async function upsertGrammarPoint(unitId, point) {
  await execute(
    `
      INSERT INTO grammar_points (unit_id, name, description, notes_content)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        description = VALUES(description),
        notes_content = VALUES(notes_content)
    `,
    [unitId, point.name, point.description, point.notesContent]
  );

  const [row] = await query('SELECT id FROM grammar_points WHERE unit_id = ? AND name = ?', [unitId, point.name]);
  return row.id;
}

async function seed() {
  const unitIds = new Map();
  const grammarPointIds = new Map();

  for (const unit of seedUnits) {
    const unitId = await upsertUnit(unit);
    unitIds.set(unit.name, unitId);

    for (const point of unit.grammarPoints) {
      const pointId = await upsertGrammarPoint(unitId, point);
      grammarPointIds.set(`${unit.name}:${point.name}`, pointId);
    }
  }

  for (const item of seedCorpus) {
    const unitId = unitIds.get(item.unitName);
    const grammarPointId = grammarPointIds.get(`${item.unitName}:${item.grammarPointName}`);

    await execute(
      `
        INSERT INTO corpus
          (unit_id, grammar_point_id, question_type, question_text, acceptable_answers, template, match_rule, requires_ai, difficulty, source_key)
        VALUES (?, ?, ?, ?, CAST(? AS JSON), ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          question_text = VALUES(question_text),
          acceptable_answers = VALUES(acceptable_answers),
          template = VALUES(template),
          match_rule = VALUES(match_rule),
          requires_ai = VALUES(requires_ai),
          difficulty = VALUES(difficulty)
      `,
      [
        unitId,
        grammarPointId,
        item.questionType,
        item.questionText,
        JSON.stringify(item.acceptableAnswers),
        item.template || null,
        item.matchRule || 'exact',
        item.requiresAi || item.questionType === 'analogy' ? 1 : 0,
        item.difficulty || 1,
        item.sourceKey
      ]
    );
  }

  const allClassroomCorpus = [...classroomCorpus, ...classroomNotesCorpus];

  const groupOrder = new Map();

  for (const item of allClassroomCorpus) {
    const nextOrder = (groupOrder.get(item.groupName) || 0) + 1;
    groupOrder.set(item.groupName, nextOrder);

    await execute(
      `
        INSERT INTO classroom_corpus
          (english, chinese, english_explain, phonetic, tags, group_name, sort_order, source_key)
        VALUES (?, ?, ?, ?, CAST(? AS JSON), ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          english = VALUES(english),
          chinese = VALUES(chinese),
          english_explain = VALUES(english_explain),
          phonetic = VALUES(phonetic),
          tags = VALUES(tags),
          group_name = VALUES(group_name),
          sort_order = VALUES(sort_order)
      `,
      [
        item.english,
        item.chinese,
        item.englishExplain,
        item.phonetic,
        JSON.stringify(item.tags || []),
        item.groupName,
        nextOrder,
        item.sourceKey
      ]
    );
  }

  console.log(
    `Seed complete. Units: ${seedUnits.length}, corpus items: ${seedCorpus.length}, classroom items: ${allClassroomCorpus.length}.`
  );
  await getPool().end();
}

seed().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
