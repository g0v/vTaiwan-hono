<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import discourseApi from '../lib/discourse'

const props = defineProps<{
  topicId: string | number
}>()

const { t } = useI18n()

const STEP_KEYS = ['即將開始', '意見徵集', '研擬草案', '送交院會', '歷史案件'] as const

const steps = ref(
  STEP_KEYS.map(title => ({
    title,
    active: false,
    current: false,
  }))
)

const loadProgress = async () => {
  try {
    if (!props.topicId) return

    const response = await discourseApi.getTopic(props.topicId)

    steps.value.forEach(step => {
      step.active = false
      step.current = false
    })

    if (response?.post_stream?.posts) {
      const posts = response.post_stream.posts.slice(1)

      if (posts.length > 0) {
        const lastPost = posts[posts.length - 1]
        const currentStage = (lastPost.raw || '').split(' ')[0]

        let foundCurrent = false
        for (let i = 0; i < steps.value.length; i++) {
          if (steps.value[i].title === currentStage) {
            steps.value[i].current = true
            foundCurrent = true
            break
          } else {
            steps.value[i].active = true
          }
        }

        if (!foundCurrent) {
          steps.value[0].current = true
        }
      } else {
        steps.value[0].current = true
      }
    }
  } catch (error) {
    console.error('Error loading progress:', error)
    steps.value[0].current = true
  }
}

onMounted(() => {
  loadProgress()
})

watch(
  () => props.topicId,
  () => {
    loadProgress()
  }
)
</script>

<template>
  <div class="topic-progress rounded-vt-2xl bg-vt-bg-1 px-vt-4 py-vt-8 shadow-vt-lg">
    <div class="mx-auto max-w-2xl">
      <div class="step-progress-bar">
        <ol class="progress-bar">
          <li
            v-for="(step, index) in steps"
            :key="index"
            :class="{
              active: step.active,
              current: step.current,
            }"
          >
            <span class="step-number">{{ index + 1 }}</span>
            <span class="step-label">{{ t('topics.steps.' + step.title) }}</span>
          </li>
        </ol>
      </div>
    </div>
  </div>
</template>

<style scoped>
.progress-bar {
  display: flex;
  padding: 0;
  margin: 0;
  list-style: none;
}
.progress-bar li {
  position: relative;
  width: 20%;
  text-align: center;
  color: var(--color-vt-gray-400);
  font-size: var(--text-vt-xs);
  font-weight: 700;
}
.step-label {
  font-size: var(--text-vt-sm);
}
.step-number {
  position: relative;
  z-index: 1;
  display: grid;
  place-items: center;
  width: var(--spacing-vt-8);
  height: var(--spacing-vt-8);
  margin: 0 auto var(--spacing-vt-2);
  border: 2px solid var(--color-vt-gray-400);
  border-radius: var(--radius-vt-full);
  background: var(--color-vt-bg-1);
}
.progress-bar li::after {
  content: '';
  position: absolute;
  top: calc(var(--spacing-vt-8) / 2);
  left: 50%;
  width: 100%;
  height: 1px;
  background: var(--color-vt-border);
}
.progress-bar li:last-child::after {
  display: none;
}
.progress-bar li.active {
  color: var(--color-vt-jade-green);
}
.progress-bar li.active .step-number {
  border-color: var(--color-vt-jade-green);
}
.progress-bar li.active::after {
  background: var(--color-vt-jade-green);
}
.progress-bar li.current {
  color: var(--color-vt-wheat-yellow);
}
.progress-bar li.current .step-number {
  border-color: var(--color-vt-wheat-yellow);
  background: var(--color-vt-wheat-yellow);
  color: var(--color-vt-white);
  box-shadow: 0 0 0 var(--spacing-vt-1) var(--color-vt-yellow-tint);
}
</style>
