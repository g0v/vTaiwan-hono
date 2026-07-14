import { describe, it, expect } from "vite-plus/test";
import zhTW from "../l10n/zh-TW.json";
import en from "../l10n/en.json";
import ja from "../l10n/ja.json";

// i18n 三檔同步測試：AGENTS.md 的硬性規定「新增介面文字時 zh-TW / en / ja 三檔都要有相同 key」。
// 以 zh-TW 為基準，斷言另外兩檔的 key 集合完全一致，並且所有 leaf 值皆為非空字串。

type Messages = Record<string, unknown>;

function flattenKeys(obj: Messages, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([key, value]) =>
    value !== null && typeof value === "object"
      ? flattenKeys(value as Messages, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

function emptyLeaves(obj: Messages, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    if (value !== null && typeof value === "object") {
      return emptyLeaves(value as Messages, `${prefix}${key}.`);
    }
    return typeof value === "string" && value.trim().length > 0 ? [] : [`${prefix}${key}`];
  });
}

const referenceKeys = new Set(flattenKeys(zhTW));
const locales: Array<[string, Messages]> = [
  ["zh-TW", zhTW],
  ["en", en],
  ["ja", ja],
];

describe("l10n 三檔同步", () => {
  for (const [name, messages] of locales.slice(1)) {
    it(`${name}.json 的 key 集合與 zh-TW.json 完全一致`, () => {
      const keys = new Set(flattenKeys(messages));
      const missing = [...referenceKeys].filter((k) => !keys.has(k)).sort();
      const extra = [...keys].filter((k) => !referenceKeys.has(k)).sort();
      // missing：zh-TW 有但此檔缺的 key；extra：此檔多出的 key——兩者都必須為空
      expect({ missing, extra }).toEqual({ missing: [], extra: [] });
    });
  }

  for (const [name, messages] of locales) {
    it(`${name}.json 所有翻譯值皆為非空字串`, () => {
      expect(emptyLeaves(messages)).toEqual([]);
    });
  }
});
