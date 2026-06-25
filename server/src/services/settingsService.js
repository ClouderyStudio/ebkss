import { config, refreshRuntimeConfig } from '../config.js';
import { query, execute } from '../db.js';

/**
 * 以 key-value map 形式返回所有系统设置（不含敏感脱敏前值）。
 */
export async function getAllSettings() {
  const rows = await query('SELECT `key`, `value`, `description`, `updated_at` FROM settings ORDER BY `key`');
  const map = {};
  for (const row of rows) {
    map[row.key] = {
      key: row.key,
      value: row.value,
      description: row.description || '',
      updatedAt: row.updated_at
    };
  }
  return map;
}

/**
 * 按前缀分组返回设置（用于前端分组展示）。
 */
export async function getGroupedSettings() {
  const rows = await query('SELECT `key`, `value`, `description`, `updated_at` FROM settings ORDER BY `key`');
  const groups = {
    app: { label: '应用', items: [] },
    auth: { label: '认证', items: [] },
    ai: { label: 'AI', items: [] },
    tts: { label: '语音合成 (TTS)', items: [] },
    classroom: { label: '课堂', items: [] }
  };

  for (const row of rows) {
    const item = { key: row.key, value: row.value, description: row.description || '', updatedAt: row.updated_at };
    if (row.key.startsWith('app_')) {
      groups.app.items.push(item);
    } else if (row.key.startsWith('auth_') || row.key.startsWith('admin_')) {
      groups.auth.items.push(item);
    } else if (row.key.startsWith('ai_')) {
      groups.ai.items.push(item);
    } else if (row.key.startsWith('tts_')) {
      groups.tts.items.push(item);
    } else if (row.key.startsWith('classroom_')) {
      groups.classroom.items.push(item);
    }
  }

  return Object.values(groups).filter(g => g.items.length > 0);
}

/**
 * 批量更新设置。
 * @param {Object} updates - { key1: 'value1', key2: 'value2', ... }
 * @returns 更新后的 settings map
 */
export async function updateSettings(updates) {
  if (!updates || typeof updates !== 'object' || Object.keys(updates).length === 0) {
    throw new Error('No settings provided for update');
  }

  // 白名单：只允许更新已知的配置键
  const allowedKeys = new Set([
    'app_port', 'app_client_origin', 'app_serve_client',
    'admin_password_hash', 'auth_secret',
    'ai_base_url', 'ai_api_key', 'ai_model', 'ai_notes_model', 'ai_timeout_ms',
    'tts_api_key', 'tts_model', 'tts_voice', 'tts_cache_path', 'tts_default_speed', 'tts_default_volume',
    'classroom_show_to_answer_delay', 'classroom_answer_hold_delay'
  ]);

  for (const key of Object.keys(updates)) {
    if (!allowedKeys.has(key)) {
      throw new Error(`Unknown setting key: ${key}`);
    }
  }

  // 批量 UPSERT
  const entries = Object.entries(updates);
  for (const [key, value] of entries) {
    await execute(
      'INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = ?',
      [key, String(value ?? ''), String(value ?? '')]
    );
  }

  // 刷新运行时配置
  const freshRows = await query('SELECT `key`, `value` FROM settings WHERE `key` IN (?)', [Object.keys(updates)]);
  const map = {};
  for (const row of freshRows) {
    map[row.key] = row.value;
  }
  refreshRuntimeConfig(map);

  return map;
}

/**
 * 将设置写入数据库（仅服务端启动时，db.js 尚未准备好时使用 .env 后备）。
 * 不触发 refreshRuntimeConfig 因为它只用于初始化。
 */
export async function initSettingsFromEnv() {
  // 仅当 settings 表为空时写入 .env 中的值作为初始数据
  const [counter] = await query('SELECT COUNT(*) AS cnt FROM settings');
  if (Number(counter?.cnt ?? 0) > 0) return;

  const envDefaults = [
    ['app_port', process.env.PORT || '3001'],
    ['app_client_origin', process.env.CLIENT_ORIGIN || 'http://localhost:5173'],
    ['app_serve_client', process.env.SERVE_CLIENT !== undefined ? process.env.SERVE_CLIENT : 'true'],
    ['admin_password_hash', process.env.ADMIN_PASSWORD || ''],
    ['auth_secret', process.env.AUTH_SECRET || ''],
    ['ai_base_url', process.env.AI_BASE_URL || 'https://api.siliconflow.cn/v1'],
    ['ai_api_key', process.env.SILICONFLOW_API_KEY || process.env.AI_API_KEY || ''],
    ['ai_model', process.env.SILICONFLOW_LLM_MODEL || process.env.AI_MODEL || 'deepseek-ai/DeepSeek-V4-Flash'],
    ['ai_notes_model', process.env.AI_NOTES_MODEL || process.env.AI_MODEL || 'Qwen/Qwen3-32B'],
    ['ai_timeout_ms', process.env.AI_TIMEOUT_MS || '12000'],
    ['tts_api_key', process.env.DASHSCOPE_API_KEY || ''],
    ['tts_model', process.env.TTS_MODEL || 'qwen3-tts-vd-2026-01-26'],
    ['tts_voice', process.env.TTS_VOICE || '沉稳清晰的女教师声音'],
    ['tts_cache_path', process.env.AUDIO_CACHE_PATH || 'public/audio/cache'],
    ['tts_default_speed', process.env.DEFAULT_TTS_SPEED || '0.8'],
    ['tts_default_volume', process.env.DEFAULT_TTS_VOLUME || '0.8'],
    ['classroom_show_to_answer_delay', process.env.DEFAULT_SHOW_TO_ANSWER_DELAY || '3500'],
    ['classroom_answer_hold_delay', process.env.DEFAULT_ANSWER_HOLD_DELAY || '3000']
  ];

  for (const [key, value] of envDefaults) {
    if (value !== undefined && value !== '') {
      await execute(
        'INSERT IGNORE INTO settings (`key`, `value`) VALUES (?, ?)',
        [key, String(value)]
      );
    }
  }
  console.log('[settings] Initialized settings from .env');
}