<script setup lang="ts">
// 連結對齊原專案 vue.vTaiwan-neo 的 Footer；文字接上 i18n，原版沒有的鍵已補入多語言。
import { computed, inject } from 'vue'
import { useI18n } from 'vue-i18n'
import FooterLinkIcon from './FooterLinkIcon.vue'
import FooterNavLink from './FooterNavLink.vue'
import { localeKey, supportedLocales, type SupportedLocale } from '../i18n'

type FooterIconName = 'mastodon' | 'facebook' | 'x' | 'instagram' | 'linkedin' | 'hackmd' | 'mail' | 'calendar' | 'document'

const connectIcons: Record<string, FooterIconName> = {
  Mastodon: 'mastodon',
  Facebook: 'facebook',
  'X (Twitter)': 'x',
  Instagram: 'instagram',
  LinkedIn: 'linkedin',
  'HackMD Workspace': 'hackmd',
}

const { t } = useI18n()
const currentYear = computed(() => new Date().getFullYear())

// 偏好語言情境 — 提供頁尾右下角語言切換按鈕使用
const localeCtx = inject(localeKey)
const currentCode = computed(() => localeCtx?.locale.value)
const switchLocale = (code: SupportedLocale) => localeCtx?.setLocale(code)

// 社群連結 — 對齊原 Footer 的「社群」區塊（品牌名稱不翻譯）
const connect = [
  { label: 'Mastodon', href: 'https://g0v.social/' },
  { label: 'Facebook', href: 'https://www.facebook.com/vtaiwan.tw/' },
  { label: 'X (Twitter)', href: 'https://x.com/v_taiwan' },
  { label: 'Instagram', href: 'https://www.instagram.com/vtaiwan.tw/' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/company/vtaiwan/' },
  { label: 'HackMD Workspace', href: 'https://g0v.hackmd.io/@tmonk/rJHYWR9S4/%2Ff9c4pS_TQjClh0g6wCJ8iw?type=book' },
]

// 聯絡 — info@vtaiwan.tw 對齊原 Footer（email 不翻譯）；其餘為站內連結
const contact = [
  { label: 'info@vtaiwan.tw', href: 'mailto:info@vtaiwan.tw' },
  { labelKey: 'footer.joinNextMeeting', to: '/meetups' },
  { labelKey: 'footer.proposeTopic', to: '/topics' },
]

function contactIcon(item: (typeof contact)[number]): FooterIconName {
  if (item.href?.startsWith('mailto:')) return 'mail'
  if (item.labelKey === 'footer.joinNextMeeting') return 'calendar'
  if (item.labelKey === 'footer.proposeTopic') return 'document'
  return 'document'
}

// 頁尾法務連結 — 對齊原 Footer 底部（原始碼指向本專案 repo）
const legal = [
  { labelKey: 'footer.sourceCode', href: 'https://github.com/g0v/vTaiwan-hono' },
  { labelKey: 'footer.privacyPolicy', to: '/privacy' },
  { labelKey: 'footer.termsOfService', to: '/terms' },
]
</script>

<template>
  <footer class="vt-footer-bg relative font-serif text-[#d8d8de]">
    <span class="vt-hairline absolute inset-x-0 top-0 h-px" />
    <div class="mx-auto max-w-6xl px-6 pb-6 pt-10">
      <div class="grid grid-cols-1 gap-8 sm:grid-cols-[1.4fr_1fr_1fr]">
        <!-- 品牌 -->
        <div>
          <img :src="'/assets/vtaiwan-logo-dark.svg'" alt="vTaiwan" class="mb-3 h-6 w-auto opacity-95" />
          <p class="max-w-[280px] text-[13px] leading-relaxed text-[#9c9ca4]">
            {{ t('footer.brandDescription') }}
          </p>
        </div>

        <!-- 社群連結 -->
        <div>
          <div class="mb-2.5 flex h-7 items-center gap-2 font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-[#e4e4ea]">
            <span class="h-[5px] w-[5px] rounded-full bg-democratic-red shadow-[0_0_6px_rgba(216,0,0,0.55)]" />
            {{ t('footer.connectTitle') }}
          </div>
          <ul class="m-0 flex list-none flex-col gap-0.5 p-0">
            <li v-for="item in connect" :key="item.label">
              <FooterNavLink :href="item.href" external>
                <template #icon>
                  <FooterLinkIcon :name="connectIcons[item.label]" />
                </template>
                {{ item.label }}
              </FooterNavLink>
            </li>
          </ul>
        </div>

        <!-- 聯絡 -->
        <div>
          <div class="mb-2.5 flex h-7 items-center gap-2 font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-[#e4e4ea]">
            <span class="h-[5px] w-[5px] rounded-full bg-democratic-red shadow-[0_0_6px_rgba(216,0,0,0.55)]" />
            {{ t('footer.contactTitle') }}
          </div>
          <ul class="m-0 flex list-none flex-col gap-0.5 p-0">
            <li v-for="item in contact" :key="item.to ?? item.href">
              <FooterNavLink :to="item.to" :href="item.href">
                <template #icon>
                  <FooterLinkIcon :name="contactIcon(item)" />
                </template>
                {{ item.labelKey ? t(item.labelKey) : item.label }}
              </FooterNavLink>
            </li>
          </ul>
        </div>
      </div>

      <div class="relative mt-7 flex flex-col md:flex-row items-center justify-between gap-x-5 gap-y-3 pt-4 font-sans text-xs text-[#76767e]">
        <span class="vt-hairline absolute inset-x-0 top-0 h-px" />
        <div class="flex flex-col sm:flex-row items-center gap-x-3 gap-y-1.5">
          <a
            href="https://creativecommons.org/licenses/by-sa/4.0/deed.zh-hant"
            target="_blank"
            rel="noopener noreferrer"
            class="transition-colors hover:text-white"
          >
            {{ t('footer.copyright', { year: currentYear }) }}
          </a>
          <span class="opacity-30">·</span>
          <div>
            <template v-for="(item, i) in legal" :key="item.labelKey">
              <RouterLink
                v-if="item.to"
                :to="item.to"
                class="text-[#b6b6be] transition-colors hover:text-white"
              >
                {{ t(item.labelKey) }}
              </RouterLink>
              <a
                v-else
                :href="item.href"
                target="_blank"
                rel="noopener noreferrer"
                class="text-[#b6b6be] transition-colors hover:text-white"
              >
                {{ t(item.labelKey) }}
              </a>
              <span v-if="i < legal.length - 1" class="opacity-30">·</span>
            </template>
          </div>
        </div>
        <span class="inline-flex items-center gap-2.5">
          <template v-for="(loc, i) in supportedLocales" :key="loc.code">
            <button
              type="button"
              class="cursor-pointer transition-colors hover:text-white"
              :class="currentCode === loc.code ? 'font-medium text-white' : 'text-[#b6b6be]'"
              :aria-pressed="currentCode === loc.code"
              @click="switchLocale(loc.code)"
            >
              {{ loc.name }}
            </button>
            <span v-if="i < supportedLocales.length - 1" class="opacity-30">·</span>
          </template>
        </span>
      </div>
    </div>
  </footer>
</template>
