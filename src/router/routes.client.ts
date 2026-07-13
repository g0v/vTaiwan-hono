import type { RouteRecordRaw } from 'vue-router'

const placeholderPaths = [
  '/404',
  '/meetups',
  '/blogs',
  '/newsletters',
  '/mastodon',
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
