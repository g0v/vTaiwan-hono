import { createSSRApp } from 'vue'
import {
  createMemoryHistory,
  createRouter,
  createWebHistory,
  type RouterHistory,
} from 'vue-router'
import App from './App.vue'
import { routes } from './router/routes'

export function createVueApp(url?: string) {
  const history: RouterHistory = import.meta.env.SSR
    ? createMemoryHistory()
    : createWebHistory()
  const router = createRouter({ history, routes })
  const app = createSSRApp(App)

  app.use(router)

  if (import.meta.env.SSR && url) {
    router.push(url)
  }

  return { app, router }
}
