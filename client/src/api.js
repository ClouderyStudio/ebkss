export const API_BASE = import.meta.env.VITE_API_BASE || '';

function getToken() {
  return localStorage.getItem('ebkss_token') || '';
}

function saveToken(token) {
  localStorage.setItem('ebkss_token', token);
}

async function request(path, options = {}) {
  const { headers: extraHeaders, ...rest } = options;
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(extraHeaders || {})
    },
    ...rest
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

  // ── 笔记管理 ─────────────────────────────────
  notes: {
    /** 获取笔记总览（按语法点分组计数） */
    overview: () => request('/api/notes/overview'),
    /** 获取某个语法点的所有笔记 */
    list: (grammarPointId) => request(`/api/notes?grammarPointId=${grammarPointId}`),
    /** 获取单条笔记详情 */
    get: (id) => request(`/api/notes/${id}`),
    /** 导入文本笔记 */
    import: ({ grammarPointId, rawContent, title, sourceKey }) =>
      request('/api/notes', {
        method: 'POST',
        body: JSON.stringify({ grammarPointId, rawContent, title, sourceKey })
      }),
    /** 导入 docx 文件笔记 */
    importDocx: async (grammarPointId, file, title = '') => {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);
      return request('/api/notes/import-docx', {
        method: 'POST',
        body: JSON.stringify({ grammarPointId, file: base64, title })
      });
    },
    /** 解析笔记为语料条目（预览） */
    parse: (id, mode = 'ai') =>
      request(`/api/notes/${id}/parse`, {
        method: 'POST',
        body: JSON.stringify({ mode })
      }),
    /** 从笔记生成课堂语料 */
    generateCorpus: (id, mode = 'ai') =>
      request(`/api/notes/${id}/generate-corpus`, {
        method: 'POST',
        body: JSON.stringify({ mode })
      }),
    /** 从笔记生成题目 */
    generateQuestions: (id, count = 4) =>
      request(`/api/notes/${id}/generate-questions`, {
        method: 'POST',
        body: JSON.stringify({ count })
      }),
    /** 删除笔记 */
    delete: (id) => request(`/api/notes/${id}`, { method: 'DELETE' })
  },

  /** 按语法点获取课堂语料 */
  corpusByGrammarPoint: (grammarPointId) =>
    request(`/api/corpus/by-grammar?grammarPointId=${grammarPointId}`),

  /** 删除某个语法点的所有课堂语料 */
  deleteCorpusByGrammarPoint: (grammarPointId) =>
    request(`/api/corpus/by-grammar?grammarPointId=${grammarPointId}`, { method: 'DELETE' }),

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
