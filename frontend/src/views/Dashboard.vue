<script setup>
import { computed, onMounted, ref } from 'vue';
import {
  ArrowRight, CalendarClock, CircleCheck, Home, Hourglass, Megaphone, Pin, ThumbsUp, Wallet,
} from 'lucide-vue-next';
import { api } from '../api.js';
import StatCard from '../components/StatCard.vue';
import BarChart from '../components/BarChart.vue';
import DonutChart from '../components/DonutChart.vue';
import ProgressRing from '../components/ProgressRing.vue';
import StatePanel from '../components/StatePanel.vue';
import { SUGGESTION_STATUS, expenseCategory } from '../constants.js';
import { dueLabel, greeting, longDate, money, monthLong, shortDate, timeAgo, toMonthKey, todayIso } from '../utils/format.js';

const data = ref(null);
const error = ref('');

async function load() {
  error.value = '';
  try {
    data.value = await api.get('/stats');
  } catch (e) {
    error.value = e.message;
  }
}
onMounted(load);

const s = computed(() => data.value?.summary);
const remaining = computed(() => (s.value ? s.value.month_total - s.value.month_paid : 0));
const paidRatio = computed(() => (s.value?.month_total ? (s.value.month_paid / s.value.month_total) * 100 : 0));
const delta = computed(() =>
  s.value?.prev_month_total ? ((s.value.month_total - s.value.prev_month_total) / s.value.prev_month_total) * 100 : null,
);
const openSuggestions = computed(() => (data.value?.suggestions.yeni || 0) + (data.value?.suggestions.inceleniyor || 0));
const monthName = monthLong(toMonthKey());
</script>

<template>
  <div class="page">
    <StatePanel v-if="error" kind="error" :message="error" @retry="load" />

    <template v-else>
      <section class="hero glass">
        <div class="hero-text">
          <p class="eyebrow">{{ greeting() }} · {{ longDate(todayIso()) }}</p>
          <h1 class="display">{{ monthName }}<br /><span class="grad">genel bakış</span></h1>
          <p v-if="s" class="hero-sub">
            Bu ay <b>{{ money(s.month_paid) }}</b> ödendi,
            <b>{{ money(remaining) }}</b> ödeme bekliyor.
            <template v-if="s.overdue_count">
              <span class="tag danger">{{ s.overdue_count }} geciken ödeme</span>
            </template>
            <template v-else>
              <span class="tag success">Geciken ödeme yok</span>
            </template>
          </p>
          <p v-else class="hero-sub"><span class="skeleton line w60" /></p>
          <div class="hero-actions">
            <RouterLink to="/giderler" class="btn btn-primary">Giderleri incele <ArrowRight :size="16" /></RouterLink>
            <RouterLink to="/oneriler" class="btn glass">Öneri yap</RouterLink>
          </div>
        </div>
        <ProgressRing :value="paidRatio" class="hero-ring">
          <strong>%{{ paidRatio.toFixed(0) }}</strong>
          <small>ödendi</small>
        </ProgressRing>
      </section>

      <section class="grid-4">
        <template v-if="s">
          <StatCard label="Bu ay toplam gider" :value="s.month_total" :icon="Wallet" tone="accent" :delta="delta" hint="geçen aya göre" />
          <StatCard label="Ödenen" :value="s.month_paid" :icon="CircleCheck" tone="success" :progress="paidRatio" />
          <StatCard
            label="Toplam bekleyen"
            :value="s.pending_total"
            :icon="Hourglass"
            :tone="s.overdue_count ? 'danger' : 'warn'"
            :hint="s.overdue_count ? `${s.overdue_count} gecikmiş · ${money(s.overdue_amount)}` : `${s.pending_count} kalem, gelecek dönemler dahil`"
          />
          <StatCard label="Daire başına bu ay" :value="s.per_unit" :icon="Home" tone="info" :hint="`${data.units} daireye bölündü`" />
        </template>
        <div v-for="n in 4" v-else :key="n" class="glass skeleton-card" />
      </section>

      <section class="grid-main">
        <article class="panel glass span-2">
          <header class="panel-head">
            <div>
              <h3>Aylık giderler</h3>
              <p class="muted small">Son 12 ay, ödenen ve bekleyen tutarlar</p>
            </div>
            <div class="legend-inline">
              <span><i class="dot paid" /> Ödenen</span>
              <span><i class="dot pending" /> Bekleyen</span>
            </div>
          </header>
          <BarChart v-if="data" :items="data.monthly" />
          <div v-else class="skeleton chart" />
        </article>

        <article class="panel glass">
          <header class="panel-head">
            <div>
              <h3>Kategori dağılımı</h3>
              <p class="muted small">Son 12 ayın toplamı</p>
            </div>
          </header>
          <DonutChart v-if="data" :items="data.byCategory" />
          <div v-else class="skeleton chart" />
        </article>
      </section>

      <section class="grid-3">
        <article class="panel glass">
          <header class="panel-head">
            <h3><CalendarClock :size="18" /> Yaklaşan ödemeler</h3>
            <RouterLink to="/giderler" class="link">Tümü</RouterLink>
          </header>
          <ul v-if="data?.upcoming.length" class="rows">
            <li v-for="e in data.upcoming" :key="e.id" class="row">
              <span class="cat-icon" :style="{ '--c': expenseCategory(e.category).color }">
                <component :is="expenseCategory(e.category).icon" :size="16" />
              </span>
              <div class="row-main">
                <strong>{{ e.title }}</strong>
                <small :class="{ 'text-danger': e.overdue }">{{ shortDate(e.due_date) }} · {{ dueLabel(e.due_date) }}</small>
              </div>
              <span class="row-amount">{{ money(e.amount) }}</span>
            </li>
          </ul>
          <StatePanel v-else-if="data" title="Bekleyen ödeme yok" message="Tüm giderler ödenmiş görünüyor." />
          <div v-else class="skeleton list" />
        </article>

        <article class="panel glass">
          <header class="panel-head">
            <h3><ThumbsUp :size="18" /> Öne çıkan öneriler</h3>
            <span v-if="data" class="tag info">{{ openSuggestions }} açık</span>
          </header>
          <ul v-if="data?.topSuggestions.length" class="rows">
            <li v-for="sg in data.topSuggestions" :key="sg.id" class="row">
              <span class="vote-chip">{{ sg.votes }}</span>
              <div class="row-main">
                <strong>{{ sg.title }}</strong>
                <small>{{ SUGGESTION_STATUS[sg.status].label }}</small>
              </div>
            </li>
          </ul>
          <StatePanel v-else-if="data" title="Henüz öneri yok" />
          <div v-else class="skeleton list" />
          <RouterLink to="/oneriler" class="btn glass block mt">Öneri ekle veya oy ver</RouterLink>
        </article>

        <article class="panel glass">
          <header class="panel-head">
            <h3><Megaphone :size="18" /> Duyurular</h3>
            <RouterLink to="/duyurular" class="link">Tümü</RouterLink>
          </header>
          <ul v-if="data?.announcements.length" class="notes">
            <li v-for="a in data.announcements" :key="a.id" :class="{ important: a.priority === 'onemli' }">
              <div class="note-head">
                <strong>{{ a.title }}</strong>
                <Pin v-if="a.pinned" :size="14" class="pin" />
              </div>
              <p>{{ a.body }}</p>
              <small class="muted">{{ timeAgo(a.created_at) }}</small>
            </li>
          </ul>
          <StatePanel v-else-if="data" title="Duyuru yok" />
          <div v-else class="skeleton list" />
        </article>
      </section>
    </template>
  </div>
</template>
