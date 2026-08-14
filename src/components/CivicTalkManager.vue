<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RefreshCw } from 'lucide-vue-next'
import { type AuthSession, responseRequiresStepUp } from '../client/auth-session'

type IssueStatus = 'collecting' | 'summarizing' | 'published'
type ManagerSection = 'issues' | 'materials' | 'opinions' | 'events' | 'reports'
type CreationEventType = 'material' | 'briefing' | 'opinion'
type AbuseReportReason = 'spam' | 'hate_speech' | 'defamation' | 'misinformation' | 'other'
type AbuseReportStatus = 'pending' | 'resolved_false' | 'resolved_abuse'

interface Issue {
  id: number
  title: string
  description: string | null
  status: IssueStatus
  polis_id: string | null
  created_at: string
  material_count: number
  opinion_count: number
  author_name: string | null
}

interface Material {
  id: number
  source_name: string | null
  source_url: string | null
  stance: 'pro' | 'con' | 'neutral' | 'unknown'
  content: string
  verified_count: number
  created_at: string
  author_name: string | null
}

interface Opinion {
  id: number
  summary: string
  created_at: string
  author_name: string | null
}

interface CreationEvent {
  id: number
  type: CreationEventType
  issueId: number
  issueTitle: string
  authorName: string | null
  createdAt: string
  material: { sourceName: string | null; sourceUrl: string | null; stance: Material['stance']; content: string; verifiedCount: number } | null
  briefing: { consensus: string | null; disputes: string | null; positions: string | null; narrative: string | null; opinionPrompt: string | null; version: number } | null
  opinion: { summary: string } | null
}

interface AbuseReport {
  id: number
  reporter_id: string
  reporter_name: string | null
  reporter_email: string
  reason: AbuseReportReason
  description: string | null
  material_id: number | null
  briefing_id: number | null
  opinion_id: number | null
  review_status: AbuseReportStatus
  created_at: string
  target_issue_id: number | null
  target_author_id: string | null
}

const props = defineProps<{ authSession?: AuthSession | null }>()

const emit = defineEmits<{ 'step-up-required': [] }>()
const { t } = useI18n()

const activeSection = ref<ManagerSection>('reports')
const issues = ref<Issue[]>([])
const issueSearchQuery = ref('')
const materials = ref<Material[]>([])
const opinions = ref<Opinion[]>([])
const creationEvents = ref<CreationEvent[]>([])
const materialIssueId = ref<number | null>(null)
const opinionIssueId = ref<number | null>(null)
const eventPage = ref(1)
const eventTotalPages = ref(0)
const issuesLoading = ref(false)
const detailsLoading = ref(false)
const eventsLoading = ref(false)
const abuseReports = ref<AbuseReport[]>([])
const reportsLoading = ref(false)
const error = ref<string | null>(null)
const previewEvent = ref<CreationEvent | null>(null)
const formOpen = ref(false)
const editingIssueId = ref<number | null>(null)
const submitting = ref(false)
const formError = ref<string | null>(null)
const formTitle = ref('')
const formDescription = ref('')
const formStatus = ref<IssueStatus>('collecting')
const formPolisEnabled = ref(false)

const issueCount = computed(() => issues.value.length)
const filteredIssues = computed(() => {
  const searchQuery = issueSearchQuery.value.trim().toLocaleLowerCase()
  if (!searchQuery) return issues.value

  return issues.value.filter(issue => issue.title.toLocaleLowerCase().includes(searchQuery))
})
const materialCount = computed(() => issues.value.reduce((total, issue) => total + issue.material_count, 0))
const opinionCount = computed(() => issues.value.reduce((total, issue) => total + issue.opinion_count, 0))
const selectedMaterialIssue = computed(() => issues.value.find(issue => issue.id === materialIssueId.value) ?? null)
const selectedOpinionIssue = computed(() => issues.value.find(issue => issue.id === opinionIssueId.value) ?? null)
const activeLoading = computed(() => {
  if (activeSection.value === 'issues') return issuesLoading.value
  if (activeSection.value === 'events') return eventsLoading.value
  if (activeSection.value === 'reports') return reportsLoading.value
  return detailsLoading.value
})

