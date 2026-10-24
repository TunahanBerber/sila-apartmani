<script setup>
import { onMounted, reactive, ref } from 'vue';
import { BellRing, LoaderCircle, Pencil, Pin, Plus, Trash2 } from 'lucide-vue-next';
import { api } from '../api.js';
import Modal from '../components/Modal.vue';
import StatePanel from '../components/StatePanel.vue';
import { session } from '../stores/session.js';
import { toast } from '../stores/toast.js';
import { longDate, timeAgo } from '../utils/format.js';

const items = ref([]);
const loading = ref(true);
const error = ref('');

async function load() {
  loading.value = true;
  error.value = '';
  try {
    items.value = await api.announcements.list();
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}
onMounted(load);

const formOpen = ref(false);
const saving = ref(false);
const formError = ref('');
const form = reactive({});

function openForm(a = null) {
  Object.assign(form, {
    id: a?.id ?? null,
    title: a?.title ?? '',
    body: a?.body ?? '',
    priority: a?.priority ?? 'normal',
    pinned: a?.pinned ?? false,
  });
  formError.value = '';
  formOpen.value = true;
}

async function save() {
  saving.value = true;
  formError.value = '';
  try {
    const { id, ...body } = form;
    if (id) await api.announcements.update(id, body);
    else await api.announcements.create(body);
    toast(id ? 'Duyuru güncellendi.' : 'Duyuru yayınlandı.');
    formOpen.value = false;
    await load();
  } catch (e) {
    formError.value = e.message;
  } finally {
    saving.value = false;
  }
}

const confirmId = ref(null);
async function remove(a) {
  if (confirmId.value !== a.id) {
    confirmId.value = a.id;
    setTimeout(() => confirmId.value === a.id && (confirmId.value = null), 3000);
    return;
  }
  try {
    await api.announcements.remove(a.id);
    items.value = items.value.filter((x) => x.id !== a.id);
    toast('Duyuru silindi.');
  } catch (e) {
    toast(e.message, 'error');
  }
}
</script>

<template>
  <div class="page narrow-page">
    <header class="page-head">
      <div>
        <p class="eyebrow">Yönetimden</p>
        <h1 class="display">Duyurular</h1>
      </div>
      <button v-if="session.isAdmin" class="btn btn-primary" type="button" @click="openForm()">
        <Plus :size="18" /> Yeni duyuru
      </button>
    </header>

    <StatePanel v-if="error" kind="error" :message="error" @retry="load" />
    <div v-else-if="loading && !items.length" class="list">
      <div v-for="n in 3" :key="n" class="glass skeleton-row tall" />
    </div>
    <StatePanel v-else-if="!items.length" title="Henüz duyuru yok" />

    <TransitionGroup v-else tag="ul" name="list" class="timeline">
      <li v-for="a in items" :key="a.id" class="announcement glass" :class="{ important: a.priority === 'onemli', pinned: a.pinned }">
        <div class="announcement-head">
          <span class="chip-icon" :class="a.priority === 'onemli' ? 'tone-danger' : 'tone-accent'">
            <BellRing :size="18" />
          </span>
          <div class="announcement-title">
            <h3>{{ a.title }}</h3>
            <small class="muted" :title="longDate(a.created_at)">{{ timeAgo(a.created_at) }}</small>
          </div>
          <span v-if="a.pinned" class="tag subtle"><Pin :size="12" /> Sabit</span>
          <span v-if="a.priority === 'onemli'" class="tag danger">Önemli</span>
        </div>
        <p class="announcement-body">{{ a.body }}</p>
        <div v-if="session.isAdmin" class="admin-tools">
          <button class="btn glass sm" type="button" @click="openForm(a)"><Pencil :size="14" /> Düzenle</button>
          <button class="icon-btn glass danger sm" :class="{ confirming: confirmId === a.id }" type="button" @click="remove(a)">
            <Trash2 :size="14" /><span v-if="confirmId === a.id">Sil?</span>
          </button>
        </div>
      </li>
    </TransitionGroup>

    <Modal v-model:open="formOpen" :title="form.id ? 'Duyuruyu düzenle' : 'Yeni duyuru'">
      <form class="form" @submit.prevent="save">
        <label class="field">
          <span>Başlık</span>
          <input v-model="form.title" required maxlength="120" />
        </label>
        <label class="field">
          <span>İçerik</span>
          <textarea v-model="form.body" required rows="5" maxlength="3000" />
        </label>
        <div class="form-row">
          <label class="toggle">
            <input v-model="form.pinned" type="checkbox" />
            <span class="switch" />
            Üstte sabitle
          </label>
          <label class="toggle">
            <input v-model="form.priority" type="checkbox" true-value="onemli" false-value="normal" />
            <span class="switch danger" />
            Önemli olarak işaretle
          </label>
        </div>
        <p v-if="formError" class="form-error">{{ formError }}</p>
        <div class="form-actions">
          <button class="btn glass" type="button" @click="formOpen = false">Vazgeç</button>
          <button class="btn btn-primary" type="submit" :disabled="saving">
            <LoaderCircle v-if="saving" :size="16" class="spin" /> Yayınla
          </button>
        </div>
      </form>
    </Modal>
  </div>
</template>
