<script setup>
import { onBeforeUnmount, ref, watch } from 'vue';
import { money } from '../utils/format.js';

const props = defineProps({
  value: { type: Number, default: 0 },
  format: { type: Function, default: money },
  duration: { type: Number, default: 1000 },
});

const shown = ref(0);
let frame;

watch(
  () => props.value,
  (to) => {
    cancelAnimationFrame(frame);
    const from = shown.value;
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / props.duration);
      shown.value = from + (to - from) * (1 - Math.pow(1 - t, 4));
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
  },
  { immediate: true },
);
onBeforeUnmount(() => cancelAnimationFrame(frame));
</script>

<template>
  <span class="num">{{ format(shown) }}</span>
</template>