async function requestJson<T>(path: string, init?: RequestInit): Promise<T | null> {
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (await responseRequiresStepUp(response)) {
    emit('step-up-required')
    return null
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return (await response.json()) as T
}

async function loadIssues() {
  issuesLoading.value = true
  error.value = null
  try {
    const data = await requestJson<{ issues: Issue[] }>('/api/admin/civic-talks/issues')
    if (data) issues.value = data.issues
  } catch (loadError) {
    console.error('Failed to load civic talk issues:', loadError)
    error.value = t('admin.civicTalk.loadFailed')
    issues.value = []
  } finally {
    issuesLoading.value = false
  }
}

async function loadMaterials() {
  if (!materialIssueId.value) {
    materials.value = []
    return
  }
  detailsLoading.value = true
  error.value = null
  try {
    const data = await requestJson<{ materials: Material[] }>(`/api/admin/civic-talks/issues/${materialIssueId.value}/materials`)
    if (data) materials.value = data.materials
  } catch (loadError) {
    console.error('Failed to load civic talk materials:', loadError)
    error.value = t('admin.civicTalk.loadFailed')
    materials.value = []
  } finally {
    detailsLoading.value = false
  }
}

async function loadOpinions() {
  if (!opinionIssueId.value) {
    opinions.value = []
    return
  }
  detailsLoading.value = true
  error.value = null
  try {
    const data = await requestJson<{ opinions: Opinion[] }>(`/api/admin/civic-talks/issues/${opinionIssueId.value}/opinions`)
    if (data) opinions.value = data.opinions
  } catch (loadError) {
    console.error('Failed to load civic talk opinions:', loadError)
    error.value = t('admin.civicTalk.loadFailed')
    opinions.value = []
  } finally {
    detailsLoading.value = false
  }
}

async function loadCreationEvents() {
  eventsLoading.value = true
  error.value = null
  try {
    const data = await requestJson<{ events: CreationEvent[]; page: number; totalPages: number }>(`/api/admin/civic-talks/events?page=${eventPage.value}`)
    if (!data) return
    creationEvents.value = data.events
    eventPage.value = data.page
    eventTotalPages.value = data.totalPages
  } catch (loadError) {
    console.error('Failed to load civic talk creation events:', loadError)
    error.value = t('admin.civicTalk.events.loadFailed')
    creationEvents.value = []
    eventTotalPages.value = 0
  } finally {
    eventsLoading.value = false
  }
}

const REASON_I18N: Record<string, string> = {
  spam: 'admin.civicTalk.admin.rptReasonSpam',
  hate_speech: 'admin.civicTalk.admin.rptReasonHate',
  defamation: 'admin.civicTalk.admin.rptReasonDefame',
  misinformation: 'admin.civicTalk.admin.rptReasonMisinfo',
  other: 'admin.civicTalk.admin.rptReasonOther',
}

async function loadAbuseReports() {
  reportsLoading.value = true
  error.value = null
  try {
    const data = await requestJson<{ reports: AbuseReport[] }>('/api/admin/civic-talks/abuse-reports')
    if (data) abuseReports.value = data.reports
  } catch (loadError) {
    console.error('Failed to load civic talk abuse reports:', loadError)
    error.value = t('admin.civicTalk.loadFailed')
    abuseReports.value = []
  } finally {
    reportsLoading.value = false
  }
}

async function resolveReport(id: number, action: 'false_report' | 'confirmed_abuse') {
  const confirmKey = action === 'false_report' ? 'admin.civicTalk.admin.rptConfirmFalse' : 'admin.civicTalk.admin.rptConfirmAbuse'
  if (!window.confirm(t(confirmKey))) return
  try {
    const data = await requestJson<{ ok: boolean }>(`/api/admin/civic-talks/abuse-reports/${id}/resolve`, {
      method: 'PATCH',
      body: JSON.stringify({ action }),
    })
    if (!data) return
    await loadAbuseReports()
  } catch (resolveError) {
    console.error('Failed to resolve abuse report:', resolveError)
    error.value = t('admin.civicTalk.admin.rptToastFail')
  }
}

function openEditIssue(issue: Issue) {
  editingIssueId.value = issue.id
  formTitle.value = issue.title
  formDescription.value = issue.description ?? ''
  formStatus.value = issue.status
  formPolisEnabled.value = issue.polis_id !== null
  formError.value = null
  formOpen.value = true
}

function closeForm() {
  formOpen.value = false
  editingIssueId.value = null
  formError.value = null
}

function issuePayload() {
  return {
    title: formTitle.value,
    description: formDescription.value,
    status: formStatus.value,
    polisEnabled: formPolisEnabled.value,
  }
}

async function saveIssue() {
  if (!formTitle.value.trim()) {
    formError.value = t('admin.civicTalk.issue.titleRequired')
    return
  }
  const issueId = editingIssueId.value
  if (issueId === null) return
  submitting.value = true
  formError.value = null
  try {
    const data = await requestJson<{ ok: boolean }>(`/api/admin/civic-talks/issues/${issueId}`, {
      method: 'PUT',
      body: JSON.stringify(issuePayload()),
    })
    if (!data) return
    closeForm()
    await loadIssues()
  } catch (saveError) {
    console.error('Failed to save civic talk issue:', saveError)
    formError.value = t('admin.civicTalk.saveFailed')
  } finally {
    submitting.value = false
  }
}

async function deleteIssue(issue: Issue) {
  if (!window.confirm(t('admin.civicTalk.issue.confirmDelete', { title: issue.title }))) return
  try {
    const data = await requestJson<{ ok: boolean }>(`/api/admin/civic-talks/issues/${issue.id}`, { method: 'DELETE' })
    if (!data) return
    if (materialIssueId.value === issue.id) materialIssueId.value = null
    if (opinionIssueId.value === issue.id) opinionIssueId.value = null
    await loadIssues()
  } catch (deleteError) {
    console.error('Failed to delete civic talk issue:', deleteError)
    error.value = t('admin.civicTalk.saveFailed')
  }
}

async function deleteMaterial(material: Material) {
  if (!window.confirm(t('admin.civicTalk.material.confirmDelete'))) return
  try {
    const data = await requestJson<{ ok: boolean }>(`/api/admin/civic-talks/materials/${material.id}`, { method: 'DELETE' })
    if (!data) return
    await Promise.all([loadMaterials(), loadIssues()])
  } catch (deleteError) {
    console.error('Failed to delete civic talk material:', deleteError)
    error.value = t('admin.civicTalk.saveFailed')
  }
}

async function deleteOpinion(opinion: Opinion) {
  if (!window.confirm(t('admin.civicTalk.opinion.confirmDelete'))) return
  try {
    const data = await requestJson<{ ok: boolean }>(`/api/admin/civic-talks/opinions/${opinion.id}`, { method: 'DELETE' })
    if (!data) return
    await Promise.all([loadOpinions(), loadIssues()])
  } catch (deleteError) {
    console.error('Failed to delete civic talk opinion:', deleteError)
    error.value = t('admin.civicTalk.saveFailed')
  }
}

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const pad = (number: number) => String(number).padStart(2, '0')
  return `${formatDate(value)} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function showIssueMaterials(issueId: number) {
  activeSection.value = 'materials'
  materialIssueId.value = issueId
}

function showIssueOpinions(issueId: number) {
  activeSection.value = 'opinions'
  opinionIssueId.value = issueId
}

function returnToIssues() {
  activeSection.value = 'issues'
}

function showCreationEvents() {
  eventPage.value = 1
  if (activeSection.value === 'events') {
    void loadCreationEvents()
    return
  }
  activeSection.value = 'events'
}

function showReports() {
  if (activeSection.value === 'reports') {
    void loadAbuseReports()
    return
  }
  activeSection.value = 'reports'
}

function refreshActiveSection() {
  if (activeSection.value === 'issues') return void loadIssues()
  if (activeSection.value === 'materials') return void loadMaterials()
  if (activeSection.value === 'opinions') return void loadOpinions()
  if (activeSection.value === 'reports') return void loadAbuseReports()
  return void loadCreationEvents()
}

function previewTitle(event: CreationEvent): string {
  return t(`admin.civicTalk.events.type.${event.type}`)
}

function previewEventRecord(event: CreationEvent) {
  previewEvent.value = event
}

function closePreview() {
  previewEvent.value = null
}

function previousEventPage() {
  if (eventPage.value > 1) eventPage.value -= 1
}

function nextEventPage() {
  if (eventPage.value < eventTotalPages.value) eventPage.value += 1
}

watch(materialIssueId, () => {
  if (activeSection.value === 'materials') void loadMaterials()
})

watch(opinionIssueId, () => {
  if (activeSection.value === 'opinions') void loadOpinions()
})

watch(eventPage, () => {
  if (activeSection.value === 'events') void loadCreationEvents()
})

watch(activeSection, section => {
  if (section === 'materials') void loadMaterials()
  if (section === 'opinions') void loadOpinions()
  if (section === 'events') void loadCreationEvents()
  if (section === 'reports' && abuseReports.value.length === 0) void loadAbuseReports()
})

onMounted(() => {
  void loadAbuseReports()
  void loadIssues()
})
</script>

<template>
  <section class="space-y-vt-6">
    <header class="civic-header">
      <div>
        <h2 class="text-vt-xl font-semibold text-vt-fg-1">{{ t('admin.civicTalk.title') }}</h2>
        <p class="mt-vt-1 text-vt-sm text-vt-fg-3">{{ t('admin.civicTalk.hint') }}</p>
      </div>
      <div class="civic-header__actions">
        <nav class="civic-tabs" role="tablist" :aria-label="t('admin.civicTalk.tabs.ariaLabel')">
          <button type="button" role="tab" class="civic-tab" :class="{ 'civic-tab--active': activeSection === 'reports' }" :aria-selected="activeSection === 'reports'" @click="showReports">
            {{ t('admin.civicTalk.tabs.reports') }}
          </button>
          <button
            type="button"
            role="tab"
            class="civic-tab"
            :class="{ 'civic-tab--active': activeSection === 'issues' || activeSection === 'materials' || activeSection === 'opinions' }"
            :aria-selected="activeSection === 'issues' || activeSection === 'materials' || activeSection === 'opinions'"
            @click="returnToIssues"
          >
            {{ t('admin.civicTalk.tabs.agenda') }}
          </button>
          <button type="button" role="tab" class="civic-tab" :class="{ 'civic-tab--active': activeSection === 'events' }" :aria-selected="activeSection === 'events'" @click="showCreationEvents">
            {{ t('admin.civicTalk.tabs.events') }}
          </button>
        </nav>
        <button
          type="button"
          class="civic-button civic-icon-button"
          :aria-label="t('admin.civicTalk.refresh')"
          :title="t('admin.civicTalk.refresh')"
          :disabled="activeLoading"
          @click="refreshActiveSection"
        >
          <RefreshCw aria-hidden="true" />
        </button>
      </div>
    </header>

    <div class="civic-stats" :aria-label="t('admin.civicTalk.stats.ariaLabel')">
      <div class="civic-stat">
        <span class="civic-stat__value">{{ issueCount }}</span>
        <span class="civic-stat__label">{{ t('admin.civicTalk.stats.issues') }}</span>
      </div>
      <div class="civic-stat">
        <span class="civic-stat__value">{{ materialCount }}</span>
        <span class="civic-stat__label">{{ t('admin.civicTalk.stats.materials') }}</span>
      </div>
      <div class="civic-stat">
        <span class="civic-stat__value">{{ opinionCount }}</span>
        <span class="civic-stat__label">{{ t('admin.civicTalk.stats.opinions') }}</span>
      </div>
    </div>

    <p v-if="error" class="civic-notice civic-notice--error" role="alert">{{ error }}</p>

    <section v-show="activeSection === 'issues'" class="civic-card">
      <div class="civic-section-heading">
        <div>
          <h3 class="text-vt-lg font-semibold text-vt-fg-1">{{ t('admin.civicTalk.issue.title') }}</h3>
          <p class="mt-vt-1 text-vt-sm text-vt-fg-3">{{ t('admin.civicTalk.issue.hint') }}</p>
        </div>
      </div>
      <label class="civic-search">
        <span>{{ t('admin.civicTalk.issue.search.label') }}</span>
        <input v-model="issueSearchQuery" type="search" :placeholder="t('admin.civicTalk.issue.search.placeholder')" autocomplete="off" />
      </label>

      <p v-if="issuesLoading" class="civic-empty">{{ t('admin.civicTalk.loading') }}</p>
      <p v-else-if="issues.length === 0" class="civic-empty">{{ t('admin.civicTalk.issue.empty') }}</p>
      <p v-else-if="filteredIssues.length === 0" class="civic-empty">{{ t('admin.civicTalk.issue.search.empty') }}</p>
      <div v-else class="civic-table-wrap">
        <table class="civic-table min-w-3xl">
          <thead>
            <tr>
              <th>{{ t('admin.civicTalk.columns.title') }}</th>
              <th>{{ t('admin.civicTalk.columns.status') }}</th>
              <th>{{ t('admin.civicTalk.columns.materials') }}</th>
              <th>{{ t('admin.civicTalk.columns.opinions') }}</th>
              <th>{{ t('admin.civicTalk.columns.author') }}</th>
              <th>{{ t('admin.civicTalk.columns.createdAt') }}</th>
              <th>{{ t('admin.civicTalk.columns.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="issue in filteredIssues" :key="issue.id">
              <td :data-label="t('admin.civicTalk.columns.title')">
                <a :href="`https://civic.vtaiwan.tw/issues/${issue.id}`" target="_blank" rel="noopener noreferrer" class="civic-issue-link font-medium">{{ issue.title }}</a>
              </td>
              <td :data-label="t('admin.civicTalk.columns.status')">
                <span class="civic-status">{{ t(`admin.civicTalk.status.${issue.status}`) }}</span>
              </td>
              <td :data-label="t('admin.civicTalk.columns.materials')">
                <button type="button" class="civic-detail-button" :aria-label="t('admin.civicTalk.columns.materials')" :disabled="issue.material_count === 0" @click="showIssueMaterials(issue.id)">
                  {{ issue.material_count }}
                </button>
              </td>
              <td :data-label="t('admin.civicTalk.columns.opinions')">
                <button type="button" class="civic-detail-button" :aria-label="t('admin.civicTalk.columns.opinions')" :disabled="issue.opinion_count === 0" @click="showIssueOpinions(issue.id)">
                  {{ issue.opinion_count }}
                </button>
              </td>
              <td :data-label="t('admin.civicTalk.columns.author')">{{ issue.author_name || t('admin.civicTalk.unknownAuthor') }}</td>
              <td :data-label="t('admin.civicTalk.columns.createdAt')">{{ formatDate(issue.created_at) }}</td>
              <td :data-label="t('admin.civicTalk.columns.actions')">
                <div class="civic-actions">
                  <button type="button" class="civic-link" @click="openEditIssue(issue)">{{ t('admin.civicTalk.edit') }}</button>
                  <button type="button" class="civic-link" :disabled="issue.material_count === 0" @click="showIssueMaterials(issue.id)">{{ t('admin.civicTalk.manageMaterials') }}</button>
                  <button type="button" class="civic-link" :disabled="issue.opinion_count === 0" @click="showIssueOpinions(issue.id)">{{ t('admin.civicTalk.manageOpinions') }}</button>
                  <button type="button" class="civic-link civic-link--danger" @click="deleteIssue(issue)">{{ t('admin.civicTalk.delete') }}</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-show="activeSection === 'materials'" class="civic-card">
      <div class="civic-section-heading">
        <div>
          <h3 class="text-vt-lg font-semibold text-vt-fg-1">{{ t('admin.civicTalk.material.title') }}</h3>
          <p class="mt-vt-1 text-vt-sm text-vt-fg-3">{{ t('admin.civicTalk.material.hint') }}</p>
        </div>
        <button type="button" class="civic-button" @click="returnToIssues">{{ t('admin.civicTalk.backToIssues') }}</button>
      </div>
      <p v-if="selectedMaterialIssue" class="civic-selected-issue">{{ selectedMaterialIssue.title }}</p>
      <p v-if="!materialIssueId" class="civic-empty">{{ t('admin.civicTalk.selectRequired') }}</p>
      <p v-else-if="detailsLoading" class="civic-empty">{{ t('admin.civicTalk.loading') }}</p>
      <p v-else-if="materials.length === 0" class="civic-empty">{{ t('admin.civicTalk.material.empty') }}</p>
      <div v-else class="space-y-vt-3">
        <article v-for="material in materials" :key="material.id" class="civic-entry">
          <div class="civic-entry__heading">
            <div>
              <h4 class="font-medium text-vt-fg-1">{{ material.source_name || t('admin.civicTalk.unknownSource') }}</h4>
              <p class="mt-vt-1 text-vt-sm text-vt-fg-3">{{ t(`admin.civicTalk.stance.${material.stance}`) }} · {{ formatDate(material.created_at) }}</p>
            </div>
            <button type="button" class="civic-link civic-link--danger" @click="deleteMaterial(material)">{{ t('admin.civicTalk.delete') }}</button>
          </div>
          <a v-if="material.source_url" class="civic-source-link" :href="material.source_url" target="_blank" rel="noopener noreferrer">{{ material.source_url }}</a>
          <p class="civic-entry__content">{{ material.content }}</p>
          <p class="mt-vt-3 text-vt-sm text-vt-fg-3">{{ t('admin.civicTalk.author', { name: material.author_name || t('admin.civicTalk.unknownAuthor') }) }}</p>
        </article>
      </div>
    </section>

    <section v-show="activeSection === 'opinions'" class="civic-card">
      <div class="civic-section-heading">
        <div>
          <h3 class="text-vt-lg font-semibold text-vt-fg-1">{{ t('admin.civicTalk.opinion.title') }}</h3>
          <p class="mt-vt-1 text-vt-sm text-vt-fg-3">{{ t('admin.civicTalk.opinion.hint') }}</p>
        </div>
        <button type="button" class="civic-button" @click="returnToIssues">{{ t('admin.civicTalk.backToIssues') }}</button>
      </div>
      <p v-if="selectedOpinionIssue" class="civic-selected-issue">{{ selectedOpinionIssue.title }}</p>
      <p v-if="!opinionIssueId" class="civic-empty">{{ t('admin.civicTalk.selectRequired') }}</p>
      <p v-else-if="detailsLoading" class="civic-empty">{{ t('admin.civicTalk.loading') }}</p>
      <p v-else-if="opinions.length === 0" class="civic-empty">{{ t('admin.civicTalk.opinion.empty') }}</p>
      <div v-else class="space-y-vt-3">
        <article v-for="opinion in opinions" :key="opinion.id" class="civic-entry">
          <div class="civic-entry__heading">
            <p class="text-vt-sm text-vt-fg-3">{{ formatDate(opinion.created_at) }}</p>
            <button type="button" class="civic-link civic-link--danger" @click="deleteOpinion(opinion)">{{ t('admin.civicTalk.delete') }}</button>
          </div>
          <p class="civic-entry__content">{{ opinion.summary }}</p>
          <p class="mt-vt-3 text-vt-sm text-vt-fg-3">{{ t('admin.civicTalk.author', { name: opinion.author_name || t('admin.civicTalk.unknownAuthor') }) }}</p>
        </article>
      </div>
    </section>

    <section v-show="activeSection === 'events'" class="civic-card">
      <div class="civic-section-heading">
        <div>
          <h3 class="text-vt-lg font-semibold text-vt-fg-1">{{ t('admin.civicTalk.events.title') }}</h3>
          <p class="mt-vt-1 text-vt-sm text-vt-fg-3">{{ t('admin.civicTalk.events.hint', { n: 15 }) }}</p>
        </div>
      </div>

      <p v-if="eventsLoading" class="civic-empty">{{ t('admin.civicTalk.loading') }}</p>
      <p v-else-if="creationEvents.length === 0" class="civic-empty">{{ t('admin.civicTalk.events.empty') }}</p>
      <div v-else class="civic-table-wrap">
        <table class="civic-table min-w-3xl">
          <thead>
            <tr>
              <th>{{ t('admin.civicTalk.events.columns.time') }}</th>
              <th>{{ t('admin.civicTalk.events.columns.action') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="event in creationEvents" :key="`${event.type}-${event.id}`">
              <td :data-label="t('admin.civicTalk.events.columns.time')">{{ formatDateTime(event.createdAt) }}</td>
              <td :data-label="t('admin.civicTalk.events.columns.action')" class="civic-event-action">
                <span>{{ t('admin.civicTalk.events.action.on', { actor: event.authorName || t('admin.civicTalk.unknownAuthor') }) }}</span>
                <a :href="`https://civic.vtaiwan.tw/issues/${event.issueId}`" target="_blank" rel="noopener noreferrer" class="civic-issue-link">{{ event.issueTitle }}</a>
                <span>{{ t('admin.civicTalk.events.action.created') }}</span>
                <button type="button" class="civic-event-item" @click="previewEventRecord(event)">{{ previewTitle(event) }}</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <nav v-if="eventTotalPages > 1" class="civic-pagination" :aria-label="t('admin.civicTalk.events.pagination.ariaLabel')">
        <button type="button" class="civic-button" :disabled="eventPage === 1 || eventsLoading" @click="previousEventPage">{{ t('admin.civicTalk.events.pagination.previous') }}</button>
        <span class="text-vt-sm text-vt-fg-3">{{ t('admin.civicTalk.events.pagination.status', { page: eventPage, total: eventTotalPages }) }}</span>
        <button type="button" class="civic-button" :disabled="eventPage === eventTotalPages || eventsLoading" @click="nextEventPage">{{ t('admin.civicTalk.events.pagination.next') }}</button>
      </nav>
    </section>

    <!-- Reports tab -->
    <section v-show="activeSection === 'reports'" class="civic-card">
      <div class="civic-section-heading">
        <div>
          <h3 class="text-vt-lg font-semibold text-vt-fg-1">{{ t('admin.civicTalk.admin.reportsTab') }}</h3>
        </div>
      </div>

      <p v-if="reportsLoading" class="civic-empty">{{ t('admin.civicTalk.loading') }}</p>
      <p v-else-if="abuseReports.length === 0" class="civic-empty">{{ t('admin.civicTalk.admin.reportsEmpty') }}</p>
      <div v-else class="civic-table-wrap">
        <table class="civic-table">
          <thead>
            <tr>
              <th>{{ t('admin.civicTalk.admin.rptThId') }}</th>
              <th>{{ t('admin.civicTalk.admin.rptThReporter') }}</th>
              <th>{{ t('admin.civicTalk.admin.rptThTarget') }}</th>
              <th>{{ t('admin.civicTalk.admin.rptThReason') }}</th>
              <th>{{ t('admin.civicTalk.admin.rptThDesc') }}</th>
              <th>{{ t('admin.civicTalk.admin.rptThStatus') }}</th>
              <th>{{ t('admin.civicTalk.admin.rptThCreated') }}</th>
              <th>{{ t('admin.civicTalk.columns.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in abuseReports" :key="r.id">
              <td :data-label="t('admin.civicTalk.admin.rptThId')">{{ r.id }}</td>
              <td :data-label="t('admin.civicTalk.admin.rptThReporter')">
                <div>{{ r.reporter_name || t('admin.civicTalk.unknownAuthor') }}</div>
                <div class="text-vt-xs text-vt-fg-3">{{ r.reporter_email }}</div>
              </td>
              <td :data-label="t('admin.civicTalk.admin.rptThTarget')">
                <template v-if="r.target_issue_id">
                  <a v-if="r.material_id" :href="`https://civic.vtaiwan.tw/issues/${r.target_issue_id}/source/${r.material_id}`" class="civic-issue-link" target="_blank" rel="noopener">
                    {{ t('admin.civicTalk.admin.rptTargetMaterial') }}{{ r.material_id }}
                  </a>
                  <a v-else-if="r.opinion_id" :href="`https://civic.vtaiwan.tw/issues/${r.target_issue_id}/comment/${r.opinion_id}`" class="civic-issue-link" target="_blank" rel="noopener">
                    {{ t('admin.civicTalk.admin.rptTargetOpinion') }}{{ r.opinion_id }}
                  </a>
                  <a v-else-if="r.briefing_id" :href="`https://civic.vtaiwan.tw/issues/${r.target_issue_id}`" class="civic-issue-link" target="_blank" rel="noopener">
                    {{ t('admin.civicTalk.admin.rptTargetBriefing') }}{{ r.briefing_id }}
                  </a>
                </template>
                <span v-else class="text-vt-xs text-vt-fg-3">{{ t('admin.civicTalk.admin.rptTargetDeleted') }}</span>
              </td>
              <td :data-label="t('admin.civicTalk.admin.rptThReason')">{{ t(REASON_I18N[r.reason] ?? 'admin.civicTalk.admin.rptReasonOther') }}</td>
              <td :data-label="t('admin.civicTalk.admin.rptThDesc')">
                <span v-if="r.description" class="text-vt-xs">{{ r.description }}</span>
                <span v-else class="text-vt-xs text-vt-fg-3">—</span>
              </td>
              <td :data-label="t('admin.civicTalk.admin.rptThStatus')">
                <span
                  class="rpt-status"
                  :class="{
                    'rpt-status--pending': r.review_status === 'pending',
                    'rpt-status--abuse': r.review_status === 'resolved_abuse',
                    'rpt-status--false': r.review_status === 'resolved_false',
                  }"
                >
                  <template v-if="r.review_status === 'pending'">{{ t('admin.civicTalk.admin.rptStatusPending') }}</template>
                  <template v-else-if="r.review_status === 'resolved_false'">{{ t('admin.civicTalk.admin.rptStatusFalse') }}</template>
                  <template v-else>{{ t('admin.civicTalk.admin.rptStatusAbuse') }}</template>
                </span>
              </td>
              <td :data-label="t('admin.civicTalk.admin.rptThCreated')" class="text-vt-xs text-vt-fg-3">{{ formatDate(r.created_at) }}</td>
              <td :data-label="t('admin.civicTalk.columns.actions')">
                <template v-if="r.review_status === 'pending'">
                  <div class="civic-actions civic-actions--col">
                    <button
                      type="button"
                      class="civic-link"
                      :disabled="props.authSession?.role !== 'super-admin' || r.reporter_id === props.authSession?.user?.id"
                      :title="
                        props.authSession?.role !== 'super-admin'
                          ? t('admin.civicTalk.admin.rptNeedSuperAdmin')
                          : r.reporter_id === props.authSession?.user?.id
                            ? t('admin.civicTalk.admin.rptCannotBanSelf')
                            : undefined
                      "
                      @click="resolveReport(r.id, 'false_report')"
                    >
                      {{ t('admin.civicTalk.admin.rptBtnFalse') }}
                    </button>
                    <button
                      type="button"
                      class="civic-link civic-link--danger"
                      :disabled="props.authSession?.role !== 'super-admin' || r.target_author_id === props.authSession?.user?.id"
                      :title="
                        props.authSession?.role !== 'super-admin'
                          ? t('admin.civicTalk.admin.rptNeedSuperAdmin')
                          : r.target_author_id === props.authSession?.user?.id
                            ? t('admin.civicTalk.admin.rptCannotBanSelf')
                            : undefined
                      "
                      @click="resolveReport(r.id, 'confirmed_abuse')"
                    >
                      {{ t('admin.civicTalk.admin.rptBtnAbuse') }}
                    </button>
                    <span v-if="!r.target_author_id" class="text-vt-xs text-vt-fg-3">{{ t('admin.civicTalk.admin.rptNoAuthor') }}</span>
                  </div>
                </template>
                <span v-else class="text-vt-xs text-vt-fg-3">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div v-if="formOpen" class="civic-modal-backdrop" role="presentation" @click.self="closeForm">
      <form class="civic-modal max-w-xl" role="dialog" aria-modal="true" :aria-label="t('admin.civicTalk.issue.editTitle')" @submit.prevent="saveIssue">
        <div class="civic-section-heading">
          <h3 class="text-vt-xl font-semibold text-vt-fg-1">{{ t('admin.civicTalk.issue.editTitle') }}</h3>
          <button type="button" class="civic-modal-close" :aria-label="t('common.cancel')" :disabled="submitting" @click="closeForm">×</button>
        </div>
        <label class="civic-field">
          <span>{{ t('admin.civicTalk.issue.fields.title') }}</span>
          <input v-model="formTitle" type="text" maxlength="200" required />
        </label>
        <label class="civic-field">
          <span>{{ t('admin.civicTalk.issue.fields.description') }}</span>
          <textarea v-model="formDescription" rows="5" maxlength="10000" />
        </label>
        <label class="civic-field">
          <span>{{ t('admin.civicTalk.issue.fields.status') }}</span>
          <select v-model="formStatus">
            <option value="collecting">{{ t('admin.civicTalk.status.collecting') }}</option>
            <option value="summarizing">{{ t('admin.civicTalk.status.summarizing') }}</option>
            <option value="published">{{ t('admin.civicTalk.status.published') }}</option>
          </select>
        </label>
        <label class="civic-check">
          <input v-model="formPolisEnabled" type="checkbox" />
          <span>{{ t('admin.civicTalk.issue.fields.polisEnabled') }}</span>
        </label>
        <p v-if="formError" class="civic-notice civic-notice--error" role="alert">{{ formError }}</p>
        <div class="civic-modal__actions">
          <button type="submit" class="civic-button civic-button--primary" :disabled="submitting">{{ submitting ? t('admin.civicTalk.saving') : t('admin.civicTalk.save') }}</button>
          <button type="button" class="civic-button" :disabled="submitting" @click="closeForm">{{ t('common.cancel') }}</button>
        </div>
      </form>
    </div>

    <div v-if="previewEvent" class="civic-modal-backdrop" role="presentation" @click.self="closePreview">
      <section class="civic-modal civic-preview-modal max-w-xl" role="dialog" aria-modal="true" :aria-label="t('admin.civicTalk.events.preview.title', { type: previewTitle(previewEvent) })">
        <div class="civic-section-heading">
          <div>
            <h3 class="text-vt-xl font-semibold text-vt-fg-1">{{ t('admin.civicTalk.events.preview.title', { type: previewTitle(previewEvent) }) }}</h3>
            <p class="mt-vt-1 text-vt-sm text-vt-fg-3">
              {{ t('admin.civicTalk.events.preview.createdBy', { author: previewEvent.authorName || t('admin.civicTalk.unknownAuthor'), time: formatDateTime(previewEvent.createdAt) }) }}
            </p>
          </div>
          <button type="button" class="civic-modal-close" :aria-label="t('common.cancel')" @click="closePreview">×</button>
        </div>

        <div v-if="previewEvent.material" class="civic-preview-content">
          <dl>
            <div>
              <dt>{{ t('admin.civicTalk.events.preview.sourceName') }}</dt>
              <dd>{{ previewEvent.material.sourceName || t('admin.civicTalk.unknownSource') }}</dd>
            </div>
            <div>
              <dt>{{ t('admin.civicTalk.events.preview.stance') }}</dt>
              <dd>{{ t(`admin.civicTalk.stance.${previewEvent.material.stance}`) }}</dd>
            </div>
            <div>
              <dt>{{ t('admin.civicTalk.events.preview.verifiedCount') }}</dt>
              <dd>{{ previewEvent.material.verifiedCount }}</dd>
            </div>
          </dl>
          <a v-if="previewEvent.material.sourceUrl" class="civic-source-link" :href="previewEvent.material.sourceUrl" target="_blank" rel="noopener noreferrer">{{
            previewEvent.material.sourceUrl
          }}</a>
          <p class="civic-entry__content">{{ previewEvent.material.content }}</p>
        </div>

        <div v-else-if="previewEvent.briefing" class="civic-preview-content">
          <p class="text-vt-sm text-vt-fg-3">{{ t('admin.civicTalk.events.preview.version', { version: previewEvent.briefing.version }) }}</p>
          <dl>
            <div v-if="previewEvent.briefing.consensus">
              <dt>{{ t('admin.civicTalk.events.preview.consensus') }}</dt>
              <dd>{{ previewEvent.briefing.consensus }}</dd>
            </div>
            <div v-if="previewEvent.briefing.disputes">
              <dt>{{ t('admin.civicTalk.events.preview.disputes') }}</dt>
              <dd>{{ previewEvent.briefing.disputes }}</dd>
            </div>
            <div v-if="previewEvent.briefing.positions">
              <dt>{{ t('admin.civicTalk.events.preview.positions') }}</dt>
              <dd>{{ previewEvent.briefing.positions }}</dd>
            </div>
            <div v-if="previewEvent.briefing.narrative">
              <dt>{{ t('admin.civicTalk.events.preview.narrative') }}</dt>
              <dd>{{ previewEvent.briefing.narrative }}</dd>
            </div>
            <div v-if="previewEvent.briefing.opinionPrompt">
              <dt>{{ t('admin.civicTalk.events.preview.opinionPrompt') }}</dt>
              <dd>{{ previewEvent.briefing.opinionPrompt }}</dd>
            </div>
          </dl>
        </div>

        <div v-else-if="previewEvent.opinion" class="civic-preview-content">
          <p class="civic-entry__content">{{ previewEvent.opinion.summary }}</p>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.civic-header,
.civic-section-heading,
.civic-entry__heading,
.civic-modal__actions,
.civic-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-vt-3);
}

.civic-header,
.civic-section-heading {
  align-items: flex-start;
}

.civic-header__actions,
.civic-pagination,
.civic-event-action,
.civic-section-switcher {
  display: flex;
  align-items: center;
  gap: var(--spacing-vt-3);
}

.civic-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--spacing-vt-3);
}

.civic-stat,
.civic-card,
.civic-entry {
  border: 1px solid var(--color-vt-border);
  background-color: var(--color-vt-bg-1);
}

.civic-stat {
  display: grid;
  gap: var(--spacing-vt-1);
  padding: var(--spacing-vt-4);
  border-radius: var(--radius-vt-md);
}

.civic-stat__value {
  color: var(--color-vt-democratic-red);
  font-size: var(--text-vt-2xl);
  font-weight: 700;
}

.civic-stat__label,
.civic-empty {
  color: var(--color-vt-fg-3);
  font-size: var(--text-vt-sm);
}

.civic-card {
  padding: var(--spacing-vt-6);
  border-radius: var(--radius-vt-lg);
}

.civic-table-wrap {
  margin-top: var(--spacing-vt-5);
  overflow-x: auto;
}

.civic-table {
  width: 100%;
  border-collapse: collapse;
  color: var(--color-vt-fg-2);
  font-size: var(--text-vt-sm);
}

.civic-table th,
.civic-table td {
  padding: var(--spacing-vt-3);
  text-align: left;
  vertical-align: top;
  border-bottom: 1px solid var(--color-vt-border);
}

.civic-table th {
  color: var(--color-vt-fg-3);
  font-weight: 500;
}

.civic-table th:not(:first-child),
.civic-table td:not(:first-child) {
  white-space: nowrap;
}

.civic-table tbody tr:last-child td {
  border-bottom: 0;
}

.civic-status {
  display: inline-flex;
  width: fit-content;
  padding: var(--spacing-vt-1) var(--spacing-vt-2);
  color: var(--color-vt-fg-2);
  background-color: var(--color-vt-bg-2);
  border-radius: var(--radius-vt-full);
  font-size: var(--text-vt-xs);
  white-space: nowrap;
}

.civic-button,
.civic-link,
.civic-detail-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-block-size: var(--spacing-vt-8);
  color: var(--color-vt-democratic-red);
  font-size: var(--text-vt-sm);
  font-weight: 500;
  cursor: pointer;
}

