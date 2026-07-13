<script setup lang="ts">
import { computed, type Component } from 'vue'
import {
  ArrowUpRight,
  Book,
  BookOpen,
  Bookmark,
  Calendar,
  ChevronDown,
  ChevronLeft,
  Download,
  Edit,
  ExternalLink,
  Eye,
  FileText,
  Github,
  Hash,
  Info,
  Link,
  Mail,
  Megaphone,
  MessageCircle,
  MessageSquare,
  Mic,
  Play,
  Search,
  Share2,
  Settings,
  Slack,
  Square,
  Trash2,
  User,
  Users,
  Video,
  X,
  ChevronUp,
} from 'lucide-vue-next'

// 只註冊實際用到的圖示（具名 import 才能被 tree-shake；勿用 import * 全量引入）
const icons: Record<string, Component> = {
  'arrow-up-right': ArrowUpRight,
  book: Book,
  'book-open': BookOpen,
  bookmark: Bookmark,
  calendar: Calendar,
  'chevron-down': ChevronDown,
  'chevron-left': ChevronLeft,
  download: Download,
  edit: Edit,
  'external-link': ExternalLink,
  eye: Eye,
  'file-text': FileText,
  github: Github,
  hash: Hash,
  info: Info,
  link: Link,
  mail: Mail,
  megaphone: Megaphone,
  'message-circle': MessageCircle,
  message: MessageSquare,
  mic: Mic,
  play: Play,
  search: Search,
  'share-2': Share2,
  settings: Settings,
  slack: Slack,
  square: Square,
  trash: Trash2,
  user: User,
  users: Users,
  video: Video,
  x: X,
  'chevron-up': ChevronUp,
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
