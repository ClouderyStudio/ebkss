<template>
  <div class="classroom-page" :style="pageStyle">
    <header class="classroom-header">
      <RouterLink class="icon-button" to="/" title="返回首页" aria-label="返回首页">
        <ArrowLeft :size="20" />
      </RouterLink>
      <div class="classroom-title">
        <strong>英语课堂快闪</strong>
        <span>{{ groupName }} 词组</span>
      </div>
      <div class="classroom-meta">
        <span>{{ currentMode.label }}</span>
        <span>{{ showDelaySeconds }}s</span>
        <span>{{ currentIndex + 1 }} / {{ items.length || 0 }}</span>
      </div>
    </header>

    <main class="classroom-main">
      <section class="flash-stage">
        <div v-if="loading" class="classroom-message">正在读取语料...</div>
        <div v-else-if="error" class="classroom-message">{{ error }}</div>
        <div v-else-if="currentItem" class="flash-card">
          <div class="flash-card-topline">
            <span>{{ currentItem.phonetic }}</span>
            <span :class="isRunning ? 'status-running' : 'status-paused'">
              {{ isRunning ? '播放中' : '已暂停' }}
            </span>
          </div>

          <div class="flash-content" :class="{ listening: isListeningPrompt }">
            <Headphones v-if="isListeningPrompt" :size="96" aria-hidden="true" />
            <template v-else>
              <h1>{{ currentItem.english }}</h1>
              <p v-if="mode === 'en-en' && answerVisible">{{ currentItem.englishExplain }}</p>
              <p v-else-if="mode === 'en-zh' && answerVisible">{{ currentItem.chinese }}</p>
              <p v-else-if="mode === 'listen-zh' && answerVisible">
                {{ currentItem.english }} / {{ currentItem.chinese }}
              </p>
            </template>
          </div>

          <div class="flash-answer-state">
            <span v-if="answerVisible">{{ answerLabel }}</span>
            <span v-else>等待答案</span>
          </div>

          <div v-if="audioError" class="classroom-audio-error">{{ audioError }}</div>
        </div>
        <div v-else class="classroom-message">暂无语料</div>
      </section>

      <aside class="classroom-graph">
        <div class="classroom-graph-header">
          <Network :size="20" aria-hidden="true" />
          <span>知识图谱</span>
          <small>{{ graphCached ? '缓存' : '生成' }}</small>
        </div>
        <GraphPanel v-if="graph" :graph="graph" :active-node-id="activeNodeId" />
        <div v-else class="classroom-message compact">正在准备图谱...</div>
      </aside>
    </main>

    <footer class="classroom-controls">
      <button class="classroom-button primary" type="button" @click="toggleRunning">
        <Pause v-if="isRunning" :size="20" aria-hidden="true" />
        <Play v-else :size="20" aria-hidden="true" />
        <span>{{ isRunning ? '暂停' : '开始' }}</span>
      </button>
      <button class="icon-button" type="button" title="上一条" aria-label="上一条" @click="prevCard">
        <SkipBack :size="20" />
      </button>
      <button class="icon-button" type="button" title="显示答案" aria-label="显示答案" @click="showAnswerNow">
        <Eye :size="20" />
      </button>
      <button class="icon-button" type="button" title="下一条" aria-label="下一条" @click="nextCard">
        <SkipForward :size="20" />
      </button>
      <button class="icon-button" type="button" title="重新读取" aria-label="重新读取" @click="loadClassroom">
        <RefreshCw :size="20" />
      </button>

      <label class="classroom-field">
        <Languages :size="18" aria-hidden="true" />
        <select v-model="mode">
          <option v-for="option in modeOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>

      <label class="classroom-field">
        <Volume2 :size="18" aria-hidden="true" />
        <select v-model="voiceMode">
          <option value="browser">本地朗读</option>
          <option value="cloud">AI音频</option>
        </select>
      </label>

      <label class="classroom-slider">
        <Timer :size="18" aria-hidden="true" />
        <input v-model.number="showDelaySeconds" type="range" min="1" max="5" step="0.5" />
        <span>{{ showDelaySeconds }}s</span>
      </label>

      <label class="classroom-slider">
        <Captions :size="18" aria-hidden="true" />
        <input v-model.number="holdDelaySeconds" type="range" min="0.5" max="3" step="0.5" />
        <span>{{ holdDelaySeconds }}s</span>
      </label>

      <label class="classroom-slider">
        <Volume2 :size="18" aria-hidden="true" />
        <input v-model.number="volume" type="range" min="0" max="1" step="0.05" />
        <span>{{ Math.round(volume * 100) }}%</span>
      </label>

      <label class="classroom-slider">
        <Gauge :size="18" aria-hidden="true" />
        <input v-model.number="speed" type="range" min="0.5" max="1.5" step="0.1" />
        <span>{{ speed.toFixed(1) }}</span>
      </label>

      <label class="toggle-field classroom-toggle">
        <input v-model="autoNext" type="checkbox" />
        <span>自动下一条</span>
      </label>

      <button class="icon-button" type="button" title="全屏" aria-label="全屏" @click="toggleFullscreen">
        <Maximize :size="20" />
      </button>
    </footer>
  </div>
