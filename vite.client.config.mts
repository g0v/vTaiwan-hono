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
