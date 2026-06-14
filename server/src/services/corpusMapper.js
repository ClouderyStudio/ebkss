import { parseAcceptableAnswers } from '../utils/answerMatcher.js';

export function mapCorpusRow(row, { includeAnswers = false } = {}) {
  const item = {
    id: row.id,
    unitId: row.unit_id,
    grammarPointId: row.grammar_point_id,
    questionType: row.question_type,
    questionText: row.question_text,
    template: row.template,
    matchRule: row.match_rule,
    requiresAi: Boolean(row.requires_ai),
    difficulty: row.difficulty
  };

  if (includeAnswers) {
    item.acceptableAnswers = parseAcceptableAnswers(row.acceptable_answers);
  }

  return item;
}

export function toDbQuestion(question, grammarPoint) {
  const questionType = question.questionType || question.question_type;
  return {
    unitId: question.unitId || question.unit_id || grammarPoint.unit_id,
    grammarPointId: question.grammarPointId || question.grammar_point_id || grammarPoint.id,
    questionType,
    questionText: question.questionText || question.question_text,
    acceptableAnswers: question.acceptableAnswers || question.acceptable_answers || [],
    template: question.template || null,
    matchRule: question.matchRule || question.match_rule || 'exact',
    requiresAi: question.requiresAi ?? question.requires_ai ?? questionType === 'analogy',
    difficulty: question.difficulty || 1,
    sourceKey: question.sourceKey || question.source_key || null
  };
}

