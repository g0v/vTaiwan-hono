<script setup lang="ts">
import { computed } from 'vue'
import * as LucideIcons from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    name: string
    size?: number
    color?: string
    type?: 'default' | 'primary' | 'teal' | 'amber'
    class?: string
  }>(),
  {
    size: 24,
    color: '',
    type: 'default',
    class: '',
  },
)

const colorMap: Record<string, string> = {
  default: '#000000',
  primary: '#D82000',
  teal: '#008888',
  amber: '#DB7700',
}

const iconColor = computed(() => props.color || colorMap[props.type])

const iconComponent = computed(() => {
  const iconName = props.name
    .charAt(0)
    .toUpperCase() +
    props.name.slice(1).replace(/-([a-z])/g, (_, g: string) => g.toUpperCase())
  return (LucideIcons as Record<string, unknown>)[iconName] ?? null
})
</script>

<template>
  <component :is="iconComponent" :size="size" :color="iconColor" :class="props.class" />
</template>
