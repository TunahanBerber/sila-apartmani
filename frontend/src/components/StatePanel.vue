<script setup>
import { CloudOff, Inbox, RotateCw } from 'lucide-vue-next';

defineProps({
  kind: { type: String, default: 'empty' }, // 'empty' | 'error'
  title: String,
  message: String,
});
defineEmits(['retry']);
</script>

<template>
  <div class="state" :class="kind">
    <span class="state-icon glass"><component :is="kind === 'error' ? CloudOff : Inbox" :size="26" /></span>
    <h4>{{ title || (kind === 'error' ? 'Bir şeyler ters gitti' : 'Burada henüz bir şey yok') }}</h4>
    <p v-if="message" class="muted">{{ message }}</p>
    <slot />
    <button v-if="kind === 'error'" class="btn glass" type="button" @click="$emit('retry')">
      <RotateCw :size="16" /> Tekrar dene
    </button>
  </div>
</template>
