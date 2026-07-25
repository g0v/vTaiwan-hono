<template>
  <div class="vt-under-navbar min-h-screen bg-vt-bg-2 pt-20">
    <div class="container mx-auto px-vt-4 mt-10">
      <div class="mx-auto max-w-6xl">
        <!-- 頁首 -->
        <header class="mb-vt-6">
          <div class="flex flex-wrap items-center gap-vt-3">
            <h1 class="text-vt-3xl font-bold text-vt-fg-1">{{ t('admin.title') }}</h1>
            <span class="rounded-full bg-vt-yellow-tint px-vt-3 py-vt-1 text-vt-xs font-semibold text-vt-wheat-yellow">
              {{ t('admin.badge') }}
            </span>
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

        <!-- Tab 1：成員與權限 -->
        <section v-show="activeTab === 'members'" class="space-y-vt-6">
          <!-- 功能 1：成員清單 -->
          <div class="admin-card">
            <div class="mb-vt-4 flex flex-wrap items-center justify-between gap-vt-2">
              <h2 class="text-vt-xl font-semibold text-vt-fg-1">{{ t('admin.members.listTitle') }}</h2>
              <span class="text-vt-sm text-vt-fg-3">{{ t('admin.members.count', { n: members.length }) }}</span>
            </div>
            <div class="overflow-x-auto">
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
                  <tr v-for="m in members" :key="m.id" class="border-b border-vt-border/60">
                    <td class="px-vt-3 py-vt-3 font-medium text-vt-fg-1">
                      <button type="button" class="admin-member-link" :aria-label="t('admin.members.showDetails', { name: m.name })" @click="showMember(m)">{{ m.name }}</button>
                    </td>
                    <td class="hidden px-vt-3 py-vt-3 text-vt-fg-2 md:table-cell">{{ m.email }}</td>
                    <td class="px-vt-3 py-vt-3">
                      <select :value="m.role" :disabled="!canManageRole(m)" class="rounded-md border border-vt-border bg-vt-bg-1 px-vt-2 py-vt-1 text-vt-sm text-vt-fg-1" @change="onRoleChange(m, $event)">
                        <option v-for="r in availableRolesFor(m)" :key="r" :value="r">{{ t('admin.roles.' + r) }}</option>
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

          <!-- 功能 2：成員權限管理 -->
          <div class="admin-card">
            <h2 class="mb-vt-1 text-vt-xl font-semibold text-vt-fg-1">{{ t('admin.perms.title') }}</h2>
            <p class="mb-vt-4 text-vt-sm text-vt-fg-3">{{ t('admin.perms.hint') }}</p>
            <div class="overflow-x-auto">
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
                  <tr v-for="m in members" :key="m.id" class="border-b border-vt-border/60">
                    <td class="px-vt-3 py-vt-3 font-medium text-vt-fg-1">
                      <button type="button" class="admin-member-link" :aria-label="t('admin.members.showDetails', { name: m.name })" @click="showMember(m)">{{ m.name }}</button>
                    </td>
                    <td v-for="p in permKeys" :key="p" class="px-vt-3 py-vt-3 text-center">
                      <input type="checkbox" class="admin-checkbox" :checked="rolePermissions[m.role][p]" :aria-label="t('admin.perms.' + p) + ' — ' + m.name" disabled />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <!-- Tab 2：變更日誌 -->
        <section v-show="activeTab === 'logs'">
          <div class="admin-card">
            <div class="mb-vt-4 flex flex-wrap items-center justify-between gap-vt-2">
              <h2 class="text-vt-xl font-semibold text-vt-fg-1">{{ t('admin.logs.title') }}</h2>
              <button type="button" class="admin-btn-ghost" @click="resetData">{{ t('admin.reset') }}</button>
            </div>
            <p v-if="logs.length === 0" class="py-vt-6 text-center text-vt-sm text-vt-fg-3">{{ t('admin.logs.empty') }}</p>
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
                  <tr v-for="log in logs" :key="log.id" class="border-b border-vt-border/60">
                    <td class="px-vt-3 py-vt-3 whitespace-nowrap text-vt-fg-3">{{ log.time }}</td>
                    <td class="px-vt-3 py-vt-3 whitespace-nowrap text-vt-fg-2">
                      <button type="button" class="admin-member-link" :aria-label="t('admin.members.showDetails', { name: actorName(log.actor) })" @click="showActor(log.actor)">{{ actorName(log.actor) }}</button>
                    </td>
                    <td class="px-vt-3 py-vt-3 text-vt-fg-1">{{ describeLog(log) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <!-- Tab 3：逐字稿管理（留白） -->
        <section v-show="activeTab === 'transcripts'">
          <div class="admin-card flex min-h-[16rem] flex-col items-center justify-center text-center">
            <h2 class="mb-vt-2 text-vt-xl font-semibold text-vt-fg-1">{{ t('admin.transcripts.title') }}</h2>
            <p class="max-w-md text-vt-sm text-vt-fg-3">{{ t('admin.transcripts.placeholder') }}</p>
          </div>
        </section>
      </div>
    </div>

    <div v-if="selectedMember" class="fixed inset-0 z-[100] flex items-center justify-center bg-vt-black/50 p-vt-4" role="dialog" aria-modal="true" :aria-label="t('admin.members.detailsTitle', { name: selectedMember.name })" @click.self="selectedMember = null">
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
            <dd class="text-vt-fg-1">{{ t('admin.roles.' + selectedMember.role) }}</dd>
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
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

// ── 型別 ──────────────────────────────────────────────
type RoleKey = 'superAdmin' | 'admin' | 'editor' | 'member'
type StatusKey = 'active' | 'invited' | 'suspended'
type PermKey = 'manageRoles' | 'uploadTranscripts' | 'updateTranscripts' | 'updateOutline' | 'viewLogs'

interface Member {
  id: string
  name: string
  email: string
  role: RoleKey
  joinedAt: string
  status: StatusKey
}

// 變更日誌以結構化資料儲存，顯示時再依當前語系翻譯（不寫死句子）
interface LogEntry {
  id: string
  time: string
  actor: string
  type: 'role' | 'member'
  member: string
  role?: RoleKey
}

const roleKeys: RoleKey[] = ['superAdmin', 'admin', 'editor', 'member']
const permKeys: PermKey[] = ['manageRoles', 'uploadTranscripts', 'updateTranscripts', 'updateOutline', 'viewLogs']
const rolePermissions: Record<RoleKey, Record<PermKey, boolean>> = {
  superAdmin: { manageRoles: true, uploadTranscripts: true, updateTranscripts: true, updateOutline: true, viewLogs: true },
  admin: { manageRoles: true, uploadTranscripts: true, updateTranscripts: true, updateOutline: true, viewLogs: true },
  editor: { manageRoles: false, uploadTranscripts: true, updateTranscripts: false, updateOutline: false, viewLogs: true },
  member: { manageRoles: false, uploadTranscripts: false, updateTranscripts: false, updateOutline: false, viewLogs: false },
}

const tabs = [
  { key: 'members', label: 'admin.tabs.members' },
  { key: 'logs', label: 'admin.tabs.logs' },
  { key: 'transcripts', label: 'admin.tabs.transcripts' },
] as const

const activeTab = ref<'members' | 'logs' | 'transcripts'>('members')

// ── 偽資料 seed（必須完全靜態，SSR 與首次 client render 一致，避免 hydration mismatch）──
// 角色矩陣已變更，使用新版本避免舊版 admin/editor 資料套到錯誤層級。
const STORAGE_KEY = 'vtaiwan_admin_v2'
const CURRENT_ACTOR = 'admin@example.com'
// TODO(MVP): 一般成員登入時改顯示權限不足，並禁止進入管理員介面。

function seedMembers(): Member[] {
  return [
    { id: 'u1', name: '管擬園', email: 'admin@example.com', role: 'superAdmin', joinedAt: '2024-01-15', status: 'active' },
    { id: 'u2', name: '陳小明', email: 'ming@example.com', role: 'admin', joinedAt: '2024-03-02', status: 'active' },
    { id: 'u3', name: '林美玲', email: 'meiling@example.com', role: 'editor', joinedAt: '2024-05-20', status: 'active' },
    { id: 'u4', name: '王大衛', email: 'david@example.com', role: 'member', joinedAt: '2024-08-11', status: 'invited' },
    { id: 'u5', name: '張雅婷', email: 'yating@example.com', role: 'member', joinedAt: '2023-11-30', status: 'suspended' },
  ]
}

function seedLogs(): LogEntry[] {
  return [
    { id: 'l1', time: '2024-08-11 09:20', actor: CURRENT_ACTOR, type: 'member', member: '王大衛' },
    { id: 'l2', time: '2024-06-01 14:05', actor: CURRENT_ACTOR, type: 'role', member: '林美玲', role: 'editor' },
  ]
}

const members = ref<Member[]>(seedMembers())
const logs = ref<LogEntry[]>(seedLogs())
const selectedMember = ref<Member | null>(null)

// ── localStorage 同步（僅瀏覽器端；SSR 期間不執行）──────────
function persist() {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ members: members.value, logs: logs.value }))
  } catch {
    // localStorage 不可用時忽略（樣稿不阻斷）
  }
}

