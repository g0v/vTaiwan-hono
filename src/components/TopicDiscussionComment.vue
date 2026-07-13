<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useI18n } from "vue-i18n";
import IconWrapper from "./IconWrapper.vue";
import discourseApi from "../lib/discourse";

interface CommentItem {
  username: string;
  avatar_template: string;
  created_at: string;
  cooked: string;
}

interface ViewStats {
  views?: number;
  participant_count?: number;
  last_posted_at?: string;
}

const props = withDefaults(
  defineProps<{
    commentId: string | number;
    slice?: boolean;
  }>(),
  {
    slice: false,
  },
);

const { t, locale } = useI18n();

const comments = ref<CommentItem[]>([]);
const views = ref<ViewStats>({});
const loading = ref(true);

const formatAvatarUrl = (avatarTemplate: string): string => {
  if (!avatarTemplate) return "";
  if (avatarTemplate.startsWith("https:")) {
    return avatarTemplate.replace(/{size}/, "100");
  }
  return `https://talk.vtaiwan.tw${avatarTemplate}`.replace(/{size}/, "100");
};

const formatPostDate = (dateString: string): string => {
  if (!dateString) return "";
  return dateString.replace(/T.*/, "");
};

const formatPostContent = (content: string): string => {
  if (!content) return "";
  let processedContent = content;
  if (processedContent.includes('src="/') && !processedContent.includes('src="https://')) {
    processedContent = processedContent.replace(/src="(?!https:)/g, 'src="https://talk.vtaiwan.tw');
  }
  return processedContent;
};

const formatDate = (dateString?: string): string => {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    const today = new Date();
    const diffDays = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return t("topicDetail.today");
    if (diffDays === 1) return t("topicDetail.yesterday");
    if (diffDays < 7) return t("topicDetail.daysAgo", { count: diffDays });
    return date.toLocaleDateString(locale.value);
  } catch {
    return dateString;
  }
};

const loadComments = async () => {
  try {
    loading.value = true;
    const topicData = await discourseApi.getTopic(props.commentId);

    views.value = {
      views: topicData.views,
      participant_count: topicData.participant_count,
      last_posted_at: topicData.last_posted_at,
    };

    const posts = props.slice ? topicData.post_stream.posts.slice(1) : topicData.post_stream.posts;

    comments.value = posts.map((post) => ({
      username: post.username,
      avatar_template: formatAvatarUrl(post.avatar_template),
      created_at: formatPostDate(post.created_at),
      cooked: formatPostContent(post.cooked),
    }));
  } catch (error) {
    console.error("Error loading comments:", error);
    comments.value = [];
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadComments();
});
</script>

<template>
  <div class="topic-discussion-comment">
    <div v-if="loading" class="py-4 text-center">
      <div class="mx-auto h-6 w-6 animate-spin rounded-full border-b-2 border-jade-green" />
      <p class="mt-2 text-sm text-gray-600">{{ t("topics.detail.loading") }}</p>
    </div>

    <div v-else-if="comments.length > 0" class="space-y-6">
      <div class="flex items-center gap-4 border-b border-gray-200 pb-4 text-sm text-gray-500">
        <div class="flex items-center gap-1">
          <IconWrapper name="message-circle" :size="16" />
          <span>{{ t("topicDetail.commentsCount", { count: comments.length }) }}</span>
        </div>
        <div class="flex items-center gap-1">
          <IconWrapper name="eye" :size="16" />
          <span>{{ t("topicDetail.viewsCount", { count: views.views || 0 }) }}</span>
        </div>
        <div class="flex items-center gap-1">
          <IconWrapper name="users" :size="16" />
          <span>{{
            t("topicDetail.participantsCount", { count: views.participant_count || 0 })
          }}</span>
        </div>
        <div class="flex items-center gap-1">
          <IconWrapper name="calendar" :size="16" />
          <span>{{ formatDate(views.last_posted_at) }}</span>
        </div>
      </div>

      <div class="space-y-4">
        <div v-for="(comment, index) in comments" :key="index" class="flex space-x-3">
          <div class="shrink-0">
            <img
              :src="comment.avatar_template"
              :alt="comment.username"
              class="h-10 w-10 rounded-full"
            />
          </div>
          <div class="min-w-0 flex-1">
            <div class="mb-1 flex items-center gap-2">
              <span class="font-semibold text-gray-900">{{ comment.username }}</span>
              <span class="text-sm text-gray-500">{{ comment.created_at }}</span>
            </div>
            <div class="comment-prose max-w-none text-sm text-gray-700" v-html="comment.cooked" />
          </div>
        </div>
      </div>

      <div class="border-t border-gray-200 pt-6 text-center">
        <a
          :href="`https://talk.vtaiwan.tw/t/topic/${commentId}`"
          target="_blank"
          rel="noopener noreferrer"
          class="vt-btn vt-btn-primary inline-flex items-center"
        >
          <IconWrapper name="edit" :size="20" class="mr-2" />
          {{ t("topicDetail.postComment") }}
        </a>
      </div>
    </div>

    <div v-else class="py-8 text-center">
      <IconWrapper name="message-circle" :size="48" color="#9CA3AF" class="mx-auto mb-4" />
      <p class="text-gray-500">{{ t("topics.detail.noDiscussion") }}</p>
      <a
        :href="`https://talk.vtaiwan.tw/t/topic/${commentId}`"
        target="_blank"
        rel="noopener noreferrer"
        class="vt-btn vt-btn-primary mt-4 inline-flex items-center"
      >
        <IconWrapper name="edit" :size="20" class="mr-2" />
        {{ t("topicDetail.firstComment") }}
      </a>
    </div>
  </div>
</template>

<style scoped>
.comment-prose :deep(p) {
  margin-bottom: 1rem;
}

.comment-prose :deep(a) {
  color: #40b3bf;
  text-decoration: underline;
}

.comment-prose :deep(a:hover) {
  color: #369aa3;
}

.comment-prose :deep(blockquote) {
  border-left: 4px solid #e5e7eb;
  padding-left: 1rem;
  margin: 1rem 0;
  font-style: italic;
  color: #6b7280;
}

.comment-prose :deep(code) {
  background-color: #f3f4f6;
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
  font-size: 0.875rem;
}

.comment-prose :deep(pre) {
  background-color: #f3f4f6;
  padding: 1rem;
  border-radius: 0.5rem;
  overflow-x: auto;
}

.comment-prose :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 0.5rem;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}
</style>
