export const API_BASE = import.meta.env.VITE_API_BASE || '';

function getToken() {
  return localStorage.getItem('ebkss_token') || '';
}

function saveToken(token) {
  localStorage.setItem('ebkss_token', token);
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || '请求失败');
  }

  return data;
}

export const api = {
  health: () => request('/api/health'),
  units: () => request('/api/units'),
  classroomCorpus: (group = 'give') => request(`/api/corpus?group=${encodeURIComponent(group)}`),
  classroomGroups: () => request('/api/corpus/groups'),
  createClassroomItem: (payload) =>
    request('/api/corpus', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  updateClassroomItem: (id, payload) =>
    request(`/api/corpus/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    }),
  deleteClassroomItem: (id) =>
    request(`/api/corpus/${id}`, { method: 'DELETE' }),
  /**
   * 删除整个语料组
   */
  deleteClassroomGroup: (groupName) =>
    request(`/api/corpus/group/${encodeURIComponent(groupName)}`, { method: 'DELETE' }),
  invalidateClassroomGraph: (group = 'class-notes') =>
    request(`/api/graph?group=${encodeURIComponent(group)}`, {
      method: 'DELETE'
    }),
  tts: ({ text, speed, voice }) => {
    const params = new URLSearchParams({ text, speed: String(speed) });
    if (voice) {
      params.set('voice', voice);
    }
    return request(`/api/tts?${params.toString()}`);
  },
  classroomGraph: (group = 'give') => request(`/api/graph?group=${encodeURIComponent(group)}`),
  quiz: (unitId, { count = 4, mode = 'student' } = {}) =>
    request(`/api/quiz/${unitId}?count=${count}&mode=${mode}`),
  submit: (payload) =>
    request('/api/submit', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  generate: (payload) =>
    request('/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  saveCorpus: (payload) =>
    request('/api/corpus/bulk', {
      method: 'POST',
      body: JSON.stringify(payload)
    }),
  /**
   * 一键导入 Word 笔记文件
   * @param {File} file - .docx 文件
   * @param {string} groupName - 语料分组名
   */
  /**
   * 一键导入 Word 笔记文件
   * @param {File} file - .docx 文件
   * @param {string} groupName - 语料分组名
   * @param {'rule'|'ai'} mode - 解析模式：rule=规则解析(快速) / ai=AI增强
   */
  importWord: async (file, groupName, mode = 'rule') => {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);

    return request('/api/corpus/import-word', {
      method: 'POST',
      body: JSON.stringify({ file: base64, groupName, mode })
    });
  },
  graph: (grammarPointId) => request(`/api/graph/${grammarPointId}`),

  // ── 系统设置 ─────────────────────────────────
  settings: {
    getAll: () =>
      request('/api/settings', {
        headers: { Authorization: `Bearer ${getToken()}` }
      }),
    update: (data) =>
      request('/api/settings', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(data)
      })
  },

  // ── 认证 ──────────────────────────────────────
  auth: {
    login: async (password) => {
      const data = await request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ password })
      });
      if (data.token) saveToken(data.token);
      return data;
    },
    verify: () => request('/api/auth/verify', { headers: { Authorization: `Bearer ${getToken()}` } }),
    getToken,
    logout: () => localStorage.removeItem('ebkss_token')
  }
};
