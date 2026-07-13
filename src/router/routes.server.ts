import type { RouteRecordRaw } from 'vue-router'
import HomeView from '../views/Home.vue'
import AboutView from '../views/About.vue'
import WordView from '../views/Word.vue'
import HundredChartView from '../views/HundredChart.vue'
import NotFoundView from '../views/NotFound.vue'
import PrivacyView from '../views/Privacy.vue'
import TermsView from '../views/Terms.vue'
import TopicsView from '../views/TopicsView.vue'
import TopicDetailView from '../views/TopicDetailView.vue'
import PolisView from '../views/PolisView.vue'
import ProfileView from '../views/ProfileView.vue'
import BlogsView from '../views/Blogs.vue'
import MastodonView from '../views/Mastodon.vue'
import NewslettersView from '../views/Newsletters.vue'
import NewsletterDetailView from '../views/NewsletterDetail.vue'
import ContributorsView from '../views/ContributorsView.vue'
import FaqView from '../views/FaqView.vue'

const placeholderPaths = [
  '/404',
  '/meetups',
]

// SSR 與 client 共用的路由表：一律靜態載入元件。
// SSR 每個請求需直接產生首屏；client 也用同一份靜態表，確保 hydration 與 SSR 完全一致（lazy import 會造成 hydration mismatch）。
export const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: HomeView, meta: { status: 200 } },
  { path: '/about', name: 'about', component: AboutView, meta: { status: 200 } },
  { path: '/intro', name: 'intro', component: AboutView, meta: { status: 200 } },
  {
    path: '/word/:w',
    name: 'word',
    component: WordView,
    props: (route) => ({ word: String(route.params.w ?? '') }),
    meta: { status: 200 },
  },
  { path: '/hundred', name: 'hundred', component: HundredChartView, meta: { status: 200 } },
  { path: '/privacy', name: 'privacy', component: PrivacyView, meta: { status: 200 } },
  { path: '/terms', name: 'terms', component: TermsView, meta: { status: 200 } },
  { path: '/topics', name: 'topics', component: TopicsView, meta: { status: 200 } },
  {
    path: '/topic/:id',
    name: 'topic',
    component: TopicDetailView,
    meta: { status: 200 },
  },
  { path: '/polis', name: 'polis', component: PolisView, meta: { status: 200 } },
  { path: '/profile', name: 'profile', component: ProfileView, meta: { status: 200 } },
  { path: '/blogs', name: 'blogs', component: BlogsView, meta: { status: 200 } },
  { path: '/mastodon', name: 'mastodon', component: MastodonView, meta: { status: 200 } },
  { path: '/newsletters', name: 'newsletters', component: NewslettersView, meta: { status: 200 } },
  { path: '/newsletters/:slug', name: 'newsletter-detail', component: NewsletterDetailView, meta: { status: 200 } },
  { path: '/contributors', name: 'contributors', component: ContributorsView, meta: { status: 200 } },
  { path: '/faq', name: 'faq', component: FaqView, meta: { status: 200 } },
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
