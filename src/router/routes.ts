import type { RouteLocationNormalizedLoaded } from 'vue-router'
import {
  headForAbout,
  headForBlogs,
  headForContact,
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
  headForPropose,
  headForTerms,
  headForTopicDetail,
  headForTopics,
  headForTranscriptionDetail,
  headForTranscriptions,
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
    case 'blogs':
      return headForBlogs(origin, t)
    case 'mastodon':
      return headForMastodon(origin, t)
    case 'newsletters':
      return headForNewsletters(origin, t)
    case 'newsletter-detail':
      return headForNewsletterDetail(origin, String(route.params.slug ?? ''), t)
    case 'contributors':
      return headForContributors(origin, t)
    case 'faq':
      return headForFaq(origin, t)
    case 'meetups':
      return headForMeetups(origin, t)
    case 'contact':
      return headForContact(origin, t)
    case 'propose':
      return headForPropose(origin, t)
    case 'transcriptions':
      return headForTranscriptions(origin, t)
    case 'transcription-detail':
      return headForTranscriptionDetail(origin, String(route.params.meeting_id ?? ''), t)
    case 'jitsi':
      return headForJitsi(origin, t)
    default:
      return headForNotFound(origin, t)
  }
}
