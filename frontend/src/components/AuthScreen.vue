<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { Building2, KeyRound, LoaderCircle, LogOut, Mail, UserRound } from 'lucide-vue-next';
import Segmented from './Segmented.vue';
import { api } from '../api.js';
import { register, saveProfile, session, signIn, signOut } from '../stores/session.js';
import { toast } from '../stores/toast.js';

const mode = ref('login');
const modes = [
  { value: 'login', label: 'Giriş yap' },
  { value: 'register', label: 'Kayıt ol' },
];

const form = reactive({ email: '', password: '', password2: '', apartment_no: '', full_name: '' });
const busy = ref(false);
const error = ref('');
const units = ref(12);

onMounted(async () => {
  try {
    units.value = await api.unitCount();
  } catch {}
});

const step = computed(() => (session.needsProfile ? 'profile' : mode.value));

async function submit() {
  error.value = '';
  if (step.value === 'register' && form.password !== form.password2) {
    error.value = 'Şifreler eşleşmiyor.';
    return;
  }
  busy.value = true;
  try {
    if (step.value === 'login') await signIn(form.email, form.password);
    else if (step.value === 'register') await register(form.email, form.password);
    else {
      await saveProfile({ apartment_no: form.apartment_no, full_name: form.full_name });
      toast(`Hoş geldiniz, ${session.resident.full_name}!`);
    }
    form.password = '';
    form.password2 = '';
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}

function switchMode(m) {
  mode.value = m;
  error.value = '';
}
</script>

<template>
  <div class="auth-screen">
    <div class="auth-card glass">
      <div class="auth-brand">
        <span class="brand-mark glass">
          <svg viewBox="0 0 64 64" aria-hidden="true">
            <path d="M18 50V24l14-10 14 10v26" />
            <path d="M27 50V38h10v12" />
          </svg>
        </span>
        <div>
          <h1>Sıla Apartmanı</h1>
          <p class="muted">
            {{ step === 'profile' ? 'Son bir adım: daire bilgileriniz' : 'Sakinler ve yönetim için panel' }}
          </p>
        </div>
      </div>

      <Segmented v-if="step !== 'profile'" :model-value="mode" :options="modes" @update:model-value="switchMode" />

      <form class="form" @submit.prevent="submit">
        <template v-if="step === 'profile'">
          <p class="muted small">
            <strong>{{ session.user?.email }}</strong> ile giriş yaptınız. Önerilerde adınız ve daire numaranız görünür.
          </p>
          <label class="field">
            <span>Daire</span>
            <select v-model="form.apartment_no" required>
              <option value="" disabled>Daire seçin</option>
              <option v-for="n in units" :key="n" :value="n">Daire {{ n }}</option>
            </select>
          </label>
          <label class="field">
            <span>Ad soyad</span>
            <div class="input-icon">
              <UserRound :size="16" />
              <input v-model="form.full_name" required minlength="2" maxlength="60" autocomplete="name" placeholder="Adınız Soyadınız" />
            </div>
          </label>
        </template>

        <template v-else>
          <label class="field">
            <span>E-posta</span>
            <div class="input-icon">
              <Mail :size="16" />
              <input v-model="form.email" type="email" required autocomplete="email" placeholder="ornek@mail.com" />
            </div>
          </label>
          <label class="field">
            <span>Şifre</span>
            <div class="input-icon">
              <KeyRound :size="16" />
              <input
                v-model="form.password"
                type="password"
                required
                minlength="6"
                :autocomplete="step === 'login' ? 'current-password' : 'new-password'"
                placeholder="••••••••"
              />
            </div>
          </label>
          <label v-if="step === 'register'" class="field">
            <span>Şifre (tekrar)</span>
            <div class="input-icon">
              <KeyRound :size="16" />
              <input v-model="form.password2" type="password" required minlength="6" autocomplete="new-password" placeholder="••••••••" />
            </div>
          </label>
        </template>

        <p v-if="error" class="form-error">{{ error }}</p>
        <button class="btn btn-primary block" type="submit" :disabled="busy">
          <LoaderCircle v-if="busy" :size="16" class="spin" />
          <Building2 v-else-if="step === 'profile'" :size="16" />
          {{ step === 'login' ? 'Giriş yap' : step === 'register' ? 'Hesap oluştur' : 'Kaydet ve devam et' }}
        </button>
      </form>

      <button v-if="step === 'profile'" class="auth-link" type="button" @click="signOut">
        <LogOut :size="14" /> Farklı hesapla gir
      </button>
    </div>
  </div>
</template>
