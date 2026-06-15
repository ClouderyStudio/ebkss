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

const clientDistPath = process.env.CLIENT_DIST_PATH
  ? path.resolve(process.cwd(), process.env.CLIENT_DIST_PATH)
  : path.resolve(process.cwd(), '..', 'client', 'dist');

export const config = {
  port: toInt(process.env.PORT, 3000),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  serveClient: process.env.SERVE_CLIENT !== 'false', // 生产环境默认内置前端
  clientDistPath,
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
    notesModel: process.env.AI_NOTES_MODEL || process.env.AI_MODEL || 'Qwen/Qwen3-32B',
    timeoutMs: toInt(process.env.AI_TIMEOUT_MS, 12000)
  },
  tts: {
    apiKey: process.env.DASHSCOPE_API_KEY,
    model: process.env.TTS_MODEL || 'qwen3-tts-vd-2026-01-26',
    voice: process.env.TTS_VOICE || '沉稳清晰的女教师声音',
    cachePath: path.resolve(process.cwd(), process.env.AUDIO_CACHE_PATH || 'public/audio/cache'),
    defaultSpeed: toFloat(process.env.DEFAULT_TTS_SPEED, 0.8),
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
