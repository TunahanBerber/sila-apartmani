<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { Check, ChevronLeft, ChevronRight, LoaderCircle, Pencil, ShieldCheck, UserCheck, UserX, Users } from 'lucide-vue-next';
import { api } from '../api.js';
import AnimatedNumber from '../components/AnimatedNumber.vue';
import StatePanel from '../components/StatePanel.vue';
import { session } from '../stores/session.js';
import { toast } from '../stores/toast.js';
import { money, monthShort, timeAgo, toMonthKey } from '../utils/format.js';

const thisMonth = toMonthKey();
const year = ref(new Date().getFullYear());
const months = computed(() => Array.from({ length: 12 }, (_, i) => `${year.value}-${String(i + 1).padStart(2, '0')}`));

const units = ref(12);
const duesAmount = ref(0);
const paid = ref(new Map()); // 'daire-YYYY-MM' → ödeme
const loading = ref(true);
const error = ref('');

const key = (apt, month) => `${apt}-${month}`;

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const [settings, rows] = await Promise.all([api.dues.settings(), api.dues.list(year.value)]);
    units.value = settings.unit_count;
    duesAmount.value = settings.dues_amount;
    paid.value = new Map(rows.map((p) => [key(p.apartment_no, p.month.slice(0, 7)), p]));
    scrollToCurrentMonth();
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}
watch(year, load, { immediate: true });

// Dar ekranda tablo bu ayın sütunu görünecek şekilde açılır.
const scroller = ref(null);
async function scrollToCurrentMonth() {
  await nextTick();
  const el = scroller.value;
  const th = el?.querySelector('thead th.current');
  if (el && th && el.scrollWidth > el.clientWidth) el.scrollLeft = th.offsetLeft - el.clientWidth / 2;
}

const apartments = computed(() => Array.from({ length: units.value }, (_, i) => i + 1));

// Ödenmemiş geçmiş aylar gecikmiş sayılır; gelecek aylar sadece bekliyor.
function cellState(apt, month) {
  if (paid.value.has(key(apt, month))) return 'paid';
  return month < thisMonth ? 'late' : month === thisMonth ? 'due' : 'future';
}

const totals = computed(() => {
  let collected = 0;
  let expected = 0;
  let late = 0;
  for (const apt of apartments.value) {
    for (const m of months.value) {
      const p = paid.value.get(key(apt, m));
      if (p) {
        collected += p.amount;
        expected += p.amount;
      } else {
        expected += duesAmount.value;
        if (m < thisMonth) late += duesAmount.value;
      }
    }
  }
  return { collected, expected, late, pending: expected - collected };
});
const paidPct = computed(() => {
  const all = units.value * 12;
  return all ? (paid.value.size / all) * 100 : 0;
});
const monthPaidCount = (m) => apartments.value.filter((a) => paid.value.has(key(a, m))).length;
const rowPaidCount = (apt) => months.value.filter((m) => paid.value.has(key(apt, m))).length;

const busyCell = ref('');
async function toggle(apt, month) {
  if (!session.isAdmin || busyCell.value) return;
  const k = key(apt, month);
  busyCell.value = k;
  try {
    const r = await api.dues.toggle(apt, `${month}-01`);
    const next = new Map(paid.value);
    if (r.paid) next.set(k, r.payment);
    else next.delete(k);
    paid.value = next;
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    busyCell.value = '';
  }
}

// --- Aidat tutarı ---
const editingAmount = ref(false);
const amountDraft = ref('');
const savingAmount = ref(false);
function editAmount() {
  amountDraft.value = duesAmount.value || '';
  editingAmount.value = true;
}
async function saveAmount() {
  savingAmount.value = true;
  try {
    const r = await api.dues.setAmount(amountDraft.value);
    duesAmount.value = r.dues_amount;
    editingAmount.value = false;
    toast('Aidat tutarı güncellendi. Yeni ödemeler bu tutarla kaydedilir.');
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    savingAmount.value = false;
  }
}

// --- Sakinler (yönetici) ---
const residents = ref([]);
const residentsError = ref('');
async function loadResidents() {
  if (!session.isAdmin) return;
  residentsError.value = '';
  try {
    residents.value = await api.residents.list();
  } catch (e) {
    residentsError.value = e.message;
  }
}
onMounted(loadResidents);

