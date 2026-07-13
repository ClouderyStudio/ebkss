<template>
  <AppShell>
    <section class="admin-layout">
      <div class="admin-tabs">
        <button :class="['admin-tab', { active: tab === 'notes' }]" @click="tab = 'notes'"><FileText :size="18" />笔记</button>
        <button :class="['admin-tab', { active: tab === 'corpus' }]" @click="tab = 'corpus'"><Database :size="18" />语料</button>
        <button :class="['admin-tab', { active: tab === 'questions' }]" @click="tab = 'questions'"><ListChecks :size="18" />题目</button>
        <button :class="['admin-tab', { active: tab === 'settings' }]" @click="tab = 'settings'"><Settings :size="18" />系统设置</button>
      </div>

      <section v-show="tab === 'notes'" class="control-panel">
        <div class="section-title"><FileText :size="22" /><h1>笔记管理</h1></div>
        <label class="field"><span>标题</span><input v-model.trim="noteForm.title" placeholder="可选" /></label>
        <label class="field"><span>内容</span><textarea v-model.trim="noteForm.rawContent" rows="7" placeholder="粘贴笔记内容" /></label>
        <button class="primary-button" :disabled="!noteForm.rawContent || savingNote" @click="createNote"><PlusCircle :size="18" />{{ savingNote ? '保存中...' : '新增笔记' }}</button>
        <div v-if="message" class="notice">{{ message }}</div><div v-if="error" class="notice error">{{ error }}</div>
        <section class="draft-panel">
          <div class="section-title"><h2>全部笔记</h2><button class="secondary-button small-button" @click="loadNotes"><RefreshCw :size="16" />刷新</button></div>
          <article v-for="note in notes" :key="note.id" class="note-card">
            <div class="note-card-header"><strong>{{ note.title || '未命名笔记' }}</strong><small>{{ formatDate(note.createdAt) }}</small></div>
            <pre class="note-preview">{{ note.rawContent }}</pre>
            <div class="note-card-actions">
              <button class="secondary-button small-button" :disabled="generating" @click="generateNoteCorpus(note)"><Database :size="16" />生成语料</button>
              <button class="secondary-button small-button" :disabled="generating" @click="generateNoteQuestions(note)"><Sparkles :size="16" />生成题目</button>
              <button class="secondary-button small-button" @click="openNoteEditor(note)"><Pencil :size="16" />编辑</button>
              <button class="secondary-button small-button danger-button" @click="removeNote(note)"><Trash2 :size="16" />删除</button>
            </div>
          </article>
          <div v-if="!notes.length" class="notice">暂无笔记</div>
        </section>
      </section>

      <section v-show="tab === 'corpus'" class="control-panel">
        <div class="section-title"><Database :size="22" /><h1>语料管理</h1></div>
        <div class="form-grid"><label class="field"><span>语料组</span><select v-model="corpusGroup"><option v-for="group in corpusGroups" :key="group.groupName" :value="group.groupName">{{ group.groupName }} ({{ group.itemCount }})</option></select></label><button class="secondary-button" @click="newCorpusGroup"><PlusCircle :size="18" />新建组</button><button class="secondary-button danger-button" :disabled="!corpusGroup" @click="removeCorpusGroup"><Trash2 :size="18" />删除组</button></div>
        <button class="primary-button" @click="openCorpusForm"><PlusCircle :size="18" />新增语料</button>
        <section class="draft-panel"><div class="section-title"><h2>{{ corpusGroup || '请选择语料组' }}</h2><button class="secondary-button small-button" @click="loadCorpus"><RefreshCw :size="16" />刷新</button></div><article v-for="item in corpus" :key="item.id" class="corpus-row"><div class="corpus-row-main"><strong>{{ item.english }}</strong><span>{{ item.chinese }}</span><small>{{ item.englishExplain }}</small></div><div class="corpus-row-actions"><button class="secondary-button small-button" @click="openCorpusForm(item)"><Pencil :size="16" />编辑</button><button class="secondary-button small-button danger-button" @click="removeCorpus(item)"><Trash2 :size="16" />删除</button></div></article></section>
      </section>

      <section v-show="tab === 'questions'" class="control-panel">
        <div class="section-title"><ListChecks :size="22" /><h1>题目管理</h1></div>
        <div class="form-grid"><label class="field"><span>题目组</span><select v-model="questionGroup"><option v-for="group in questionGroups" :key="group.groupName" :value="group.groupName">{{ group.groupName }} ({{ group.itemCount }})</option></select></label><button class="secondary-button" @click="newQuestionGroup"><PlusCircle :size="18" />新建组</button><button class="secondary-button danger-button" :disabled="!questionGroup" @click="removeQuestionGroup"><Trash2 :size="18" />删除组</button></div>
        <label class="field"><span>生成主题</span><textarea v-model="questionTopic" rows="3" placeholder="输入内容后 AI 生成题目" /></label><button class="primary-button" :disabled="!questionGroup || !questionTopic || generating" @click="generateQuestions()"><Sparkles :size="18" />AI生成题目</button>
        <section class="draft-panel"><div class="section-title"><h2>{{ questionGroup || '请选择题目组' }}</h2><button class="secondary-button small-button" @click="loadQuestions"><RefreshCw :size="16" />刷新</button></div><article v-for="question in questions" :key="question.id" class="question-card"><div class="question-card-header"><QuestionTypeBadge :type="question.questionType" /><div class="action-row"><button class="icon-button small-button" title="编辑题目" @click="openQuestionEditor(question)"><Pencil :size="16" /></button><button class="icon-button small-button danger-button" title="删除题目" @click="removeQuestion(question)"><Trash2 :size="16" /></button></div></div><p>{{ question.questionText }}</p><div class="tag-line"><span v-for="answer in question.acceptableAnswers" :key="answer" class="type-badge">{{ answer }}</span></div></article></section>
      </section>

      <section v-show="tab === 'settings'" class="control-panel">
        <div class="section-title"><Settings :size="22" /><h1>系统设置</h1></div>
        <div v-if="settingsLoading" class="notice">加载中...</div>
        <div v-if="settingsError" class="notice error">{{ settingsError }}</div>
        <div v-if="settingsMessage" class="notice">{{ settingsMessage }}</div>
        <div v-for="group in settingGroups" :key="group.label" class="settings-group">
          <h3 class="settings-group-label">{{ group.label }}</h3>
          <div v-for="item in group.items" :key="item.key" class="settings-row">
            <label class="settings-label"><code>{{ item.key }}</code><small>{{ item.description }}</small></label>
            <input v-if="!isSecretKey(item.key)" :value="settingsForm[item.key] ?? item.value" @input="settingsForm[item.key] = $event.target.value" class="settings-input" />
            <input v-else :value="settingsForm[item.key] ?? ''" @input="settingsForm[item.key] = $event.target.value" :placeholder="item.value ? '已设置，留空不变' : '未设置'" type="password" class="settings-input" />
          </div>
        </div>
        <div class="action-row"><button class="primary-button" :disabled="settingsSaving" @click="saveSettings"><Save :size="18" />{{ settingsSaving ? '保存中...' : '保存设置' }}</button><button class="secondary-button" @click="loadSettings"><RefreshCw :size="18" />重新加载</button></div>
      </section>
    </section>

    <Teleport to="body"><div v-if="showNoteEditor" class="modal-backdrop" @click.self="showNoteEditor = false"><form class="modal-panel" @submit.prevent="saveNoteEdit"><div class="modal-header"><h2>编辑笔记</h2><button class="icon-button" type="button" title="关闭" @click="showNoteEditor = false"><X :size="20" /></button></div><div class="modal-body"><label class="field"><span>标题</span><input v-model.trim="noteEditForm.title" placeholder="可选" /></label><label class="field"><span>内容 *</span><textarea v-model.trim="noteEditForm.rawContent" rows="7" required /></label><button class="primary-button" type="submit" :disabled="savingNoteEdit"><Save :size="18" />{{ savingNoteEdit ? '保存中...' : '保存更改' }}</button></div></form></div></Teleport>
    <Teleport to="body"><div v-if="showCorpusForm" class="modal-backdrop" @click.self="showCorpusForm = false"><form class="modal-panel" @submit.prevent="saveCorpus"><div class="modal-header"><h2>{{ editingCorpusId ? '编辑语料' : '新增语料' }}</h2><button class="icon-button" type="button" title="关闭" @click="showCorpusForm = false"><X :size="20" /></button></div><div class="modal-body"><label class="field"><span>英语 *</span><input v-model.trim="corpusForm.english" required /></label><label class="field"><span>中文</span><input v-model.trim="corpusForm.chinese" /></label><label class="field"><span>英文解释</span><textarea v-model.trim="corpusForm.englishExplain" rows="2" /></label><label class="field"><span>音标</span><input v-model.trim="corpusForm.phonetic" /></label><label class="field"><span>标签（逗号分隔）</span><input v-model="corpusForm.tagsText" /></label><button class="primary-button" type="submit" :disabled="savingCorpus"><Save :size="18" />{{ savingCorpus ? '保存中...' : '保存' }}</button></div></form></div></Teleport>
    <Teleport to="body"><div v-if="showQuestionEditor" class="modal-backdrop" @click.self="showQuestionEditor = false"><form class="modal-panel" @submit.prevent="saveQuestionEdit"><div class="modal-header"><h2>编辑题目</h2><button class="icon-button" type="button" title="关闭" @click="showQuestionEditor = false"><X :size="20" /></button></div><div class="modal-body"><label class="field"><span>题型</span><select v-model="questionEditForm.questionType"><option value="collocation">固定搭配</option><option value="translation">中英互译</option><option value="synonym">同义词</option><option value="analogy">类似结构</option><option value="morphology">词形变化</option><option value="phrase">短语</option></select></label><label class="field"><span>题干 *</span><textarea v-model.trim="questionEditForm.questionText" rows="3" required /></label><label class="field"><span>可接受答案（每行一个）*</span><textarea v-model="questionEditForm.answersText" rows="3" required /></label><label v-if="questionEditForm.questionType === 'analogy'" class="field"><span>模板句</span><input v-model.trim="questionEditForm.template" /></label><label class="field"><span>匹配方式</span><select v-model="questionEditForm.matchRule"><option value="exact">完全匹配</option><option value="case_insensitive">忽略大小写</option><option value="trim">忽略首尾空格</option></select></label><label class="field"><span>难度</span><input v-model.number="questionEditForm.difficulty" type="number" min="1" max="5" /></label><button class="primary-button" type="submit" :disabled="savingQuestionEdit"><Save :size="18" />{{ savingQuestionEdit ? '保存中...' : '保存更改' }}</button></div></form></div></Teleport>
    <Teleport to="body"><div v-if="showGenerationModal" class="modal-backdrop"><section class="modal-panel generation-modal"><div class="modal-header"><h2>{{ generationTitle }}</h2><button class="icon-button" type="button" title="停止生成" @click="cancelGeneration"><X :size="20" /></button></div><div class="modal-body"><div class="generation-status"><span>{{ generationStatus }}</span><span>{{ generationText.length }} 字符</span></div><details v-if="generationReasoning || generationStatus.includes('推理')" class="generation-reasoning"><summary>思考过程 <span>{{ generationReasoning.length }} 字符</span></summary><pre ref="generationReasoningOutput" class="generation-reasoning-output">{{ generationReasoning || '正在等待推理输出...' }}</pre></details><pre ref="generationOutput" class="generation-output">{{ generationText || '正在等待模型输出...' }}</pre><div v-if="generationError" class="notice error">{{ generationError }}</div><div v-if="generationResult" class="notice">{{ generationResult }}</div></div></section></div></Teleport>
  </AppShell>
