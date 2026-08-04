<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'

const route = useRoute()
const { t, te } = useI18n()

const errorCode = computed(() => {
  const value = route.query.error
  const code = Array.isArray(value) ? value[0] : value
  return typeof code === 'string' && /^[A-Za-z0-9_-]+$/.test(code) ? code : 'UNKNOWN'
})

const errorDescription = computed(() => {
  const reasonKey = `authError.reasons.${errorCode.value}`
  if (te(reasonKey)) return t(reasonKey)

  const value = route.query.error_description
  const description = Array.isArray(value) ? value[0] : value
  return typeof description === 'string' && description.trim() ? description : t('authError.descriptionFallback')
})
</script>

<template>
  <main class="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
    <section>
      <div class="border-b border-vt-border px-6 py-7 sm:px-8 sm:py-8">
        <p class="mb-3 font-sans text-vt-sm font-semibold text-democratic-red">
          {{ t('authError.eyebrow') }}
        </p>
        <h1 class="font-sans text-vt-3xl leading-tight font-bold text-vt-fg-1 sm:text-vt-4xl">
          {{ t('authError.title') }}
        </h1>
      </div>

      <div class="px-6 py-7 sm:px-8 sm:py-8">
        <div class="space-y-6">
          <p class="max-w-2xl text-vt-base leading-relaxed text-vt-fg-2">
            {{ t('authError.description') }}
          </p>

          <dl class="max-w-xl rounded-vt-md border border-vt-border bg-vt-bg-2 p-4">
            <dt class="font-sans text-vt-sm font-semibold text-vt-fg-2">
              {{ t('authError.reasonLabel') }}
            </dt>
            <dd class="mt-2 mb-4 text-vt-sm break-words text-vt-fg-1">
              {{ errorDescription }}
            </dd>
            <dt class="font-sans text-vt-sm font-semibold text-vt-fg-2">
              {{ t('authError.codeLabel') }}
            </dt>
            <dd class="mt-2 font-mono text-vt-sm break-all text-vt-fg-1">
              {{ errorCode }}
            </dd>
          </dl>

          <div class="flex flex-col gap-3 font-sans sm:flex-row">
            <RouterLink to="/profile" class="vt-btn vt-btn-primary justify-center">
              {{ t('authError.retryLogin') }}
            </RouterLink>
            <RouterLink to="/" class="vt-btn rounded-vt-md border border-vt-border text-vt-fg-2 hover:bg-vt-bg-2">
              {{ t('authError.goHome') }}
            </RouterLink>
          </div>
        </div>

        <aside class="mt-8 border-t border-vt-border pt-6">
          <p class="font-sans text-vt-sm font-semibold text-vt-fg-1">
            {{ t('authError.helpTitle') }}
          </p>
          <p class="mt-2 max-w-2xl text-vt-sm leading-relaxed text-vt-fg-2">
            {{ t('authError.helpDescription') }}
          </p>
          <RouterLink to="/contact" class="mt-4 inline-flex font-sans text-vt-sm font-semibold text-jade-green hover:text-vt-fg-1">
            {{ t('authError.contact') }}
          </RouterLink>
        </aside>
      </div>
    </section>
  </main>
</template>
