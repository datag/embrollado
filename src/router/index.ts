import { createRouter, createWebHashHistory } from 'vue-router'
import SessionsView from '@/views/SessionsView.vue'
import SetupView from '@/views/SetupView.vue'
import DialogueView from '@/views/DialogueView.vue'
import SettingsView from '@/views/SettingsView.vue'
import AboutView from '@/views/AboutView.vue'

/**
 * Hash routing (T026; deployment.md §3) so the app works on any static host without a rewrite
 * rule: deep links look like `.../index.html#/session/<uuid>` and a refresh never 404s.
 * Views are statically imported — the build is a single chunk (no lazy loading, D3).
 */
export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'sessions', component: SessionsView },
    { path: '/new', name: 'setup', component: SetupView },
    { path: '/session/:id', name: 'dialogue', component: DialogueView },
    { path: '/settings', name: 'settings', component: SettingsView },
    { path: '/about', name: 'about', component: AboutView },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})