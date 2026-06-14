export const MATCH_RULES = new Set(['exact', 'case_insensitive', 'trim']);

export function normalizeAnswer(value, matchRule = 'exact') {
  const normalized = String(value ?? '')
    .normalize('NFKC')
    .trim()
    .replace(/\s+/g, ' ');

  return matchRule === 'case_insensitive' ? normalized.toLowerCase() : normalized;
}

export function parseAcceptableAnswers(value) {
  if (Array.isArray(value)) {
    return value.map(String);
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return value ? [value] : [];
    }
  }

  return [];
}

export function checkAnswer(userAnswer, acceptableAnswers, matchRule = 'exact') {
  const answers = parseAcceptableAnswers(acceptableAnswers);
  const normalizedUserAnswer = normalizeAnswer(userAnswer, matchRule);

  if (!normalizedUserAnswer || answers.length === 0) {
    return false;
  }

  return answers.some((answer) => normalizeAnswer(answer, matchRule) === normalizedUserAnswer);
}

