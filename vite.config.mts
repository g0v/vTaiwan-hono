import { defineConfig } from 'vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import vue from '@vitejs/plugin-vue'
import * as vueCompiler from '@vue/compiler-sfc'

// vue-i18n v11 預設使用 JIT 編譯（不依賴 new Function / eval），可在
// Cloudflare Workers 執行期安全運作；此處設定 feature flag 讓建置乾淨。
const vueI18nFlags = {
  __VUE_I18N_FULL_INSTALL__: true,
  __VUE_I18N_LEGACY_API__: false,
  __INTLIFY_JIT_COMPILATION__: true,
  __INTLIFY_DROP_MESSAGE_COMPILER__: false,
  __INTLIFY_PROD_DEVTOOLS__: false,
}

export default defineConfig({
  publicDir: 'public',
  define: vueI18nFlags,
  plugins: [
    cloudflare(),
    vue({ compiler: vueCompiler }),
  ],
})