.civic-button {
  padding: var(--spacing-vt-2) var(--spacing-vt-3);
  border: 1px solid var(--color-vt-border);
  border-radius: var(--radius-vt-md);
}

.civic-icon-button {
  aspect-ratio: 1;
  padding: var(--spacing-vt-2);
}

.civic-icon-button :deep(svg) {
  width: var(--spacing-vt-4);
  height: var(--spacing-vt-4);
}

.civic-button:hover:not(:disabled) {
  background-color: var(--color-vt-red-tint);
}

.civic-button--primary {
  color: var(--color-vt-fg-inverse);
  background-color: var(--color-vt-democratic-red);
  border-color: var(--color-vt-democratic-red);
}

.civic-button--primary:hover:not(:disabled) {
  background-color: var(--color-vt-bg-inverse);
  border-color: var(--color-vt-bg-inverse);
}

.civic-button--outline-primary {
  color: var(--color-vt-democratic-red);
  background-color: var(--color-vt-bg-1);
  border-color: var(--color-vt-democratic-red);
}

.civic-button--outline-primary:hover:not(:disabled) {
  color: var(--color-vt-fg-inverse);
  background-color: var(--color-vt-democratic-red);
  border-color: var(--color-vt-democratic-red);
}

.civic-section-switcher {
  gap: normal;
  border: 1px solid var(--color-vt-border);
  border-radius: var(--radius-vt-md);
  overflow: hidden;
}

