<template>
  <label class="field">
    <span>{{ label }}</span>
    <select :value="modelValue" @change="$emit('update:modelValue', Number($event.target.value))">
      <option v-for="unit in units" :key="unit.id" :value="unit.id">{{ unit.name }}</option>
    </select>
  </label>
</template>

<script setup>
defineProps({
  label: {
    type: String,
    default: '选择单元'
  },
  modelValue: {
    type: Number,
    default: 0
  },
  units: {
    type: Array,
    default: () => []
  }
});

defineEmits(['update:modelValue']);
</script>

