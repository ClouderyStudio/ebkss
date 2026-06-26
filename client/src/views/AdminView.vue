<template>
  <AppShell>
    <section class="admin-layout">
      <!-- Tab 切换 -->
      <div class="admin-tabs">
        <button :class="['admin-tab', { active: activeTab === 'notes' }]" @click="activeTab = 'notes'">
          <FileText :size="18" /> 笔记管理
        </button>
        <button :class="['admin-tab', { active: activeTab === 'corpus' }]" @click="activeTab = 'corpus'">
          <Database :size="18" /> 语料管理
        </button>
        <button :class="['admin-tab', { active: activeTab === 'ai' }]" @click="activeTab = 'ai'">
          <WandSparkles :size="18" /> AI 出题
        </button>
        <button :class="['admin-tab', { active: activeTab === 'settings' }]" @click="activeTab = 'settings'">
          <Settings :size="18" /> 系统设置
        </button>
      </div>

      <!-- ═══════════════ Tab: 笔记管理 ═══════════════ -->
      <div v-show="activeTab === 'notes'">
        <div class="control-panel">
          <div class="section-title"><FileText :size="22" /><h1>笔记管理</h1></div>

          <!-- 语法点选择 -->
          <div class="form-grid">
            <label class="field">
              <span>语法点</span>
              <select v-model.number="notesGrammarPointId">
                <option :value="0" disabled>-- 选择语法点 --</option>
                <option v-for="p in store.allGrammarPoints" :key="p.id" :value="p.id">{{ p.name }}</option>
              </select>
            </label>
            <button class="secondary-button" :disabled="!notesGrammarPointId" @click="loadNotes">
              <RefreshCw :size="18" /> <span>刷新</span>
            </button>
          </div>

          <!-- 导入文本笔记 -->
          <div class="import-section">
            <div class="section-title"><Pencil :size="20" /><h2>导入文本笔记</h2></div>
            <label class="field"><span>标题（可选）</span><input v-model.trim="noteImportTitle" placeholder="笔记标题" /></label>
            <label class="field"><span>笔记内容</span><textarea v-model.trim="noteImportText" rows="6" placeholder="粘贴笔记文本...&#10;每行一条英文短语/句子，可附中文解释" /></label>
            <button class="primary-button" :disabled="!notesGrammarPointId || !noteImportText || noteImporting" @click="importTextNote">
              <Upload :size="18" /> <span>{{ noteImporting ? '导入中...' : '导入笔记' }}</span>
            </button>
          </div>

          <!-- 导入 Word 笔记 -->
          <div class="import-section">
            <div class="section-title"><Upload :size="20" /><h2>导入 Word 笔记</h2></div>
            <div class="import-controls">
              <label class="field"><span>.docx 文件</span><input ref="noteFileInput" type="file" accept=".docx" @change="onNoteFileChange" /></label>
              <button class="primary-button" :disabled="!notesGrammarPointId || !noteSelectedFile || noteImporting" @click="importDocxNote">
                <Upload :size="18" /> <span>{{ noteImporting ? '导入中...' : '导入 Word' }}</span>
              </button>
            </div>
          </div>

          <div v-if="notesMessage" class="notice">{{ notesMessage }}</div>
          <div v-if="notesError" class="notice error">{{ notesError }}</div>
        </div>

        <!-- 笔记列表 -->
        <section class="draft-panel" v-if="notesGrammarPointId">
          <div class="section-title"><ListChecks :size="20" /><h2>笔记列表 · {{ selectedNotePoint?.name || '' }}</h2></div>
          <div v-if="notesLoading" class="notice">读取中...</div>
          <div v-else-if="notesList.length === 0" class="notice">暂无笔记</div>
          <article v-for="note in notesList" :key="note.id" class="note-card">
            <div class="note-card-header">
              <strong>{{ note.title || '未命名笔记' }}</strong>
              <small>{{ formatDate(note.createdAt) }} · {{ note.sourceType }}</small>
            </div>
            <pre class="note-preview">{{ note.rawContent?.slice(0, 300) }}{{ (note.rawContent?.length || 0) > 300 ? '...' : '' }}</pre>
            <div class="note-card-actions">
              <button class="secondary-button small-button" :disabled="noteParsing === note.id" @click="parseNote(note)">
                <Eye :size="16" /> <span>{{ noteParsing === note.id ? '解析中...' : '预览解析' }}</span>
              </button>
              <button class="primary-button small-button" :disabled="generatingCorpus === note.id" @click="genCorpusFromNote(note)">
                <Database :size="16" /> <span>{{ generatingCorpus === note.id ? '生成中...' : '生成课堂语料' }}</span>
              </button>
              <button class="primary-button small-button" :disabled="generatingQuestions === note.id" @click="genQuestionsFromNote(note)">
                <Sparkles :size="16" /> <span>{{ generatingQuestions === note.id ? '生成中...' : '生成题目' }}</span>
              </button>
              <button class="secondary-button small-button danger-button" @click="deleteNoteItem(note)">
                <Trash2 :size="16" /> 删除
              </button>
            </div>
          </article>

          <!-- 解析预览 -->
          <div v-if="noteParsePreview.length" class="parse-preview">
            <div class="section-title"><Eye :size="18" /><h3>解析预览 · {{ noteParsePreview.length }} 条</h3></div>
            <div class="corpus-table">
              <article v-for="(entry, idx) in noteParsePreview" :key="idx" class="corpus-row">
                <div class="corpus-row-main">
                  <strong>{{ entry.english }}</strong>
                  <span>{{ entry.chinese }}</span>
                  <small>{{ entry.englishExplain }}</small>
                </div>
              </article>
            </div>
          </div>
        </section>
      </div>

      <!-- ═══════════════ Tab: 语料管理 ═══════════════ -->
      <div v-show="activeTab === 'corpus'">
        <div class="control-panel">
          <div class="section-title"><h1>课堂语料管理</h1></div>
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
              <RefreshCw :size="18" /> <span>刷新</span>
            </button>
            <button class="secondary-button" type="button" @click="invalidateGraph">
              <Network :size="18" /> <span>重建图谱</span>
            </button>
            <button class="secondary-button danger-button" type="button" :disabled="!selectedGroup" @click="deleteGroup">
              <Trash2 :size="18" /> <span>删除语料组</span>
            </button>
          </div>

          <!-- 一键导入（旧版兼容，保留） -->
          <div class="import-section">
            <div class="section-title"><Upload :size="20" /><h2>导入 Word 笔记（旧版兼容）</h2></div>
            <div class="import-controls">
              <label class="field"><span>.docx 文件</span><input ref="fileInput" type="file" accept=".docx" @change="onFileChange" /></label>
              <div class="import-buttons">
                <button class="secondary-button" :disabled="!selectedFile || importing" @click="importWordFile('rule')">
                  <Zap :size="18" /> <span>{{ importing && importMode === 'rule' ? '解析中...' : '⚡ 规则解析' }}</span>
                </button>
                <button class="primary-button" :disabled="!selectedFile || importing" @click="importWordFile('ai')">
                  <Sparkles :size="18" /> <span>{{ importing && importMode === 'ai' ? 'AI解析中...' : '✨ AI 增强解析' }}</span>
                </button>
              </div>
            </div>
            <div v-if="sseMessages.length" class="sse-log">
              <div v-for="(msg, idx) in sseMessages" :key="idx" :class="['sse-line', `sse-${msg.status}`]">
                <span v-if="msg.status === 'parsing'">📄</span>
                <span v-else-if="msg.status === 'ai_progress'">📊</span>
                <span v-else-if="msg.status === 'saving'">💾</span>
                <span v-else-if="msg.status === 'done'">✅</span>
                <span v-else-if="msg.status === 'error'">❌</span>
                {{ msg.message }}
              </div>
            </div>
            <div v-if="importResult" class="notice">
              {{ importResult.mode === 'ai' ? '🤖' : '⚡' }} 成功导入 {{ importResult.imported }} 条
            </div>
          </div>

          <button class="primary-button" type="button" @click="openFormModal()">
            <PlusCircle :size="18" /> <span>新增语料</span>
          </button>

          <div v-if="message" class="notice">{{ message }}</div>
          <div v-if="error" class="notice error">{{ error }}</div>
        </div>

        <!-- 语料列表 -->
        <section class="draft-panel">
          <div class="section-title"><ListChecks :size="20" /><h2>{{ selectedGroup }} · {{ items.length }} 条</h2></div>
          <div v-if="loading" class="notice">读取中...</div>
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
                <button class="secondary-button small-button" @click="openFormModal(item)"><Pencil :size="16" /> 编辑</button>
                <button class="secondary-button small-button danger-button" @click="deleteItem(item)"><Trash2 :size="16" /> 删除</button>
              </div>
            </article>
          </div>
        </section>
      </div>

      <!-- ═══════════════ Tab: AI 出题 ═══════════════ -->
      <div v-show="activeTab === 'ai'">
        <div class="control-panel">
          <div class="section-title"><h1>AI 出题工具</h1></div>
          <div class="form-grid">
            <label class="field">
              <span>语法点</span>
              <select v-model.number="aiGrammarPointId">
                <option v-for="point in store.allGrammarPoints" :key="point.id" :value="point.id">{{ point.name }}</option>
              </select>
            </label>
            <label class="field compact">
              <span>题数</span>
              <input v-model.number="aiCount" min="1" max="12" type="number" />
            </label>
          </div>
          <label class="field"><span>笔记内容</span><textarea v-model="aiNotes" rows="5" /></label>
          <div class="action-row">
            <button class="primary-button" :disabled="aiGenerating" @click="generateQuestions">
              <Sparkles :size="19" /> <span>{{ aiGenerating ? '生成中...' : 'AI 生成题目' }}</span>
            </button>
            <button class="secondary-button" :disabled="aiGraphLoading" @click="loadAiGraph">
              <Network :size="19" /> <span>{{ aiGraphLoading ? '生成中...' : '知识图谱' }}</span>
            </button>
          </div>
          <div v-if="aiOutput" class="ai-output">
            <div class="section-title"><Eye :size="18" /><h3>AI 输出</h3></div>
            <pre class="ai-output-text">{{ aiOutput }}</pre>
          </div>
          <div v-if="aiMessage" class="notice">{{ aiMessage }}</div>
          <div v-if="aiError" class="notice error">{{ aiError }}</div>
        </div>

        <!-- 已有题目 -->
        <section class="draft-panel">
          <div class="section-title">
            <Database :size="20" />
            <h2>已有题目 · {{ selectedPoint?.name || '' }}</h2>
            <button class="secondary-button small-button" :disabled="aiLoadingExisting" @click="loadExistingQuestions">
              <RefreshCw :size="16" /> {{ aiLoadingExisting ? '加载中...' : '刷新' }}
            </button>
          </div>
          <div v-if="aiExistingQuestions.length === 0 && !aiLoadingExisting" class="notice">暂无题目</div>
          <article v-for="(q, idx) in aiExistingQuestions" :key="q.id || idx" class="question-card">
            <div class="question-card-header">
              <QuestionTypeBadge :type="q.questionType || q.question_type" />
              <span>#{{ q.id }}</span>
              <button class="icon-button small-button danger-button" title="删除" @click="deleteExistingQuestion(q)"><Trash2 :size="14" /></button>
            </div>
            <p class="question-text">{{ q.questionText || q.question_text }}</p>
            <div class="tag-line">
              <span v-for="a in (q.acceptableAnswers || [])" :key="a" class="type-badge answer-badge">{{ a }}</span>
            </div>
          </article>
        </section>

        <section class="draft-panel">
          <div class="section-title"><ListChecks :size="20" /><h2>AI 生成草稿</h2></div>
          <article v-for="(draft, index) in aiDrafts" :key="index" class="question-card">
            <div class="question-card-header">
              <QuestionTypeBadge :type="draft.questionType" />
              <span>草稿 {{ index + 1 }}</span>
            </div>
            <label class="field"><span>题干</span><textarea v-model="draft.questionText" rows="2" /></label>
            <label class="field"><span>可接受答案（每行一个）</span><textarea v-model="draft.answerText" rows="2" /></label>
            <label v-if="draft.questionType === 'analogy'" class="field"><span>模板句</span><input v-model="draft.template" /></label>
          </article>
          <button v-if="aiDrafts.length" class="primary-button submit-button" @click="saveAiDrafts">
            <Save :size="20" /> <span>保存到题库</span>
          </button>
        </section>
        <GraphPanel v-if="aiGraph" :graph="aiGraph" />
      </div>

      <!-- ═══════════════ Tab: 系统设置 ═══════════════ -->
      <div v-show="activeTab === 'settings'">
        <div class="control-panel">
          <div class="section-title">
            <Settings :size="20" /> <h1>系统设置</h1>
            <span class="settings-hint">修改后立即生效（部分需重启服务）</span>
          </div>
          <div v-if="settingsLoading" class="notice">加载中...</div>
          <div v-if="settingsError" class="notice error">{{ settingsError }}</div>
          <div v-if="settingsMessage" class="notice">{{ settingsMessage }}</div>
          <div v-for="group in settingGroups" :key="group.label" class="settings-group">
            <h3 class="settings-group-label">{{ group.label }}</h3>
            <div v-for="item in group.items" :key="item.key" class="settings-row">
              <label class="settings-label">
                <code>{{ item.key }}</code>
                <small v-if="item.description">{{ item.description }}</small>
              </label>
              <div class="settings-input-wrap">
                <input
                  v-if="!isSecretKey(item.key)"
                  :value="settingsForm[item.key] ?? item.value"
                  @input="onSettingsChange(item.key, ($event.target).value)"
                  class="settings-input"
                />
                <input
                  v-else
                  :value="settingsForm[item.key] ?? ''"
                  @input="onSettingsChange(item.key, ($event.target).value)"
                  :placeholder="item.value ? '●●●●●●（已设置，留空不变）' : '未设置'"
                  type="password"
                  class="settings-input"
                />
              </div>
            </div>
          </div>
          <div v-if="settingGroups.length" class="action-row">
            <button class="primary-button submit-button" :disabled="settingsSaving" @click="saveSettings">
              <Save :size="18" /> <span>{{ settingsSaving ? '保存中...' : '保存设置' }}</span>
            </button>
            <button class="secondary-button" @click="loadSettings">
              <RefreshCw :size="18" /> <span>重新加载</span>
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- 新增/编辑弹窗 -->
    <Teleport to="body">
      <div v-if="showFormModal" class="modal-backdrop" @click.self="showFormModal = false">
        <form class="modal-panel" @submit.prevent="saveForm">
          <div class="modal-header">
            <h2>{{ editingId ? '编辑语料' : '新增语料' }}</h2>
            <button class="icon-button" type="button" @click="showFormModal = false"><X :size="20" /></button>
          </div>
          <div class="modal-body">
            <div class="form-grid">
              <label class="field"><span>英语 *</span><input v-model.trim="form.english" required /></label>
              <label class="field"><span>中文</span><input v-model.trim="form.chinese" /></label>
              <label class="field"><span>音标</span><input v-model.trim="form.phonetic" /></label>
            </div>
            <label class="field"><span>英文解释</span><textarea v-model.trim="form.englishExplain" rows="2" /></label>
            <div class="form-grid">
              <label class="field"><span>标签</span><input v-model.trim="form.tagsText" placeholder="逗号分隔" /></label>
              <label class="field compact"><span>排序</span><input v-model.number="form.sortOrder" type="number" min="0" /></label>
            </div>
            <div class="action-row">
              <button class="primary-button" type="submit"><Save :size="18" /><span>{{ editingId ? '保存修改' : '新增语料' }}</span></button>
              <button class="secondary-button" type="button" @click="showFormModal = false"><X :size="18" /><span>取消</span></button>
            </div>
          </div>
        </form>
      </div>
    </Teleport>
  </AppShell>
