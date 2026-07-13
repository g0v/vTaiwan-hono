<script setup lang="ts">
defineProps<{
  word: string;
}>();
</script>

<template>
  <main class="container">
    <h1>Word: {{ word }}</h1>
    <p>
      The Open Graph image for this page is served from
      <a
        :href="`https://www.moedict.tw/${encodeURIComponent(word)}.png`"
        target="_blank"
        rel="noopener"
      >
        moedict.tw/{{ word }}.png </a
      >.
    </p>
    <figure>
      <img
        :src="`https://www.moedict.tw/${encodeURIComponent(word)}.png`"
        :alt="`Stroke order of ${word}`"
        loading="lazy"
      />
      <figcaption>Stroke order of {{ word }}</figcaption>
    </figure>
    <p><RouterLink to="/">Back home</RouterLink></p>
  </main>
</template>
