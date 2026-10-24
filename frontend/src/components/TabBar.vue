<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { LayoutDashboard, Lightbulb, Megaphone, Receipt, Wallet } from 'lucide-vue-next';

const tabs = [
  { to: '/', label: 'Genel Bakış', icon: LayoutDashboard },
  { to: '/giderler', label: 'Giderler', icon: Receipt },
  { to: '/aidat', label: 'Aidat', icon: Wallet },
  { to: '/oneriler', label: 'Öneriler', icon: Lightbulb },
  { to: '/duyurular', label: 'Duyurular', icon: Megaphone },
];

const route = useRoute();
const index = computed(() => Math.max(0, tabs.findIndex((t) => t.to === route.path)));

// iOS 26 gibi: aşağı kaydırınca sekme çubuğu küçülür, yukarı kaydırınca açılır.
const compact = ref(false);
let lastY = 0;
function onScroll() {
  const y = window.scrollY;
  if (Math.abs(y - lastY) < 8) return;
  compact.value = y > lastY && y > 120;
  lastY = y;
}
onMounted(() => window.addEventListener('scroll', onScroll, { passive: true }));
onBeforeUnmount(() => window.removeEventListener('scroll', onScroll));
</script>

<template>
  <nav class="tabbar glass glass-strong" :class="{ compact }" :style="{ '--n': tabs.length, '--i': index }" aria-label="Ana menü">
    <span class="tab-lens" aria-hidden="true" />
    <RouterLink
      v-for="t in tabs"
      :key="t.to"
      :to="t.to"
      class="tab"
      :class="{ active: route.path === t.to }"
    >
      <component :is="t.icon" :size="20" :stroke-width="route.path === t.to ? 2.4 : 1.9" />
      <span>{{ t.label }}</span>
    </RouterLink>
  </nav>
</template>
