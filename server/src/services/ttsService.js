import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';

const speedSchema = {
  min: 0.5,
  max: 1.5
};

const VOICE_ID_CACHE_FILE = 'voice_id_cache.json';

// ── 音色管理 ─────────────────────────────────────────────────

/**
 * 对音色描述取 SHA1 前 8 位作为缓存 key，避免长文件名。
 */
export function getTtsVoiceCacheKey(voice = config.tts.voice) {
  const normalized = String(voice || '').trim();
  if (!normalized) {
    return 'default_voice';
  }
  return crypto.createHash('sha1').update(normalized).digest('hex').slice(0, 8);
}

/**
 * 读取缓存的 voice_id（key 为音色描述的 hash）。
 */
async function readCachedVoiceId() {
  try {
    const raw = await fs.readFile(path.join(config.tts.cachePath, VOICE_ID_CACHE_FILE), 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function writeCachedVoiceId(cache) {
  await fs.mkdir(config.tts.cachePath, { recursive: true });
  await fs.writeFile(path.join(config.tts.cachePath, VOICE_ID_CACHE_FILE), JSON.stringify(cache, null, 2));
}

/**
 * 通过 DashScope 声音设计 API 创建音色，返回 voice_id。
 * 缓存到文件避免重复创建（每次创建会产生费用）。
 */
async function ensureVoiceId(voiceDescription) {
  const cache = await readCachedVoiceId();
  const cacheKey = getTtsVoiceCacheKey(voiceDescription);

  if (cache[cacheKey]) {
    return cache[cacheKey];
  }

  if (!config.tts.apiKey) {
    throw new Error('Missing DASHSCOPE_API_KEY');
  }

  // 第 1 步：调用声音设计 API 创建音色
  // preferred_name 限制约 13 字符，纯字母和下划线
  const preferredName = 'ebkss_def';
  const designBody = {
    model: 'qwen-voice-design',
    input: {
      action: 'create',
      target_model: config.tts.model,
      preferred_name: preferredName,
      voice_prompt: voiceDescription,
      preview_text: 'Hello everyone, welcome to today English class.'
    },
    parameters: {
      sample_rate: 24000,
      response_format: 'wav'
    }
  };

  const designResp = await fetch('https://dashscope.aliyuncs.com/api/v1/services/audio/tts/customization', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.tts.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(designBody)
  });

  if (!designResp.ok) {
    const detail = await designResp.text();
    // 如果音色已存在（重复调用），尝试从错误信息中获取已有 voice_id
    if (designResp.status === 400 && detail.includes('preferred_name')) {
      // 尝试用已有名称音色查询 API 获取 voice_id
      throw new Error(`Voice design failed: ${detail.slice(0, 240)}. Try deleting the cached voice file and restarting.`);
    }
    throw new Error(`Voice design failed (${designResp.status}): ${detail.slice(0, 240)}`);
  }

  const designResult = await designResp.json();
  const voiceId = designResult?.output?.voice;

  if (!voiceId) {
    throw new Error('Voice design succeeded but no voice ID returned');
  }

  // 缓存 voice_id
  cache[cacheKey] = voiceId;
  await writeCachedVoiceId(cache);

  return voiceId;
}

// ── 速度控制 ─────────────────────────────────────────────────

export function clampTtsSpeed(speed = config.tts.defaultSpeed) {
  const parsed = Number.parseFloat(speed);
  if (!Number.isFinite(parsed)) {
    return config.tts.defaultSpeed;
  }
  return Math.min(speedSchema.max, Math.max(speedSchema.min, Number(parsed.toFixed(2))));
}

// ── 缓存文件名 ───────────────────────────────────────────────

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

// ── 语音合成 ─────────────────────────────────────────────────

export async function getOrCreateSpeech({ text, speed, voice = config.tts.voice }) {
  const normalizedText = String(text || '').trim();
  if (!normalizedText) {
    throw new Error('TTS text is required');
  }

  const normalizedSpeed = clampTtsSpeed(speed);
  const voiceDescription = String(voice || config.tts.voice).trim() || '沉稳清晰的女教师声音';

  const cachePath = getAudioCachePath({ text: normalizedText, voice, speed: normalizedSpeed });
  const url = getAudioUrl({ text: normalizedText, voice, speed: normalizedSpeed });

  await fs.mkdir(config.tts.cachePath, { recursive: true });

  // 检查缓存
  try {
    await fs.access(cachePath);
    return { url, cached: true, text: normalizedText, speed: normalizedSpeed, voice: voiceDescription, voiceRef: voiceDescription };
  } catch {
    // Cache miss
  }

  if (!config.tts.apiKey) {
    throw new Error('Missing DASHSCOPE_API_KEY');
  }

  // 第 1 步：确保音色已创建（声音设计），获取 voice_id
  const voiceId = await ensureVoiceId(voiceDescription);

  // 第 2 步：使用 voice_id 调用 multimodal-generation 合成语音
  const synthBody = {
    model: config.tts.model,
    input: {
      text: normalizedText,
      voice: voiceId
    },
    parameters: {
      speech_rate: normalizedSpeed
    }
  };

  const synthResp = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.tts.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(synthBody)
  });

  if (!synthResp.ok) {
    const detail = await synthResp.text();
    throw new Error(`TTS synthesis failed (${synthResp.status}): ${detail.slice(0, 240)}`);
  }

  const synthResult = await synthResp.json();
  const audioUrl = synthResult?.output?.audio?.url;
  const audioData = synthResult?.output?.audio?.data;

  let audioBuffer;

  if (audioUrl) {
    // 从 OSS URL 下载音频
    const audioResp = await fetch(audioUrl);
    if (!audioResp.ok) {
      throw new Error(`Failed to download audio from OSS (${audioResp.status})`);
    }
    audioBuffer = Buffer.from(await audioResp.arrayBuffer());
  } else if (audioData) {
    // base64 编码的音频数据
    audioBuffer = Buffer.from(audioData, 'base64');
  } else {
    throw new Error('TTS response contains no audio data or URL');
  }

  await fs.writeFile(cachePath, audioBuffer);

  return { url, cached: false, text: normalizedText, speed: normalizedSpeed, voice: voiceDescription, voiceRef: voiceDescription };
}
