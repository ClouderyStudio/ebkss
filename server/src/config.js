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

// ── 运行时配置缓存（由 loadConfigFromDb 填充）───────────────
const runtime = {};

/**
 * 从数据库 settings 表加载系统配置。
 * 调用时机：数据库连接池创建后、createApp 之前。
 * DB 配置项优先于 .env；DB 连接信息本身仍从 .env 读取（鸡-蛋问题）。
 *
 * @param {Function} queryFn - async (sql, params) => rows
 */
export async function loadConfigFromDb(queryFn) {
  try {
    const rows = await queryFn("SELECT `key`, `value` FROM settings");
    const map = {};
    for (const row of rows) {
      map[row.key] = row.value;
    }

    // ── 应用 ──
    runtime.port = map.app_port ? toInt(map.app_port, 3000) : null;
    runtime.clientOrigin = map.app_client_origin || null;
    runtime.serveClient = map.app_serve_client !== undefined ? map.app_serve_client : null;

    // ── 认证 ──
    runtime.adminPasswordHash = map.admin_password_hash || null;
    runtime.authSecret = map.auth_secret || null;

    // ── AI ──
    runtime.aiBaseUrl = map.ai_base_url || null;
    runtime.aiApiKey = map.ai_api_key || null;
    runtime.aiModel = map.ai_model || null;
    runtime.aiNotesModel = map.ai_notes_model || null;
    runtime.aiTimeoutMs = map.ai_timeout_ms ? toInt(map.ai_timeout_ms) : null;

    // ── TTS ──
    runtime.ttsApiKey = map.tts_api_key || null;
    runtime.ttsModel = map.tts_model || null;
    runtime.ttsVoice = map.tts_voice || null;
    runtime.ttsCachePath = map.tts_cache_path || null;
    runtime.ttsDefaultSpeed = map.tts_default_speed ? toFloat(map.tts_default_speed) : null;
    runtime.ttsDefaultVolume = map.tts_default_volume ? toFloat(map.tts_default_volume) : null;

    // ── 课堂 ──
    runtime.showToAnswerDelay = map.classroom_show_to_answer_delay ? toInt(map.classroom_show_to_answer_delay) : null;
    runtime.answerHoldDelay = map.classroom_answer_hold_delay ? toInt(map.classroom_answer_hold_delay) : null;

    console.log('[config] Loaded %d settings from database', rows.length);
  } catch (err) {
    console.warn('[config] Failed to load from DB, using .env fallback:', err.message);
  }
}

/**
 * 运行时配置刷新（管理员修改设置后调用，仅更新内存中的值）。
 * 仅更新非 DB 连接类的配置项。
 */
export function refreshRuntimeConfig(settingsMap) {
  const map = settingsMap;
  if (map.app_port !== undefined) runtime.port = toInt(map.app_port, 3000);
  if (map.app_client_origin !== undefined) runtime.clientOrigin = map.app_client_origin;
  if (map.app_serve_client !== undefined) runtime.serveClient = map.app_serve_client;
  if (map.admin_password_hash !== undefined) runtime.adminPasswordHash = map.admin_password_hash;
  if (map.auth_secret !== undefined) runtime.authSecret = map.auth_secret;
  if (map.ai_base_url !== undefined) runtime.aiBaseUrl = map.ai_base_url;
  if (map.ai_api_key !== undefined) runtime.aiApiKey = map.ai_api_key;
  if (map.ai_model !== undefined) runtime.aiModel = map.ai_model;
  if (map.ai_notes_model !== undefined) runtime.aiNotesModel = map.ai_notes_model;
  if (map.ai_timeout_ms !== undefined) runtime.aiTimeoutMs = toInt(map.ai_timeout_ms);
  if (map.tts_api_key !== undefined) runtime.ttsApiKey = map.tts_api_key;
  if (map.tts_model !== undefined) runtime.ttsModel = map.tts_model;
  if (map.tts_voice !== undefined) runtime.ttsVoice = map.tts_voice;
  if (map.tts_cache_path !== undefined) runtime.ttsCachePath = map.tts_cache_path;
  if (map.tts_default_speed !== undefined) runtime.ttsDefaultSpeed = toFloat(map.tts_default_speed);
  if (map.tts_default_volume !== undefined) runtime.ttsDefaultVolume = toFloat(map.tts_default_volume);
  if (map.classroom_show_to_answer_delay !== undefined) runtime.showToAnswerDelay = toInt(map.classroom_show_to_answer_delay);
  if (map.classroom_answer_hold_delay !== undefined) runtime.answerHoldDelay = toInt(map.classroom_answer_hold_delay);
}

