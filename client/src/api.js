const API_BASE = import.meta.env.VITE_API_BASE || '';

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
  graph: (grammarPointId) => request(`/api/graph/${grammarPointId}`)
};