</template>

<script setup>
import {
  ArrowLeft,
  Captions,
  Eye,
  Gauge,
  Headphones,
  Languages,
  Maximize,
  Network,
  Pause,
  Play,
  RefreshCw,
  SkipBack,
  SkipForward,
  Timer,
  Volume2
} from '@lucide/vue';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { api } from '../api.js';
import GraphPanel from '../components/GraphPanel.vue';
import { CLASSROOM_CONFIG } from '../config.js';

const modeOptions = [
  { value: 'en-zh', label: '英语说汉', usesTts: false },
  { value: 'en-en', label: '英语说英', usesTts: true },
  { value: 'listen-zh', label: '听英语说汉', usesTts: true }
];

const groupName = ref(CLASSROOM_CONFIG.defaultGroup);
const mode = ref(CLASSROOM_CONFIG.defaultMode);
const items = ref([]);
const graph = ref(null);
const graphCached = ref(false);
const currentIndex = ref(0);
const answerVisible = ref(false);
const isRunning = ref(false);
const loading = ref(false);
const error = ref('');
const audioError = ref('');
const autoNext = ref(true);
const voiceMode = ref(CLASSROOM_CONFIG.defaultVoiceMode);
const showDelaySeconds = ref(CLASSROOM_CONFIG.showToAnswerDelay / 1000);
const holdDelaySeconds = ref(CLASSROOM_CONFIG.answerHoldDelay / 1000);
const volume = ref(CLASSROOM_CONFIG.defaultTtsVolume);
const speed = ref(CLASSROOM_CONFIG.defaultTtsSpeed);
let revealTimer;
let nextTimer;
let speechTimer;
let audio;
let selectedBrowserVoice = null;

const pageStyle = {
  '--classroom-bg': CLASSROOM_CONFIG.backgroundColor,
  '--classroom-accent': CLASSROOM_CONFIG.accentColor
};

const currentMode = computed(() => modeOptions.find((option) => option.value === mode.value) || modeOptions[1]);
const currentItem = computed(() => items.value[currentIndex.value] || null);
const activeNodeId = computed(() => currentItem.value?.graphNodeId || '');
const isListeningPrompt = computed(() => mode.value === 'listen-zh' && !answerVisible.value);
const answerLabel = computed(() => {
  if (mode.value === 'en-en') return '英文解释';
  if (mode.value === 'listen-zh') return '中英文';
  return '中文释义';
});

function clearTimers() {
  window.clearTimeout(revealTimer);
  window.clearTimeout(nextTimer);
  window.clearTimeout(speechTimer);
}

function stopAudio() {
  if (audio) {
    audio.pause();
    audio.currentTime = 0;
    audio = null;
  }
  window.speechSynthesis?.cancel();
}

async function playCurrentAudio() {
  if (!currentItem.value || !currentMode.value.usesTts) {
    return;
  }

  audioError.value = '';
  stopAudio();

  try {
    if (voiceMode.value === 'browser' && 'speechSynthesis' in window) {
      playBrowserSpeech(currentItem.value.english);
      return;
    }

    const result = await api.tts({
      text: currentItem.value.english,
      speed: speed.value
    });
    audio = new Audio(resolveAudioUrl(result.url));
    audio.volume = volume.value;
    audio.preload = 'auto';
    await audio.play();
  } catch (err) {
    audioError.value = err.message;
  }
}

