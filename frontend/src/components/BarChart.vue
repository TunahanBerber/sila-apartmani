<script setup>
import { computed } from 'vue';
import { compact, money, monthLong, monthShort, toMonthKey } from '../utils/format.js';

const props = defineProps({
  items: { type: Array, default: () => [] }, // [{ month: 'YYYY-MM', total, paid }]
});

const current = toMonthKey();

const scale = computed(() => {
  const max = Math.max(1, ...props.items.map((i) => i.total));
  const pow = 10 ** Math.floor(Math.log10(max));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => max / s <= 4) || pow * 10;
  const top = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = 0; v <= top + 1e-6; v += step) ticks.push(v);
  return { top, ticks };
});

const average = computed(() =>
  props.items.length ? props.items.reduce((s, i) => s + i.total, 0) / props.items.length : 0,
);
</script>

<template>
  <div class="bars">
    <div class="bars-grid" aria-hidden="true">
      <div v-for="t in scale.ticks" :key="t" class="bars-tick" :style="{ bottom: `${(t / scale.top) * 100}%` }">
        <span>{{ compact(t) }}</span>
      </div>
      <div v-if="average" class="bars-avg" :style="{ bottom: `${(average / scale.top) * 100}%` }">
        <span>ort. {{ compact(average) }}</span>
      </div>
    </div>
    <div class="bars-cols">
      <div
        v-for="(item, i) in items"
        :key="item.month"
        class="bar-col"
        :class="{ current: item.month === current }"
        tabindex="0"
        :aria-label="`${monthLong(item.month)}: ${money(item.total)}`"
      >
        <div class="bar" :style="{ height: `${(item.total / scale.top) * 100}%`, animationDelay: `${i * 45}ms` }">
          <span class="bar-paid" :style="{ height: item.total ? `${(item.paid / item.total) * 100}%` : '0' }" />
        </div>
        <span class="bar-label">{{ monthShort(item.month) }}</span>
        <div class="bar-tip glass glass-strong">
          <strong>{{ monthLong(item.month) }}</strong>
          <span>Toplam <b>{{ money(item.total) }}</b></span>
          <span>Ödenen <b>{{ money(item.paid) }}</b></span>
          <span v-if="item.total - item.paid > 0">Bekleyen <b>{{ money(item.total - item.paid) }}</b></span>
        </div>
      </div>
    </div>
  </div>
</template>
