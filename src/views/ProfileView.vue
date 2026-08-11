<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import SocialLogin from '../components/SocialLogin.vue'
import UserAvatar from '../components/UserAvatar.vue'
import { authClient } from '../client/authClient'
import type { AuthSession } from '../client/auth-session'
import { isNameChangeCooldownPayload, NAME_CHANGE_COOLDOWN_DAYS } from '../lib/profile-name'
import { adminNavLink } from '../router/nav-links'

interface AuthenticatedUser {
  uid: string
  displayName: string | null
  email: string | null
  photoURL: string | null
}

const props = withDefaults(
  defineProps<{
    user?: AuthenticatedUser | null
    authSession?: AuthSession | null
    inApp?: boolean
    /** 管理員才顯示後台入口；僅顯示層取捨，真正把關在 Worker 端。 */
    isAdmin?: boolean
  }>(),
  {
    user: null,
    authSession: null,
    inApp: false,
    isAdmin: false,
  }
)
const emit = defineEmits<{
  logout: []
  'profile-updated': [displayName: string, nameChangeCooldownDays: number]
}>()
const { t } = useI18n()
const editing = ref(false)
const updating = ref(false)
const editForm = reactive({ displayName: '' })

const hasChanges = computed(() => editForm.displayName.trim() !== (props.user?.displayName ?? ''))
const profileName = computed(() => props.user?.displayName || t('profile.notSet'))
const profilePhotoUrl = computed(() => props.user?.photoURL)
const nameChangeCooldownDays = computed(() => props.authSession?.nameChangeCooldownDays ?? null)

watch(
  () => props.user,
  user => {
    editForm.displayName = user?.displayName ?? ''
  },
  { immediate: true }
)

function startEdit() {
  editing.value = true
  editForm.displayName = props.user?.displayName ?? ''
}

function cancelEdit() {
  editing.value = false
  editForm.displayName = props.user?.displayName ?? ''
}

async function saveProfile() {
  if (!props.user || updating.value || !hasChanges.value) return
  if (!window.confirm(t('profile.nameChangeConfirm', { days: NAME_CHANGE_COOLDOWN_DAYS }))) return

  try {
    updating.value = true
    const displayName = editForm.displayName.trim()
    const { error } = await authClient.updateUser({ name: displayName })
    if (error) throw error
    emit('profile-updated', displayName, NAME_CHANGE_COOLDOWN_DAYS)
    editing.value = false
  } catch (error) {
    console.error('Failed to update profile:', error)
    window.alert(t(isNameChangeCooldownPayload(error) ? 'profile.nameChangeCooldown' : 'profile.updateFailed'))
  } finally {
    updating.value = false
  }
}
</script>

<template>
  <main class="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6">
    <section class="rounded-vt-lg border border-vt-border bg-vt-bg-1 p-6 shadow-vt-md sm:p-8">
      <div class="mb-8 flex items-center justify-between gap-4">
        <h1 class="font-sans text-vt-3xl font-bold">{{ t('profile.title') }}</h1>
        <RouterLink v-if="user && isAdmin" :to="adminNavLink.href" class="vt-btn shrink-0 rounded-vt-md border border-democratic-red text-democratic-red hover:bg-vt-red-tint">
          {{ t(adminNavLink.labelKey) }}
        </RouterLink>
      </div>

      <div v-if="!user" class="py-8 text-center">
        <p class="mb-5 text-vt-fg-2">{{ t('profile.loginRequired') }}</p>
        <SocialLogin :in-app="inApp" />
      </div>

      <div v-else-if="!editing" class="space-y-8">
        <div class="flex flex-col items-start gap-4 md:flex-row md:items-center">
          <UserAvatar :src="profilePhotoUrl" :alt="t('profile.avatarAlt')" class="h-16 w-16 rounded-vt-full border border-vt-border" />
          <div>
            <h2 class="font-sans text-vt-xl font-semibold">{{ profileName }}</h2>
            <p class="text-vt-fg-2">{{ user.email }}</p>
          </div>
        </div>

        <dl class="grid gap-4 sm:grid-cols-2">
          <div class="rounded-vt-md border border-vt-border bg-vt-bg-2 p-4">
            <dt class="mb-1 font-sans text-vt-sm font-medium text-vt-fg-2">
              {{ t('profile.name') }}
            </dt>
            <dd>{{ profileName }}</dd>
            <p v-if="nameChangeCooldownDays !== null" class="mt-2 text-vt-sm text-vt-fg-2">
              {{ t('profile.nameChangeCooldownRemaining', { days: nameChangeCooldownDays }) }}
            </p>
          </div>
          <div class="rounded-vt-md border border-vt-border bg-vt-bg-2 p-4">
            <dt class="mb-1 font-sans text-vt-sm font-medium text-vt-fg-2">
              {{ t('profile.email') }}
            </dt>
            <dd>{{ user.email }}</dd>
          </div>
        </dl>

        <div class="flex flex-wrap gap-3">
          <button type="button" class="vt-btn vt-btn-primary" @click="startEdit">
            {{ t('common.edit') }}
          </button>
          <button type="button" class="vt-btn rounded-vt-md border border-vt-border text-vt-fg-1 hover:bg-vt-bg-2" @click="emit('logout')">
            {{ t('common.logout') }}
          </button>
        </div>
      </div>

      <div v-else class="space-y-6">
        <div class="flex items-center gap-4">
          <UserAvatar :src="profilePhotoUrl" :alt="t('profile.avatarAlt')" class="h-16 w-16 rounded-vt-full border border-vt-border" />
          <div>
            <h2 class="font-sans text-vt-xl font-semibold">{{ t('profile.title') }}</h2>
            <p class="text-vt-fg-2">{{ user.email }}</p>
          </div>
        </div>

        <form class="space-y-5" @submit.prevent="saveProfile">
          <div>
            <label for="display-name" class="mb-2 block font-sans text-vt-sm font-medium">{{ t('profile.name') }}</label>
            <input
              id="display-name"
              v-model="editForm.displayName"
              required
              class="w-full rounded-vt-md border border-vt-border bg-vt-bg-1 px-3 py-2 font-sans focus:border-democratic-red focus:ring-2 focus:ring-democratic-red/20 focus:outline-none"
            />
            <p v-if="nameChangeCooldownDays !== null" class="mt-2 text-vt-sm text-vt-fg-2">
              {{ t('profile.nameChangeCooldownRemaining', { days: nameChangeCooldownDays }) }}
            </p>
          </div>
          <div>
            <p class="mb-2 font-sans text-vt-sm font-medium">{{ t('profile.email') }}</p>
            <p class="rounded-vt-md border border-vt-border bg-vt-bg-2 px-3 py-2 text-vt-fg-2">
              {{ user.email }}
            </p>
          </div>
          <div class="flex flex-wrap gap-3">
            <button type="submit" class="vt-btn vt-btn-primary disabled:cursor-not-allowed disabled:opacity-50" :disabled="updating || !hasChanges">
              {{ t('common.save') }}
            </button>
            <button type="button" class="vt-btn rounded-vt-md border border-vt-border text-vt-fg-2 hover:bg-vt-bg-2" :disabled="updating" @click="cancelEdit">
              {{ t('common.cancel') }}
            </button>
          </div>
        </form>
      </div>
    </section>
  </main>
</template>
