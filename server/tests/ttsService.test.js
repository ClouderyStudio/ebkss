import { describe, expect, it } from 'vitest';
import { clampTtsSpeed, makeAudioCacheFileName, resolveTtsVoiceReference } from '../src/services/ttsService.js';

describe('ttsService', () => {
  it('uses readable cache names for classroom phrases', () => {
    expect(makeAudioCacheFileName({ text: 'give up', voice: 'anna', speed: 0.7 })).toBe(
      'give_up_anna_speed0.7.mp3'
    );
  });

  it('clamps speed to the supported range', () => {
    expect(clampTtsSpeed(0.1)).toBe(0.5);
    expect(clampTtsSpeed(2)).toBe(1.5);
  });

  it('expands short SiliconFlow voice names with the model prefix', () => {
    expect(resolveTtsVoiceReference('anna', 'FunAudioLLM/CosyVoice2-0.5B')).toBe(
      'FunAudioLLM/CosyVoice2-0.5B:anna'
    );
  });
});