</template>

<script setup>
import { Database, Eye, FileText, ListChecks, Network, Pencil, PlusCircle, RefreshCw, Save, Settings, Sparkles, Trash2, Upload, WandSparkles, X, Zap } from '@lucide/vue';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { api, API_BASE } from '../api.js';
import AppShell from '../components/AppShell.vue';
import GraphPanel from '../components/GraphPanel.vue';
import QuestionTypeBadge from '../components/QuestionTypeBadge.vue';
import { CLASSROOM_CONFIG } from '../config.js';
import { useUnitsStore } from '../stores/units.js';
const store = useUnitsStore();

const activeTab = ref('notes');

// ── 笔记管理状态 ─────────────────────────────────
const notesGrammarPointId = ref(0);
const notesList = ref([]);
const notesLoading = ref(false);
const notesMessage = ref('');
const notesError = ref('');
const noteImportText = ref('');
const noteImportTitle = ref('');
const noteImporting = ref(false);
const noteFileInput = ref(null);
const noteSelectedFile = ref(null);
const noteParsePreview = ref([]);
const noteParsing = ref(0);
const generatingCorpus = ref(0);
const generatingQuestions = ref(0);

const selectedNotePoint = computed(() => store.allGrammarPoints.find(p => p.id === notesGrammarPointId.value));

