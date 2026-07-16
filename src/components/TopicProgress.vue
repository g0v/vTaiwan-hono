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
  <div class="topic-progress py-6">
    <div class="container mx-auto px-4">
      <div class="mx-auto max-w-4xl">
        <div class="step-progress-bar">
          <ul class="progress-bar">
            <li
              v-for="(step, index) in steps"
              :key="index"
              :class="{
                active: step.active,
                current: step.current,
              }"
            >
              {{ t('topics.steps.' + step.title) }}
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.step-progress-bar {
  margin: 0 auto;
  display: block;
  padding: 10px 0;
  width: 100%;
  max-width: 600px;
}

.progress-bar {
  counter-reset: step;
  padding: 0;
  margin: 0;
  list-style: none;
  display: flex;
}

.progress-bar li {
  color: #6b7280;
  width: 20%;
  position: relative;
  text-align: center;
  font-size: 1rem;
  font-weight: 500;
}

@media (min-width: 768px) {
  .progress-bar li {
    font-size: 1.125rem;
  }
}

.progress-bar li:before {
  content: counter(step);
  counter-increment: step;
  width: 32px;
  height: 32px;
  border: 2px solid #6b7280;
  border-radius: 50%;
  display: block;
  text-align: center;
  line-height: 28px;
  margin: 0 auto 10px auto;
  z-index: 9;
  background-color: white;
  font-weight: 600;
  position: relative;
}

.progress-bar li:after {
  content: '';
  width: 100%;
  position: absolute;
  height: 2px;
  background-color: #6b7280;
  top: 16px;
  left: 50%;
  z-index: -1;
}

.progress-bar li:last-child:after {
  content: none;
}

.progress-bar li.active {
  color: #10b981;
}

.progress-bar li.active:before {
  border-color: #10b981;
}

.progress-bar li.active:after {
  background-color: #10b981;
}

.progress-bar li.current {
  color: #f59e0b;
}

.progress-bar li.current:before {
  border-color: #f59e0b;
  background-color: #f59e0b;
  color: white;
}

.progress-bar li.current:after {
  background-color: #f59e0b;
}

@media (max-width: 767px) {
  .progress-bar li {
    font-size: 0.875rem;
  }

  .progress-bar li:before {
    width: 28px;
    height: 28px;
    line-height: 24px;
  }

  .progress-bar li:after {
    top: 14px;
  }
}
</style>
