<script setup lang="ts">
import { computed, type Component } from 'vue'
import {
  ArrowUpRight,
  Book,
  Bookmark,
  Calendar,
  ChevronDown,
  Download,
  Edit,
  ExternalLink,
  Eye,
  Github,
  Info,
  Link,
  Megaphone,
  MessageCircle,
  Play,
  Search,
  Share2,
  Users,
  X,
} from 'lucide-vue-next'

// 只註冊實際用到的圖示（具名 import 才能被 tree-shake；勿用 import * 全量引入）
const icons: Record<string, Component> = {
  'arrow-up-right': ArrowUpRight,
  book: Book,
  bookmark: Bookmark,
  calendar: Calendar,
  'chevron-down': ChevronDown,
  download: Download,
  edit: Edit,
  'external-link': ExternalLink,
  eye: Eye,
  github: Github,
  info: Info,
  link: Link,
  megaphone: Megaphone,
  'message-circle': MessageCircle,
  play: Play,
  search: Search,
  'share-2': Share2,
  users: Users,
  x: X,
}

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
const iconComponent = computed(() => icons[props.name] ?? null)
</script>

<template>
  <component :is="iconComponent" :size="size" :color="iconColor" :class="props.class" />
</template>
