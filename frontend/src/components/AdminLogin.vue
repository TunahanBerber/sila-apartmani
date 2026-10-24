<script setup>
import { ref, watch } from 'vue';
import { KeyRound, LoaderCircle, Mail } from 'lucide-vue-next';
import Modal from './Modal.vue';
import { admin } from '../stores/admin.js';
import { toast } from '../stores/toast.js';

const props = defineProps({ open: Boolean });
const emit = defineEmits(['update:open']);

const email = ref('');
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
  if (!email.value || !password.value) return;
  busy.value = true;
  error.value = '';
  try {
    await admin.login(email.value.trim(), password.value);
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
        <span>E-posta</span>
        <div class="input-icon">
          <Mail :size="16" />
          <input v-model="email" type="email" autocomplete="username" placeholder="yonetici@ornek.com" autofocus />
        </div>
      </label>
      <label class="field">
        <span>Şifre</span>
        <div class="input-icon">
          <KeyRound :size="16" />
          <input v-model="password" type="password" autocomplete="current-password" placeholder="••••••••" />
        </div>
      </label>
      <p v-if="error" class="form-error">{{ error }}</p>
      <button class="btn btn-primary block" type="submit" :disabled="busy || !email || !password">
        <LoaderCircle v-if="busy" :size="16" class="spin" />
        Giriş yap
      </button>
    </form>
  </Modal>
</template>
