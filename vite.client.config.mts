import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import * as vueCompiler from '@vue/compiler-sfc'

const root = path.dirname(fileURLToPath(import.meta.url))

// 建置全站 hydration bundle，輸出到 public/js/ 供 ASSETS 提供
export default defineConfig({
  root,
  publicDir: false,
  // 對齊 vite.config.mts 的 vue-i18n feature flag（JIT、非 legacy）
  define: {
    __VUE_I18N_FULL_INSTALL__: true,
    __VUE_I18N_LEGACY_API__: false,
    __INTLIFY_JIT_COMPILATION__: true,
    __INTLIFY_DROP_MESSAGE_COMPILER__: false,
    __INTLIFY_PROD_DEVTOOLS__: false,
  },
  plugins: [vue({ compiler: vueCompiler })],
  build: {
    outDir: 'public',
    emptyOutDir: false,
    cssCodeSplit: false,
    rollupOptions: {
      input: path.resolve(root, 'src/client/app-entry.ts'),
      output: {
        format: 'es',
        entryFileNames: 'js/app.js',
        assetFileNames: (assetInfo) =>
          assetInfo.names?.some((name) => name.endsWith('.css'))
            ? 'js/app.css'
            : 'assets/[name][extname]',
        inlineDynamicImports: true,
      },
    },
  },
})
