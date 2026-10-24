<script setup>
import { computed, onMounted, reactive, ref } from 'vue';
import { Building2, Clock, KeyRound, LoaderCircle, LogOut, Mail, Pencil, RefreshCw, UserRound, XCircle } from 'lucide-vue-next';
import Segmented from './Segmented.vue';
import { api } from '../api.js';
import { refresh, register, saveProfile, session, signIn, signOut } from '../stores/session.js';
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
const editing = ref(false);

onMounted(async () => {
  try {
    units.value = await api.unitCount();
  } catch {}
});

// login | register | profile | pending | rejected
const step = computed(() => {
  if (!session.user) return mode.value;
  if (session.needsProfile || editing.value) return 'profile';
  return session.resident?.status === 'rejected' ? 'rejected' : 'pending';
});

const subtitle = computed(
  () =>
    ({
      profile: 'Son bir adım: daire bilgileriniz',
      pending: 'Kaydınız yönetici onayı bekliyor',
      rejected: 'Kaydınız onaylanmadı',
    })[step.value] || 'Sakinler ve yönetim için panel',
);

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
      editing.value = false;
    }
    form.password = '';
    form.password2 = '';
  } catch (e) {
    error.value = e.message;
  } finally {
    busy.value = false;
  }
}

async function checkStatus() {
  busy.value = true;
  await refresh();
  busy.value = false;
  if (session.canUseApp) toast(`Hoş geldiniz, ${session.resident.full_name}!`);
  else toast('Kaydınız henüz onaylanmadı.', 'info');
}

function editProfile() {
  Object.assign(form, { apartment_no: session.resident.apartment_no, full_name: session.resident.full_name });
  error.value = '';
  editing.value = true;
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
          <p class="muted">{{ subtitle }}</p>
        </div>
      </div>

      <template v-if="step === 'pending' || step === 'rejected'">
        <div class="auth-status" :class="step">
          <span class="auth-status-icon">
            <Clock v-if="step === 'pending'" :size="22" />
            <XCircle v-else :size="22" />
          </span>
          <div>
            <strong>Daire {{ session.resident.apartment_no }} · {{ session.resident.full_name }}</strong>
            <p v-if="step === 'pending'" class="muted small">
              Yönetici kaydınızı onayladığında panelin tamamını görebileceksiniz.
            </p>
            <p v-else class="muted small">
              Bilgilerinizi kontrol edip tekrar gönderebilir ya da yönetimle görüşebilirsiniz.
            </p>
          </div>
        </div>
        <button v-if="step === 'pending'" class="btn btn-primary block" type="button" :disabled="busy" @click="checkStatus">
          <LoaderCircle v-if="busy" :size="16" class="spin" />
          <RefreshCw v-else :size="16" />
          Durumu kontrol et
        </button>
        <button class="btn glass block" type="button" @click="editProfile">
          <Pencil :size="16" /> Bilgilerimi düzenle
        </button>
      </template>

      <template v-else>
        <Segmented v-if="!session.user" :model-value="mode" :options="modes" @update:model-value="switchMode" />

        <form class="form" @submit.prevent="submit">
          <template v-if="step === 'profile'">
            <p class="muted small">
              <strong>{{ session.user?.email }}</strong> ile giriş yaptınız. Kaydınız yönetici onayından sonra açılır;
              önerilerde adınız ve daire numaranız görünür.
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
            {{ step === 'login' ? 'Giriş yap' : step === 'register' ? 'Hesap oluştur' : 'Onaya gönder' }}
          </button>
        </form>
      </template>

      <button v-if="session.user" class="auth-link" type="button" @click="signOut">
        <LogOut :size="14" /> Çıkış yap
      </button>
    </div>
  </div>
</template>