</template>

<script setup>
import { Database, FileText, ListChecks, Pencil, PlusCircle, RefreshCw, Save, Settings, Sparkles, Trash2, X } from '@lucide/vue';
import { onMounted, ref, watch } from 'vue';
import { api, API_BASE } from '../api.js';
import AppShell from '../components/AppShell.vue';
import QuestionTypeBadge from '../components/QuestionTypeBadge.vue';

const tab = ref('notes'); const notes = ref([]); const corpusGroups = ref([]); const questionGroups = ref([]); const corpusGroup = ref(''); const questionGroup = ref(''); const corpus = ref([]); const questions = ref([]); const message = ref(''); const error = ref(''); const savingNote = ref(false); const savingNoteEdit = ref(false); const savingCorpus = ref(false); const savingQuestionEdit = ref(false); const generating = ref(false); const showNoteEditor = ref(false); const showCorpusForm = ref(false); const showQuestionEditor = ref(false); const showGenerationModal = ref(false); const editingCorpusId = ref(null); const generationTitle = ref('AI 正在生成题目'); const generationText = ref(''); const generationReasoning = ref(''); const generationStatus = ref('准备连接 AI...'); const generationError = ref(''); const generationResult = ref(''); const generationOutput = ref(null); const generationReasoningOutput = ref(null); let generationController = null; let generationScrollFrame = null; let generationBatchPending = false;
const noteForm = ref({ title: '', rawContent: '' }); const noteEditForm = ref({ id: null, title: '', rawContent: '' }); const corpusForm = ref({ english: '', chinese: '', englishExplain: '', phonetic: '', tagsText: '' }); const questionEditForm = ref({ id: null, questionType: 'phrase', questionText: '', answersText: '', template: '', matchRule: 'exact', difficulty: 1 }); const questionTopic = ref('');
const settingGroups = ref([]); const settingsForm = ref({}); const settingsLoading = ref(false); const settingsSaving = ref(false); const settingsError = ref(''); const settingsMessage = ref('');
const secretKeys = new Set(['ai_api_key', 'tts_api_key', 'admin_password_hash', 'auth_secret']);
const formatDate = (value) => value ? new Date(value).toLocaleString('zh-CN') : '';
function reportError(err) { error.value = err.message; }
function isSecretKey(key) { return secretKeys.has(key); }
async function loadNotes() { try { notes.value = (await api.content.notes()).notes || []; } catch (err) { reportError(err); } }
async function loadCorpusGroups() { try { corpusGroups.value = (await api.classroomGroups()).groups || []; if (!corpusGroup.value && corpusGroups.value.length) corpusGroup.value = corpusGroups.value[0].groupName; } catch (err) { reportError(err); } }
async function loadQuestionGroups() { try { questionGroups.value = (await api.content.questionGroups()).groups || []; if (!questionGroup.value && questionGroups.value.length) questionGroup.value = questionGroups.value[0].groupName; } catch (err) { reportError(err); } }
async function loadCorpus() { if (!corpusGroup.value) return; try { corpus.value = (await api.classroomCorpus(corpusGroup.value)).items || []; } catch (err) { reportError(err); } }
async function loadQuestions() { if (!questionGroup.value) return; try { questions.value = (await api.content.questions(questionGroup.value)).questions || []; } catch (err) { reportError(err); } }
async function createNote() { savingNote.value = true; try { await api.content.createNote(noteForm.value); noteForm.value = { title: '', rawContent: '' }; message.value = '笔记已保存'; await loadNotes(); } catch (err) { reportError(err); } finally { savingNote.value = false; } }
function openNoteEditor(note) { noteEditForm.value = { id: note.id, title: note.title || '', rawContent: note.rawContent || '' }; showNoteEditor.value = true; }
async function saveNoteEdit() { savingNoteEdit.value = true; try { await api.content.updateNote(noteEditForm.value.id, { title: noteEditForm.value.title, rawContent: noteEditForm.value.rawContent }); showNoteEditor.value = false; message.value = '笔记已更新'; await loadNotes(); } catch (err) { reportError(err); } finally { savingNoteEdit.value = false; } }
async function removeNote(note) { if (!confirm(`删除笔记“${note.title || '未命名'}”？`)) return; try { await api.content.deleteNote(note.id); await loadNotes(); } catch (err) { reportError(err); } }
function beginGeneration(title) {
  generating.value = true;
  generationTitle.value = title;
  showGenerationModal.value = true;
  generationText.value = '';
  generationReasoning.value = '';
  generationError.value = '';
  generationResult.value = '';
  generationStatus.value = '正在连接 AI...';
  generationBatchPending = false;
  generationController = new AbortController();
}