const pending = computed(() => residents.value.filter((r) => r.status === 'pending'));
const reviewed = computed(() => residents.value.filter((r) => r.status !== 'pending'));
const namesByApt = computed(() => {
  const m = new Map();
  for (const r of residents.value) {
    if (r.status !== 'approved') continue;
    m.set(r.apartment_no, [...(m.get(r.apartment_no) || []), r.full_name.split(' ')[0]]);
  }
  return m;
});

const reviewing = ref('');
async function review(r, status) {
  reviewing.value = r.user_id;
  try {
    await api.residents.review(r.user_id, status);
    r.status = status;
    toast(
      status === 'approved'
        ? `${r.full_name} onaylandı.`
        : status === 'rejected'
          ? `${r.full_name} reddedildi.`
          : `${r.full_name} tekrar onaya alındı.`,
    );
  } catch (e) {
    toast(e.message, 'error');
  } finally {
    reviewing.value = '';
  }
}

const STATUS = {
  approved: { label: 'Onaylı', tone: 'success' },
  rejected: { label: 'Reddedildi', tone: 'danger' },
  pending: { label: 'Bekliyor', tone: 'warn' },
};
</script>

<template>
  <div class="page">
    <header class="page-head">
      <div>
        <p class="eyebrow">Aidat takibi</p>
        <h1 class="display">Aidat</h1>
      </div>
      <div class="month-switch glass">
        <button class="icon-btn" type="button" aria-label="Önceki yıl" @click="year--"><ChevronLeft :size="18" /></button>
        <button class="month-label" type="button" title="Bu yıla dön" @click="year = new Date().getFullYear()">{{ year }}</button>
        <button class="icon-btn" type="button" aria-label="Sonraki yıl" @click="year++"><ChevronRight :size="18" /></button>
      </div>
    </header>

    <section v-if="session.isAdmin && pending.length" class="panel glass approvals">
      <header class="panel-head">
        <h3><UserCheck :size="18" /> Onay bekleyen kayıtlar</h3>
        <span class="tag warn">{{ pending.length }}</span>
      </header>
      <ul class="rows">
        <li v-for="r in pending" :key="r.user_id" class="row resident-row">
          <span class="apt-badge">{{ r.apartment_no }}</span>
          <div class="row-main">
            <strong>{{ r.full_name }}</strong>
            <small class="muted">{{ r.email }} · {{ timeAgo(r.created_at) }}</small>
          </div>
          <div class="row-actions">
            <button class="btn btn-primary sm" type="button" :disabled="reviewing === r.user_id" @click="review(r, 'approved')">
              <Check :size="15" /> Onayla
            </button>
            <button class="icon-btn danger" type="button" title="Reddet" :disabled="reviewing === r.user_id" @click="review(r, 'rejected')">
              <UserX :size="16" />
            </button>
          </div>
        </li>
      </ul>
    </section>

    <section class="summary glass">
      <div class="summary-item">
        <small>{{ year }} beklenen</small>
        <strong><AnimatedNumber :value="totals.expected" /></strong>
      </div>
      <div class="summary-item success">
        <small>Tahsil edilen</small>
        <strong><AnimatedNumber :value="totals.collected" /></strong>
      </div>
      <div class="summary-item danger">
        <small>Geciken</small>
        <strong><AnimatedNumber :value="totals.late" /></strong>
      </div>
      <div class="summary-item">
        <small>Aylık aidat</small>
        <strong v-if="!editingAmount" class="amount-line">
          {{ money(duesAmount) }}
          <button v-if="session.isAdmin" class="icon-btn sm" type="button" title="Tutarı değiştir" @click="editAmount">
            <Pencil :size="14" />
          </button>
        </strong>
        <form v-else class="amount-form" @submit.prevent="saveAmount">
          <input v-model="amountDraft" type="number" min="0" step="10" inputmode="decimal" autofocus />
          <button class="btn btn-primary sm" type="submit" :disabled="savingAmount">
            <LoaderCircle v-if="savingAmount" :size="14" class="spin" /> Kaydet
          </button>
        </form>
      </div>
      <div class="summary-progress">
        <div class="meter big"><span :style="{ width: `${paidPct}%` }" /></div>
        <small class="muted">%{{ paidPct.toFixed(0) }} ödendi · {{ paid.size }}/{{ units * 12 }}</small>
      </div>
    </section>

    <StatePanel v-if="error" kind="error" :message="error" @retry="load" />
    <section v-else class="panel glass dues-panel" :class="{ loading }">
      <header class="panel-head">
        <div>
          <h3>Daire × ay tablosu</h3>
          <p class="muted small">
            {{ session.isAdmin ? 'Hücreye dokunarak ödendi / ödenmedi olarak işaretleyin.' : 'Ödemeler yönetim tarafından işlenir.' }}
          </p>
        </div>
        <div class="legend-inline">
          <span><i class="dues-dot paid" /> Ödendi</span>
          <span><i class="dues-dot late" /> Gecikti</span>
          <span><i class="dues-dot due" /> Bu ay</span>
          <span><i class="dues-dot future" /> Bekliyor</span>
        </div>
      </header>

      <div ref="scroller" class="dues-scroll">
        <table class="dues-table">
          <thead>
            <tr>
              <th class="sticky">Daire</th>
              <th v-for="m in months" :key="m" :class="{ current: m === thisMonth }">{{ monthShort(m) }}</th>
              <th class="total-col">Ödenen</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="apt in apartments" :key="apt" :class="{ mine: session.resident?.apartment_no === apt }">
              <th class="sticky">
                <span class="apt-badge">{{ apt }}</span>
                <small v-if="session.isAdmin && namesByApt.get(apt)" class="muted apt-names">{{ namesByApt.get(apt).join(', ') }}</small>
                <small v-else-if="session.resident?.apartment_no === apt" class="muted apt-names">Siz</small>
              </th>
              <td v-for="m in months" :key="m" :class="{ current: m === thisMonth }">
                <button
                  class="dues-cell"
                  :class="cellState(apt, m)"
                  type="button"
                  :disabled="!session.isAdmin || busyCell === key(apt, m)"
                  :title="`Daire ${apt} · ${monthShort(m)} ${year}: ${cellState(apt, m) === 'paid' ? 'ödendi' : 'ödenmedi'}`"
                  @click="toggle(apt, m)"
                >
                  <LoaderCircle v-if="busyCell === key(apt, m)" :size="14" class="spin" />
                  <Check v-else-if="cellState(apt, m) === 'paid'" :size="15" :stroke-width="3" />
                </button>
              </td>
              <td class="total-col">{{ rowPaidCount(apt) }}/12</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <th class="sticky">Ödeyen</th>
              <td v-for="m in months" :key="m" :class="{ current: m === thisMonth }">{{ monthPaidCount(m) }}/{{ units }}</td>
              <td class="total-col" />
            </tr>
          </tfoot>
        </table>
      </div>
    </section>

    <section v-if="session.isAdmin" class="panel glass">
      <header class="panel-head">
        <h3><Users :size="18" /> Sakinler</h3>
        <span class="muted small">{{ reviewed.length }} kayıt</span>
      </header>
      <StatePanel v-if="residentsError" kind="error" :message="residentsError" @retry="loadResidents" />
      <p v-else-if="!residents.length" class="muted small">Henüz kayıt olan sakin yok. Sakinler uygulamadan kayıt olduğunda burada onayınıza düşer.</p>
      <ul v-else-if="reviewed.length" class="rows">
        <li v-for="r in reviewed" :key="r.user_id" class="row resident-row">
          <span class="apt-badge">{{ r.apartment_no }}</span>
          <div class="row-main">
            <strong>{{ r.full_name }}</strong>
            <small class="muted">{{ r.email }}</small>
          </div>
          <div class="row-actions">
            <span class="tag" :class="STATUS[r.status].tone">{{ STATUS[r.status].label }}</span>
            <button
              v-if="r.status === 'approved'"
              class="icon-btn danger"
              type="button"
              title="Erişimi kaldır"
              :disabled="reviewing === r.user_id"
              @click="review(r, 'rejected')"
            >
              <UserX :size="16" />
            </button>
            <button v-else class="icon-btn pay" type="button" title="Onayla" :disabled="reviewing === r.user_id" @click="review(r, 'approved')">
              <ShieldCheck :size="16" />
            </button>
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>