.civic-section-switcher__button {
  border: 0;
  border-radius: 0;
}

.civic-section-switcher__button + .civic-section-switcher__button {
  border-left: 1px solid var(--color-vt-border);
}

.civic-section-switcher__button--active,
.civic-section-switcher__button--active:hover:not(:disabled) {
  color: var(--color-vt-fg-inverse);
  background-color: var(--color-vt-democratic-red);
}

.civic-detail-button {
  min-width: var(--spacing-vt-8);
  width: fit-content;
  padding: var(--spacing-vt-1) var(--spacing-vt-2);
  background-color: var(--color-vt-bg-1);
  border: 1px solid var(--color-vt-border);
  border-radius: var(--radius-vt-md);
}

.civic-detail-button:hover:not(:disabled) {
  background-color: var(--color-vt-red-tint);
}

.civic-detail-button:focus-visible {
  outline: 2px solid var(--color-vt-democratic-red);
  outline-offset: 2px;
}

.civic-button:disabled,
.civic-link:disabled,
.civic-detail-button:disabled {
  color: var(--color-vt-fg-3);
  cursor: not-allowed;
  opacity: 0.7;
}

.civic-link:hover {
  text-decoration: underline;
  text-underline-offset: var(--spacing-vt-1);
}

.civic-link:focus-visible,
.civic-event-item:focus-visible,
.civic-modal-close:focus-visible {
  outline: 2px solid var(--color-vt-democratic-red);
  outline-offset: 2px;
}

