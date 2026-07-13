import { defineConfig, lazyPlugins } from "vite-plus";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import vue from "@vitejs/plugin-vue";
import * as vueCompiler from "@vue/compiler-sfc";

const root = path.dirname(fileURLToPath(import.meta.url));

// vue-i18n v11 預設使用 JIT 編譯（不依賴 new Function / eval），可在
// Cloudflare Workers 執行期安全運作；此處設定 feature flag 讓建置乾淨。
const vueI18nFlags = {
  __VUE_I18N_FULL_INSTALL__: true,
  __VUE_I18N_LEGACY_API__: false,
  __INTLIFY_JIT_COMPILATION__: true,
  __INTLIFY_DROP_MESSAGE_COMPILER__: false,
  __INTLIFY_PROD_DEVTOOLS__: false,
};

export default defineConfig({
  fmt: {},
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
  publicDir: "public",
  resolve: {
    alias: {
      "#routes-runtime": path.resolve(root, "src/router/routes.server.ts"),
    },
  },
  define: vueI18nFlags,
  plugins: lazyPlugins(() => [cloudflare(), vue({ compiler: vueCompiler })]),
});
