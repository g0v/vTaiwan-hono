import { defineConfig, lazyPlugins } from 'vite-plus'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { cloudflare } from '@cloudflare/vite-plugin'
import vue from '@vitejs/plugin-vue'
import * as vueCompiler from '@vue/compiler-sfc'

const root = path.dirname(fileURLToPath(import.meta.url))

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
  fmt: {
    semi: false,
    singleQuote: true,
    trailingComma: 'es5',
    printWidth: 200,
    bracketSpacing: true,
    arrowParens: 'avoid',
    sortTailwindcss: {
      stylesheet: './src/styles/app.css',
    },
    ignorePatterns: ['public/**', 'dist/**', '.claude/**', '.vscode/**', '.wrangler/**'],
  },
  lint: {
    jsPlugins: [{ name: 'vite-plus', specifier: 'vite-plus/oxlint-plugin' }],
    rules: { 'vite-plus/prefer-vite-plus-imports': 'error' },
    options: { typeAware: true, typeCheck: true },
  },
  test: {
    // 連結完整性測試：routes.server.ts 靜態 import .vue，vue plugin 仍需載入
    include: ['src/tests/**/*.test.ts'],
    environment: 'node',
  },
  publicDir: 'public',
  resolve: {
    alias: {
      '#routes-runtime': path.resolve(root, 'src/router/routes.server.ts'),
    },
  },
  define: vueI18nFlags,
  plugins: lazyPlugins(() => [
    // Cloudflare plugin 與 Vitest 不相容；測試時略過，由 vue plugin 單獨處理 .vue
    ...(process.env['VITEST'] ? [] : [cloudflare()]),
    vue({ compiler: vueCompiler }),
  ]),
})
