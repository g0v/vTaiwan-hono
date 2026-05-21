import { createVueApp } from '../app'
import { headForRoute } from '../router/routes'
import type { MetaEntry } from '../ssr/heads'

const { app, router } = createVueApp()

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
  const head = headForRoute(router.currentRoute.value, window.location.origin)
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

router.afterEach(() => {
  syncHead()
})

router.isReady().then(() => {
  syncHead()
  app.mount('#app', true)
})
