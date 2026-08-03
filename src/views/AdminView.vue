<template>
  <div class="vt-under-navbar min-h-screen bg-vt-bg-2 pt-20">
    <!-- 確認權限中：SSR 與首次 hydration 一律落此狀態，避免洩漏管理版面或造成 mismatch -->
    <div v-if="!authReady" class="container mx-auto flex min-h-[50vh] items-center justify-center px-vt-4">
      <p class="text-vt-base text-vt-fg-3">{{ t('admin.guard.checking') }}</p>
    </div>

    <!-- 非管理員：前端顯示層守衛（真正 403 由 Worker 端把關，見 index.ts） -->
    <div v-else-if="!isAdmin" class="container mx-auto flex min-h-[50vh] items-center justify-center px-vt-4">
      <div class="mx-auto max-w-md rounded-vt-lg border border-vt-border bg-vt-bg-1 p-vt-8 text-center shadow-vt-sm">
        <p class="text-vt-4xl font-bold text-vt-democratic-red">403</p>
        <h1 class="mt-vt-3 text-vt-xl font-semibold text-vt-fg-1">{{ t('admin.guard.forbiddenTitle') }}</h1>
        <p class="mt-vt-2 text-vt-sm text-vt-fg-2">{{ t('admin.guard.forbiddenDesc') }}</p>
        <RouterLink
          to="/"
          class="px-vt-5 mt-vt-6 inline-flex items-center justify-center rounded-full bg-ink py-vt-2 text-vt-sm font-medium text-vt-fg-inverse transition-colors hover:bg-democratic-red"
        >
          {{ t('admin.guard.backHome') }}
        </RouterLink>
      </div>
    </div>

    <!-- 管理員但 session 已不新鮮：整個後台換成二次驗證畫面（重新登入即恢復） -->
    <div v-else-if="needsStepUp" class="container mx-auto flex min-h-[50vh] items-center justify-center px-vt-4">
      <StepUpAuth :title="t('admin.guard.reauthTitle')" :description="t('admin.guard.reauthDesc')" />
    </div>

    <div v-else class="container mx-auto mt-10 px-vt-4">
      <div class="mx-auto max-w-6xl">
        <!-- 頁首 -->
        <header class="mb-vt-6">
          <div class="flex flex-wrap items-center justify-between gap-vt-3">
            <h1 class="text-vt-3xl font-bold text-vt-fg-1">{{ t('admin.title') }}</h1>

            <!-- 二次驗證剩餘時間：歸零即自動退回二次驗證畫面 -->
            <p
              v-if="stepUpRemainingLabel"
              class="rounded-full border border-vt-border bg-vt-bg-1 px-vt-3 py-vt-1 text-vt-sm text-vt-fg-2 tabular-nums"
              :class="stepUpExpiringSoon ? 'border-vt-democratic-red text-vt-democratic-red' : ''"
              role="status"
              :aria-label="t('admin.guard.sessionRemainingAria')"
            >
              {{ t('admin.guard.sessionRemaining', { time: stepUpRemainingLabel }) }}
            </p>
          </div>
          <p class="mt-vt-2 text-vt-base text-vt-fg-2">{{ t('admin.subtitle') }}</p>
        </header>

        <!-- 分頁列 -->
        <div class="mb-vt-6 flex flex-wrap gap-vt-1 border-b border-vt-border">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            type="button"
            class="admin-tab"
            :class="activeTab === tab.key ? 'admin-tab--active' : ''"
            :aria-selected="activeTab === tab.key"
            @click="activeTab = tab.key"
          >
            {{ t(tab.label) }}
          </button>
        </div>

        <!-- Tab 1：成員與權限（真實 Better Auth 資料；僅 super-admin 可列／改角色） -->
        <section v-show="activeTab === 'members'" class="space-y-vt-6">
          <p v-if="!isSuperAdmin" class="rounded-vt-md border border-vt-border bg-vt-bg-1 p-vt-4 text-vt-sm text-vt-fg-2">
            {{ t('admin.members.needSuperAdmin') }}
          </p>

          <template v-else>
            <SearchInput v-model="memberQuery" :placeholder="t('admin.search.placeholder.members')" :label="t('admin.search.label')" :clear-label="t('admin.search.clear')" />

            <div class="admin-card">
              <div class="mb-vt-4 flex flex-wrap items-center justify-between gap-vt-2">
                <h2 class="text-vt-xl font-semibold text-vt-fg-1">{{ t('admin.members.listTitle') }}</h2>
                <span class="text-vt-sm text-vt-fg-3">
                  {{ memberQuery.trim() ? t('admin.members.countFiltered', { n: filteredMembers.length, total: members.length }) : t('admin.members.count', { n: members.length }) }}
                </span>
              </div>

              <p v-if="membersLoading" class="py-vt-6 text-center text-vt-sm text-vt-fg-3">{{ t('admin.members.loading') }}</p>
              <p v-else-if="membersError" class="py-vt-6 text-center text-vt-sm text-vt-democratic-red">{{ membersError }}</p>
              <p v-else-if="filteredMembers.length === 0" class="py-vt-6 text-center text-vt-sm text-vt-fg-3">
                {{ memberQuery.trim() ? t('admin.search.empty', { q: memberQuery.trim() }) : t('admin.members.empty') }}
              </p>
              <div v-else class="overflow-x-auto">
                <table class="w-full text-left text-vt-sm">
                  <thead>
                    <tr class="border-b border-vt-border text-vt-fg-3">
                      <th class="px-vt-3 py-vt-2 font-medium">{{ t('admin.members.col.name') }}</th>
                      <th class="hidden px-vt-3 py-vt-2 font-medium md:table-cell">{{ t('admin.members.col.email') }}</th>
                      <th class="px-vt-3 py-vt-2 font-medium">{{ t('admin.members.col.role') }}</th>
                      <th class="px-vt-3 py-vt-2 font-medium">{{ t('admin.members.col.joinedAt') }}</th>
                      <th class="px-vt-3 py-vt-2 font-medium">{{ t('admin.members.col.status') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="m in filteredMembers" :key="m.id" class="border-b border-vt-border/60">
                      <td class="px-vt-3 py-vt-3 font-medium text-vt-fg-1">
                        <button type="button" class="admin-member-link" :aria-label="t('admin.members.showDetails', { name: m.name })" @click="showMember(m)">
                          {{ m.name }}
                        </button>
                      </td>
                      <td class="hidden px-vt-3 py-vt-3 text-vt-fg-2 md:table-cell">{{ m.email }}</td>
                      <td class="px-vt-3 py-vt-3">
                        <select
                          :value="m.role"
                          :disabled="!canManageRole(m) || updatingRoleId === m.id"
                          class="rounded-md border border-vt-border bg-vt-bg-1 px-vt-2 py-vt-1 text-vt-sm text-vt-fg-1 disabled:cursor-not-allowed disabled:opacity-60"
                          @change="onRoleChange(m, $event)"
                        >
                          <option v-for="r in availableRolesFor(m)" :key="r" :value="r">{{ t(roleLabelKey(r)) }}</option>
                        </select>
                      </td>
                      <td class="px-vt-3 py-vt-3 text-vt-fg-2">{{ m.joinedAt }}</td>
                      <td class="px-vt-3 py-vt-3">
                        <span class="rounded-full px-vt-2 py-vt-0_5 text-vt-xs font-medium" :class="statusClass(m.status)">
                          {{ t('admin.status.' + m.status) }}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <!-- 權限矩陣：依角色唯讀展示（對齊 authorization.ts）；改角色即改權限 -->
            <div class="admin-card">
              <h2 class="mb-vt-1 text-vt-xl font-semibold text-vt-fg-1">{{ t('admin.perms.title') }}</h2>
              <p class="mb-vt-4 text-vt-sm text-vt-fg-3">{{ t('admin.perms.hint') }}</p>
              <p v-if="membersLoading" class="py-vt-6 text-center text-vt-sm text-vt-fg-3">{{ t('admin.members.loading') }}</p>
              <p v-else-if="filteredMembers.length === 0" class="py-vt-6 text-center text-vt-sm text-vt-fg-3">
                {{ memberQuery.trim() ? t('admin.search.empty', { q: memberQuery.trim() }) : t('admin.members.empty') }}
              </p>
              <div v-else class="overflow-x-auto">
                <table class="w-full text-left text-vt-sm">
                  <thead>
                    <tr class="border-b border-vt-border text-vt-fg-3">
                      <th class="px-vt-3 py-vt-2 font-medium">{{ t('admin.perms.col.member') }}</th>
                      <th v-for="p in permKeys" :key="p" class="px-vt-3 py-vt-2 text-center font-medium">
                        {{ t('admin.perms.' + p) }}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="m in filteredMembers" :key="m.id" class="border-b border-vt-border/60">
                      <td class="px-vt-3 py-vt-3 font-medium text-vt-fg-1">
                        <button type="button" class="admin-member-link" :aria-label="t('admin.members.showDetails', { name: m.name })" @click="showMember(m)">
                          {{ m.name }}
                        </button>
                      </td>
                      <td v-for="p in permKeys" :key="p" class="px-vt-3 py-vt-3 text-center">
                        <input type="checkbox" class="admin-checkbox" :checked="roleHasPermission(m.role, p)" :aria-label="t('admin.perms.' + p) + ' — ' + m.name" disabled />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </template>
        </section>

        <!-- Tab 2：變更日誌（真實事件：角色／停權變更 + 逐字稿與大綱異動） -->
        <section v-show="activeTab === 'logs'">
          <p v-if="!isSuperAdmin" class="rounded-vt-md border border-vt-border bg-vt-bg-1 p-vt-4 text-vt-sm text-vt-fg-2">
            {{ t('admin.logs.needSuperAdmin') }}
          </p>

          <div v-else class="admin-card">
            <div class="mb-vt-1 flex flex-wrap items-center justify-between gap-vt-2">
              <h2 class="text-vt-xl font-semibold text-vt-fg-1">{{ t('admin.logs.title') }}</h2>
              <button type="button" class="admin-btn-ghost" :disabled="logsLoading" @click="loadLogs">{{ t('admin.logs.refresh') }}</button>
            </div>
            <p class="mb-vt-4 text-vt-sm text-vt-fg-3">{{ t('admin.logs.hint', { n: AUDIT_LOG_LIMIT }) }}</p>
            <SearchInput v-model="logQuery" class="mb-vt-4" :placeholder="t('admin.search.placeholder.logs')" :label="t('admin.search.label')" :clear-label="t('admin.search.clear')" />

            <p v-if="logsLoading" class="py-vt-6 text-center text-vt-sm text-vt-fg-3">{{ t('admin.logs.loading') }}</p>
            <p v-else-if="logsError" class="py-vt-6 text-center text-vt-sm text-vt-democratic-red">{{ logsError }}</p>
            <p v-else-if="logs.length === 0" class="py-vt-6 text-center text-vt-sm text-vt-fg-3">{{ t('admin.logs.empty') }}</p>
            <p v-else-if="filteredLogs.length === 0" class="py-vt-6 text-center text-vt-sm text-vt-fg-3">{{ t('admin.search.empty', { q: logQuery.trim() }) }}</p>
            <div v-else class="overflow-x-auto">
              <table class="w-full text-left text-vt-sm">
                <thead>
                  <tr class="border-b border-vt-border text-vt-fg-3">
                    <th class="px-vt-3 py-vt-2 font-medium">{{ t('admin.logs.col.time') }}</th>
                    <th class="px-vt-3 py-vt-2 font-medium">{{ t('admin.logs.col.actor') }}</th>
                    <th class="px-vt-3 py-vt-2 font-medium">{{ t('admin.logs.col.action') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="log in filteredLogs" :key="log.id" class="border-b border-vt-border/60">
                    <td class="px-vt-3 py-vt-3 whitespace-nowrap text-vt-fg-3">{{ formatLogTime(log.createdAt) }}</td>
                    <td class="px-vt-3 py-vt-3 whitespace-nowrap text-vt-fg-2">{{ log.actor.email || log.actor.name }}</td>
                    <td class="px-vt-3 py-vt-3 text-vt-fg-1">{{ describeLog(log) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <!-- Tab 3：逐字稿管理（真實資料，與公開列表頁共用 TranscriptionManager） -->
        <section v-show="activeTab === 'transcripts'">
          <div class="admin-card">
            <h2 class="mb-vt-1 text-vt-xl font-semibold text-vt-fg-1">{{ t('admin.transcripts.title') }}</h2>
            <p class="mb-vt-4 text-vt-sm text-vt-fg-3">{{ t('admin.transcripts.hint') }}</p>
            <TranscriptionManager manage :auth-session="props.authSession" @step-up-required="requireStepUp" />
          </div>
        </section>
      </div>
    </div>

    <div
      v-if="selectedMember"
      class="fixed inset-0 z-[100] flex items-center justify-center bg-vt-black/50 p-vt-4"
      role="dialog"
      aria-modal="true"
      :aria-label="t('admin.members.detailsTitle', { name: selectedMember.name })"
      @click.self="selectedMember = null"
    >
      <div class="w-full max-w-md rounded-vt-lg bg-vt-bg-1 p-vt-6 shadow-vt-lg">
        <div class="mb-vt-4 flex items-center justify-between gap-vt-4">
          <h2 class="text-vt-xl font-semibold text-vt-fg-1">{{ t('admin.members.detailsTitle', { name: selectedMember.name }) }}</h2>
          <button type="button" class="admin-modal-close" :aria-label="t('common.cancel')" @click="selectedMember = null">×</button>
        </div>
        <dl class="space-y-vt-3 text-vt-sm">
          <div>
            <dt class="text-vt-fg-3">{{ t('admin.members.col.name') }}</dt>
            <dd class="font-medium text-vt-fg-1">{{ selectedMember.name }}</dd>
          </div>
          <div>
            <dt class="text-vt-fg-3">{{ t('admin.members.col.email') }}</dt>
            <dd class="text-vt-fg-1">{{ selectedMember.email }}</dd>
          </div>
          <div>
            <dt class="text-vt-fg-3">{{ t('admin.members.col.role') }}</dt>
            <dd class="text-vt-fg-1">{{ t(roleLabelKey(selectedMember.role)) }}</dd>
          </div>
          <div>
            <dt class="text-vt-fg-3">{{ t('admin.members.col.joinedAt') }}</dt>
            <dd class="text-vt-fg-1">{{ selectedMember.joinedAt }}</dd>
          </div>
          <div>
            <dt class="text-vt-fg-3">{{ t('admin.members.col.status') }}</dt>
            <dd class="text-vt-fg-1">{{ t('admin.status.' + selectedMember.status) }}</dd>
          </div>
        </dl>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { authClient } from '../client/authClient'
import { isAdminSession, isSessionNotFreshPayload, isSuperAdminSession, responseRequiresStepUp, type AppRole, type AuthSession, type Permission } from '../client/auth-session'
import { auditActionLabelKey, AUDIT_LOG_LIMIT, type AuditEntry } from '../lib/audit-log'
import SearchInput from '../components/SearchInput.vue'
import StepUpAuth from '../components/StepUpAuth.vue'
import TranscriptionManager from '../components/TranscriptionManager.vue'

const { t } = useI18n()

// tab 1 成員／角色：Better Auth admin API（僅 super-admin）；tab 2 日誌仍為偽資料；tab 3 逐字稿為真實 API。
// authReady：session 是否已載入完成（App.vue 提供）——區分「確認中」與「非管理員」。
const props = withDefaults(
  defineProps<{
    authSession?: AuthSession | null
    authReady?: boolean
  }>(),
  { authSession: null, authReady: false }
)

const isAdmin = computed(() => isAdminSession(props.authSession))
const isSuperAdmin = computed(() => isSuperAdminSession(props.authSession))

// 二次驗證：進入後台本身即為敏感操作，未通過就整頁換成再驗證畫面。
// staleSession 補上「伺服器已判定過期、但 props.authSession 仍是載入當下舊值」的情形。
const staleSession = ref(false)

// 倒數計時：now 於 SSR／首次渲染為 0，掛載後才開始跳動（不得在 SSR 讀時間造成 mismatch）
const now = ref(0)
let ticker: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  now.value = Date.now()
  ticker = setInterval(() => {
    now.value = Date.now()
  }, 1000)
})

onUnmounted(() => {
  if (ticker) clearInterval(ticker)
})

const stepUpExpiresAt = computed(() => props.authSession?.stepUpExpiresAt ?? null)
const stepUpRemainingMs = computed(() => {
  const expiresAt = stepUpExpiresAt.value
  if (expiresAt === null || now.value === 0) return 0
  return Math.max(0, expiresAt - now.value)
})
const stepUpExpired = computed(() => now.value > 0 && stepUpExpiresAt.value !== null && stepUpRemainingMs.value === 0)
const stepUpExpiringSoon = computed(() => stepUpRemainingMs.value > 0 && stepUpRemainingMs.value <= 60_000)
const stepUpRemainingLabel = computed(() => (stepUpRemainingMs.value > 0 ? formatRemaining(stepUpRemainingMs.value) : ''))

// 到期即自動退回二次驗證畫面（顯示層；端點仍各自以 cookie 把關）
const needsStepUp = computed(() => !props.authSession?.fresh || staleSession.value || stepUpExpired.value)

function formatRemaining(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

function requireStepUp() {
  staleSession.value = true
}

// ── 型別 ──────────────────────────────────────────────
type StatusKey = 'active' | 'banned'

interface Member {
  id: string
  name: string
  email: string
  role: AppRole
  joinedAt: string
  status: StatusKey
}

const ALL_ROLES: AppRole[] = ['user', 'admin', 'super-admin']
const permKeys: Permission[] = ['meeting.join', 'meeting.moderate', 'transcription.update', 'topic.manage']

// 與 src/server/lib/authorization.ts 的 permissionsByRole 對齊（顯示用；安全邊界在 Worker）。
const permissionsByRole: Record<AppRole, Permission[]> = {
  user: ['meeting.join'],
  admin: ['meeting.join', 'meeting.moderate', 'transcription.update', 'topic.manage'],
  'super-admin': ['meeting.join', 'meeting.moderate', 'transcription.update', 'topic.manage'],
}

const tabs = [
  { key: 'members', label: 'admin.tabs.members' },
  { key: 'logs', label: 'admin.tabs.logs' },
  { key: 'transcripts', label: 'admin.tabs.transcripts' },
] as const

const activeTab = ref<'members' | 'logs' | 'transcripts'>('members')

// ── 真實成員（SSR／首次 hydration 維持空陣列，掛載後再抓）────────
const members = ref<Member[]>([])
const membersLoading = ref(false)
const membersError = ref<string | null>(null)
const updatingRoleId = ref<string | null>(null)
const selectedMember = ref<Member | null>(null)
const memberQuery = ref('')

// ── 真實變更日誌（#71；SSR／首次 hydration 維持空陣列，切到該分頁才抓）────
const logs = ref<AuditEntry[]>([])
const logsLoading = ref(false)
const logsError = ref<string | null>(null)
const logQuery = ref('')

function matches(query: string, fields: string[]): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return fields.some(field => field.toLowerCase().includes(q))
}

const filteredMembers = computed(() => members.value.filter(m => matches(memberQuery.value, [m.name, m.email, m.role, t(roleLabelKey(m.role)), m.status, t('admin.status.' + m.status), m.joinedAt])))

const filteredLogs = computed(() => logs.value.filter(log => matches(logQuery.value, [formatLogTime(log.createdAt), log.actor.name, log.actor.email, describeLog(log)])))

function roleLabelKey(role: AppRole): string {
  // i18n key 避開連字號（vue-i18n 會把 super-admin 拆成路徑）
  return role === 'super-admin' ? 'admin.roles.superAdmin' : `admin.roles.${role}`
}

function roleHasPermission(role: AppRole, permission: Permission): boolean {
  return permissionsByRole[role].includes(permission)
}

function resolveRole(raw: string | null | undefined): AppRole {
  return raw === 'admin' || raw === 'super-admin' ? raw : 'user'
}

function formatJoinedAt(value: Date | string | null | undefined): string {
  if (value == null) return '—'
  const d = typeof value === 'string' || typeof value === 'number' ? new Date(value) : value
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '—'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function mapUserToMember(user: { id: string; name: string; email: string; role?: string | null; banned?: boolean | null; createdAt?: Date | string | null }): Member {
  return {
    id: user.id,
    name: user.name || user.email,
    email: user.email,
    role: resolveRole(user.role),
    joinedAt: formatJoinedAt(user.createdAt),
    status: user.banned ? 'banned' : 'active',
  }
}

async function loadMembers() {
  // session 不新鮮時 /api/auth/admin/* 會回 403，先別發請求（否則二次驗證畫面後面會留一則錯誤）
  if (typeof window === 'undefined' || !isSuperAdmin.value || needsStepUp.value) return

  membersLoading.value = true
  membersError.value = null
  try {
    const { data, error } = await authClient.admin.listUsers({
      query: {
        limit: 100,
        offset: 0,
        sortBy: 'createdAt',
        sortDirection: 'desc',
      },
    })
    if (error) throw error
    const users = data?.users ?? []
    members.value = users.map(mapUserToMember)
  } catch (error) {
    console.error('Failed to list users:', error)
    membersError.value = t('admin.members.loadFailed')
    members.value = []
  } finally {
    membersLoading.value = false
  }
}

async function loadLogs() {
  // 與成員列表同樣的前提：/api/admin/audit-log 僅 super-admin 且需 session 新鮮
  if (typeof window === 'undefined' || !isSuperAdmin.value || needsStepUp.value) return

  logsLoading.value = true
  logsError.value = null
  try {
    const response = await fetch('/api/admin/audit-log')
    // session 在頁面開著時失效（例如在另一個分頁登出換了 session id），倒數還沒歸零，
    // 但伺服器已回 SESSION_NOT_FRESH——換成二次驗證畫面，不要顯示成一般載入錯誤。
    if (await responseRequiresStepUp(response)) {
      requireStepUp()
      return
    }
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
    const data = (await response.json()) as { entries: AuditEntry[] }
    logs.value = data.entries
  } catch (error) {
    console.error('Failed to load audit log:', error)
    logsError.value = t('admin.logs.loadFailed')
    logs.value = []
  } finally {
    logsLoading.value = false
  }
}

watch(
  () => [props.authReady, isSuperAdmin.value, needsStepUp.value] as const,
  ([ready, superAdmin, stepUp]) => {
    if (ready && superAdmin && !stepUp) void loadMembers()
  },
  { immediate: true }
)

// 日誌在切到該分頁時才抓，並且每次切入都重抓——剛在成員分頁改完角色就切過來，
// 必須看得到那筆紀錄（#71 驗收條件），不能沿用進站時的舊資料。
watch(
  () => [props.authReady, isSuperAdmin.value, needsStepUp.value, activeTab.value] as const,
  ([ready, superAdmin, stepUp, tab]) => {
    if (ready && superAdmin && !stepUp && tab === 'logs') void loadLogs()
  },
  { immediate: true }
)

function superAdminCount(): number {
  return members.value.filter(m => m.role === 'super-admin').length
}

function canManageRole(member: Member): boolean {
  if (!isSuperAdmin.value) return false
  if (member.id === props.authSession?.user.id) return false
  // 最後一位 super-admin 不可被降級（避免鎖死管理能力）
  if (member.role === 'super-admin' && superAdminCount() <= 1) return false
  return true
}

function availableRolesFor(member: Member): AppRole[] {
  if (!canManageRole(member)) return [member.role]
  return ALL_ROLES
}

function showMember(member: Member) {
  selectedMember.value = member
}

async function onRoleChange(m: Member, event: Event) {
  const select = event.target as HTMLSelectElement
  const nextRole = resolveRole(select.value)

  if (!availableRolesFor(m).includes(nextRole) || nextRole === m.role) {
    select.value = m.role
    return
  }

  if (!window.confirm(t('admin.roles.confirm', { member: m.name, role: t(roleLabelKey(nextRole)) }))) {
    select.value = m.role
    return
  }

  updatingRoleId.value = m.id
  try {
    const { error } = await authClient.admin.setRole({
      userId: m.id,
      role: nextRole,
    })
    if (error) throw error
    m.role = nextRole
    if (selectedMember.value?.id === m.id) {
      selectedMember.value = { ...selectedMember.value, role: nextRole }
    }
  } catch (error) {
    console.error('Failed to set role:', error)
    select.value = m.role
    // 變更權限屬敏感操作：session 在頁面開著時過期即回 SESSION_NOT_FRESH（見 api/auth.ts），
    // 換成二次驗證畫面。此處不預先擋——props.authSession 是載入當下的舊值，判不出中途過期。
    if (isSessionNotFreshPayload(error)) {
      requireStepUp()
    } else {
      window.alert(t('admin.members.roleUpdateFailed'))
    }
  } finally {
    updatingRoleId.value = null
  }
}

function statusClass(status: StatusKey): string {
  return status === 'banned' ? 'bg-vt-red-tint text-vt-democratic-red' : 'bg-vt-green-tint text-vt-jade-green'
}

// 時間只在瀏覽器端格式化：now 之外的本地時區資訊不得進入 SSR 輸出（會造成 hydration mismatch），
// 而日誌本身就是掛載後才抓的，SSR 期間不會走到這裡。
function formatLogTime(epochMs: number): string {
  const date = new Date(epochMs)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// target.label 是寫入當下的快照（成員姓名／格式化後的會議日期），直接顯示即可。
// 角色缺值時顯示破折號，不臆測成「一般使用者」。
function describeLog(log: AuditEntry): string {
  return t(auditActionLabelKey(log.action), {
    target: log.target.label,
    from: log.detail.fromRole ? t(roleLabelKey(resolveRole(log.detail.fromRole))) : '—',
    to: log.detail.toRole ? t(roleLabelKey(resolveRole(log.detail.toRole))) : '—',
    version: log.detail.versionId ?? '—',
  })
}
</script>

<style scoped>
.admin-tab {
  padding: var(--spacing-vt-3) var(--spacing-vt-4);
  font-size: var(--text-vt-sm);
  font-weight: 500;
  color: var(--color-vt-fg-3);
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition:
    color 0.15s ease,
    border-color 0.15s ease;
}

.admin-tab:hover {
  color: var(--color-vt-fg-1);
}

.admin-tab--active {
  color: var(--color-vt-democratic-red);
  border-bottom-color: var(--color-vt-democratic-red);
}

.admin-card {
  background-color: var(--color-vt-bg-1);
  border: 1px solid var(--color-vt-border);
  border-radius: var(--radius-vt-lg, 12px);
  padding: var(--spacing-vt-6, 24px);
}

.admin-checkbox {
  width: 18px;
  height: 18px;
  accent-color: var(--color-vt-democratic-red);
  cursor: not-allowed;
}

.admin-member-link {
  font-size: var(--text-vt-base);
  color: var(--color-vt-democratic-red);
  text-decoration: underline;
  text-decoration-color: var(--color-vt-border);
  text-underline-offset: var(--spacing-vt-1);
  cursor: pointer;
}

.admin-member-link:hover {
  color: var(--color-vt-democratic-red);
}

.admin-modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--spacing-vt-8);
  height: var(--spacing-vt-8);
  border-radius: var(--radius-vt-full);
  color: var(--color-vt-fg-2);
  font-size: var(--text-vt-xl);
}

.admin-modal-close:hover {
  background-color: var(--color-vt-bg-2);
}

.admin-btn-ghost {
  padding: var(--spacing-vt-2) var(--spacing-vt-3);
  font-size: var(--text-vt-sm);
  font-weight: 500;
  color: var(--color-vt-democratic-red);
  border: 1px solid var(--color-vt-border);
  border-radius: var(--radius-vt-md, 8px);
  transition: background-color 0.15s ease;
}

.admin-btn-ghost:hover {
  background-color: var(--color-vt-red-tint);
}

.admin-btn-ghost:disabled {
  color: var(--color-vt-fg-3);
  cursor: not-allowed;
  background-color: transparent;
}
</style>