function onNoteFileChange(event) { noteSelectedFile.value = event.target.files?.[0] || null; }

function formatDate(d) {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

async function loadNotes() {
  if (!notesGrammarPointId.value) return;
  notesLoading.value = true; notesError.value = '';
  try { const d = await api.notes.list(notesGrammarPointId.value); notesList.value = d.notes || []; }
  catch (err) { notesError.value = err.message; }
  finally { notesLoading.value = false; }
}

async function importTextNote() {
  noteImporting.value = true; notesError.value = ''; notesMessage.value = '';
  try {
    await api.notes.import({ grammarPointId: notesGrammarPointId.value, rawContent: noteImportText.value, title: noteImportTitle.value });
    notesMessage.value = '笔记已导入';
    noteImportText.value = ''; noteImportTitle.value = '';
    await loadNotes();
  } catch (err) { notesError.value = err.message; }
  finally { noteImporting.value = false; }
}

async function importDocxNote() {
  if (!noteSelectedFile.value) return;
  noteImporting.value = true; notesError.value = ''; notesMessage.value = '';
  try {
    await api.notes.importDocx(notesGrammarPointId.value, noteSelectedFile.value);
    notesMessage.value = 'Word 笔记已导入';
    noteSelectedFile.value = null;
    if (noteFileInput.value) noteFileInput.value.value = '';
    await loadNotes();
  } catch (err) { notesError.value = err.message; }
  finally { noteImporting.value = false; }
}

async function parseNote(note) {
  noteParsing.value = note.id; notesError.value = ''; noteParsePreview.value = [];
  try {
    const d = await api.notes.parse(note.id, 'ai');
    noteParsePreview.value = d.entries || [];
    notesMessage.value = `解析出 ${noteParsePreview.value.length} 条语料`;
  } catch (err) { notesError.value = err.message; }
  finally { noteParsing.value = 0; }
}

async function genCorpusFromNote(note) {
  generatingCorpus.value = note.id; notesError.value = ''; notesMessage.value = '';
  try {
    const d = await api.notes.generateCorpus(note.id, 'ai');
    notesMessage.value = `已生成 ${d.result?.imported || 0} 条课堂语料 → "${d.result?.groupName || ''}"`;
  } catch (err) { notesError.value = err.message; }
  finally { generatingCorpus.value = 0; }
}

async function genQuestionsFromNote(note) {
  generatingQuestions.value = note.id; notesError.value = ''; notesMessage.value = '';
  try {
    const d = await api.notes.generateQuestions(note.id, 4);
    notesMessage.value = `已生成 ${d.generated || 0} 道题目`;
  } catch (err) { notesError.value = err.message; }
  finally { generatingQuestions.value = 0; }
}

async function deleteNoteItem(note) {
  if (!confirm(`删除笔记"${note.title || '未命名'}"？`)) return;
  try { await api.notes.delete(note.id); notesMessage.value = '已删除'; await loadNotes(); }
  catch (err) { notesError.value = err.message; }
}

// ── 语料管理状态 ─────────────────────────────────
const selectedGroup = ref(CLASSROOM_CONFIG.defaultGroup);
const groups = ref([]);
const items = ref([]);
const loading = ref(false);
const editingId = ref(0);
const message = ref('');
const error = ref('');
const showFormModal = ref(false);
const fileInput = ref(null);
const selectedFile = ref(null);
const importing = ref(false);
const importMode = ref(null);
const importResult = ref(null);
const sseMessages = ref([]);
const form = reactive({ english: '', chinese: '', englishExplain: '', phonetic: '', tagsText: '', sortOrder: 0 });

// ── AI 出题状态 ──────────────────────────────────
const aiGrammarPointId = ref(0);
const aiNotes = ref('');
const aiCount = ref(4);
const aiDrafts = ref([]);
const aiGraph = ref(null);
const aiGenerating = ref(false);
const aiGraphLoading = ref(false);
const aiMessage = ref('');
const aiError = ref('');
const aiOutput = ref('');
const aiExistingQuestions = ref([]);
const aiLoadingExisting = ref(false);

const selectedPoint = computed(() => store.allGrammarPoints.find(p => p.id === aiGrammarPointId.value));
watch(selectedPoint, (p) => { if (p) { aiNotes.value = p.notesContent || ''; loadExistingQuestions(); } });

// ── 语料管理方法 ─────────────────────────────────
function payloadFromForm() { return { english: form.english, chinese: form.chinese, englishExplain: form.englishExplain, phonetic: form.phonetic, tags: form.tagsText.split(',').map(t => t.trim()).filter(Boolean), groupName: selectedGroup.value, sortOrder: form.sortOrder || undefined }; }
function openFormModal(item) { if (item) editItem(item); else resetForm(); showFormModal.value = true; }
function resetForm() { editingId.value = 0; form.english = ''; form.chinese = ''; form.englishExplain = ''; form.phonetic = ''; form.tagsText = ''; form.sortOrder = 0; }
async function loadGroups() { const d = await api.classroomGroups(); groups.value = d.groups || []; }
async function loadItems() { loading.value = true; error.value = ''; try { const d = await api.classroomCorpus(selectedGroup.value); items.value = d.items || []; } catch (err) { error.value = err.message; } finally { loading.value = false; } }
async function loadAll() { await Promise.all([loadGroups(), loadItems()]); }
async function saveForm() { error.value = ''; message.value = ''; try { if (editingId.value) { await api.updateClassroomItem(editingId.value, payloadFromForm()); message.value = '已保存'; } else { await api.createClassroomItem(payloadFromForm()); message.value = '已新增'; } showFormModal.value = false; resetForm(); await loadAll(); } catch (err) { error.value = err.message; } }
function editItem(item) { editingId.value = item.id; selectedGroup.value = item.groupName; form.english = item.english; form.chinese = item.chinese || ''; form.englishExplain = item.englishExplain || ''; form.phonetic = item.phonetic || ''; form.tagsText = (item.tags || []).join(', '); form.sortOrder = item.sortOrder || 0; }
async function deleteItem(item) { if (!confirm(`删除"${item.english}"？`)) return; error.value = ''; try { await api.deleteClassroomItem(item.id); message.value = '已删除'; if (editingId.value === item.id) resetForm(); await loadAll(); } catch (err) { error.value = err.message; } }
async function invalidateGraph() { error.value = ''; try { await api.invalidateClassroomGraph(selectedGroup.value); message.value = '图谱缓存已清理'; } catch (err) { error.value = err.message; } }
async function deleteGroup() { if (!confirm(`确定删除语料组"${selectedGroup.value}"及其所有条目？此操作不可恢复。`)) return; error.value = ''; try { const r = await api.deleteClassroomGroup(selectedGroup.value); message.value = `已删除语料组"${r.groupName}"（${r.count} 条）`; selectedGroup.value = CLASSROOM_CONFIG.defaultGroup; await loadAll(); } catch (err) { error.value = err.message; } }

// 导入（旧版兼容）
function onFileChange(event) { selectedFile.value = event.target.files?.[0] || null; importResult.value = null; error.value = ''; }
async function importWordFile(mode) { if (!selectedFile.value) return; importMode.value = mode; importing.value = true; error.value = ''; importResult.value = null; message.value = ''; sseMessages.value = []; try { if (mode === 'ai') { await importWithSSE(); } else { const result = await api.importWord(selectedFile.value, selectedGroup.value, mode); importResult.value = result; message.value = `⚡ 完成：导入 ${result.imported} 条`; } selectedFile.value = null; if (fileInput.value) fileInput.value.value = ''; await loadAll(); } catch (err) { error.value = err.message; } finally { importing.value = false; importMode.value = null; } }
async function importWithSSE() { const buffer = await selectedFile.value.arrayBuffer(); const bytes = new Uint8Array(buffer); let binary = ''; for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]); const base64 = btoa(binary); const resp = await fetch(`${API_BASE}/api/corpus/import-word/stream`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file: base64, groupName: selectedGroup.value }) }); const reader = resp.body.getReader(); const decoder = new TextDecoder(); let buf = ''; while (true) { const { done, value } = await reader.read(); if (done) break; buf += decoder.decode(value, { stream: true }); const lines = buf.split('\n'); buf = lines.pop() || ''; for (const line of lines) { const t = line.trim(); if (t.startsWith('data: ')) { try { const m = JSON.parse(t.slice(6)); sseMessages.value = [...sseMessages.value, m]; if (m.status === 'done') { importResult.value = m; message.value = `🤖 完成：导入 ${m.imported} 条`; } else if (m.status === 'error') error.value = m.message; } catch { /* */ } } } } }

