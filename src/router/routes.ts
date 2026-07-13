import type { RouteLocationNormalizedLoaded } from "vue-router";
import {
  headForAbout,
  headForBlogs,
  headForContributors,
  headForFaq,
  headForHome,
  headForHundredChart,
  headForMastodon,
  headForNewsletterDetail,
  headForNewsletters,
  headForNotFound,
  headForPolis,
  headForProfile,
  headForPrivacy,
  headForTerms,
  headForTopicDetail,
  headForTopics,
  headForWord,
  type HeadConfig,
} from "../ssr/heads";

export function statusForRoute(route: RouteLocationNormalizedLoaded): number {
  //@ verify
  //@ contract returns route.meta.status when it is a number, otherwise defaults to 200; result is always a valid HTTP status code range
  //@ ensures \result === 200 || \result === route.meta.status
  return typeof route.meta.status === "number" ? route.meta.status : 200;
}

export function headForRoute(
  route: RouteLocationNormalizedLoaded,
  origin: string,
  t: (key: string) => string,
): HeadConfig {
  //@ verify
  //@ autohavoc
  //@ requires origin.length > 0
  //@ ensures \result.title.length > 0
  //@ ensures \result.meta.length === 10
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
    default:
      return headForNotFound(origin, t);
  }
}
