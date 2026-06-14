import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';

const speedSchema = {
  min: 0.5,
  max: 1.5
};

export function resolveTtsVoiceReference(voice = config.tts.voice, model = config.tts.model) {
  const normalized = String(voice || '').trim();

  if (!normalized) {
    return `${model}:anna`;
  }

  if (normalized.startsWith('speech:')) {
    return normalized;
  }

  if (normalized.includes('/')) {
    return normalized;
  }

  return `${model}:${normalized}`;
}

export function getTtsVoiceCacheKey(voice = config.tts.voice) {
  const normalized = String(voice || '').trim();
  if (!normalized) {
    return 'anna';
  }

  if (normalized.startsWith('speech:')) {
    return normalized.split(':').pop() || 'voice';
  }

  if (normalized.includes(':')) {
    return normalized.split(':').pop() || 'voice';
  }

  return normalized;
}

export function clampTtsSpeed(speed = config.tts.defaultSpeed) {
  const parsed = Number.parseFloat(speed);
  if (!Number.isFinite(parsed)) {
    return config.tts.defaultSpeed;
  }
  return Math.min(speedSchema.max, Math.max(speedSchema.min, Number(parsed.toFixed(2))));
}

export function makeAudioCacheFileName({ text, voice = config.tts.voice, speed = config.tts.defaultSpeed }) {
  const voiceKey = getTtsVoiceCacheKey(voice);
  const slug = String(text)
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const safeSlug = slug || crypto.createHash('sha1').update(String(text)).digest('hex').slice(0, 12);
  return `${safeSlug}_${voiceKey}_speed${clampTtsSpeed(speed)}.mp3`;
}

export function getAudioCachePath(params) {
  return path.join(config.tts.cachePath, makeAudioCacheFileName(params));
}

export function getAudioUrl(params) {
  return `/audio/cache/${makeAudioCacheFileName(params)}`;
}

export async function getOrCreateSpeech({ text, speed, voice = config.tts.voice }) {
  const normalizedText = String(text || '').trim();
  if (!normalizedText) {
    throw new Error('TTS text is required');
  }

  const normalizedSpeed = clampTtsSpeed(speed);
  const voiceRef = resolveTtsVoiceReference(voice, config.tts.model);
  const cachePath = getAudioCachePath({ text: normalizedText, voice, speed: normalizedSpeed });
  const url = getAudioUrl({ text: normalizedText, voice, speed: normalizedSpeed });

  await fs.mkdir(config.tts.cachePath, { recursive: true });

  try {
    await fs.access(cachePath);
    return { url, cached: true, text: normalizedText, speed: normalizedSpeed, voice, voiceRef };
  } catch {
    // Cache miss; continue to synthesis.
  }

  if (!config.ai.apiKey) {
    throw new Error('Missing SILICONFLOW_API_KEY or AI_API_KEY');
  }

  const response = await fetch(`${config.ai.baseUrl.replace(/\/$/, '')}/audio/speech`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.ai.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: config.tts.model,
      input: normalizedText,
      voice: voiceRef,
      response_format: 'mp3',
      speed: normalizedSpeed,
      stream: false
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`TTS request failed (${response.status}): ${detail.slice(0, 240)}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(cachePath, buffer);

  return { url, cached: false, text: normalizedText, speed: normalizedSpeed, voice, voiceRef };
}