// ── config 导出 ── 通过 getter 实现 DB > .env > 默认值 的优先级 ──
export const config = {
  // 端口 → DB > .env > 默认
  get port() {
    return runtime.port ?? toInt(process.env.PORT, 3000);
  },
  get clientOrigin() {
    return runtime.clientOrigin ?? process.env.CLIENT_ORIGIN || 'http://localhost:5173';
  },
  get serveClient() {
    return runtime.serveClient !== null ? runtime.serveClient !== 'false' : process.env.SERVE_CLIENT !== 'false';
  },
  clientDistPath,

  // ── DB 配置永远只从 .env 读取 ──
  db: {
    host: process.env.DB_HOST,
    port: toInt(process.env.DB_PORT, 3306),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectionLimit: toInt(process.env.DB_CONNECTION_LIMIT, 10)
  },

  // ── AI ──
  ai: {
    get baseUrl() {
      return runtime.aiBaseUrl || process.env.AI_BASE_URL || 'https://api.siliconflow.cn/v1';
    },
    get apiKey() {
      return runtime.aiApiKey || process.env.SILICONFLOW_API_KEY || process.env.AI_API_KEY;
    },
    get model() {
      return runtime.aiModel || process.env.SILICONFLOW_LLM_MODEL || process.env.AI_MODEL || 'deepseek-ai/DeepSeek-V4-Flash';
    },
    get notesModel() {
      return runtime.aiNotesModel || process.env.AI_NOTES_MODEL || process.env.AI_MODEL || 'Qwen/Qwen3-32B';
    },
    get timeoutMs() {
      return runtime.aiTimeoutMs ?? toInt(process.env.AI_TIMEOUT_MS, 12000);
    }
  },

  // ── TTS ──
  tts: {
    get apiKey() {
      return runtime.ttsApiKey || process.env.DASHSCOPE_API_KEY;
    },
    get model() {
      return runtime.ttsModel || process.env.TTS_MODEL || 'qwen3-tts-vd-2026-01-26';
    },
    get voice() {
      return runtime.ttsVoice || process.env.TTS_VOICE || '沉稳清晰的女教师声音';
    },
    get cachePath() {
      if (runtime.ttsCachePath) return path.resolve(process.cwd(), runtime.ttsCachePath);
      return path.resolve(process.cwd(), process.env.AUDIO_CACHE_PATH || 'public/audio/cache');
    },
    get defaultSpeed() {
      return runtime.ttsDefaultSpeed ?? toFloat(process.env.DEFAULT_TTS_SPEED, 0.8);
    },
    get defaultVolume() {
      return runtime.ttsDefaultVolume ?? toFloat(process.env.DEFAULT_TTS_VOLUME, 0.8);
    }
  },

  // ── 课堂 ──
  classroom: {
    get showToAnswerDelay() {
      return runtime.showToAnswerDelay ?? toInt(process.env.DEFAULT_SHOW_TO_ANSWER_DELAY, 3500);
    },
    get answerHoldDelay() {
      return runtime.answerHoldDelay ?? toInt(process.env.DEFAULT_ANSWER_HOLD_DELAY, 3000);
    }
  },

  // ── 认证 ──
  get adminPasswordHash() {
    return runtime.adminPasswordHash ?? null;
  },
  get authSecret() {
    return runtime.authSecret || process.env.AUTH_SECRET || 'ebkss-classroom-secret-2026';
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