function scheduleGenerationScroll() {
  if (generationScrollFrame) return;
  generationScrollFrame = requestAnimationFrame(() => {
    generationScrollFrame = null;
    if (generationOutput.value) generationOutput.value.scrollTop = generationOutput.value.scrollHeight;
    if (generationReasoningOutput.value) generationReasoningOutput.value.scrollTop = generationReasoningOutput.value.scrollHeight;
  });
}

function appendGenerationText(text) {
  if (generationBatchPending && generationText.value) generationText.value += '\n\n--- 下一批解析结果 ---\n';
  generationBatchPending = false;
  generationText.value += text;
  scheduleGenerationScroll();
}

function appendGenerationReasoning(text) {
  generationReasoning.value += text;
  scheduleGenerationScroll();
}

async function readGenerationStream(response, handleEvent) {
  if (!response.ok || !response.body) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || '无法建立 AI 流式连接');
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      const text = line.trim();
      if (!text.startsWith('data:')) continue;
      await handleEvent(JSON.parse(text.slice(5).trim()));
    }
  }
}

function handleGenerationFailure(err) {
  if (err.name === 'AbortError') generationStatus.value = '已停止生成';
  else {
    generationError.value = err.message;
    generationStatus.value = '生成失败';
    reportError(err);
  }
}

