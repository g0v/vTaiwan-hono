import type { RouteLocationNormalizedLoaded, RouteRecordRaw } from 'vue-router'
import HomeView from '../views/Home.vue'
import AboutView from '../views/About.vue'
import WordView from '../views/Word.vue'
import HundredChartView from '../views/HundredChart.vue'
import NotFoundView from '../views/NotFound.vue'
import PrivacyView from '../views/Privacy.vue'
import TermsView from '../views/Terms.vue'
import {
  headForAbout,
  headForHome,
  headForHundredChart,
  headForNotFound,
  headForPrivacy,
  headForTerms,
  headForWord,
  type HeadConfig,
} from '../ssr/heads'

const placeholderPaths = [
  '/404',
  '/topics',
  '/meetups',
  '/blogs',
  '/newsletters',
  '/mastodon',
  '/faq',
  '/contributors',
]

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: HomeView,
    meta: { status: 200 },
  },
  {
    path: '/about',
    name: 'about',
    component: AboutView,
    meta: { status: 200 },
  },
  {
    path: '/intro',
    name: 'intro',
    component: AboutView,
    meta: { status: 200 },
  },
  {
    path: '/word/:w',
    name: 'word',
    component: WordView,
    props: (route) => ({ word: String(route.params.w ?? '') }),
    meta: { status: 200 },
  },
  {
    path: '/hundred',
    name: 'hundred',
    component: HundredChartView,
    meta: { status: 200 },
  },
  {
    path: '/privacy',
    name: 'privacy',
    component: PrivacyView,
    meta: { status: 200 },
  },
  {
    path: '/terms',
    name: 'terms',
    component: TermsView,
    meta: { status: 200 },
  },
  ...placeholderPaths.map((path) => ({
    path,
    name: `placeholder-${path.slice(1)}`,
    component: NotFoundView,
    meta: { status: 404 },
  })),
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: NotFoundView,
    meta: { status: 404 },
  },
]

export function statusForRoute(route: RouteLocationNormalizedLoaded): number {
  return typeof route.meta.status === 'number' ? route.meta.status : 200
}

export function headForRoute(
  route: RouteLocationNormalizedLoaded,
  origin: string,
): HeadConfig {
  switch (route.name) {
    case 'home':
      return headForHome(origin)
    case 'about':
    case 'intro':
      return headForAbout(origin)
    case 'word':
      return headForWord(String(route.params.w ?? ''), origin)
    case 'hundred':
      return headForHundredChart(origin)
    case 'privacy':
      return headForPrivacy(origin)
    case 'terms':
      return headForTerms(origin)
    default:
      return headForNotFound(origin)
  }
}
