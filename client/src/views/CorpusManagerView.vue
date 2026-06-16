<template>
  <AppShell>
    <section class="corpus-layout">
      <div class="control-panel">
        <div class="section-title">
          <Database :size="22" aria-hidden="true" />
          <h1>课堂语料管理</h1>
        </div>

        <div class="form-grid corpus-toolbar">
          <label class="field">
            <span>语料组</span>
            <input v-model="selectedGroup" list="group-options" />
            <datalist id="group-options">
              <option v-for="group in groups" :key="group.groupName" :value="group.groupName">
                {{ group.groupName }} ({{ group.itemCount }})
              </option>
            </datalist>
          </label>
          <button class="secondary-button" type="button" @click="loadAll">
            <RefreshCw :size="18" aria-hidden="true" />
            <span>刷新</span>
          </button>
          <button class="secondary-button" type="button" @click="invalidateGraph">
            <Network :size="18" aria-hidden="true" />
            <span>重建图谱</span>
          </button>
        </div>

        <!-- 一键导入 Word -->
        <div class="import-section">
          <div class="section-title">
            <Upload :size="22" aria-hidden="true" />
            <h2>一键导入 Word 笔记</h2>
          </div>
          <div class="form-grid import-controls">
            <label class="field">
              <span>选择 .docx 文件</span>
              <input ref="fileInput" type="file" accept=".docx" @change="onFileChange" />
            </label>
            <div class="import-buttons">
              <button
                class="primary-button"
                type="button"
                :disabled="!selectedFile || importing"
                @click="importWordFile('rule')"
              >
                <Zap :size="18" aria-hidden="true" />
                <span>{{ importing && importMode === 'rule' ? '解析中...' : '⚡ 规则解析导入' }}</span>
              </button>
              <button
                class="secondary-button"
                type="button"
                :disabled="!selectedFile || importing"
                @click="importWordFile('ai')"
              >
                <Sparkles :size="18" aria-hidden="true" />
                <span>{{ importing && importMode === 'ai' ? 'AI解析中(约2分钟)...' : '✨ AI增强解析导入' }}</span>
              </button>
            </div>
          </div>
          <!-- SSE 实时进度 -->
          <div v-if="sseMessages.length > 0" class="sse-log">
            <div v-for="(msg, idx) in sseMessages" :key="idx" :class="['sse-line', `sse-${msg.status}`]">
              <span v-if="msg.status === 'parsing'">📄 </span>
              <span v-else-if="msg.status === 'ai_start'">🤖 </span>
              <span v-else-if="msg.status === 'ai_progress'">📊 </span>
              <span v-else-if="msg.status === 'saving'">💾 </span>
              <span v-else-if="msg.status === 'done'">✅ </span>
              <span v-else-if="msg.status === 'error'">❌ </span>
              {{ msg.message }}
            </div>
          </div>
          <div v-if="importResult" class="import-result notice">
            <span v-if="importResult.mode === 'ai'">🤖 </span>
            成功导入 {{ importResult.imported }} 条语料到组 "{{ importResult.groupName }}"
          </div>
        </div>

        <div v-if="message" class="notice">{{ message }}</div>
        <div v-if="error" class="notice error">{{ error }}</div>
      </div>

      <form class="control-panel corpus-form" @submit.prevent="saveForm">
        <div class="section-title">
          <Pencil :size="22" aria-hidden="true" />
          <h2>{{ editingId ? '编辑语料' : '新增语料' }}</h2>
        </div>

        <div class="form-grid">
          <label class="field">
            <span>英语</span>
            <input v-model.trim="form.english" required />
          </label>
          <label class="field">
            <span>中文</span>
            <input v-model.trim="form.chinese" />
          </label>
          <label class="field">
            <span>音标</span>
            <input v-model.trim="form.phonetic" />
          </label>
        </div>

        <label class="field">
          <span>英文解释</span>
          <textarea v-model.trim="form.englishExplain" rows="2" />
        </label>

        <div class="form-grid">
          <label class="field">
            <span>标签（逗号分隔）</span>
            <input v-model.trim="form.tagsText" placeholder="phrase, give" />
          </label>
          <label class="field compact">
            <span>排序</span>
            <input v-model.number="form.sortOrder" type="number" min="0" />
          </label>
          <div class="action-row inline-actions">
            <button class="primary-button" type="submit">
              <Save :size="18" aria-hidden="true" />
              <span>{{ editingId ? '保存修改' : '新增' }}</span>
            </button>
            <button class="secondary-button" type="button" @click="resetForm">
              <X :size="18" aria-hidden="true" />
              <span>清空</span>
            </button>
          </div>
        </div>
      </form>

      <section class="draft-panel corpus-table-panel">
        <div class="section-title">
          <ListChecks :size="22" aria-hidden="true" />
          <h2>{{ selectedGroup }} · {{ items.length }} 条</h2>
        </div>

        <div v-if="loading" class="notice">正在读取语料...</div>
        <div v-else class="corpus-table">
          <article v-for="item in items" :key="item.id" class="corpus-row">
            <div class="corpus-row-main">
              <strong>{{ item.english }}</strong>
              <span>{{ item.chinese }}</span>
              <small>{{ item.englishExplain }}</small>
              <div class="tag-line">
                <span v-for="tag in item.tags" :key="tag" class="type-badge">{{ tag }}</span>
              </div>
            </div>
            <div class="corpus-row-meta">
              <small>{{ item.phonetic || '无音标' }}</small>
              <small>#{{ item.sortOrder }}</small>
            </div>
            <div class="corpus-row-actions">
              <button class="secondary-button small-button" type="button" @click="editItem(item)">
                <Pencil :size="16" aria-hidden="true" />
                <span>编辑</span>
              </button>
              <button class="secondary-button small-button danger-button" type="button" @click="deleteItem(item)">
                <Trash2 :size="16" aria-hidden="true" />
                <span>删除</span>
              </button>
            </div>
          </article>
        </div>
      </section>
    </section>
  </AppShell>
