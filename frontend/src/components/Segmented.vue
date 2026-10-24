<script setup>
import { computed } from 'vue';

const props = defineProps({
  modelValue: [String, Number],
  options: { type: Array, required: true }, // [{ value, label }]
});
const emit = defineEmits(['update:modelValue']);

const index = computed(() => Math.max(0, props.options.findIndex((o) => o.value === props.modelValue)));
</script>

<template>
  <div class="segmented glass" role="tablist" :style="{ '--n': options.length, '--i': index }">
    <span class="segmented-thumb" aria-hidden="true" />
    <button
      v-for="o in options"
      :key="o.value"
      type="button"
      role="tab"
      :aria-selected="o.value === modelValue"
      :class="{ active: o.value === modelValue }"
      @click="emit('update:modelValue', o.value)"
    >
      {{ o.label }}
    </button>
  </div>
</template>
