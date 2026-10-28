import { createApp } from 'vue'
import App from '@/App.vue'
import { router } from '@/router'
import { i18n } from '@/i18n'
import { useTheme } from '@/composables/useTheme'
import '@/style.css'

// Apply the persisted theme before first paint-ish render (T028).
useTheme().initTheme()

// Production-only service-worker registration (T076): the app shell is precached so an offline
// reload still works (SC-008). Never touches the AI origin.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    const scope = import.meta.env.BASE_URL || '/'
    navigator.serviceWorker.register(`${scope}sw.js`, { scope }).catch((err) => {
      console.warn('embrollado: service worker registration failed.', err)
    })
  })
}

const app = createApp(App)
app.use(router)
app.use(i18n)
app.mount('#app')