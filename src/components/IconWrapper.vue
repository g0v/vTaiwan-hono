<script setup lang="ts">
import { computed, type Component } from 'vue'
import {
  ArrowUpRight,
  Book,
  Bookmark,
  Calendar,
  ChevronDown,
  ChevronUp,
  CircleCheckBig,
  Download,
  Edit,
  ExternalLink,
  Eye,
  FileText,
  Github,
  Info,
  Link,
  Megaphone,
  MessageCircle,
  Mic,
  Play,
  Plus,
  Search,
  Settings,
  Share2,
  Square,
  Trash2,
  User,
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
  'chevron-up': ChevronUp,
  'circle-check-big': CircleCheckBig,
  download: Download,
  edit: Edit,
  'external-link': ExternalLink,
  eye: Eye,
  'file-text': FileText,
  github: Github,
  info: Info,
  link: Link,
  megaphone: Megaphone,
  'message-circle': MessageCircle,
  mic: Mic,
  play: Play,
  plus: Plus,
  search: Search,
  settings: Settings,
  'share-2': Share2,
  square: Square,
  trash: Trash2,
  user: User,
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
  }
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
