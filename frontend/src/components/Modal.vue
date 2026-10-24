<script setup>
import { onBeforeUnmount, watch } from 'vue';
import { X } from 'lucide-vue-next';

const props = defineProps({
  open: Boolean,
  title: String,
  subtitle: String,
  width: { type: String, default: '540px' },
});
const emit = defineEmits(['update:open']);
const close = () => emit('update:open', false);

const onKey = (e) => e.key === 'Escape' && close();
watch(
  () => props.open,
  (open) => {
    document.body.style.overflow = open ? 'hidden' : '';
    if (open) window.addEventListener('keydown', onKey);
    else window.removeEventListener('keydown', onKey);
  },
);
onBeforeUnmount(() => {
  document.body.style.overflow = '';
  window.removeEventListener('keydown', onKey);
});
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="modal-backdrop" @mousedown.self="close">
        <div class="modal glass glass-strong" :style="{ maxWidth: width }" role="dialog" aria-modal="true" :aria-label="title">
          <header class="modal-head">
            <div>
              <h3>{{ title }}</h3>
              <p v-if="subtitle" class="muted small">{{ subtitle }}</p>
            </div>
            <button class="icon-btn glass" type="button" aria-label="Kapat" @click="close"><X :size="18" /></button>
          </header>
          <div class="modal-body"><slot /></div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
