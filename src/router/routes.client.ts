import type { RouteRecordRaw } from 'vue-router'
import BlogsView from '../views/Blogs.vue'
import MastodonView from '../views/Mastodon.vue'
import NewslettersView from '../views/Newsletters.vue'
import NewsletterDetailView from '../views/NewsletterDetail.vue'

const placeholderPaths = [
  '/404',
  '/meetups',
  '/faq',
  '/contributors',
]

// 瀏覽器端按路由載入頁面，減少 hydration 初始下載量。
export const routes: RouteRecordRaw[] = [
  { path: '/', name: 'home', component: () => import('../views/Home.vue'), meta: { status: 200 } },
  { path: '/about', name: 'about', component: () => import('../views/About.vue'), meta: { status: 200 } },
  { path: '/intro', name: 'intro', component: () => import('../views/About.vue'), meta: { status: 200 } },
  {
    path: '/word/:w',
    name: 'word',
    component: () => import('../views/Word.vue'),
    props: (route) => ({ word: String(route.params.w ?? '') }),
    meta: { status: 200 },
  },
  {
    path: '/hundred',
    name: 'hundred',
    component: () => import('../views/HundredChart.vue'),
    meta: { status: 200 },
  },
  {
    path: '/privacy',
    name: 'privacy',
    component: () => import('../views/Privacy.vue'),
    meta: { status: 200 },
  },
  { path: '/terms', name: 'terms', component: () => import('../views/Terms.vue'), meta: { status: 200 } },
  {
    path: '/topics',
    name: 'topics',
    component: () => import('../views/TopicsView.vue'),
    meta: { status: 200 },
  },
  {
    path: '/topic/:id',
    name: 'topic',
    component: () => import('../views/TopicDetailView.vue'),
    meta: { status: 200 },
  },
  { path: '/polis', name: 'polis', component: () => import('../views/PolisView.vue'), meta: { status: 200 } },
  {
    path: '/profile',
    name: 'profile',
    component: () => import('../views/ProfileView.vue'),
    meta: { status: 200 },
  },
  // 文章頁會在 mounted 後載入資料；不可延後載入元件，以確保前端導航時生命週期會正確觸發。
  { path: '/blogs', name: 'blogs', component: BlogsView, meta: { status: 200 } },
  { path: '/mastodon', name: 'mastodon', component: MastodonView, meta: { status: 200 } },
  { path: '/newsletters', name: 'newsletters', component: NewslettersView, meta: { status: 200 } },
  { path: '/newsletters/:slug', name: 'newsletter-detail', component: NewsletterDetailView, meta: { status: 200 } },
  ...placeholderPaths.map((path) => ({
    path,
    name: `placeholder-${path.slice(1)}`,
    component: () => import('../views/NotFound.vue'),
    meta: { status: 404 },
  })),
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('../views/NotFound.vue'),
    meta: { status: 404 },
  },
]
