import { createVueApp } from '../app'
import { watch } from 'vue'
import { initGtag, trackPageView } from '../analytics/gtag'
import { headForRoute } from '../router/routes'
import type { MetaEntry } from '../ssr/heads'

const { app, router, i18n } = createVueApp()

function upsertMeta(selector: string, attrs: Record<string, string>) {
  let tag = document.head.querySelector<HTMLMetaElement>(selector)
  if (!tag) {
    tag = document.createElement('meta')
    document.head.appendChild(tag)
  }
  for (const [name, value] of Object.entries(attrs)) {
    tag.setAttribute(name, value)
  }
}

function applyMeta(entry: MetaEntry) {
  if ('name' in entry) {
    upsertMeta(`meta[name="${entry.name}"]`, {
      name: entry.name,
      content: entry.content,
    })
  } else {
    upsertMeta(`meta[property="${entry.property}"]`, {
      property: entry.property,
      content: entry.content,
    })
  }
}

function syncHead() {
  const head = headForRoute(router.currentRoute.value, window.location.origin, key => i18n.global.t(key))
  document.title = head.title
  if (head.description) {
    upsertMeta('meta[name="description"]', {
      name: 'description',
      content: head.description,
    })
  }
  for (const meta of head.meta ?? []) {
    applyMeta(meta)
  }
}

initGtag()

router.afterEach(to => {
  syncHead()
  // 先 syncHead 更新 document.title，再送 page_view，page_title 才會是新頁標題。
  trackPageView(to.fullPath)
})

watch(i18n.global.locale, syncHead)

void router.isReady().then(() => {
  syncHead()
  // afterEach 在首屏 hydration 是否觸發不保證，這裡補一次；trackPageView 內建去重。
  trackPageView(router.currentRoute.value.fullPath)
  app.mount('#app', true)
})
