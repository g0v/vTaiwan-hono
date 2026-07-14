import { createI18n } from "vue-i18n";
import type { InjectionKey, WritableComputedRef } from "vue";
import zhTW from "../l10n/zh-TW.json";
import en from "../l10n/en.json";
import ja from "../l10n/ja.json";

// 支援的語言列表（對齊 vue.vTaiwan-neo 舊專案）
export const supportedLocales = [
  { code: "zh-TW", name: "繁體中文", flag: "🇹🇼" },
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "ja", name: "日本語", flag: "🇯🇵" },
] as const;

// 支援的語言代碼類型
export type SupportedLocale = (typeof supportedLocales)[number]["code"];

// 預設語言
export const defaultLocale: SupportedLocale = "zh-TW";

const STORAGE_KEY = "locale";

// 純字串判斷核心：可被 LemmaScript/Dafny 機器驗證。刻意不引用 SupportedLocale
// union type（lsc 會為其生成帶連字號的 Dafny datatype 建構子，語法不合法）。
// 新增語言時：supportedLocales、此函式、detectPreferredLocale 三處同步。
export function isSupportedLocaleCode(value: string): boolean {
  //@ verify
  //@ ensures \result === (value === "zh-TW" || value === "en" || value === "ja")
  return value === "zh-TW" || value === "en" || value === "ja";
}

export function isSupportedLocale(value: string | null | undefined): value is SupportedLocale {
  return typeof value === "string" && isSupportedLocaleCode(value);
}

// 每個請求建立獨立的 i18n 實例，避免 SSR 跨請求狀態污染。
// 注意：此處刻意不讀取 localStorage / navigator，確保可在伺服器端執行。
export function createAppI18n(locale: SupportedLocale = defaultLocale) {
  return createI18n({
    legacy: false, // 使用 Composition API
    locale,
    fallbackLocale: defaultLocale,
    messages: {
      "zh-TW": zhTW,
      en,
      ja,
    },
    globalInjection: true, // 全域注入 $t 函數
    silentTranslationWarn: true,
    silentFallbackWarn: true,
  });
}

// 僅限瀏覽器端：依使用者偏好決定語言（localStorage > 瀏覽器語言 > 預設）。
// 回傳值恆為合法 locale。（localStorage 不可建模，故不做 LemmaScript 標注）
export function detectPreferredLocale(): SupportedLocale {
  if (typeof window === "undefined") return defaultLocale;

  const saved = localStorage.getItem(STORAGE_KEY);
  if (isSupportedLocale(saved)) return saved;

  const browserLocale = navigator.language;
  if (browserLocale.startsWith("zh")) return "zh-TW";
  if (browserLocale.startsWith("en")) return "en";
  if (browserLocale.startsWith("ja")) return "ja";

  return defaultLocale;
}

// 僅限瀏覽器端：記住使用者選擇並同步 <html lang>（狀態守恆）。
// （localStorage / document 不可建模，故不做 LemmaScript 標注）
export function persistLocale(locale: SupportedLocale) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, locale);
  document.documentElement.lang = locale;
}

// 提供給子元件 inject 的偏好語言情境
export interface LocaleContext {
  // 目前語言（可讀可寫，寫入即切換語言）
  locale: WritableComputedRef<string>;
  supportedLocales: typeof supportedLocales;
  // 切換語言並持久化
  setLocale: (locale: SupportedLocale) => void;
}

export const localeKey: InjectionKey<LocaleContext> = Symbol("vt-locale");
