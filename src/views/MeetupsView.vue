<template>
  <!-- Hero Section -->
  <section class="vt-hero-bg vt-under-navbar text-white">
    <div class="relative z-1 mx-auto max-w-5xl px-6 pt-36 pb-24">
      <h1 class="mb-4 text-3xl font-bold md:text-4xl">{{ t('meetups.title') }}</h1>
      <p class="max-w-3xl text-xl">
        {{ t('meetups.description') }}
      </p>
      <br />

      <div class="flex justify-center gap-4">
        <RouterLink to="/jitsi" class="vt-btn vt-btn-primary inline-block rounded-md">
          {{ t('meetups.jitsi') }}(Beta)
          <br />
          <span class="text-sm text-black">(Wednesdays 19:00)</span>
        </RouterLink>
        <RouterLink to="/transcriptions" class="vt-btn vt-btn-primary inline-block rounded-md"> {{ t('meetups.transcriptions') }}(Beta) </RouterLink>
      </div>
    </div>
  </section>

  <!-- Calendar View -->
  <section class="bg-gray-100 py-12">
    <div class="container px-4 text-center">
      <h2 class="mb-6 text-2xl font-bold">{{ t('meetups.calendar.title') }}</h2>
      <p class="mb-8">
        {{ t('meetups.calendar.description') }}
      </p>
      <div class="flex justify-center gap-4">
        <a
          href="https://calendar.google.com/calendar/u/2?cid=MjhlZDRjMjYwOGQyMTc3NTZjNjJiOWMxOGYyMjhkNDJjNGY0MzcxNWViYTUxN2FkYmNiOTE2MGZhMzY5NDRhN0Bncm91cC5jYWxlbmRhci5nb29nbGUuY29t"
          target="_blank"
          rel="noopener noreferrer"
          class="vt-btn vt-btn-primary flex items-center gap-2 rounded-md"
        >
          <IconWrapper name="calendar" :size="18" color="#FFFFFF" />
          <span>{{ t('meetups.calendar.googleCalendar') }}</span>
        </a>
      </div>
    </div>
  </section>

  <!-- Host a Meetup -->
  <section class="bg-gray-100 py-12">
    <div class="container px-4 text-center">
      <h2 class="mb-4 text-2xl font-bold">{{ t('meetups.host.title') }}</h2>
      <p class="mx-auto mb-6 max-w-2xl text-lg">
        {{ t('meetups.host.description') }}
      </p>
      <a href="/contact" class="vt-btn vt-btn-primary inline-block rounded-md">
        {{ t('meetups.host.contactUs') }}
      </a>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import IconWrapper from '../components/IconWrapper.vue'

const { t } = useI18n()
</script>
