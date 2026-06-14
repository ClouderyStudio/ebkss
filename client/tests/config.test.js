import { describe, expect, it } from 'vitest';
import { CLASSROOM_CONFIG, QUIZ_CONFIG } from '../src/config.js';

describe('QUIZ_CONFIG', () => {
  it('uses a 2 second answer reveal delay', () => {
    expect(QUIZ_CONFIG.showAnswerDelay).toBe(2000);
  });

  it('keeps projection text readable', () => {
    expect(QUIZ_CONFIG.fontSize).toBeGreaterThanOrEqual(48);
    expect(QUIZ_CONFIG.answerFontSize).toBeGreaterThanOrEqual(36);
  });
});

describe('CLASSROOM_CONFIG', () => {
  it('matches the classroom timing defaults', () => {
    expect(CLASSROOM_CONFIG.showToAnswerDelay).toBe(2000);
    expect(CLASSROOM_CONFIG.answerHoldDelay).toBe(1500);
  });

  it('keeps TTS controls in the accepted range', () => {
    expect(CLASSROOM_CONFIG.defaultTtsSpeed).toBeGreaterThanOrEqual(CLASSROOM_CONFIG.minTtsSpeed);
    expect(CLASSROOM_CONFIG.defaultTtsSpeed).toBeLessThanOrEqual(CLASSROOM_CONFIG.maxTtsSpeed);
  });
});
