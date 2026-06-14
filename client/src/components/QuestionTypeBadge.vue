<template>
  <span class="type-badge">{{ label }}</span>
</template>

<script setup>
const labels = {
  collocation: '固定搭配',
  translation: '中英互译',
  synonym: '同义词',
  analogy: '类似结构',
  morphology: '词形变化',
  phrase: '短语'
};

const props = defineProps({
  type: {
    type: String,
    required: true
  }
});

const label = labels[props.type] || props.type;
</script>

