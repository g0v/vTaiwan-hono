import type { RouteLocationNormalizedLoaded } from 'vue-router'
import {
  headForAbout,
  headForHome,
  headForHundredChart,
  headForNotFound,
  headForPolis,
  headForProfile,
  headForPrivacy,
  headForTerms,
  headForTopicDetail,
  headForTopics,
  headForWord,
  type HeadConfig,
} from '../ssr/heads'

export function statusForRoute(route: RouteLocationNormalizedLoaded): number {
  return typeof route.meta.status === 'number' ? route.meta.status : 200
}

export function headForRoute(
  route: RouteLocationNormalizedLoaded,
  origin: string,
  t: (key: string) => string,
): HeadConfig {
  switch (route.name) {
    case 'home':
      return headForHome(origin, t)
    case 'about':
    case 'intro':
      return headForAbout(origin, t)
    case 'word':
      return headForWord(String(route.params.w ?? ''), origin, t)
    case 'hundred':
      return headForHundredChart(origin, t)
    case 'privacy':
      return headForPrivacy(origin, t)
    case 'terms':
      return headForTerms(origin, t)
    case 'topics':
      return headForTopics(origin, t)
    case 'topic':
      return headForTopicDetail(origin, String(route.params.id ?? ''), t)
    case 'polis':
      return headForPolis(origin, t)
    case 'profile':
      return headForProfile(origin, t)
    default:
      return headForNotFound(origin, t)
  }
}
