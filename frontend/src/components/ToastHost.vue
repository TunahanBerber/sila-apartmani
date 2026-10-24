<script setup>
import { CircleAlert, CircleCheck, Info } from 'lucide-vue-next';
import { toasts } from '../stores/toast.js';

const icons = { success: CircleCheck, error: CircleAlert, info: Info };
</script>

<template>
  <div class="toasts" aria-live="polite">
    <TransitionGroup name="toast">
      <div v-for="t in toasts" :key="t.id" class="toast glass glass-strong" :class="t.type">
        <component :is="icons[t.type] || Info" :size="18" />
        <span>{{ t.message }}</span>
      </div>
    </TransitionGroup>
  </div>
</template>