async function generateNoteCorpus(note) {
  const groupName = prompt('输出到哪个语料组？', corpusGroup.value || '笔记语料');
  if (!groupName?.trim()) return;
  const normalizedGroup = groupName.trim();
  beginGeneration('AI 正在生成语料');
  try {
    const response = await fetch(`${API_BASE}/api/content/notes/${note.id}/generate-corpus/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ groupName: normalizedGroup }),
      signal: generationController.signal
    });
    await readGenerationStream(response, async (event) => {
      if (event.status === 'started') generationStatus.value = 'AI 正在解析笔记...';
      if (event.status === 'delta') {
        if (event.phase === 'reasoning') { generationStatus.value = 'AI 正在推理...'; appendGenerationReasoning(event.text); }
        else { generationStatus.value = 'AI 正在生成语料...'; appendGenerationText(event.text); }
      }
      if (event.status === 'progress') { generationStatus.value = `正在解析第 ${event.currentLine}/${event.totalLines} 行，已提取 ${event.extractedCount} 条`; generationBatchPending = true; }
      if (event.status === 'error') throw new Error(event.message);
      if (event.status === 'done') {
        generationStatus.value = '生成完成';
        generationResult.value = `已保存 ${event.result.imported} 条语料到“${normalizedGroup}”`;
        corpusGroup.value = normalizedGroup;
        await Promise.all([loadCorpusGroups(), loadCorpus()]);
      }
    });
  } catch (err) {
    handleGenerationFailure(err);
  } finally {
    generating.value = false;
    generationController = null;
  }
}

async function generateNoteQuestions(note) {
  const groupName = prompt('输出到哪个题目组？', questionGroup.value || '笔记题目');
  if (!groupName?.trim()) return;
  await generateQuestions({
    topic: note.title || '导入笔记',
    notesContent: note.rawContent,
    groupName: groupName.trim(),
    clearTopic: false
  });
}
async function newCorpusGroup() { const name = prompt('新语料组名称'); if (!name?.trim()) return; try { await api.createClassroomGroup(name.trim()); await loadCorpusGroups(); corpusGroup.value = name.trim(); } catch (err) { reportError(err); } }
async function removeCorpusGroup() { if (!confirm(`删除语料组“${corpusGroup.value}”及其内容？`)) return; try { await api.deleteClassroomGroup(corpusGroup.value); corpusGroup.value = ''; corpus.value = []; await loadCorpusGroups(); } catch (err) { reportError(err); } }
function openCorpusForm(item = null) { editingCorpusId.value = item?.id ?? null; corpusForm.value = item ? { english: item.english || '', chinese: item.chinese || '', englishExplain: item.englishExplain || '', phonetic: item.phonetic || '', tagsText: (item.tags || []).join(', ') } : { english: '', chinese: '', englishExplain: '', phonetic: '', tagsText: '' }; showCorpusForm.value = true; }
async function saveCorpus() { savingCorpus.value = true; try { const payload = { english: corpusForm.value.english, chinese: corpusForm.value.chinese, englishExplain: corpusForm.value.englishExplain, phonetic: corpusForm.value.phonetic, tags: corpusForm.value.tagsText.split(',').map((tag) => tag.trim()).filter(Boolean) }; if (editingCorpusId.value) await api.updateClassroomItem(editingCorpusId.value, payload); else await api.createClassroomItem({ ...payload, groupName: corpusGroup.value }); showCorpusForm.value = false; await loadCorpus(); await loadCorpusGroups(); } catch (err) { reportError(err); } finally { savingCorpus.value = false; } }
async function removeCorpus(item) { if (!confirm(`删除“${item.english}”？`)) return; try { await api.deleteClassroomItem(item.id); await loadCorpus(); await loadCorpusGroups(); } catch (err) { reportError(err); } }
async function newQuestionGroup() { const name = prompt('新题目组名称'); if (!name?.trim()) return; try { await api.content.createQuestionGroup(name.trim()); await loadQuestionGroups(); questionGroup.value = name.trim(); } catch (err) { reportError(err); } }
async function removeQuestionGroup() { if (!confirm(`删除题目组“${questionGroup.value}”及其内容？`)) return; try { await api.content.deleteQuestionGroup(questionGroup.value); questionGroup.value = ''; questions.value = []; await loadQuestionGroups(); } catch (err) { reportError(err); } }
async function generateQuestions(input = {}) {
  const groupName = input.groupName || questionGroup.value;
  const notesContent = input.notesContent ?? questionTopic.value;
  if (!groupName || !notesContent?.trim()) return;

  beginGeneration('AI 正在生成题目');
  try {
    const response = await fetch(`${API_BASE}/api/ai/generate/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic: input.topic || groupName, notesContent, count: 4 }),
      signal: generationController.signal
    });
    await readGenerationStream(response, async (event) => {
      if (event.status === 'started') generationStatus.value = 'AI 正在输出...';
      if (event.status === 'delta') {
        if (event.phase === 'reasoning') { generationStatus.value = 'AI 正在推理...'; appendGenerationReasoning(event.text); }
        else { generationStatus.value = 'AI 正在生成题目...'; appendGenerationText(event.text); }
      }
      if (event.status === 'error') throw new Error(event.message);
      if (event.status === 'done') {
        generationStatus.value = '正在保存题目...';
        const result = await api.content.saveQuestions({ questionGroup: groupName, questions: event.questions });
        generationResult.value = `已保存 ${result.insertedCount} 道题目到“${groupName}”`;
        generationStatus.value = '生成完成';
        if (input.clearTopic !== false) questionTopic.value = '';
        questionGroup.value = groupName;
        await Promise.all([loadQuestionGroups(), loadQuestions()]);
      }
    });
  } catch (err) {
    handleGenerationFailure(err);
  } finally {
    generating.value = false;
    generationController = null;
  }
}
function cancelGeneration() { generationController?.abort(); showGenerationModal.value = false; }
function openQuestionEditor(question) { questionEditForm.value = { id: question.id, questionType: question.questionType, questionText: question.questionText || '', answersText: (question.acceptableAnswers || []).join('\n'), template: question.template || '', matchRule: question.matchRule || 'exact', difficulty: question.difficulty || 1 }; showQuestionEditor.value = true; }
async function saveQuestionEdit() { const acceptableAnswers = questionEditForm.value.answersText.split(/\r?\n/).map((answer) => answer.trim()).filter(Boolean); if (!acceptableAnswers.length) { reportError(new Error('请至少填写一个可接受答案')); return; } savingQuestionEdit.value = true; try { await api.content.updateQuestion(questionEditForm.value.id, { questionType: questionEditForm.value.questionType, questionText: questionEditForm.value.questionText, acceptableAnswers, template: questionEditForm.value.questionType === 'analogy' ? questionEditForm.value.template || null : null, matchRule: questionEditForm.value.matchRule, difficulty: questionEditForm.value.difficulty }); showQuestionEditor.value = false; message.value = '题目已更新'; await loadQuestions(); } catch (err) { reportError(err); } finally { savingQuestionEdit.value = false; } }
async function removeQuestion(question) { if (!confirm('删除此题？')) return; try { await api.content.deleteQuestion(question.id); await loadQuestions(); await loadQuestionGroups(); } catch (err) { reportError(err); } }
async function loadSettings() { settingsLoading.value = true; settingsError.value = ''; try { const data = await api.settings.getAll(); settingGroups.value = data.groups || []; const values = {}; for (const group of settingGroups.value) for (const item of group.items) values[item.key] = isSecretKey(item.key) ? '' : item.value; settingsForm.value = values; } catch (err) { settingsError.value = err.message; } finally { settingsLoading.value = false; } }
async function saveSettings() { settingsSaving.value = true; settingsError.value = ''; settingsMessage.value = ''; try { const payload = {}; for (const group of settingGroups.value) for (const item of group.items) { const value = settingsForm.value[item.key]; if (isSecretKey(item.key) && !value) continue; if (value !== item.value) payload[item.key] = value; } if (!Object.keys(payload).length) { settingsMessage.value = '没有需要保存的更改'; return; } await api.settings.update(payload); settingsMessage.value = `已更新 ${Object.keys(payload).length} 项设置`; await loadSettings(); } catch (err) { settingsError.value = err.message; } finally { settingsSaving.value = false; } }
watch(tab, (value) => { if (value === 'settings' && !settingGroups.value.length) loadSettings(); }); watch(corpusGroup, loadCorpus); watch(questionGroup, loadQuestions); onMounted(async () => { await Promise.all([loadNotes(), loadCorpusGroups(), loadQuestionGroups()]); await Promise.all([loadCorpus(), loadQuestions()]); });
</script>
