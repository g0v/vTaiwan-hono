<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { responseRequiresStepUp } from '../client/auth-session'

type IssueStatus = 'collecting' | 'summarizing' | 'published'
type ManagerSection = 'issues' | 'materials' | 'opinions'

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

const emit = defineEmits<{ 'step-up-required': [] }>()
const { t } = useI18n()

const activeSection = ref<ManagerSection>('issues')
const issues = ref<Issue[]>([])
const materials = ref<Material[]>([])
const opinions = ref<Opinion[]>([])
const materialIssueId = ref<number | null>(null)
const opinionIssueId = ref<number | null>(null)
const issuesLoading = ref(false)
const detailsLoading = ref(false)
const error = ref<string | null>(null)
const formOpen = ref(false)
const editingIssueId = ref<number | null>(null)
const submitting = ref(false)
const formError = ref<string | null>(null)
const formTitle = ref('')
const formDescription = ref('')
const formStatus = ref<IssueStatus>('collecting')
const formPolisEnabled = ref(false)

const issueCount = computed(() => issues.value.length)
const materialCount = computed(() => issues.value.reduce((total, issue) => total + issue.material_count, 0))
const opinionCount = computed(() => issues.value.reduce((total, issue) => total + issue.opinion_count, 0))
const formTitleKey = computed(() => (editingIssueId.value === null ? 'admin.civicTalk.issue.createTitle' : 'admin.civicTalk.issue.editTitle'))
const selectedMaterialIssue = computed(() => issues.value.find(issue => issue.id === materialIssueId.value) ?? null)
const selectedOpinionIssue = computed(() => issues.value.find(issue => issue.id === opinionIssueId.value) ?? null)

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

function openCreateIssue() {
  editingIssueId.value = null
  formTitle.value = ''
  formDescription.value = ''
  formStatus.value = 'collecting'
  formPolisEnabled.value = false
  formError.value = null
  formOpen.value = true
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
  submitting.value = true
  formError.value = null
  try {
    const id = editingIssueId.value
    const data = await requestJson<{ id?: number; ok?: boolean }>(id === null ? '/api/admin/civic-talks/issues' : `/api/admin/civic-talks/issues/${id}`, {
      method: id === null ? 'POST' : 'PUT',
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

watch(materialIssueId, () => {
  if (activeSection.value === 'materials') void loadMaterials()
})

watch(opinionIssueId, () => {
  if (activeSection.value === 'opinions') void loadOpinions()
})

watch(activeSection, section => {
  if (section === 'materials') void loadMaterials()
  if (section === 'opinions') void loadOpinions()
})

onMounted(() => {
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
      <button type="button" class="civic-button" :disabled="issuesLoading" @click="loadIssues">{{ t('admin.civicTalk.refresh') }}</button>
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
        <button type="button" class="civic-button civic-button--outline-primary" @click="openCreateIssue">{{ t('admin.civicTalk.issue.create') }}</button>
      </div>

      <p v-if="issuesLoading" class="civic-empty">{{ t('admin.civicTalk.loading') }}</p>
      <p v-else-if="issues.length === 0" class="civic-empty">{{ t('admin.civicTalk.issue.empty') }}</p>
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
            <tr v-for="issue in issues" :key="issue.id">
              <td :data-label="t('admin.civicTalk.columns.title')">
                <a :href="`https://civic.vtaiwan.tw/issues/${issue.id}`" target="_blank" class="civic-issue-link font-medium">{{ issue.title }}</a>
                <p v-if="issue.description" class="mt-vt-1 text-vt-sm text-vt-fg-3">{{ issue.description }}</p>
              </td>
              <td :data-label="t('admin.civicTalk.columns.status')">
                <span class="civic-status">{{ t(`admin.civicTalk.status.${issue.status}`) }}</span>
              </td>
              <td :data-label="t('admin.civicTalk.columns.materials')">
                <button type="button" class="civic-detail-button" :aria-label="t('admin.civicTalk.columns.materials')" @click="showIssueMaterials(issue.id)">
                  {{ issue.material_count }}
                </button>
              </td>
              <td :data-label="t('admin.civicTalk.columns.opinions')">
                <button type="button" class="civic-detail-button" :aria-label="t('admin.civicTalk.columns.opinions')" @click="showIssueOpinions(issue.id)">
                  {{ issue.opinion_count }}
                </button>
              </td>
              <td :data-label="t('admin.civicTalk.columns.author')">{{ issue.author_name || t('admin.civicTalk.unknownAuthor') }}</td>
              <td :data-label="t('admin.civicTalk.columns.createdAt')">{{ formatDate(issue.created_at) }}</td>
              <td :data-label="t('admin.civicTalk.columns.actions')">
                <div class="civic-actions">
                  <button type="button" class="civic-link" @click="openEditIssue(issue)">{{ t('admin.civicTalk.edit') }}</button>
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

    <div v-if="formOpen" class="civic-modal-backdrop" role="presentation" @click.self="closeForm">
      <form class="civic-modal max-w-xl" @submit.prevent="saveIssue">
        <div class="civic-section-heading">
          <h3 class="text-vt-xl font-semibold text-vt-fg-1">{{ t(formTitleKey) }}</h3>
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

.civic-detail-button {
  min-width: var(--spacing-vt-8);
  padding: var(--spacing-vt-1) var(--spacing-vt-2);
  background-color: var(--color-vt-bg-1);
  border: 1px solid var(--color-vt-border);
  border-radius: var(--radius-vt-md);
}

.civic-detail-button:hover {
  background-color: var(--color-vt-red-tint);
}

.civic-detail-button:focus-visible {
  outline: 2px solid var(--color-vt-democratic-red);
  outline-offset: 2px;
}

.civic-button:disabled {
  color: var(--color-vt-fg-3);
  cursor: not-allowed;
  opacity: 0.7;
}

.civic-link:hover {
  text-decoration: underline;
  text-underline-offset: var(--spacing-vt-1);
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

.civic-field input,
.civic-field select,
.civic-field textarea {
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
.civic-field textarea:focus {
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

  .civic-stats {
    grid-template-columns: 1fr;
  }

  .civic-card,
  .civic-modal {
    padding: var(--spacing-vt-4);
  }
}
</style>
