<script setup>
import { LogOut, Moon, ShieldCheck, Sun, UserRound } from 'lucide-vue-next';
import TabBar from './components/TabBar.vue';
import AuthScreen from './components/AuthScreen.vue';
import ToastHost from './components/ToastHost.vue';
import { session, signOut } from './stores/session.js';
import { theme, toggleTheme } from './stores/theme.js';
import { toast } from './stores/toast.js';

async function logout() {
  await signOut();
  toast('Çıkış yapıldı.', 'info');
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

  <AuthScreen v-if="session.ready && !session.canUseApp" />

  <template v-else-if="session.ready">
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

        <div class="admin-pill glass" :class="{ resident: !session.isAdmin }" :title="session.user.email">
          <ShieldCheck v-if="session.isAdmin" :size="16" />
          <UserRound v-else :size="16" />
          <span v-if="session.isAdmin">Yönetici</span>
          <span v-else>Daire {{ session.resident.apartment_no }}<span class="hide-sm"> · {{ session.resident.full_name }}</span></span>
          <button type="button" aria-label="Çıkış yap" title="Çıkış yap" @click="logout"><LogOut :size="15" /></button>
        </div>
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
  </template>
  <ToastHost />
</template>
