<template>
  <AppShell>
    <section class="tools-layout">
      <div class="control-panel">
        <div class="section-title">
          <WandSparkles :size="22" aria-hidden="true" />
          <h1>教师工具</h1>
        </div>

        <div class="form-grid">
          <label class="field">
            <span>语法点</span>
            <select v-model.number="selectedGrammarPointId">
              <option v-for="point in store.allGrammarPoints" :key="point.id" :value="point.id">
                {{ point.name }}
              </option>
            </select>
          </label>
          <label class="field compact">
            <span>题数</span>
            <input v-model.number="count" min="1" max="12" type="number" />
          </label>
        </div>

        <label class="field">
          <span>笔记内容</span>
          <textarea v-model="notesContent" rows="5" />
        </label>

        <div class="action-row">
          <button class="primary-button" type="button" :disabled="generating" @click="generate">
            <Sparkles :size="19" aria-hidden="true" />
            <span>{{ generating ? '生成中...' : 'AI生成题目' }}</span>
          </button>
          <button class="secondary-button" type="button" :disabled="graphLoading" @click="loadGraph">
            <Network :size="19" aria-hidden="true" />
            <span>{{ graphLoading ? '生成中...' : '知识图谱' }}</span>
          </button>
        </div>

        <div v-if="message" class="notice">{{ message }}</div>
        <div v-if="error" class="notice error">{{ error }}</div>
      </div>

      <section class="draft-panel">
        <div class="section-title">
          <ListChecks :size="22" aria-hidden="true" />
          <h2>题目草稿</h2>
        </div>

        <article v-for="(draft, index) in drafts" :key="index" class="question-card">
          <div class="question-card-header">
            <QuestionTypeBadge :type="draft.questionType" />
            <span>草稿 {{ index + 1 }}</span>
          </div>
          <label class="field">
            <span>题干</span>
            <textarea v-model="draft.questionText" rows="2" />
          </label>
          <label class="field">
            <span>可接受答案（每行一个）</span>
            <textarea v-model="draft.answerText" rows="2" />
          </label>
          <label v-if="draft.questionType === 'analogy'" class="field">
            <span>模板句</span>
            <input v-model="draft.template" />
          </label>
        </article>

        <button v-if="drafts.length" class="primary-button submit-button" type="button" @click="saveDrafts">
          <Save :size="20" aria-hidden="true" />
          <span>保存到题库</span>
        </button>
      </section>

      <GraphPanel v-if="graph" :graph="graph" />
    </section>
  </AppShell>
</template>

<script setup>
import { ListChecks, Network, Save, Sparkles, WandSparkles } from '@lucide/vue';
import { computed, onMounted, ref, watch } from 'vue';
import { api } from '../api.js';
import AppShell from '../components/AppShell.vue';
import GraphPanel from '../components/GraphPanel.vue';
import QuestionTypeBadge from '../components/QuestionTypeBadge.vue';
import { useUnitsStore } from '../stores/units.js';

const store = useUnitsStore();
const selectedGrammarPointId = ref(0);
const notesContent = ref('');
const count = ref(4);
const drafts = ref([]);
const graph = ref(null);
const generating = ref(false);
const graphLoading = ref(false);
const message = ref('');
const error = ref('');

const selectedPoint = computed(() =>
  store.allGrammarPoints.find((point) => point.id === selectedGrammarPointId.value)
);

watch(selectedPoint, (point) => {
  notesContent.value = point?.notesContent || '';
});

async function generate() {
  generating.value = true;
  error.value = '';
  message.value = '';

  try {
    const data = await api.generate({
      grammarPointId: selectedGrammarPointId.value,
      notesContent: notesContent.value,
      count: count.value
    });
    drafts.value = (data.questions || []).map((question) => ({
      ...question,
      answerText: question.acceptableAnswers.join('\n')
    }));
  } catch (err) {
    error.value = err.message;
  } finally {
    generating.value = false;
  }
}

async function saveDrafts() {
  error.value = '';
  message.value = '';

  try {
    const payload = {
      grammarPointId: selectedGrammarPointId.value,
      questions: drafts.value.map((draft) => ({
        questionType: draft.questionType,
        questionText: draft.questionText,
        acceptableAnswers: draft.answerText
          .split('\n')
          .map((answer) => answer.trim())
          .filter(Boolean),
        template: draft.template,
        matchRule: draft.matchRule || 'exact',
        difficulty: draft.difficulty || 1,
        requiresAi: draft.questionType === 'analogy'
      }))
    };
    const result = await api.saveCorpus(payload);
    drafts.value = [];
    message.value = `已保存 ${result.insertedCount} 道题`;
  } catch (err) {
    error.value = err.message;
  }
}

async function loadGraph() {
  graphLoading.value = true;
  error.value = '';
  message.value = '';

  try {
    const data = await api.graph(selectedGrammarPointId.value);
    graph.value = data.graph;
    message.value = data.cached ? '已读取缓存图谱' : '已生成新图谱';
  } catch (err) {
    error.value = err.message;
  } finally {
    graphLoading.value = false;
  }
}

onMounted(async () => {
  await store.loadUnits();
  if (store.allGrammarPoints.length > 0) {
    selectedGrammarPointId.value = store.allGrammarPoints[0].id;
    notesContent.value = store.allGrammarPoints[0].notesContent || '';
  }
});
</script>
