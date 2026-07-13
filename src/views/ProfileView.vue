<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import GoogleLogin from '../components/GoogleLogin.vue'
import { getFirebaseServices } from '../lib/firebase'

interface AuthenticatedUser {
  uid: string
  displayName: string | null
  email: string | null
  photoURL: string | null
}

interface UserData {
  name: string | null
  photoURL: string | null
}

const props = withDefaults(
  defineProps<{
    user?: AuthenticatedUser | null
    userData?: UserData | null
    inApp?: boolean
  }>(),
  {
    user: null,
    userData: null,
    inApp: false,
  },
)
const emit = defineEmits<{
  'login-success': []
  logout: []
  'profile-updated': [displayName: string]
}>()
const { t } = useI18n()
const editing = ref(false)
const updating = ref(false)
const editForm = reactive({ displayName: '' })

const hasChanges = computed(() => editForm.displayName.trim() !== (props.user?.displayName ?? ''))
const profileName = computed(() => props.userData?.name || props.user?.displayName || t('profile.notSet'))
const profilePhotoUrl = computed(() => props.userData?.photoURL || props.user?.photoURL)

watch(
  () => props.user,
  user => {
    editForm.displayName = user?.displayName ?? ''
  },
  { immediate: true },
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

  try {
    updating.value = true
    const displayName = editForm.displayName.trim()
    const { auth, database, databaseRef, databaseUpdate, updateProfile } = await getFirebaseServices()

    if (!auth.currentUser) return

    await updateProfile(auth.currentUser, { displayName })
    await databaseUpdate(databaseRef(database, `users/${props.user.uid}`), {
      name: displayName,
      updatedAt: new Date().toISOString(),
    })
    emit('profile-updated', displayName)
    editing.value = false
  } catch (error) {
    console.error('Failed to update profile:', error)
    window.alert(t('profile.updateFailed'))
  } finally {
    updating.value = false
  }
}
</script>

<template>
  <main class="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6">
    <section class="rounded-vt-lg border border-vt-border bg-vt-bg-1 p-6 shadow-vt-md sm:p-8">
      <h1 class="mb-8 font-sans text-vt-3xl font-bold">{{ t('profile.title') }}</h1>

      <div v-if="!user" class="py-8 text-center">
        <p class="mb-5 text-vt-fg-2">{{ t('profile.loginRequired') }}</p>
        <GoogleLogin :in-app="inApp" @login-success="emit('login-success')" />
      </div>

      <div v-else-if="!editing" class="space-y-8">
        <div class="flex items-center gap-4">
          <img v-if="profilePhotoUrl" :src="profilePhotoUrl" :alt="t('profile.avatarAlt')" class="h-16 w-16 rounded-vt-full border border-vt-border object-cover" />
          <div v-else class="flex h-16 w-16 items-center justify-center rounded-vt-full bg-vt-bg-2 text-vt-fg-2" aria-hidden="true">👤</div>
          <div>
            <h2 class="font-sans text-vt-xl font-semibold">{{ profileName }}</h2>
            <p class="text-vt-fg-2">{{ user.email }}</p>
          </div>
        </div>

        <dl class="grid gap-4 sm:grid-cols-2">
          <div class="rounded-vt-md border border-vt-border bg-vt-bg-2 p-4">
            <dt class="mb-1 font-sans text-vt-sm font-medium text-vt-fg-2">{{ t('profile.name') }}</dt>
            <dd>{{ profileName }}</dd>
          </div>
          <div class="rounded-vt-md border border-vt-border bg-vt-bg-2 p-4">
            <dt class="mb-1 font-sans text-vt-sm font-medium text-vt-fg-2">{{ t('profile.email') }}</dt>
            <dd>{{ user.email }}</dd>
          </div>
        </dl>

        <div class="flex flex-wrap gap-3">
          <button type="button" class="vt-btn vt-btn-primary" @click="startEdit">{{ t('common.edit') }}</button>
          <button type="button" class="vt-btn rounded-vt-md border border-democratic-red text-democratic-red hover:bg-vt-red-tint" @click="emit('logout')">
            {{ t('common.logout') }}
          </button>
        </div>
      </div>

      <div v-else class="space-y-6">
        <div class="flex items-center gap-4">
          <img v-if="profilePhotoUrl" :src="profilePhotoUrl" :alt="t('profile.avatarAlt')" class="h-16 w-16 rounded-vt-full border border-vt-border object-cover" />
          <div v-else class="flex h-16 w-16 items-center justify-center rounded-vt-full bg-vt-bg-2 text-vt-fg-2" aria-hidden="true">👤</div>
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
              class="w-full rounded-vt-md border border-vt-border bg-vt-bg-1 px-3 py-2 font-sans focus:border-democratic-red focus:outline-none focus:ring-2 focus:ring-democratic-red/20"
            />
          </div>
          <div>
            <p class="mb-2 font-sans text-vt-sm font-medium">{{ t('profile.email') }}</p>
            <p class="rounded-vt-md border border-vt-border bg-vt-bg-2 px-3 py-2 text-vt-fg-2">{{ user.email }}</p>
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
