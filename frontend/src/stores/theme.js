import { ref } from 'vue';

const media = window.matchMedia('(prefers-color-scheme: light)');

function initial() {
  try {
    const saved = localStorage.getItem('sila-theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {}
  return media.matches ? 'light' : 'dark';
}

export const theme = ref(initial());
document.documentElement.dataset.theme = theme.value;

export function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = theme.value;
  try {
    localStorage.setItem('sila-theme', theme.value);
  } catch {}
}
