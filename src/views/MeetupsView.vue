<template>
  <!-- Hero Section -->
  <section class="bg-black py-12 text-white">
    <div class="container mx-auto px-4">
      <h1 class="mb-4 text-3xl font-bold md:text-4xl">{{ t("meetups.title") }}</h1>
      <p class="max-w-3xl text-xl">
        {{ t("meetups.description") }}
      </p>
      <br />

      <div class="flex justify-center gap-4">
        <RouterLink to="/jitsi" class="btn-primary inline-block rounded-md">
          {{ t("meetups.jitsi") }}(Beta)
          <br />
          <span class="text-sm text-black">(Wednesdays 19:00)</span>
        </RouterLink>
        <RouterLink to="/transcriptions" class="btn-primary inline-block rounded-md">
          {{ t("meetups.transcriptions") }}(Beta)
        </RouterLink>
      </div>
    </div>
  </section>

  <!-- Calendar View -->
  <section class="bg-gray-100 py-12">
    <div class="container mx-auto px-4 text-center">
      <h2 class="mb-6 text-2xl font-bold">{{ t("meetups.calendar.title") }}</h2>
      <p class="mb-8">
        {{ t("meetups.calendar.description") }}
      </p>
      <div class="flex justify-center gap-4">
        <a
          href="https://calendar.google.com/calendar/u/2?cid=MjhlZDRjMjYwOGQyMTc3NTZjNjJiOWMxOGYyMjhkNDJjNGY0MzcxNWViYTUxN2FkYmNiOTE2MGZhMzY5NDRhN0Bncm91cC5jYWxlbmRhci5nb29nbGUuY29t"
          target="_blank"
          rel="noopener noreferrer"
          class="btn-primary flex items-center gap-2 rounded-md"
        >
          <IconWrapper name="calendar" :size="18" color="#FFFFFF" />
          <span>{{ t("meetups.calendar.googleCalendar") }}</span>
        </a>
      </div>
    </div>
  </section>

  <!-- Host a Meetup -->
  <section class="bg-gray-100 py-12">
    <div class="container mx-auto px-4 text-center">
      <h2 class="mb-4 text-2xl font-bold">{{ t("meetups.host.title") }}</h2>
      <p class="mx-auto mb-6 max-w-2xl text-lg">
        {{ t("meetups.host.description") }}
      </p>
      <a href="/contact" class="btn-primary inline-block rounded-md">
        {{ t("meetups.host.contactUs") }}
      </a>
    </div>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from "vue-i18n";
import IconWrapper from "../components/IconWrapper.vue";

const { t } = useI18n();
</script>
