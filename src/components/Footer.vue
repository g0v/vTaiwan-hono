<script setup lang="ts">
// 連結對齊原專案 vue.vTaiwan-neo 的 Footer；原 Footer 沒有的項目則手動設置。

// 社群連結 — 對齊原 Footer 的「社群」區塊
const connect = [
  { label: 'Mastodon', href: 'https://g0v.social/' },
  { label: 'Facebook', href: 'https://www.facebook.com/vtaiwan.tw/' },
  { label: 'X (Twitter)', href: 'https://x.com/v_taiwan' },
  { label: 'Instagram', href: 'https://www.instagram.com/vtaiwan.tw/' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com/company/vtaiwan/' },
  { label: 'HackMD Workspace', href: 'https://g0v.hackmd.io/@tmonk/rJHYWR9S4/%2Ff9c4pS_TQjClh0g6wCJ8iw?type=book' },
]

// 聯絡 — info@vtaiwan.tw 對齊原 Footer；其餘為原 Footer 沒有、手動設置的站內連結
const contact = [
  { label: 'info@vtaiwan.tw', href: 'mailto:info@vtaiwan.tw' },
  { label: '加入下次會議', to: '/meetups' },
  { label: '提案新議題', to: '/topics' },
]

// 頁尾法務連結 — 對齊原 Footer 底部（原始碼指向本專案 repo）
const legal = [
  { label: '原始碼', href: 'https://github.com/g0v/vTaiwan-hono' },
  { label: '隱私政策', to: '/privacy' },
  { label: '使用條款', to: '/terms' },
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
            公共政策的開放協作平台，讓每個人都能參與台灣的未來。
          </p>
        </div>

        <!-- 社群連結 -->
        <div>
          <div class="mb-2.5 flex h-7 items-center gap-2 font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-[#e4e4ea]">
            <span class="h-[5px] w-[5px] rounded-full bg-democratic-red shadow-[0_0_6px_rgba(216,0,0,0.55)]" />
            Connect
            <span class="ml-0.5 font-serif font-normal normal-case tracking-[0.06em] text-[#9c9ca4]">社群連結</span>
          </div>
          <ul class="flex flex-col gap-0.5">
            <li v-for="item in connect" :key="item.label">
              <a
                :href="item.href"
                target="_blank"
                rel="noopener noreferrer"
                class="-mx-2.5 flex items-center rounded-[10px] px-2.5 py-2 text-[13px] text-[#c0c0c8] transition-colors hover:bg-white/5 hover:text-white"
              >
                {{ item.label }}
              </a>
            </li>
          </ul>
        </div>

        <!-- 聯絡 -->
        <div>
          <div class="mb-2.5 flex h-7 items-center gap-2 font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-[#e4e4ea]">
            <span class="h-[5px] w-[5px] rounded-full bg-democratic-red shadow-[0_0_6px_rgba(216,0,0,0.55)]" />
            Contact
            <span class="ml-0.5 font-serif font-normal normal-case tracking-[0.06em] text-[#9c9ca4]">聯絡</span>
          </div>
          <ul class="flex flex-col gap-0.5">
            <li v-for="item in contact" :key="item.label">
              <RouterLink
                v-if="item.to"
                :to="item.to"
                class="-mx-2.5 flex items-center rounded-[10px] px-2.5 py-2 text-[13px] text-[#c0c0c8] transition-colors hover:bg-white/5 hover:text-white"
              >
                {{ item.label }}
              </RouterLink>
              <a
                v-else
                :href="item.href"
                class="-mx-2.5 flex items-center rounded-[10px] px-2.5 py-2 text-[13px] text-[#c0c0c8] transition-colors hover:bg-white/5 hover:text-white"
              >
                {{ item.label }}
              </a>
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
            © 2026 vTaiwan · 採 CC-BY-SA 4.0 創用授權釋出
          </a>
          <span class="opacity-30">·</span>
          <div>
            <template v-for="(item, i) in legal" :key="item.label">
              <RouterLink
                v-if="item.to"
                :to="item.to"
                class="text-[#b6b6be] transition-colors hover:text-white"
              >
                {{ item.label }}
              </RouterLink>
              <a
                v-else
                :href="item.href"
                target="_blank"
                rel="noopener noreferrer"
                class="text-[#b6b6be] transition-colors hover:text-white"
              >
                {{ item.label }}
              </a>
              <span v-if="i < legal.length - 1" class="opacity-30">·</span>
            </template>
          </div>
        </div>
        <span class="inline-flex items-center gap-2.5">
          <a href="#" class="text-[#b6b6be] transition-colors hover:text-white">中文</a>          
          <span class="opacity-30">·</span>
          <a href="#" class="text-[#b6b6be] transition-colors hover:text-white">English</a>
          <span class="opacity-30">·</span>
          <a href="#" class="text-[#b6b6be] transition-colors hover:text-white">日本語</a>
        </span>
      </div>
    </div>
  </footer>
</template>
