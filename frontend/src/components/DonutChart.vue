<script setup>
import { computed, ref } from 'vue';
import { expenseCategory } from '../constants.js';
import { compact, money } from '../utils/format.js';

const props = defineProps({
  items: { type: Array, default: () => [] }, // [{ category, total }]
});

const R = 52;
const C = 2 * Math.PI * R;
const active = ref(null);

const total = computed(() => props.items.reduce((s, i) => s + i.total, 0));
const segments = computed(() => {
  let offset = 0;
  return props.items.map((item) => {
    const share = total.value ? item.total / total.value : 0;
    const len = share * C;
    const seg = { ...item, ...expenseCategory(item.category), share, dash: `${Math.max(0, len - 2.5)} ${C}`, offset: -offset };
    offset += len;
    return seg;
  });
});
const focus = computed(() => segments.value.find((s) => s.category === active.value));
</script>

<template>
  <div class="donut-wrap">
    <div class="donut">
      <svg viewBox="0 0 140 140" role="img" aria-label="Kategorilere göre gider dağılımı">
        <circle cx="70" cy="70" :r="R" class="donut-track" />
        <circle
          v-for="(s, i) in segments"
          :key="s.category"
          cx="70"
          cy="70"
          :r="R"
          class="donut-seg"
          :class="{ dim: active && active !== s.category }"
          :stroke="s.color"
          :stroke-dasharray="s.dash"
          :stroke-dashoffset="s.offset"
          :style="{ animationDelay: `${i * 70}ms` }"
          @mouseenter="active = s.category"
          @mouseleave="active = null"
        />
      </svg>
      <div class="donut-center">
        <template v-if="focus">
          <small>{{ focus.label }}</small>
          <strong>{{ compact(focus.total) }}</strong>
          <small>%{{ (focus.share * 100).toFixed(1) }}</small>
        </template>
        <template v-else>
          <small>Son 12 ay</small>
          <strong>{{ compact(total) }}</strong>
          <small>{{ items.length }} kategori</small>
        </template>
      </div>
    </div>
    <ul class="legend">
      <li
        v-for="s in segments"
        :key="s.category"
        :class="{ dim: active && active !== s.category }"
        :title="money(s.total)"
        @mouseenter="active = s.category"
        @mouseleave="active = null"
      >
        <span class="dot" :style="{ background: s.color }" />
        <span class="legend-label">{{ s.label }}</span>
        <span class="legend-value">%{{ (s.share * 100).toFixed(0) }}</span>
      </li>
    </ul>
  </div>
</template>
