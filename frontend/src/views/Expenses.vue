<script setup>
import { computed, reactive, ref, watch } from 'vue';
import {
  Check, ChevronLeft, ChevronRight, LoaderCircle, Pencil, Plus, Repeat, Search, Trash2, Undo2,
} from 'lucide-vue-next';
import { api } from '../api.js';
import Modal from '../components/Modal.vue';
import Segmented from '../components/Segmented.vue';
import StatePanel from '../components/StatePanel.vue';
import AnimatedNumber from '../components/AnimatedNumber.vue';
import { EXPENSE_CATEGORIES, RECURRING, expenseCategory } from '../constants.js';
import { session } from '../stores/session.js';
import { toast } from '../stores/toast.js';
import { dueLabel, money, monthLong, shiftMonth, shortDate, toMonthKey, todayIso } from '../utils/format.js';

const month = ref(toMonthKey());
const category = ref('');
const status = ref('');
const search = ref('');

const items = ref([]);
const loading = ref(true);
const error = ref('');

async function load() {
  loading.value = true;
  error.value = '';
  try {
    items.value = await api.expenses.list({ month: month.value, category: category.value, status: status.value });
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}
watch([month, category, status], load, { immediate: true });

const visible = computed(() => {
  const q = search.value.trim().toLocaleLowerCase('tr');
  const list = q
    ? items.value.filter((e) => `${e.title} ${e.vendor || ''} ${e.notes || ''}`.toLocaleLowerCase('tr').includes(q))
    : items.value;
  // Ay görünümünde takvim sırası, tüm kayıtlarda en yeni üstte
  return month.value ? [...list].sort((a, b) => a.due_date.localeCompare(b.due_date) || a.id - b.id) : list;
});

const totals = computed(() => {
  const t = { all: 0, paid: 0, pending: 0, overdue: 0, overdueCount: 0 };
  for (const e of visible.value) {
    t.all += e.amount;
    if (e.status === 'odendi') t.paid += e.amount;
    else t.pending += e.amount;
    if (e.overdue) {
      t.overdue += e.amount;
      t.overdueCount++;
    }
  }
  return t;
});
const paidPct = computed(() => (totals.value.all ? (totals.value.paid / totals.value.all) * 100 : 0));

const statusOptions = [
  { value: '', label: 'Tümü' },
  { value: 'bekliyor', label: 'Bekleyen' },
  { value: 'gecikti', label: 'Geciken' },
  { value: 'odendi', label: 'Ödenen' },
];

// --- Ödeme durumu ---
const busyId = ref(null);
async function togglePaid(e) {
  busyId.value = e.id;
  try {
    const { expense, next } = await api.expenses.togglePaid(e.id);
    toast(expense.status === 'odendi' ? `"${expense.title}" ödendi olarak işaretlendi.` : 'Ödeme geri alındı.');
    if (next) toast(`Sonraki dönem kaydı açıldı: ${shortDate(next.due_date)}`, 'info');
    await load();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    busyId.value = null;
  }
}

// --- Silme (iki adımlı onay) ---
const confirmId = ref(null);
let confirmTimer;
async function remove(e) {
  if (confirmId.value !== e.id) {
    confirmId.value = e.id;
    clearTimeout(confirmTimer);
    confirmTimer = setTimeout(() => (confirmId.value = null), 3000);
    return;
  }
  confirmId.value = null;
  try {
    await api.expenses.remove(e.id);
    items.value = items.value.filter((x) => x.id !== e.id);
    toast('Gider silindi.');
  } catch (err) {
    toast(err.message, 'error');
  }
}

// --- Ekle / düzenle ---
const formOpen = ref(false);
const saving = ref(false);
const formError = ref('');
const form = reactive({});

function openForm(e = null) {
  const defaultDay = month.value && month.value !== toMonthKey() ? `${month.value}-01` : todayIso();
  Object.assign(form, {
    id: e?.id ?? null,
    title: e?.title ?? '',
    category: e?.category ?? 'bakim',
    amount: e?.amount ?? '',
    due_date: e?.due_date ?? defaultDay,
    status: e?.status ?? 'bekliyor',
    vendor: e?.vendor ?? '',
    recurring: e?.recurring ?? 'none',
    notes: e?.notes ?? '',
  });
  formError.value = '';
  formOpen.value = true;
}

async function save() {
  saving.value = true;
  formError.value = '';
  try {
    const { id, ...body } = form;
    if (id) await api.expenses.update(id, body);
    else await api.expenses.create(body);
    toast(id ? 'Gider güncellendi.' : 'Gider eklendi.');
    formOpen.value = false;
    await load();
  } catch (err) {
    formError.value = err.message;
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="page">
    <header class="page-head">
      <div>
        <p class="eyebrow">Gider takibi</p>
        <h1 class="display">Giderler</h1>
      </div>
      <button v-if="session.isAdmin" class="btn btn-primary" type="button" @click="openForm()">
        <Plus :size="18" /> Yeni gider
      </button>
    </header>

    <section class="toolbar">
      <div class="month-switch glass">
        <button class="icon-btn" type="button" aria-label="Önceki ay" :disabled="!month" @click="month = shiftMonth(month, -1)">
          <ChevronLeft :size="18" />
        </button>
        <button class="month-label" type="button" title="Bu aya dön" @click="month = toMonthKey()">
          {{ month ? monthLong(month) : 'Tüm kayıtlar' }}
        </button>
        <button class="icon-btn" type="button" aria-label="Sonraki ay" :disabled="!month" @click="month = shiftMonth(month, 1)">
          <ChevronRight :size="18" />
        </button>
        <button class="all-btn" :class="{ active: !month }" type="button" @click="month = month ? '' : toMonthKey()">
          {{ month ? 'Tümü' : 'Aylık' }}
        </button>
      </div>
      <Segmented v-model="status" :options="statusOptions" />
      <label class="search glass">
        <Search :size="16" />
        <input v-model="search" type="search" placeholder="Gider, firma ara…" />
      </label>
    </section>

    <section class="summary glass">
      <div class="summary-item">
        <small>Toplam</small>
        <strong><AnimatedNumber :value="totals.all" /></strong>
      </div>
      <div class="summary-item success">
        <small>Ödenen</small>
        <strong><AnimatedNumber :value="totals.paid" /></strong>
      </div>
      <div class="summary-item warn">
        <small>Bekleyen</small>
        <strong><AnimatedNumber :value="totals.pending" /></strong>
      </div>
      <div class="summary-item danger">
        <small>Geciken ({{ totals.overdueCount }})</small>
        <strong><AnimatedNumber :value="totals.overdue" /></strong>
      </div>
      <div class="summary-progress">
        <div class="meter big"><span :style="{ width: `${paidPct}%` }" /></div>
        <small class="muted">%{{ paidPct.toFixed(0) }} ödendi</small>
      </div>
    </section>

    <div class="chips" role="group" aria-label="Kategori filtresi">
      <button class="chip glass" :class="{ active: !category }" type="button" @click="category = ''">Tüm kategoriler</button>
      <button
        v-for="(c, key) in EXPENSE_CATEGORIES"
        :key="key"
        class="chip glass"
        :class="{ active: category === key }"
        :style="{ '--c': c.color }"
        type="button"
        @click="category = category === key ? '' : key"
      >
        <component :is="c.icon" :size="14" /> {{ c.label }}
      </button>
    </div>

    <StatePanel v-if="error" kind="error" :message="error" @retry="load" />
    <div v-else-if="loading && !items.length" class="list">
      <div v-for="n in 5" :key="n" class="glass skeleton-row" />
    </div>
    <StatePanel
      v-else-if="!visible.length"
      title="Bu filtrelerle gider bulunamadı"
      :message="session.isAdmin ? 'Yeni bir gider ekleyebilir ya da filtreleri değiştirebilirsiniz.' : 'Filtreleri değiştirmeyi deneyin.'"
    />
    <TransitionGroup v-else tag="ul" name="list" class="list" :class="{ dimmed: loading }">
      <li
        v-for="e in visible"
        :key="e.id"
        class="expense glass"
        :class="{ paid: e.status === 'odendi', overdue: e.overdue }"
        :style="{ '--c': expenseCategory(e.category).color }"
      >
        <span class="cat-icon lg"><component :is="expenseCategory(e.category).icon" :size="20" /></span>

        <div class="expense-main">
          <div class="expense-title">
            <strong>{{ e.title }}</strong>
            <span v-if="e.recurring !== 'none'" class="tag subtle" :title="RECURRING[e.recurring]">
              <Repeat :size="12" /> {{ RECURRING[e.recurring] }}
            </span>
          </div>
          <small class="muted">
            {{ expenseCategory(e.category).label }}<template v-if="e.vendor"> · {{ e.vendor }}</template>
            <template v-if="e.notes"> · {{ e.notes }}</template>
          </small>
        </div>

        <div class="expense-date">
          <strong>{{ shortDate(e.due_date) }}</strong>
          <small v-if="e.status === 'odendi'" class="text-success">{{ e.paid_at ? `${shortDate(e.paid_at)} ödendi` : 'Ödendi' }}</small>
          <small v-else :class="e.overdue ? 'text-danger' : 'muted'">{{ dueLabel(e.due_date) }}</small>
        </div>

        <div class="expense-amount">
          <strong>{{ money(e.amount) }}</strong>
          <span class="status" :class="e.status === 'odendi' ? 'success' : e.overdue ? 'danger' : 'warn'">
            {{ e.status === 'odendi' ? 'Ödendi' : e.overdue ? 'Gecikti' : 'Bekliyor' }}
          </span>
        </div>

        <div v-if="session.isAdmin" class="expense-actions">
          <button
            class="icon-btn glass"
            :class="e.status === 'odendi' ? '' : 'pay'"
            type="button"
            :title="e.status === 'odendi' ? 'Ödemeyi geri al' : 'Ödendi olarak işaretle'"
            :disabled="busyId === e.id"
            @click="togglePaid(e)"
          >
            <LoaderCircle v-if="busyId === e.id" :size="16" class="spin" />
            <Undo2 v-else-if="e.status === 'odendi'" :size="16" />
            <Check v-else :size="16" />
          </button>
          <button class="icon-btn glass" type="button" title="Düzenle" @click="openForm(e)"><Pencil :size="16" /></button>
          <button
            class="icon-btn glass danger"
            :class="{ confirming: confirmId === e.id }"
            type="button"
            :title="confirmId === e.id ? 'Silmek için tekrar tıklayın' : 'Sil'"
            @click="remove(e)"
          >
            <Trash2 :size="16" /><span v-if="confirmId === e.id">Sil?</span>
          </button>
        </div>
      </li>
    </TransitionGroup>

    <Modal v-model:open="formOpen" :title="form.id ? 'Gideri düzenle' : 'Yeni gider'" subtitle="Tutar ve son ödeme tarihi zorunludur">
      <form class="form" @submit.prevent="save">
        <label class="field">
          <span>Başlık</span>
          <input v-model="form.title" required maxlength="120" placeholder="Örn. Asansör periyodik bakımı" />
        </label>
        <div class="form-row">
          <label class="field">
            <span>Kategori</span>
            <select v-model="form.category">
              <option v-for="(c, key) in EXPENSE_CATEGORIES" :key="key" :value="key">{{ c.label }}</option>
            </select>
          </label>
          <label class="field">
            <span>Tutar (₺)</span>
            <input v-model.number="form.amount" type="number" min="0" step="0.01" required inputmode="decimal" placeholder="0" />
          </label>
        </div>
        <div class="form-row">
          <label class="field">
            <span>Son ödeme tarihi</span>
            <input v-model="form.due_date" type="date" required />
          </label>
          <label class="field">
            <span>Tekrar</span>
            <select v-model="form.recurring">
              <option v-for="(label, key) in RECURRING" :key="key" :value="key">{{ label }}</option>
            </select>
          </label>
        </div>
        <div class="form-row">
          <label class="field">
            <span>Firma / kurum</span>
            <input v-model="form.vendor" maxlength="120" placeholder="İsteğe bağlı" />
          </label>
          <label class="field">
            <span>Durum</span>
            <select v-model="form.status">
              <option value="bekliyor">Bekliyor</option>
              <option value="odendi">Ödendi</option>
            </select>
          </label>
        </div>
        <label class="field">
          <span>Not</span>
          <textarea v-model="form.notes" rows="2" maxlength="1000" placeholder="İsteğe bağlı" />
        </label>
        <p v-if="form.recurring !== 'none'" class="hint">
          <Repeat :size="14" /> Ödendi olarak işaretlendiğinde bir sonraki dönemin kaydı otomatik oluşturulur.
        </p>
        <p v-if="formError" class="form-error">{{ formError }}</p>
        <div class="form-actions">
          <button class="btn glass" type="button" @click="formOpen = false">Vazgeç</button>
          <button class="btn btn-primary" type="submit" :disabled="saving">
            <LoaderCircle v-if="saving" :size="16" class="spin" /> Kaydet
          </button>
        </div>
      </form>
    </Modal>
  </div>
</template>
