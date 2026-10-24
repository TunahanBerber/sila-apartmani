<script setup>
import { ref } from 'vue';
import { LogOut, Moon, ShieldCheck, Sun, UserRound } from 'lucide-vue-next';
import TabBar from './components/TabBar.vue';
import AdminLogin from './components/AdminLogin.vue';
import ToastHost from './components/ToastHost.vue';
import { admin } from './stores/admin.js';
import { theme, toggleTheme } from './stores/theme.js';
import { toast } from './stores/toast.js';

const loginOpen = ref(false);

function logout() {
  admin.logout();
  toast('Yönetici modundan çıkıldı.', 'info');
}
</script>

<template>
  <div class="backdrop" aria-hidden="true">
    <span class="orb o1" />
    <span class="orb o2" />
    <span class="orb o3" />
    <span class="orb o4" />
    <span class="grain" />
  </div>

  <header class="topbar">
    <RouterLink to="/" class="brand">
      <span class="brand-mark glass">
        <svg viewBox="0 0 64 64" aria-hidden="true">
          <path d="M18 50V24l14-10 14 10v26" />
          <path d="M27 50V38h10v12" />
        </svg>
      </span>
      <span class="brand-text">
        <strong>Sıla Apartmanı</strong>
        <small>Yönetim Paneli</small>
      </span>
    </RouterLink>

    <div class="topbar-actions">
      <button class="icon-btn glass" type="button" :aria-label="theme === 'dark' ? 'Açık tema' : 'Koyu tema'" @click="toggleTheme">
        <Transition name="swap" mode="out-in">
          <Sun v-if="theme === 'dark'" key="sun" :size="18" />
          <Moon v-else key="moon" :size="18" />
        </Transition>
      </button>

      <div v-if="admin.isAdmin" class="admin-pill glass">
        <ShieldCheck :size="16" />
        <span>Yönetici</span>
        <button type="button" aria-label="Çıkış yap" title="Çıkış yap" @click="logout"><LogOut :size="15" /></button>
      </div>
      <button v-else class="btn glass" type="button" @click="loginOpen = true">
        <UserRound :size="16" />
        <span class="hide-sm">Yönetici girişi</span>
      </button>
    </div>
  </header>

  <main class="content">
    <RouterView v-slot="{ Component }">
      <Transition name="page" mode="out-in">
        <component :is="Component" />
      </Transition>
    </RouterView>
  </main>

  <TabBar />
  <AdminLogin v-model:open="loginOpen" />
  <ToastHost />
</template>