watch(selectedGroup, () => { resetForm(); loadItems(); });

// ── AI 出题方法 ──────────────────────────────────
async function generateQuestions() { aiGenerating.value = true; aiError.value = ''; aiOutput.value = ''; try { const d = await api.generate({ grammarPointId: aiGrammarPointId.value, notesContent: aiNotes.value, count: aiCount.value }); aiOutput.value = JSON.stringify(d.questions, null, 2); aiDrafts.value = (d.questions || []).map(q => ({ ...q, answerText: q.acceptableAnswers.join('\n') })); aiMessage.value = `生成了 ${aiDrafts.value.length} 道题目`; } catch (err) { aiError.value = err.message; } finally { aiGenerating.value = false; } }
async function loadExistingQuestions() { aiLoadingExisting.value = true; try { const d = await api.quiz(aiGrammarPointId.value, { count: 50, mode: 'teacher' }); aiExistingQuestions.value = d.questions || []; } catch (err) { aiError.value = err.message; } finally { aiLoadingExisting.value = false; } }
async function deleteExistingQuestion(q) { if (!confirm(`删除题目 #${q.id}？`)) return; try { await api.deleteClassroomItem(q.id); aiExistingQuestions.value = aiExistingQuestions.value.filter(item => item.id !== q.id); aiMessage.value = '已删除'; } catch (err) { aiError.value = err.message; } }
async function saveAiDrafts() { aiError.value = ''; try { const r = await api.saveCorpus({ grammarPointId: aiGrammarPointId.value, questions: aiDrafts.value.map(d => ({ questionType: d.questionType, questionText: d.questionText, acceptableAnswers: d.answerText.split('\n').map(a => a.trim()).filter(Boolean), template: d.template, matchRule: d.matchRule || 'exact', difficulty: d.difficulty || 1, requiresAi: d.questionType === 'analogy' })) }); aiDrafts.value = []; aiMessage.value = `已保存 ${r.insertedCount} 道题`; } catch (err) { aiError.value = err.message; } }
async function loadAiGraph() { aiGraphLoading.value = true; aiError.value = ''; try { const d = await api.graph(aiGrammarPointId.value); aiGraph.value = d.graph; aiMessage.value = d.cached ? '缓存图谱' : '新图谱'; } catch (err) { aiError.value = err.message; } finally { aiGraphLoading.value = false; } }