.civic-event-action {
  flex-wrap: wrap;
  white-space: normal;
}

.civic-event-item {
  color: var(--color-vt-democratic-red);
  font-weight: 500;
  cursor: pointer;
}

.civic-event-item:hover {
  color: var(--color-vt-democratic-red);
  text-decoration: underline;
  text-underline-offset: var(--spacing-vt-1);
}

.civic-pagination {
  justify-content: flex-end;
  margin-top: var(--spacing-vt-5);
}

.civic-issue-link {
  color: var(--color-vt-fg-1);
}

.civic-issue-link:hover {
  color: var(--color-vt-democratic-red);
  text-decoration: underline;
  text-underline-offset: var(--spacing-vt-1);
}

.civic-link--danger {
  color: var(--color-vt-democratic-red);
}

.civic-field {
  display: grid;
  gap: var(--spacing-vt-2);
  margin-top: var(--spacing-vt-5);
  color: var(--color-vt-fg-2);
  font-size: var(--text-vt-sm);
  font-weight: 500;
}

.civic-search {
  margin-bottom: 1rem;
  display: grid;
  gap: var(--spacing-vt-2);
  margin-top: var(--spacing-vt-5);
  color: var(--color-vt-fg-2);
  font-size: var(--text-vt-sm);
  font-weight: 500;
}

