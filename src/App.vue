<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import Footer from './components/Footer.vue'
import NavBar from './components/NavBar.vue'

const route = useRoute()

const activeNavKey = computed(() => {
  const path = route.path

  if (path === '/') return 'home'

  const map: Array<{ prefix: string; key: string }> = [
    { prefix: '/topics', key: 'topics' },
    { prefix: '/meetups', key: 'meetups' },
    { prefix: '/blogs', key: 'blogs' },
    { prefix: '/newsletters', key: 'newsletters' },
    { prefix: '/mastodon', key: 'mastodon' },
    { prefix: '/faq', key: 'faq' },
    { prefix: '/intro', key: 'about' },
    { prefix: '/about', key: 'about' },
    { prefix: '/contributors', key: 'contributors' },
  ]

  return map.find((item) => path.startsWith(item.prefix))?.key
})

watch(
  () => route.fullPath,
  () => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
    }
  },
)
</script>

<template>
  <div class="font-serif min-h-screen flex flex-col">
    <NavBar :current="activeNavKey" />
    <div class="flex-1">
      <RouterView />
    </div>
    <Footer />
  </div>
</template>
