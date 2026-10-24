import { createApp } from 'vue';
import App from './App.vue';
import router from './router.js';
import './assets/main.css';

// Cam yüzeylerde imleci takip eden ışık yansıması
let raf;
document.addEventListener(
  'pointermove',
  (e) => {
    if (e.pointerType !== 'mouse') return;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const el = e.target instanceof Element && e.target.closest('.glass');
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  },
  { passive: true },
);

createApp(App).use(router).mount('#app');
