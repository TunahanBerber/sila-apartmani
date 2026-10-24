<script setup>
import { computed } from 'vue';

const props = defineProps({
  value: { type: Number, default: 0 }, // 0-100
  size: { type: Number, default: 168 },
  stroke: { type: Number, default: 14 },
});

const r = computed(() => (props.size - props.stroke) / 2);
const c = computed(() => 2 * Math.PI * r.value);
const offset = computed(() => c.value * (1 - Math.min(100, Math.max(0, props.value)) / 100));
</script>

<template>
  <div class="ring" :style="{ width: `${size}px`, height: `${size}px` }">
    <svg :viewBox="`0 0 ${size} ${size}`" aria-hidden="true">
      <defs>
        <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="var(--accent)" />
          <stop offset="1" stop-color="var(--accent-2)" />
        </linearGradient>
      </defs>
      <circle :cx="size / 2" :cy="size / 2" :r="r" class="ring-track" :stroke-width="stroke" />
      <circle
        :cx="size / 2"
        :cy="size / 2"
        :r="r"
        class="ring-value"
        :stroke-width="stroke"
        :stroke-dasharray="c"
        :stroke-dashoffset="offset"
      />
    </svg>
    <div class="ring-center"><slot /></div>
  </div>
</template>
