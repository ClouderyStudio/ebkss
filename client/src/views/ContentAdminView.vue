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
              <button class="secondary-button small-button" @click="generateNoteCorpus(note)"><Database :size="16" />生成语料</button>
              <button class="secondary-button small-button" @click="generateNoteQuestions(note)"><Sparkles :size="16" />生成题目</button>
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
        <section class="draft-panel"><div class="section-title"><h2>{{ corpusGroup || '请选择语料组' }}</h2><button class="secondary-button small-button" @click="loadCorpus"><RefreshCw :size="16" />刷新</button></div><article v-for="item in corpus" :key="item.id" class="corpus-row"><div class="corpus-row-main"><strong>{{ item.english }}</strong><span>{{ item.chinese }}</span><small>{{ item.englishExplain }}</small></div><button class="secondary-button small-button danger-button" @click="removeCorpus(item)"><Trash2 :size="16" />删除</button></article></section>
      </section>

      <section v-show="tab === 'questions'" class="control-panel">
        <div class="section-title"><ListChecks :size="22" /><h1>题目管理</h1></div>
        <div class="form-grid"><label class="field"><span>题目组</span><select v-model="questionGroup"><option v-for="group in questionGroups" :key="group.groupName" :value="group.groupName">{{ group.groupName }} ({{ group.itemCount }})</option></select></label><button class="secondary-button" @click="newQuestionGroup"><PlusCircle :size="18" />新建组</button><button class="secondary-button danger-button" :disabled="!questionGroup" @click="removeQuestionGroup"><Trash2 :size="18" />删除组</button></div>
        <label class="field"><span>生成主题</span><textarea v-model="questionTopic" rows="3" placeholder="输入内容后 AI 生成题目" /></label><button class="primary-button" :disabled="!questionGroup || !questionTopic || generating" @click="generateQuestions"><Sparkles :size="18" />{{ generating ? '生成中...' : 'AI生成题目' }}</button>
        <section class="draft-panel"><div class="section-title"><h2>{{ questionGroup || '请选择题目组' }}</h2><button class="secondary-button small-button" @click="loadQuestions"><RefreshCw :size="16" />刷新</button></div><article v-for="question in questions" :key="question.id" class="question-card"><div class="question-card-header"><QuestionTypeBadge :type="question.questionType" /><button class="icon-button small-button danger-button" @click="removeQuestion(question)"><Trash2 :size="16" /></button></div><p>{{ question.questionText }}</p><div class="tag-line"><span v-for="answer in question.acceptableAnswers" :key="answer" class="type-badge">{{ answer }}</span></div></article></section>
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

    <Teleport to="body"><div v-if="showCorpusForm" class="modal-backdrop" @click.self="showCorpusForm = false"><form class="modal-panel" @submit.prevent="createCorpus"><div class="modal-header"><h2>新增语料</h2><button class="icon-button" type="button" @click="showCorpusForm = false"><X :size="20" /></button></div><div class="modal-body"><label class="field"><span>英语 *</span><input v-model.trim="corpusForm.english" required /></label><label class="field"><span>中文</span><input v-model.trim="corpusForm.chinese" /></label><label class="field"><span>英文解释</span><textarea v-model.trim="corpusForm.englishExplain" rows="2" /></label><button class="primary-button" type="submit"><Save :size="18" />保存</button></div></form></div></Teleport>
  </AppShell>
</template>

<script setup>
import { Database, FileText, ListChecks, PlusCircle, RefreshCw, Save, Settings, Sparkles, Trash2, X } from '@lucide/vue';
import { onMounted, ref, watch } from 'vue';
import { api } from '../api.js';
import AppShell from '../components/AppShell.vue';
import QuestionTypeBadge from '../components/QuestionTypeBadge.vue';