.civic-field input,
.civic-field select,
.civic-field textarea,
.civic-search input {
  width: 100%;
  padding: var(--spacing-vt-2) var(--spacing-vt-3);
  color: var(--color-vt-fg-1);
  background-color: var(--color-vt-bg-1);
  border: 1px solid var(--color-vt-border);
  border-radius: var(--radius-vt-md);
  font: inherit;
  font-weight: 400;
}

.civic-field textarea {
  resize: vertical;
}

.civic-field input:focus,
.civic-field select:focus,
.civic-field textarea:focus,
.civic-search input:focus {
  outline: none;
  border-color: var(--color-vt-democratic-red);
  box-shadow: 0 0 0 2px var(--color-vt-red-tint);
}

.civic-empty {
  padding: var(--spacing-vt-6) 0;
  text-align: center;
}

.civic-selected-issue {
  margin-top: var(--spacing-vt-4);
  margin-bottom: var(--spacing-vt-4);
  color: var(--color-vt-fg-1);
  font-size: var(--text-vt-lg);
  font-weight: 600;
}

.civic-entry {
  padding: var(--spacing-vt-4);
  border-radius: var(--radius-vt-md);
}

.civic-source-link {
  display: block;
  margin-top: var(--spacing-vt-3);
  color: var(--color-vt-democratic-red);
  font-size: var(--text-vt-sm);
  overflow-wrap: anywhere;
}

