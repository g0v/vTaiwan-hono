<script setup lang="ts">
defineProps<{
  href?: string
  to?: string
  external?: boolean
}>()
</script>

<template>
  <RouterLink
    v-if="to"
    :to="to"
    class="group -mx-2.5 flex items-center gap-2.5 rounded-lg px-2.5 py-2 font-sans text-[13px] leading-[1.4] text-vt-gray-200 no-underline transition duration-200 hover:bg-white/5 hover:text-vt-white"
  >
    <slot name="icon" />
    <span class="min-w-0"><slot /></span>
    <svg
      class="h-3.5 w-3.5 shrink-0 -translate-x-1 text-democratic-red opacity-0 transition duration-200 group-hover:translate-x-0 group-hover:opacity-100"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="2"
    >
      <path stroke-linecap="round" stroke-linejoin="round" d="M7 7h10v10M7 17 17 7" />
    </svg>
    <span class="grow" aria-hidden="true" />
  </RouterLink>
  <a
    v-else
    :href="href"
    :target="external ? '_blank' : undefined"
    :rel="external ? 'noopener noreferrer' : undefined"
    class="group -mx-2.5 flex items-center gap-2.5 rounded-lg px-2.5 py-2 font-sans text-[13px] leading-[1.4] text-vt-gray-200 no-underline transition duration-200 hover:bg-white/5 hover:text-vt-white"
  >
    <slot name="icon" />
    <span class="min-w-0"><slot /></span>
    <svg
      class="h-3.5 w-3.5 shrink-0 -translate-x-1 text-democratic-red opacity-0 transition duration-200 group-hover:translate-x-0 group-hover:opacity-100"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      stroke-width="2"
    >
      <path stroke-linecap="round" stroke-linejoin="round" d="M7 7h10v10M7 17 17 7" />
    </svg>
    <span class="grow" aria-hidden="true" />
  </a>
</template>
