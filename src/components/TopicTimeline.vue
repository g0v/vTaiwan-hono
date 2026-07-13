<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useI18n } from "vue-i18n";
import IconWrapper from "./IconWrapper.vue";
import ParticipationLink from "./ParticipationLink.vue";
import discourseApi from "../lib/discourse";

const props = defineProps<{
  topicId: string | number;
}>();

const { t } = useI18n();

interface TimelineItem {
  title: string;
  start: string;
  end: string | null;
  info: string;
  link: string[];
}

const timeline = ref<TimelineItem[]>([]);
const loading = ref(true);

const timelineTitle = computed(() => [
  t("topics.timeline.columns.time"),
  t("topics.timeline.columns.stage"),
  t("topics.timeline.columns.links"),
]);

const plinkList = computed(() => [
  {
    icon: "link",
    title: t("topics.timeline.linkTypes.related"),
    desc: t("topics.timeline.linkTypes.relatedDesc"),
  },
  {
    icon: "edit",
    title: t("topics.timeline.linkTypes.hackpad"),
    desc: t("topics.timeline.linkTypes.hackpadDesc"),
  },
  {
    icon: "book",
    title: t("topics.timeline.linkTypes.record"),
    desc: t("topics.timeline.linkTypes.recordDesc"),
  },
  {
    icon: "play",
    title: t("topics.timeline.linkTypes.live"),
    desc: t("topics.timeline.linkTypes.liveDesc"),
  },
  {
    icon: "users",
    title: t("topics.timeline.linkTypes.discuss"),
    desc: t("topics.timeline.linkTypes.discussDesc"),
  },
  {
    icon: "message-circle",
    title: t("topics.timeline.linkTypes.comment"),
    desc: t("topics.timeline.linkTypes.commentDesc"),
  },
]);

const parseTimelinePost = (raw: string): TimelineItem | null => {
  try {
    const regex = /(?: (?:init )?)|\n/g;
    const dateRegex = /^\d{4}-(0?[1-9]|1[012])-(0?[1-9]|[12][0-9]|3[01])$/;
    const timeRegex = /^(2[0-3]|1[0-9]|0[0-9]|[^0-9][0-9]):([0-5][0-9]|[0-9]):([0-5][0-9]|[0-9])$/;

    const comment = raw.split(regex);
    const links: string[] = [];

    if (comment.length < 2) return null;

    const timelineContent: TimelineItem = {
      title: comment[0],
      start: comment[1],
      end: null,
      info: "",
      link: [],
    };

    if (comment[2] && dateRegex.test(comment[2])) {
      timelineContent.end = comment[2];
    } else if (comment[2] && timeRegex.test(comment[2])) {
      timelineContent.start += " " + comment[2];
    }

    comment.slice(1).forEach((item) => {
      if (item && item.indexOf("http") > -1) {
        links.push(item);
      } else if (item && !dateRegex.test(item) && !timeRegex.test(item) && item.trim() !== "") {
        if (!timelineContent.info) {
          timelineContent.info = item;
        }
      }
    });

    timelineContent.link = links;
    return timelineContent.title ? timelineContent : null;
  } catch (error) {
    console.error("Error parsing timeline post:", error);
    return null;
  }
};

const loadTimeline = async () => {
  try {
    loading.value = true;
    const topicData = await discourseApi.getTopic(props.topicId);
    const posts = topicData.post_stream.posts.slice(1);
    const timelineItems: TimelineItem[] = [];

    posts.forEach((post) => {
      const item = parseTimelinePost(post.raw);
      if (item) timelineItems.push(item);
    });

    timeline.value = timelineItems.sort(
      (a, b) => new Date(b.start).getTime() - new Date(a.start).getTime(),
    );
  } catch (error) {
    console.error("Error loading timeline:", error);
    timeline.value = [];
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadTimeline();
});
</script>

<template>
  <div class="topic-timeline overflow-x-auto">
    <div v-if="loading" class="py-8 text-center">
      <div class="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-jade-green" />
      <p class="mt-2 text-gray-600">{{ t("topics.timeline.loading") }}</p>
    </div>

    <div v-else-if="timeline.length > 0">
      <table class="w-full border-collapse border border-gray-200 bg-white">
        <thead>
          <tr class="bg-gray-50 text-center">
            <th v-for="title in timelineTitle" :key="title" class="border border-gray-200 p-4">
              <h3 class="text-lg font-semibold text-gray-900">{{ title }}</h3>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(item, index) in timeline" :key="index" class="border-b border-gray-200">
            <td class="border border-gray-200 p-4 text-center align-top">
              <div class="text-lg leading-6">{{ item.start }}</div>
              <i v-if="item.end" class="my-2 flex justify-center text-gray-400">
                <IconWrapper name="chevron-down" :size="16" />
              </i>
              <div v-if="item.end" class="text-lg leading-6">{{ item.end }}</div>
            </td>

            <td class="border border-gray-200 p-4 align-top">
              <div class="block md:hidden">
                <span class="inline-block rounded-sm bg-gray-100 px-2 py-1 text-xs text-gray-800">
                  {{ item.title }}
                </span>
              </div>
              <div class="hidden md:block">
                <span class="inline-block rounded-sm bg-gray-100 px-3 py-1 text-sm text-gray-800">
                  {{ item.title }}
                </span>
              </div>
              <h4 v-if="item.info" class="mt-2 text-base font-medium text-gray-900">
                {{ item.info }}
              </h4>
            </td>

            <td class="border border-gray-200 p-4 align-top">
              <ParticipationLink :urllink="item.link" />
            </td>
          </tr>
        </tbody>
      </table>

      <div class="mt-8">
        <h3 class="mb-4 text-lg font-semibold text-gray-900">
          {{ t("topics.timeline.externalLinksTitle") }}
        </h3>
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="link in plinkList"
            :key="link.title"
            class="flex items-start space-x-3 rounded-lg bg-gray-50 p-3"
          >
            <IconWrapper :name="link.icon" :size="20" class="mt-0.5 text-gray-600" />
            <div>
              <h5 class="font-medium text-gray-900">{{ link.title }}</h5>
              <p class="text-sm text-gray-600">{{ link.desc }}</p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="py-8 text-center">
      <IconWrapper name="calendar" :size="48" color="#9CA3AF" class="mx-auto mb-4" />
      <p class="text-gray-500">{{ t("topics.detail.noTimeline") }}</p>
    </div>
  </div>
</template>

<style scoped>
@media (max-width: 767px) {
  table {
    font-size: 0.875rem;
  }
}
</style>
