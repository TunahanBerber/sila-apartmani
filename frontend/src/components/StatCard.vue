<script setup>
import { TrendingDown, TrendingUp } from 'lucide-vue-next';
import AnimatedNumber from './AnimatedNumber.vue';
import { money } from '../utils/format.js';

defineProps({
  label: String,
  value: Number,
  icon: [Object, Function],
  tone: { type: String, default: 'accent' },
  hint: String,
  delta: { type: Number, default: null },
  format: { type: Function, default: money },
  progress: { type: Number, default: null },
});
</script>

<template>
  <article class="stat glass" :class="`tone-${tone}`">
    <div class="stat-top">
      <span class="chip-icon"><component :is="icon" :size="18" /></span>
      <!-- Giderde artış kötü (kırmızı), azalış iyi (yeşil) -->
      <span v-if="delta !== null && Number.isFinite(delta)" class="delta" :class="delta > 0 ? 'bad' : 'good'">
        <component :is="delta > 0 ? TrendingUp : TrendingDown" :size="13" />
        %{{ Math.abs(delta).toFixed(0) }}
      </span>
    </div>
    <p class="stat-label">{{ label }}</p>
    <p class="stat-value"><AnimatedNumber :value="value" :format="format" /></p>
    <div v-if="progress !== null" class="meter"><span :style="{ width: `${Math.min(100, progress)}%` }" /></div>
    <p v-if="hint" class="stat-hint">{{ hint }}</p>
  </article>
</template>
