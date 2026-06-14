import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config();

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toFloat = (value, fallback) => {
  const parsed = Number.parseFloat(value ?? '');
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const config = {
  port: toInt(process.env.PORT, 3000),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  db: {
    host: process.env.DB_HOST,
    port: toInt(process.env.DB_PORT, 3306),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectionLimit: toInt(process.env.DB_CONNECTION_LIMIT, 10)
  },
  ai: {
    baseUrl: process.env.AI_BASE_URL || 'https://api.siliconflow.cn/v1',
    apiKey: process.env.SILICONFLOW_API_KEY || process.env.AI_API_KEY,
    model: process.env.SILICONFLOW_LLM_MODEL || process.env.AI_MODEL || 'deepseek-ai/DeepSeek-V4-Flash',
    timeoutMs: toInt(process.env.AI_TIMEOUT_MS, 12000)
  },
  tts: {
    model: process.env.SILICONFLOW_TTS_MODEL || 'FunAudioLLM/CosyVoice2-0.5B',
    voice: process.env.SILICONFLOW_TTS_VOICE || 'anna',
    cachePath: path.resolve(process.cwd(), process.env.AUDIO_CACHE_PATH || 'public/audio/cache'),
    defaultSpeed: toFloat(process.env.DEFAULT_TTS_SPEED, 0.7),
    defaultVolume: toFloat(process.env.DEFAULT_TTS_VOLUME, 0.8)
  },
  classroom: {
    showToAnswerDelay: toInt(process.env.DEFAULT_SHOW_TO_ANSWER_DELAY, 2000),
    answerHoldDelay: toInt(process.env.DEFAULT_ANSWER_HOLD_DELAY, 1500)
  }
};

export function assertDbConfig() {
  const missing = Object.entries({
    DB_HOST: config.db.host,
    DB_NAME: config.db.database,
    DB_USER: config.db.user,
    DB_PASSWORD: config.db.password
  })
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Missing database environment variables: ${missing.join(', ')}`);
  }
}
