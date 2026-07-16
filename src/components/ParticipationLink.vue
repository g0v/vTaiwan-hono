<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import IconWrapper from './IconWrapper.vue'

const props = withDefaults(
  defineProps<{
    urllink?: string[]
  }>(),
  {
    urllink: () => [],
  }
)

interface LinkItem {
  icon: string
  text: string
  long: string
  link: string
}

const { t } = useI18n()
const ulinkall = ref<LinkItem[]>([])

const dataBase = [
  {
    key: 'hackpad',
    icon: 'edit',
    textKey: 'topics.participation.types.hackpad' as const,
    longKey: 'topics.participation.types.hackpadLong' as const,
  },
  {
    key: 'sayit',
    icon: 'book',
    textKey: 'topics.participation.types.sayit' as const,
    longKey: 'topics.participation.types.sayitLong' as const,
  },
  {
    key: 'youtube',
    icon: 'play',
    textKey: 'topics.participation.types.youtube' as const,
    longKey: 'topics.participation.types.youtubeLong' as const,
  },
  {
    key: 'livehouse',
    icon: 'play',
    textKey: 'topics.participation.types.livehouse' as const,
    longKey: 'topics.participation.types.livehouseLong' as const,
  },
  {
    key: 'pol.is',
    icon: 'users',
    textKey: 'topics.participation.types.polis' as const,
    longKey: 'topics.participation.types.polisLong' as const,
  },
  {
    key: 'talk.vtaiwan.tw',
    icon: 'message-circle',
    textKey: 'topics.participation.types.discourse' as const,
    longKey: 'topics.participation.types.discourseLong' as const,
  },
  {
    key: 'app.sli.do',
    icon: 'megaphone',
    textKey: 'topics.participation.types.slido' as const,
    longKey: 'topics.participation.types.slidoLong' as const,
  },
  {
    key: '.pdf',
    icon: 'download',
    textKey: 'topics.participation.types.pdf' as const,
    longKey: 'topics.participation.types.pdfLong' as const,
  },
  {
    key: 'g0v.github',
    icon: 'github',
    textKey: 'topics.participation.types.gitbook' as const,
    longKey: 'topics.participation.types.gitbookLong' as const,
  },
  {
    key: '',
    icon: 'link',
    textKey: 'topics.participation.types.related' as const,
    longKey: 'topics.participation.types.relatedLong' as const,
  },
]

const processLinks = () => {
  ulinkall.value = []
  if (!props.urllink?.length) return

  const validLinks = props.urllink.filter(link => link?.trim())
  if (!validLinks.length) return

  ulinkall.value = validLinks.map(link => {
    const matched = dataBase.find(data => data.key !== '' && link.toLowerCase().includes(data.key)) ?? dataBase[dataBase.length - 1]

    const linkMatch = /^\[(.*?)\]\((.*)\)/.exec(link)
    return {
      icon: matched.icon,
      long: t(matched.longKey),
      text: linkMatch ? linkMatch[1] : t(matched.textKey),
      link: linkMatch ? linkMatch[2] : link,
    }
  })
}

onMounted(() => {
  processLinks()
})

watch(() => props.urllink, processLinks)
</script>

<template>
  <div class="participation-link min-h-8">
    <div v-if="ulinkall.length > 0" class="flex flex-wrap gap-2">
      <a
        v-for="(item, index) in ulinkall"
        :key="index"
        :href="item.link"
        target="_blank"
        rel="noopener noreferrer"
        :title="item.long"
        class="inline-flex items-center rounded-sm bg-jade-green px-3 py-1 text-sm text-white transition-colors hover:bg-jade-green/80"
      >
        <IconWrapper :name="item.icon" :size="14" class="mr-1 shrink-0" color="white" />
        {{ item.text }}
      </a>
    </div>
    <div v-else class="text-xs text-gray-400">{{ t('topics.participation.noLinks') }}</div>
  </div>
</template>