.civic-entry__content {
  margin-top: var(--spacing-vt-3);
  color: var(--color-vt-fg-1);
  font-size: var(--text-vt-sm);
  white-space: pre-wrap;
}

.civic-notice {
  padding: var(--spacing-vt-3) var(--spacing-vt-4);
  border: 1px solid var(--color-vt-border);
  border-radius: var(--radius-vt-md);
  font-size: var(--text-vt-sm);
}

.civic-notice--error {
  color: var(--color-vt-democratic-red);
  background-color: var(--color-vt-red-tint);
}

.civic-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 120;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-vt-4);
  background-color: color-mix(in srgb, var(--color-vt-black), transparent 45%);
}

.civic-modal {
  width: 100%;
  max-height: calc(100dvh - var(--spacing-vt-8));
  padding: var(--spacing-vt-6);
  overflow-y: auto;
  background-color: var(--color-vt-bg-1);
  border-radius: var(--radius-vt-lg);
  box-shadow: var(--shadow-vt-lg);
}

.civic-modal-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--spacing-vt-8);
  height: var(--spacing-vt-8);
  border-radius: var(--radius-vt-full);
  color: var(--color-vt-fg-2);
  font-size: var(--text-vt-xl);
}

.civic-modal-close:hover {
  background-color: var(--color-vt-bg-2);
}