const tab = ref('notes'); const notes = ref([]); const corpusGroups = ref([]); const questionGroups = ref([]); const corpusGroup = ref(''); const questionGroup = ref(''); const corpus = ref([]); const questions = ref([]); const message = ref(''); const error = ref(''); const savingNote = ref(false); const generating = ref(false); const showCorpusForm = ref(false);
const noteForm = ref({ title: '', rawContent: '' }); const corpusForm = ref({ english: '', chinese: '', englishExplain: '' }); const questionTopic = ref('');
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
async function removeNote(note) { if (!confirm(`删除笔记“${note.title || '未命名'}”？`)) return; try { await api.content.deleteNote(note.id); await loadNotes(); } catch (err) { reportError(err); } }
async function generateNoteCorpus(note) { const groupName = prompt('输出到哪个语料组？', corpusGroup.value || '笔记语料'); if (!groupName?.trim()) return; try { const result = await api.content.generateCorpus(note.id, { groupName: groupName.trim(), mode: 'ai' }); message.value = `已生成 ${result.result.imported} 条语料`; await loadCorpusGroups(); corpusGroup.value = groupName.trim(); } catch (err) { reportError(err); } }
async function generateNoteQuestions(note) { const groupName = prompt('输出到哪个题目组？', questionGroup.value || '笔记题目'); if (!groupName?.trim()) return; try { const result = await api.content.generateQuestions(note.id, { questionGroup: groupName.trim(), count: 4 }); message.value = `已生成 ${result.insertedCount} 道题目`; await loadQuestionGroups(); questionGroup.value = groupName.trim(); } catch (err) { reportError(err); } }
async function newCorpusGroup() { const name = prompt('新语料组名称'); if (!name?.trim()) return; try { await api.createClassroomGroup(name.trim()); await loadCorpusGroups(); corpusGroup.value = name.trim(); } catch (err) { reportError(err); } }
async function removeCorpusGroup() { if (!confirm(`删除语料组“${corpusGroup.value}”及其内容？`)) return; try { await api.deleteClassroomGroup(corpusGroup.value); corpusGroup.value = ''; corpus.value = []; await loadCorpusGroups(); } catch (err) { reportError(err); } }
function openCorpusForm() { corpusForm.value = { english: '', chinese: '', englishExplain: '' }; showCorpusForm.value = true; }
async function createCorpus() { try { await api.createClassroomItem({ ...corpusForm.value, groupName: corpusGroup.value, tags: [] }); showCorpusForm.value = false; await loadCorpus(); await loadCorpusGroups(); } catch (err) { reportError(err); } }
async function removeCorpus(item) { if (!confirm(`删除“${item.english}”？`)) return; try { await api.deleteClassroomItem(item.id); await loadCorpus(); await loadCorpusGroups(); } catch (err) { reportError(err); } }
async function newQuestionGroup() { const name = prompt('新题目组名称'); if (!name?.trim()) return; try { await api.content.createQuestionGroup(name.trim()); await loadQuestionGroups(); questionGroup.value = name.trim(); } catch (err) { reportError(err); } }
async function removeQuestionGroup() { if (!confirm(`删除题目组“${questionGroup.value}”及其内容？`)) return; try { await api.content.deleteQuestionGroup(questionGroup.value); questionGroup.value = ''; questions.value = []; await loadQuestionGroups(); } catch (err) { reportError(err); } }
async function generateQuestions() { generating.value = true; try { const data = await api.generate({ topic: questionGroup.value, notesContent: questionTopic.value, count: 4 }); await api.content.saveQuestions({ questionGroup: questionGroup.value, questions: data.questions }); questionTopic.value = ''; await loadQuestions(); await loadQuestionGroups(); } catch (err) { reportError(err); } finally { generating.value = false; } }
async function removeQuestion(question) { if (!confirm('删除此题？')) return; try { await api.content.deleteQuestion(question.id); await loadQuestions(); await loadQuestionGroups(); } catch (err) { reportError(err); } }
async function loadSettings() { settingsLoading.value = true; settingsError.value = ''; try { const data = await api.settings.getAll(); settingGroups.value = data.groups || []; const values = {}; for (const group of settingGroups.value) for (const item of group.items) values[item.key] = isSecretKey(item.key) ? '' : item.value; settingsForm.value = values; } catch (err) { settingsError.value = err.message; } finally { settingsLoading.value = false; } }
async function saveSettings() { settingsSaving.value = true; settingsError.value = ''; settingsMessage.value = ''; try { const payload = {}; for (const group of settingGroups.value) for (const item of group.items) { const value = settingsForm.value[item.key]; if (isSecretKey(item.key) && !value) continue; if (value !== item.value) payload[item.key] = value; } if (!Object.keys(payload).length) { settingsMessage.value = '没有需要保存的更改'; return; } await api.settings.update(payload); settingsMessage.value = `已更新 ${Object.keys(payload).length} 项设置`; await loadSettings(); } catch (err) { settingsError.value = err.message; } finally { settingsSaving.value = false; } }
watch(tab, (value) => { if (value === 'settings' && !settingGroups.value.length) loadSettings(); }); watch(corpusGroup, loadCorpus); watch(questionGroup, loadQuestions); onMounted(async () => { await Promise.all([loadNotes(), loadCorpusGroups(), loadQuestionGroups()]); await Promise.all([loadCorpus(), loadQuestions()]); });
</script>