function playBrowserSpeech(text) {
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'en-US';
  utterance.volume = volume.value;
  utterance.rate = Math.min(1.2, Math.max(0.65, speed.value));
  utterance.pitch = 1;

  const voice = getBrowserVoice();
  if (voice) {
    utterance.voice = voice;
  }

  utterance.onerror = (event) => {
    audioError.value = `本地朗读失败：${event.error}`;
  };

  window.speechSynthesis.speak(utterance);
}

function getBrowserVoice() {
  if (selectedBrowserVoice) {
    return selectedBrowserVoice;
  }

  const voices = window.speechSynthesis?.getVoices?.() || [];
  selectedBrowserVoice =
    voices.find((voice) => voice.lang === 'en-US' && /female|zira|aria|jenny|samantha/i.test(voice.name)) ||
    voices.find((voice) => voice.lang === 'en-US') ||
    voices.find((voice) => voice.lang?.startsWith('en')) ||
    null;

  return selectedBrowserVoice;
}

function resolveAudioUrl(url) {
  if (!url) {
    return '';
  }

  if (/^https?:\/\//i.test(url)) {
    return url;
  }

  if (import.meta.env.DEV) {
    return `http://localhost:3000${url}`;
  }

  return url;
}

function revealAnswer() {
  answerVisible.value = true;
  if (isRunning.value && autoNext.value) {
    nextTimer = window.setTimeout(() => {
      goToCard(currentIndex.value + 1);
    }, holdDelaySeconds.value * 1000);
  }
}

function runCurrentCard() {
  clearTimers();
  stopAudio();
  answerVisible.value = false;

  if (currentMode.value.usesTts) {
    speechTimer = window.setTimeout(() => {
      playCurrentAudio();
    }, 100);
  }

  revealTimer = window.setTimeout(revealAnswer, showDelaySeconds.value * 1000);
}

function resetCurrentCard() {
  clearTimers();
  stopAudio();
  answerVisible.value = false;
  if (isRunning.value) {
    runCurrentCard();
  }
}

function goToCard(index) {
  if (items.value.length === 0) {
    return;
  }
  currentIndex.value = (index + items.value.length) % items.value.length;
  resetCurrentCard();
}

function nextCard() {
  goToCard(currentIndex.value + 1);
}

function prevCard() {
  goToCard(currentIndex.value - 1);
}

function showAnswerNow() {
  clearTimers();
  stopAudio();
  revealAnswer();
}

function toggleRunning() {
  isRunning.value = !isRunning.value;
  if (isRunning.value) {
    runCurrentCard();
  } else {
    clearTimers();
    stopAudio();
  }
}

async function loadClassroom() {
  loading.value = true;
  error.value = '';
  clearTimers();
  stopAudio();

  try {
    const [corpusResult, graphResult] = await Promise.all([
      api.classroomCorpus(groupName.value),
      api.classroomGraph(groupName.value)
    ]);
    items.value = corpusResult.items || [];
    graph.value = graphResult.graph;
    graphCached.value = graphResult.cached;
    currentIndex.value = 0;
    answerVisible.value = false;
    if (isRunning.value) {
      runCurrentCard();
    }
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen?.();
  } else {
    document.exitFullscreen?.();
  }
}

function onKeydown(event) {
  if (event.key === 'ArrowLeft') prevCard();
  if (event.key === 'ArrowRight') nextCard();
  if (event.key === ' ') {
    event.preventDefault();
    toggleRunning();
  }
  if (event.key === 'Enter') showAnswerNow();
}

watch(mode, resetCurrentCard);
watch(voiceMode, resetCurrentCard);
watch([showDelaySeconds, holdDelaySeconds, autoNext], () => {
  if (isRunning.value) {
    runCurrentCard();
  }
});
watch(volume, () => {
  if (audio) {
    audio.volume = volume.value;
  }
});
watch(speed, () => {
  if (isRunning.value && currentMode.value.usesTts && !answerVisible.value) {
    playCurrentAudio();
  }
});

onMounted(() => {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => {
      selectedBrowserVoice = null;
      getBrowserVoice();
    };
    getBrowserVoice();
  }
  loadClassroom();
  window.addEventListener('keydown', onKeydown);
});

onBeforeUnmount(() => {
  clearTimers();
  stopAudio();
  window.removeEventListener('keydown', onKeydown);
});
</script>
