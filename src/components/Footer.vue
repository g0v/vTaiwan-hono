<script setup lang="ts">
const connect = [
  { label: 'GitHub', href: 'https://github.com/g0v/vTaiwan-hono' },
  { label: 'Facebook', href: '#' },
  { label: 'HackMD workspace', href: '#' },
]
const contact = [
  { label: 'info@vtaiwan.tw', href: 'mailto:info@vtaiwan.tw' },
  { label: '加入下次會議', href: '#' },
  { label: '提案新議題', href: '#' },
]
</script>

<template>
  <footer class="vt-footer-bg relative font-serif text-[#d8d8de]">
    <span class="vt-hairline absolute inset-x-0 top-0 h-px" />
    <div class="mx-auto max-w-6xl px-6 pb-6 pt-10">
      <div class="grid gap-8 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr]">
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
              <a
                :href="item.href"
                class="-mx-2.5 flex items-center rounded-[10px] px-2.5 py-2 text-[13px] text-[#c0c0c8] transition-colors hover:bg-white/5 hover:text-white"
              >
                {{ item.label }}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div class="relative mt-7 flex flex-wrap items-center justify-between gap-2.5 pt-4 font-sans text-xs text-[#76767e]">
        <span class="vt-hairline absolute inset-x-0 top-0 h-px" />
        <span>© 2026 vTaiwan · Licensed CC-BY 4.0</span>
        <span class="inline-flex items-center gap-2.5">
          <a href="#" class="text-[#b6b6be] transition-colors hover:text-white">中文</a>
          <span class="opacity-30">·</span>
          <a href="#" class="text-[#b6b6be] transition-colors hover:text-white">English</a>
        </span>
      </div>
    </div>
  </footer>
</template>