// ── 系统设置 ─────────────────────────────────────
const settingGroups = ref([]);
const settingsForm = reactive({});
const settingsLoading = ref(false);
const settingsSaving = ref(false);
const settingsError = ref('');
const settingsMessage = ref('');
const SECRET_KEYS = new Set(['ai_api_key', 'tts_api_key', 'admin_password_hash', 'auth_secret']);
function isSecretKey(key) { return SECRET_KEYS.has(key); }
function onSettingsChange(key, value) { settingsForm[key] = value; }
async function loadSettings() {
  settingsLoading.value = true; settingsError.value = ''; settingsMessage.value = '';
  try {
    const d = await api.settings.getAll(); settingGroups.value = d.groups || [];
    for (const group of settingGroups.value) { for (const item of group.items) { if (!(item.key in settingsForm)) settingsForm[item.key] = item.value; } }
  } catch (err) { settingsError.value = err.message; } finally { settingsLoading.value = false; }
}
async function saveSettings() {
  settingsSaving.value = true; settingsError.value = ''; settingsMessage.value = '';
  try {
    const payload = {};
    for (const [key, val] of Object.entries(settingsForm)) {
      if (SECRET_KEYS.has(key) && (!val || val.trim() === '')) continue;
      const original = findOriginalValue(key);
      if (val === original) continue;
      payload[key] = String(val ?? '');
    }
    if (Object.keys(payload).length === 0) { settingsMessage.value = '没有需要保存的更改'; return; }
    await api.settings.update(payload);
    for (const [key, val] of Object.entries(payload)) { for (const group of settingGroups.value) { const item = group.items.find(it => it.key === key); if (item) item.value = val; } }
    settingsMessage.value = `已更新 ${Object.keys(payload).length} 项设置`;
  } catch (err) { settingsError.value = err.message; } finally { settingsSaving.value = false; }
}
function findOriginalValue(key) { for (const group of settingGroups.value) { const item = group.items.find(it => it.key === key); if (item) return item.value; } return undefined; }

// ── Tab 切换监听 ─────────────────────────────────
watch(activeTab, (tab) => {
  if (tab === 'settings' && settingGroups.value.length === 0) loadSettings();
  if (tab === 'notes' && notesGrammarPointId.value && notesList.value.length === 0) loadNotes();
});

onMounted(async () => {
  await store.loadUnits();
  if (store.allGrammarPoints.length) {
    notesGrammarPointId.value = store.allGrammarPoints[0].id;
    aiGrammarPointId.value = store.allGrammarPoints[0].id;
    aiNotes.value = store.allGrammarPoints[0].notesContent || '';
    loadNotes();
  }
  await loadAll();
});
</script>
