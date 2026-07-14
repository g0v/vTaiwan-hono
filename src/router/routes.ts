import type { RouteLocationNormalizedLoaded } from "vue-router";
import {
  headForAbout,
  headForBlogs,
  headForContributors,
  headForFaq,
  headForHome,
  headForHundredChart,
  headForJitsi,
  headForMastodon,
  headForMeetups,
  headForNewsletterDetail,
  headForNewsletters,
  headForNotFound,
  headForPolis,
  headForProfile,
  headForPrivacy,
  headForTerms,
  headForTopicDetail,
  headForTopics,
  headForTranscriptionDetail,
  headForTranscriptions,
  headForWord,
  type HeadConfig,
} from "../ssr/heads";

// 純核心：可被 LemmaScript/Dafny 機器驗證。刻意不吃 RouteLocationNormalizedLoaded
// （lsc 會把整個 Vue 型別閉包拉進 Dafny，無法解析）。
export function resolveRouteStatus(metaStatus: number | undefined): number {
  //@ verify
  //@ ensures \result === 200 || \result === metaStatus
  return metaStatus === undefined ? 200 : metaStatus;
}

// 回傳 route.meta.status（非數字時預設 200）
export function statusForRoute(route: RouteLocationNormalizedLoaded): number {
  const status = route.meta.status;
  return resolveRouteStatus(typeof status === "number" ? status : undefined);
}

// 恆回傳有效 HeadConfig（title 非空、meta 十項）；未知 route 落到 headForNotFound。
// （吃 RouteLocationNormalizedLoaded 且依賴 t()，不可建模，故不做 LemmaScript 標注）
export function headForRoute(
  route: RouteLocationNormalizedLoaded,
  origin: string,
  t: (key: string) => string,
): HeadConfig {
  switch (route.name) {
    case "home":
      return headForHome(origin, t);
    case "about":
    case "intro":
      return headForAbout(origin, t);
    case "word":
      return headForWord(String(route.params.w ?? ""), origin, t);
    case "hundred":
      return headForHundredChart(origin, t);
    case "privacy":
      return headForPrivacy(origin, t);
    case "terms":
      return headForTerms(origin, t);
    case "topics":
      return headForTopics(origin, t);
    case "topic":
      return headForTopicDetail(origin, String(route.params.id ?? ""), t);
    case "polis":
      return headForPolis(origin, t);
    case "profile":
      return headForProfile(origin, t);
    case "blogs":
      return headForBlogs(origin, t);
    case "mastodon":
      return headForMastodon(origin, t);
    case "newsletters":
      return headForNewsletters(origin, t);
    case "newsletter-detail":
      return headForNewsletterDetail(origin, String(route.params.slug ?? ""), t);
    case "contributors":
      return headForContributors(origin, t);
    case "faq":
      return headForFaq(origin, t);
    case "meetups":
      return headForMeetups(origin, t);
    case "transcriptions":
      return headForTranscriptions(origin, t);
    case "transcription-detail":
      return headForTranscriptionDetail(origin, t);
    case "jitsi":
      return headForJitsi(origin, t);
    default:
      return headForNotFound(origin, t);
  }
}
