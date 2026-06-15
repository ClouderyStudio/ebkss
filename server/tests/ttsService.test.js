import { describe, expect, it } from 'vitest';
import { clampTtsSpeed, makeAudioCacheFileName, getTtsVoiceCacheKey } from '../src/services/ttsService.js';

describe('ttsService', () => {
  it('uses hash-based cache names for Chinese voice descriptions', () => {
    const name = makeAudioCacheFileName({ text: 'give up', voice: '沉稳清晰的女教师声音', speed: 0.8 });
    // voice 描述取 SHA1 前 8 位作为 key
    expect(name).toMatch(/^give_up_[a-f0-9]{8}_speed0\.8\.mp3$/);
  });

  it('clamps speed to the supported range', () => {
    expect(clampTtsSpeed(0.1)).toBe(0.5);
    expect(clampTtsSpeed(2)).toBe(1.5);
  });

  it('generates a hash-based cache key for Chinese voice descriptions', () => {
    const key = getTtsVoiceCacheKey('沉稳清晰的女教师声音');
    expect(key).toMatch(/^[a-f0-9]{8}$/);
  });

  it('returns default key for empty voice', () => {
    expect(getTtsVoiceCacheKey('')).toBe('default_voice');
  });
});