.civic-preview-content {
  margin-top: var(--spacing-vt-5);
}

.civic-preview-content dl {
  display: grid;
  gap: var(--spacing-vt-4);
}

.civic-preview-content dt {
  color: var(--color-vt-fg-3);
  font-size: var(--text-vt-sm);
}

.civic-preview-content dd {
  margin-top: var(--spacing-vt-1);
  color: var(--color-vt-fg-1);
  font-size: var(--text-vt-sm);
  white-space: pre-wrap;
}

.civic-check {
  display: flex;
  align-items: center;
  gap: var(--spacing-vt-2);
  margin-top: var(--spacing-vt-5);
  color: var(--color-vt-fg-2);
  font-size: var(--text-vt-sm);
}

.civic-modal__actions {
  justify-content: flex-end;
  margin-top: var(--spacing-vt-6);
}

@media (max-width: 768px) {
  .civic-header,
  .civic-section-heading,
  .civic-entry__heading {
    flex-direction: column;
    align-items: stretch;
  }

  .civic-header__actions,
  .civic-pagination {
    width: 100%;
  }

  .civic-header__actions > .civic-button:not(.civic-icon-button) {
    flex: 1;
  }

  .civic-section-switcher {
    flex: 1;
  }

  .civic-section-switcher__button {
    flex: 1;
  }

  .civic-pagination {
    justify-content: space-between;
  }

  .civic-stats {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .civic-stat {
    padding: var(--spacing-vt-3);
    text-align: center;
  }

  .civic-stat__value {
    font-size: var(--text-vt-xl);
  }

  .civic-table-wrap {
    overflow: visible;
  }

  .civic-table,
  .civic-table tbody,
  .civic-table tr,
  .civic-table td {
    display: block;
    width: 100%;
    min-width: 0;
  }

  .civic-table thead {
    display: none;
  }

  .civic-table tr {
    padding: var(--spacing-vt-3) 0;
    border-bottom: 1px solid var(--color-vt-border);
  }

  .civic-table tbody tr:last-child {
    padding-bottom: 0;
    border-bottom: 0;
  }

  .civic-table td {
    display: grid;
    grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
    gap: var(--spacing-vt-3);
    padding: var(--spacing-vt-2) 0;
    border-bottom: 0;
    overflow-wrap: anywhere;
  }

  .civic-table td::before {
    content: attr(data-label);
    color: var(--color-vt-fg-3);
    font-weight: 500;
  }

  .civic-table th:not(:first-child),
  .civic-table td:not(:first-child) {
    white-space: normal;
  }

  .civic-table td > * {
    min-width: 0;
  }

  .civic-actions {
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .civic-actions .civic-link,
  .civic-entry__heading .civic-link {
    padding: var(--spacing-vt-2) var(--spacing-vt-3);
    border: 1px solid var(--color-vt-border);
    border-radius: var(--radius-vt-md);
  }

  .civic-entry__heading .civic-link {
    align-self: flex-start;
  }

  .civic-modal-backdrop {
    align-items: flex-end;
    padding: 0;
  }

  .civic-modal {
    max-height: calc(100dvh - var(--spacing-vt-8));
    border-bottom-right-radius: 0;
    border-bottom-left-radius: 0;
  }

  .civic-modal__actions {
    position: sticky;
    bottom: calc(-1 * var(--spacing-vt-4));
    padding: var(--spacing-vt-3) 0 var(--spacing-vt-4);
    background-color: var(--color-vt-bg-1);
  }

  .civic-modal__actions .civic-button {
    flex: 1;
  }

  .civic-card,
  .civic-modal {
    padding: var(--spacing-vt-4);
  }
}

/* Tab bar */
.civic-tabs {
  display: flex;
  gap: 0;
  border-bottom: 2px solid var(--color-vt-border);
}

.civic-tab {
  padding: var(--spacing-vt-2) var(--spacing-vt-4);
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  background: none;
  color: var(--color-vt-fg-3);
  font-size: var(--text-vt-sm);
  font-weight: 500;
  cursor: pointer;
  transition:
    color 0.15s,
    border-color 0.15s;
}

.civic-tab:hover:not(:disabled) {
  color: var(--color-vt-fg-2);
}

.civic-tab--active {
  color: var(--color-vt-democratic-red);
  border-bottom-color: var(--color-vt-democratic-red);
}

/* Report status badges */
.rpt-status {
  font-size: var(--text-vt-sm);
  font-weight: 500;
}

.rpt-status--pending {
  color: var(--color-vt-wheat-yellow);
}

.rpt-status--abuse {
  color: var(--color-vt-democratic-red);
}

.rpt-status--false {
  color: var(--color-vt-fg-3);
}

/* Column-stacked actions (reports table) */
.civic-actions--col {
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-vt-1);
}
</style>