function load() {
  if (typeof window === 'undefined') return
  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) {
    persist()
    return
  }
  try {
    const parsed = JSON.parse(stored) as { members?: Member[]; logs?: LogEntry[] }
    if (parsed.members) {
      members.value = parsed.members.map((member) => {
        const storedRole = member.role as string
        return {
          ...member,
          role: roleKeys.includes(storedRole as RoleKey) ? (storedRole as RoleKey) : 'member',
        }
      })
    }
    if (parsed.logs) logs.value = parsed.logs.filter((log) => log.type === 'role' || log.type === 'member')
    persist()
  } catch {
    // 解析失敗：重置為 seed 並覆寫，避免對著壞資料渲染
    members.value = seedMembers()
    logs.value = seedLogs()
    persist()
  }
}

onMounted(load)

// ── 互動：以 localStorage 同步摹擬變更，並自動寫入變更日誌 ──
function nowStamp(): string {
  // 事件處理器只在瀏覽器端執行，可安全使用 Date
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function nextId(): string {
  return 'l' + (logs.value.length + 1) + '-' + nowStamp().replace(/\D/g, '')
}

function addLog(entry: Omit<LogEntry, 'id' | 'time' | 'actor'>) {
  logs.value.unshift({ id: nextId(), time: nowStamp(), actor: CURRENT_ACTOR, ...entry })
}

function currentActorRole(): RoleKey {
  return members.value.find((member) => member.email === CURRENT_ACTOR)?.role ?? 'member'
}

function canManageRole(member: Member): boolean {
  const actorRole = currentActorRole()
  if (member.role === 'superAdmin') return false
  if (actorRole === 'superAdmin') return true
  return actorRole === 'admin' && member.id !== 'u1' && member.role !== 'admin'
}

function availableRolesFor(member: Member): RoleKey[] {
  if (!canManageRole(member)) return [member.role]
  return currentActorRole() === 'superAdmin' ? ['admin', 'editor', 'member'] : ['editor', 'member']
}

function showMember(member: Member) {
  selectedMember.value = member
}

function actorMember(actor: string): Member | undefined {
  return members.value.find((member) => member.id === actor || member.email === actor)
}

function actorName(actor: string): string {
  return actorMember(actor)?.name ?? actor
}

function showActor(actor: string) {
  const member = actorMember(actor)
  if (member) showMember(member)
}

function onRoleChange(m: Member, event: Event) {
  const select = event.target as HTMLSelectElement
  const nextRole = select.value as RoleKey

  if (!availableRolesFor(m).includes(nextRole)) {
    select.value = m.role
    return
  }

  if (!window.confirm(t('admin.roles.confirm', { member: m.name, role: t('admin.roles.' + nextRole) }))) {
    select.value = m.role
    return
  }

  m.role = nextRole
  addLog({ type: 'role', member: m.name, role: nextRole })
  persist()
}

function resetData() {
  members.value = seedMembers()
  logs.value = seedLogs()
  persist()
}

// ── 顯示輔助 ───────────────────────────────────────────
function statusClass(status: StatusKey): string {
  switch (status) {
    case 'active':
      return 'bg-vt-green-tint text-vt-jade-green'
    case 'invited':
      return 'bg-vt-yellow-tint text-vt-wheat-yellow'
    case 'suspended':
      return 'bg-vt-red-tint text-vt-democratic-red'
  }
}

function describeLog(log: LogEntry): string {
  if (log.type === 'role') {
    return t('admin.logs.role.changed', { member: log.member, role: t('admin.roles.' + (log.role ?? 'member')) })
  }
  return t('admin.logs.member.added', { member: log.member })
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
  width: var(--spacing-vt-9);
  height: var(--spacing-vt-9);
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
</style>