</template>

<script setup>
import { Database, ListChecks, Network, Pencil, RefreshCw, Save, Sparkles, Trash2, Upload, X, Zap } from '@lucide/vue';
import { onMounted, reactive, ref, watch } from 'vue';
import { api, API_BASE } from '../api.js';
import AppShell from '../components/AppShell.vue';
import { CLASSROOM_CONFIG } from '../config.js';

const selectedGroup = ref(CLASSROOM_CONFIG.defaultGroup);
const groups = ref([]);
const items = ref([]);
const loading = ref(false);
const editingId = ref(0);
const message = ref('');
const error = ref('');

// 导入状态
const fileInput = ref(null);
const selectedFile = ref(null);
const importing = ref(false);
const importMode = ref(null);
const importResult = ref(null);
const sseMessages = ref([]);
const form = reactive({
  english: '',
  chinese: '',
  englishExplain: '',
  phonetic: '',
  tagsText: '',
  sortOrder: 0
});

function payloadFromForm() {
  return {
    english: form.english,
    chinese: form.chinese,
    englishExplain: form.englishExplain,
    phonetic: form.phonetic,
    tags: form.tagsText
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean),
    groupName: selectedGroup.value,
    sortOrder: form.sortOrder || undefined
  };
}

function resetForm() {
  editingId.value = 0;
  form.english = '';
  form.chinese = '';
  form.englishExplain = '';
  form.phonetic = '';
  form.tagsText = '';
  form.sortOrder = 0;
}

async function loadGroups() {
  const data = await api.classroomGroups();
  groups.value = data.groups || [];
}

async function loadItems() {
  loading.value = true;
  error.value = '';
  try {
    const data = await api.classroomCorpus(selectedGroup.value);
    items.value = data.items || [];
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

async function loadAll() {
  await Promise.all([loadGroups(), loadItems()]);
}

async function saveForm() {
  error.value = '';
  message.value = '';
  try {
    if (editingId.value) {
      await api.updateClassroomItem(editingId.value, payloadFromForm());
      message.value = '已保存修改，图谱缓存已失效';
    } else {
      await api.createClassroomItem(payloadFromForm());
      message.value = '已新增语料，图谱缓存已失效';
    }
    resetForm();
    await loadAll();
  } catch (err) {
    error.value = err.message;
  }
}

function editItem(item) {
  editingId.value = item.id;
  selectedGroup.value = item.groupName;
  form.english = item.english;
  form.chinese = item.chinese || '';
  form.englishExplain = item.englishExplain || '';
  form.phonetic = item.phonetic || '';
  form.tagsText = (item.tags || []).join(', ');
  form.sortOrder = item.sortOrder || 0;
}

async function deleteItem(item) {
  const confirmed = window.confirm(`删除“${item.english}”？`);
  if (!confirmed) {
    return;
  }

  error.value = '';
  message.value = '';
  try {
    await api.deleteClassroomItem(item.id);
    message.value = '已删除语料，图谱缓存已失效';
    if (editingId.value === item.id) {
      resetForm();
    }
    await loadAll();
  } catch (err) {
    error.value = err.message;
  }
}

async function invalidateGraph() {
  error.value = '';
  message.value = '';
  try {
    await api.invalidateClassroomGraph(selectedGroup.value);
    message.value = '图谱缓存已清理，课堂页下次会重新生成';
  } catch (err) {
    error.value = err.message;
  }
}

function onFileChange(event) {
  selectedFile.value = event.target.files?.[0] || null;
  importResult.value = null;
  error.value = '';
}

async function importWordFile(mode) {
  if (!selectedFile.value) return;

  importMode.value = mode;
  importing.value = true;
  error.value = '';
  importResult.value = null;
  message.value = '';
  sseMessages.value = [];

  try {
    if (mode === 'ai') {
      // AI 模式使用 SSE 实时流式
      await importWithSSE();
    } else {
      const result = await api.importWord(selectedFile.value, selectedGroup.value, mode);
      importResult.value = result;
      message.value = `⚡ 规则解析完成：成功导入 ${result.imported} 条语料到 "${result.groupName}"`;
    }
    selectedFile.value = null;
    if (fileInput.value) fileInput.value.value = '';
    await loadAll();
  } catch (err) {
    error.value = err.message;
  } finally {
    importing.value = false;
    importMode.value = null;
  }
}

async function importWithSSE() {
  const buffer = await selectedFile.value.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const base64 = btoa(binary);

  const resp = await fetch(`${API_BASE}/api/corpus/import-word/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file: base64, groupName: selectedGroup.value })
  });

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer2 = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer2 += decoder.decode(value, { stream: true });
    const lines = buffer2.split('\n');
    buffer2 = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('data: ')) {
        try {
          const msg = JSON.parse(trimmed.slice(6));
          sseMessages.value = [...sseMessages.value, msg];
          if (msg.status === 'done') {
            importResult.value = msg;
            message.value = `🤖 AI 增强解析完成：成功导入 ${msg.imported} 条语料到 "${msg.groupName}"`;
          } else if (msg.status === 'error') {
            error.value = msg.message;
          }
        } catch { /* ignore parse errors */ }
      }
    }
  }
}

watch(selectedGroup, () => {
  resetForm();
  loadItems();
});

onMounted(loadAll);
</script>
