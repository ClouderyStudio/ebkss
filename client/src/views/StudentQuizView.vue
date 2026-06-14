<template>
  <AppShell>
    <section class="student-layout">
      <div class="control-panel">
        <div class="section-title">
          <PenLine :size="22" aria-hidden="true" />
          <h1>学生练习</h1>
        </div>

        <div class="form-grid">
          <UnitSelect v-if="store.units.length" v-model="selectedUnitId" :units="store.units" />
          <label class="field">
            <span>姓名</span>
            <input v-model="studentName" placeholder="可不填" />
          </label>
          <button class="secondary-button" type="button" @click="loadQuiz">
            <RefreshCw :size="18" aria-hidden="true" />
            <span>换一组题</span>
          </button>
        </div>

        <div v-if="error" class="notice error">{{ error }}</div>
      </div>

      <form v-if="questions.length" class="question-list" @submit.prevent="submit">
        <article v-for="(question, index) in questions" :key="question.id" class="question-card">
          <div class="question-card-header">
            <QuestionTypeBadge :type="question.questionType" />
            <span>第 {{ index + 1 }} 题</span>
          </div>
          <p>{{ question.questionText }}</p>
          <textarea v-model="answers[question.id]" rows="2" placeholder="输入答案"></textarea>
        </article>

        <button class="primary-button submit-button" type="submit" :disabled="submitting">
          <Send :size="20" aria-hidden="true" />
          <span>{{ submitting ? '评分中...' : '提交评分' }}</span>
        </button>
      </form>

      <section v-if="result" class="result-panel">
        <div class="section-title">
          <CircleCheck :size="22" aria-hidden="true" />
          <h2>练习结果</h2>
        </div>
        <div class="metric-grid">
          <div>
            <strong>{{ Math.round(result.accuracy * 100) }}%</strong>
            <span>正确率</span>
          </div>
          <div>
            <strong>{{ result.score }}</strong>
            <span>得分</span>
          </div>
          <div>
            <strong>{{ result.correctCount }}/{{ result.totalQuestions }}</strong>
            <span>正确题数</span>
          </div>
        </div>

        <article v-for="item in result.results" :key="item.questionId" class="review-row">
          <div>
            <strong :class="item.isCorrect ? 'ok-text' : 'bad-text'">{{ item.isCorrect ? '正确' : '需订正' }}</strong>
            <p>{{ item.questionText }}</p>
            <small>你的答案：{{ item.userAnswer || '未作答' }}</small>
          </div>
          <div class="answer-chip">{{ item.correctAnswers.join(' / ') }}</div>
        </article>
      </section>
    </section>
  </AppShell>
</template>

<script setup>
import { CircleCheck, PenLine, RefreshCw, Send } from '@lucide/vue';
import { onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../api.js';
import AppShell from '../components/AppShell.vue';
import QuestionTypeBadge from '../components/QuestionTypeBadge.vue';
import UnitSelect from '../components/UnitSelect.vue';
import { useUnitsStore } from '../stores/units.js';

const route = useRoute();
const store = useUnitsStore();
const selectedUnitId = ref(Number(route.query.unitId) || 0);
const studentName = ref('');
const questions = ref([]);
const answers = ref({});
const error = ref('');
const result = ref(null);
const submitting = ref(false);

async function loadQuiz() {
  if (!selectedUnitId.value) {
    return;
  }

  error.value = '';
  result.value = null;

  try {
    const data = await api.quiz(selectedUnitId.value, { count: 8, mode: 'student' });
    questions.value = data.questions || [];
    answers.value = Object.fromEntries(questions.value.map((question) => [question.id, '']));
  } catch (err) {
    error.value = err.message;
  }
}

async function submit() {
  submitting.value = true;
  error.value = '';

  try {
    result.value = await api.submit({
      unitId: selectedUnitId.value,
      studentName: studentName.value || undefined,
      mode: 'student',
      answers: questions.value.map((question) => ({
        questionId: question.id,
        answer: answers.value[question.id] || ''
      }))
    });
  } catch (err) {
    error.value = err.message;
  } finally {
    submitting.value = false;
  }
}

watch(selectedUnitId, loadQuiz);

onMounted(async () => {
  await store.loadUnits();
  if (!selectedUnitId.value && store.firstUnit) {
    selectedUnitId.value = store.firstUnit.id;
  } else {
    loadQuiz();
  }
});
</script>
