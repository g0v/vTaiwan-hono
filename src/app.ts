import { createSSRApp } from 'vue'
import { createMemoryHistory, createRouter, createWebHistory, type RouterHistory } from 'vue-router'
import App from './App.vue'
import { routes } from '#routes-runtime'
import { createAppI18n, type SupportedLocale } from './i18n'

export function createVueApp(url?: string, locale?: SupportedLocale) {
  const history: RouterHistory = import.meta.env.SSR ? createMemoryHistory() : createWebHistory()
  const router = createRouter({ history, routes })
  const i18n = createAppI18n(locale)
  const app = createSSRApp(App)

  app.use(router)
  app.use(i18n)

  if (import.meta.env.SSR && url) {
    void router.push(url)
  }

  return { app, router, i18n }
}
