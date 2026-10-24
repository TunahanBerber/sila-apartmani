<script setup>
import { ref, watch } from 'vue';
import { KeyRound, LoaderCircle } from 'lucide-vue-next';
import Modal from './Modal.vue';
import { api } from '../api.js';
import { admin } from '../stores/admin.js';
import { toast } from '../stores/toast.js';

const props = defineProps({ open: Boolean });
const emit = defineEmits(['update:open']);

const password = ref('');
const error = ref('');
const busy = ref(false);

watch(
  () => props.open,
  (open) => {
    if (open) {
      password.value = '';
      error.value = '';
    }
  },
);

async function submit() {
  if (!password.value) return;
  busy.value = true;
  error.value = '';
  try {
    await api.post('/auth/check', {}, { token: password.value });
    admin.login(password.value);
    toast('Yönetici moduna geçildi.');
    emit('update:open', false);
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <Modal
    :open="open"
    title="Yönetici girişi"
    subtitle="Gider, duyuru ve öneri durumlarını düzenlemek için"
    width="420px"
    @update:open="emit('update:open', $event)"
  >
    <form class="form" @submit.prevent="submit">
      <label class="field">
        <span>Yönetici şifresi</span>
        <div class="input-icon">
          <KeyRound :size="16" />
          <input v-model="password" type="password" autocomplete="current-password" placeholder="••••••••" autofocus />
        </div>
      </label>
      <p v-if="error" class="form-error">{{ error }}</p>
      <button class="btn btn-primary block" type="submit" :disabled="busy || !password">
        <LoaderCircle v-if="busy" :size="16" class="spin" />
        Giriş yap
      </button>
    </form>
  </Modal>
</template>
