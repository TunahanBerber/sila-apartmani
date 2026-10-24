<script setup>
import { computed, reactive, ref, watch } from 'vue';
import { ChevronUp, LoaderCircle, MessageSquareText, Send, ShieldCheck, Trash2 } from 'lucide-vue-next';
import { api } from '../api.js';
import Segmented from '../components/Segmented.vue';
import StatePanel from '../components/StatePanel.vue';
import { SUGGESTION_CATEGORIES, SUGGESTION_STATUS } from '../constants.js';
import { session } from '../stores/session.js';
import { toast } from '../stores/toast.js';
import { timeAgo } from '../utils/format.js';

const sort = ref('popular');
const status = ref('');
const items = ref([]);
const loading = ref(true);
const error = ref('');

async function load() {
  loading.value = true;
  error.value = '';
  try {
    items.value = await api.suggestions.list({ sort: sort.value, status: status.value });
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}
watch([sort, status], load, { immediate: true });

const counts = computed(() => {
  const c = {};
  for (const s of items.value) c[s.status] = (c[s.status] || 0) + 1;
  return c;
});

// --- Oy verme (iyimser güncelleme) ---
const bumped = ref(null);
async function vote(s) {
  const before = { votes: s.votes, voted: s.voted };
  s.voted = !s.voted;
  s.votes += s.voted ? 1 : -1;
  if (s.voted) {
    bumped.value = s.id;
    setTimeout(() => bumped.value === s.id && (bumped.value = null), 500);
  }
  try {
    Object.assign(s, await api.suggestions.vote(s.id));
  } catch (e) {
    Object.assign(s, before);
    toast(e.message, 'error');
  }
}

// --- Yeni öneri ---
const form = reactive({ title: '', description: '', category: 'genel' });
const sending = ref(false);
const formError = ref('');

async function submit() {
  sending.value = true;
  formError.value = '';
  try {
    const created = await api.suggestions.create(form);
    form.title = '';
    form.description = '';
    toast('Öneriniz yönetime iletildi. Teşekkürler!');
    if (!status.value || status.value === 'yeni') {
      if (sort.value === 'new') items.value.unshift(created);
      else await load();
    }
  } catch (e) {
    formError.value = e.message;
  } finally {
    sending.value = false;
  }
}

// --- Yönetici işlemleri ---
async function setStatus(s, newStatus) {
  try {
    Object.assign(s, await api.suggestions.update(s.id, { status: newStatus, admin_note: s.admin_note }));
    toast(`Durum: ${SUGGESTION_STATUS[newStatus].label}`);
  } catch (e) {
    toast(e.message, 'error');
  }
}

const editingNote = ref(null);
const noteDraft = ref('');
function editNote(s) {
  editingNote.value = s.id;
  noteDraft.value = s.admin_note || '';
}
async function saveNote(s) {
  try {
    Object.assign(s, await api.suggestions.update(s.id, { status: s.status, admin_note: noteDraft.value }));
    editingNote.value = null;
    toast('Yönetici notu kaydedildi.');
  } catch (e) {
    toast(e.message, 'error');
  }
}

const confirmId = ref(null);
async function remove(s) {
  if (confirmId.value !== s.id) {
    confirmId.value = s.id;
    setTimeout(() => confirmId.value === s.id && (confirmId.value = null), 3000);
    return;
  }
  try {
    await api.suggestions.remove(s.id);
    items.value = items.value.filter((x) => x.id !== s.id);
    toast('Öneri silindi.');
  } catch (e) {
    toast(e.message, 'error');
  }
}

const statusFilter = [{ value: '', label: 'Tümü' }, ...Object.entries(SUGGESTION_STATUS).map(([value, s]) => ({ value, label: s.label }))];
</script>

<template>
  <div class="page">
    <header class="page-head">
      <div>
        <p class="eyebrow">Birlikte daha iyi bir apartman</p>
        <h1 class="display">Öneriler</h1>
      </div>
      <Segmented
        v-model="sort"
        :options="[
          { value: 'popular', label: 'En çok oy' },
          { value: 'new', label: 'En yeni' },
        ]"
      />
    </header>

    <div class="split">
      <section>
        <div class="chips">
          <button
            v-for="f in statusFilter"
            :key="f.value"
            class="chip glass"
            :class="[{ active: status === f.value }, f.value && `tone-${SUGGESTION_STATUS[f.value].tone}`]"
            type="button"
            @click="status = f.value"
          >
            {{ f.label }}
            <span v-if="!status && f.value && counts[f.value]" class="chip-count">{{ counts[f.value] }}</span>
          </button>
        </div>

        <StatePanel v-if="error" kind="error" :message="error" @retry="load" />
        <div v-else-if="loading && !items.length" class="list">
          <div v-for="n in 4" :key="n" class="glass skeleton-row tall" />
        </div>
        <StatePanel v-else-if="!items.length" title="Henüz öneri yok" message="İlk öneriyi siz yapın." />

        <TransitionGroup v-else tag="ul" name="list" class="list" :class="{ dimmed: loading }">
          <li v-for="s in items" :key="s.id" class="suggestion glass" :class="`st-${s.status}`">
            <button
              class="vote glass"
              :class="{ voted: s.voted, bump: bumped === s.id }"
              type="button"
              :aria-pressed="s.voted"
              :aria-label="s.voted ? 'Oyunu geri al' : 'Destekle'"
              @click="vote(s)"
            >
              <ChevronUp :size="20" :stroke-width="2.6" />
              <strong>{{ s.votes }}</strong>
            </button>

            <div class="suggestion-body">
              <div class="suggestion-meta">
                <span class="tag subtle">
                  <component :is="(SUGGESTION_CATEGORIES[s.category] || SUGGESTION_CATEGORIES.genel).icon" :size="12" />
                  {{ (SUGGESTION_CATEGORIES[s.category] || SUGGESTION_CATEGORIES.genel).label }}
                </span>
                <span class="status" :class="SUGGESTION_STATUS[s.status].tone">{{ SUGGESTION_STATUS[s.status].label }}</span>
              </div>
              <h3>{{ s.title }}</h3>
              <p>{{ s.description }}</p>
              <small class="muted">
                {{ s.author || 'İsimsiz komşu' }}<template v-if="s.apartment_no"> · Daire {{ s.apartment_no }}</template>
                · {{ timeAgo(s.created_at) }}
              </small>

              <div v-if="s.admin_note && editingNote !== s.id" class="admin-note">
                <ShieldCheck :size="14" />
                <span><b>Yönetim:</b> {{ s.admin_note }}</span>
              </div>

              <div v-if="session.isAdmin" class="admin-tools">
                <select :value="s.status" aria-label="Durum" @change="setStatus(s, $event.target.value)">
                  <option v-for="(st, key) in SUGGESTION_STATUS" :key="key" :value="key">{{ st.label }}</option>
                </select>
                <template v-if="editingNote === s.id">
                  <input v-model="noteDraft" maxlength="500" placeholder="Sakinlere görünen not" @keyup.enter="saveNote(s)" />
                  <button class="btn glass sm" type="button" @click="saveNote(s)">Kaydet</button>
                </template>
                <button v-else class="btn glass sm" type="button" @click="editNote(s)">
                  <MessageSquareText :size="14" /> Not
                </button>
                <button class="icon-btn glass danger sm" :class="{ confirming: confirmId === s.id }" type="button" @click="remove(s)">
                  <Trash2 :size="14" /><span v-if="confirmId === s.id">Sil?</span>
                </button>
              </div>
            </div>
          </li>
        </TransitionGroup>
      </section>

      <aside class="compose glass">
        <h3>Bir öneriniz mi var?</h3>
        <p class="muted small">Öneriniz adınız ve daire numaranızla yönetime iletilir, komşularınız oy verebilir.</p>
        <form class="form" @submit.prevent="submit">
          <label class="field">
            <span>Başlık</span>
            <input v-model="form.title" required maxlength="120" placeholder="Kısaca öneriniz" />
          </label>
          <label class="field">
            <span>Açıklama</span>
            <textarea v-model="form.description" required rows="4" maxlength="2000" placeholder="Neden faydalı olur, nasıl yapılabilir?" />
          </label>
          <label class="field">
            <span>Kategori</span>
            <div class="cat-picker">
              <button
                v-for="(c, key) in SUGGESTION_CATEGORIES"
                :key="key"
                type="button"
                class="chip glass"
                :class="{ active: form.category === key }"
                @click="form.category = key"
              >
                <component :is="c.icon" :size="13" /> {{ c.label }}
              </button>
            </div>
          </label>
          <p v-if="formError" class="form-error">{{ formError }}</p>
          <button class="btn btn-primary block" type="submit" :disabled="sending">
            <LoaderCircle v-if="sending" :size="16" class="spin" />
            <Send v-else :size="16" />
            Öneriyi gönder
          </button>
        </form>
      </aside>
    </div>
  </div>
</template>
