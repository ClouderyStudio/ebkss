import { describe, expect, it } from 'vitest';
import { checkAnswer, normalizeAnswer, parseAcceptableAnswers } from '../src/utils/answerMatcher.js';

describe('answerMatcher', () => {
  it('normalizes whitespace and unicode width', () => {
    expect(normalizeAnswer('  ＴＣＭ   answer  ')).toBe('TCM answer');
  });

  it('matches case-insensitive answers', () => {
    expect(checkAnswer('traditional chinese medicine', ['TCM', 'Traditional Chinese Medicine'], 'case_insensitive')).toBe(
      true
    );
  });

  it('requires complete answer matches', () => {
    expect(checkAnswer('Traditional Chinese', ['Traditional Chinese Medicine'], 'case_insensitive')).toBe(false);
  });

  it('parses JSON answers stored by MySQL', () => {
    expect(parseAcceptableAnswers('["yet","up to now"]')).toEqual(['yet', 'up to now']);
  });
});

