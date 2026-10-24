import { createRouter, createWebHistory } from 'vue-router';
import Dashboard from './views/Dashboard.vue';

const routes = [
  { path: '/', name: 'dashboard', component: Dashboard, meta: { title: 'Genel Bakış' } },
  { path: '/giderler', name: 'expenses', component: () => import('./views/Expenses.vue'), meta: { title: 'Giderler' } },
  { path: '/oneriler', name: 'suggestions', component: () => import('./views/Suggestions.vue'), meta: { title: 'Öneriler' } },
  { path: '/duyurular', name: 'announcements', component: () => import('./views/Announcements.vue'), meta: { title: 'Duyurular' } },
  { path: '/:pathMatch(.*)*', redirect: '/' },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
});

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · Sıla Apartmanı` : 'Sıla Apartmanı';
});

export default router;
