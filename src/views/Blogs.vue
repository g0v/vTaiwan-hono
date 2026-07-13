<template>
  <div class="container mx-auto px-2 py-8">
    <div class="mb-8 flex flex-col items-center justify-between md:flex-row">
      <h1 class="text-3xl font-bold md:w-1/2">{{ t("medium.title") }}</h1>
      <p class="text-sm text-gray-500">
        {{ t("medium.sourceDescription") }}
        <a
          :href="`https://medium.com/@${MEDIUM_USERNAME}`"
          target="_blank"
          rel="noopener noreferrer"
          class="text-sm text-democratic-red hover:underline"
          >Medium/@{{ MEDIUM_USERNAME }}</a
        >
      </p>
    </div>

    <div v-if="loading" class="py-8 text-center">
      <p class="text-gray-600">{{ t("medium.loading") }}</p>
    </div>

    <div v-else-if="error" class="py-8 text-center">
      <p class="mb-4 text-red-600">{{ error }}</p>
      <button
        @click="loadArticles"
        class="rounded-md bg-democratic-red px-4 py-2 text-white transition hover:opacity-90"
      >
        {{ t("medium.retry") }}
      </button>
    </div>

    <div v-else-if="articles.length > 0" class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      <article
        v-for="article in articles"
        :key="article.id"
        class="rounded-lg bg-white p-6 shadow-md transition-shadow hover:shadow-lg"
      >
        <!-- 文章標題 -->
        <h2 class="mb-3 text-xl font-bold">
          <a
            :href="article.link"
            target="_blank"
            rel="noopener noreferrer"
            class="text-gray-900 transition-colors hover:text-democratic-red"
          >
            {{ article.title }}
          </a>
        </h2>

        <!-- 作者和日期 -->
        <div class="mb-4 flex items-center space-x-3">
          <div v-if="article.author" class="flex items-center space-x-2">
            <span class="text-sm text-gray-600">{{ article.author }}</span>
          </div>
          <div v-if="article.pubDate" class="text-sm text-gray-500">
            {{ formatDate(article.pubDate) }}
          </div>
        </div>

        <!-- 文章摘要 -->
        <div class="mb-4">
          <div class="prose prose-sm max-w-none text-gray-700">
            {{ article.summary }}
          </div>
        </div>

        <!-- 標籤 -->
        <div v-if="article.categories.length > 0" class="mb-4 flex flex-wrap gap-2">
          <span
            v-for="category in article.categories"
            :key="category"
            class="rounded-full bg-jade-green/10 px-2 py-1 text-sm text-jade-green"
            >#{{ category }}</span
          >
        </div>

        <!-- 外部連結 -->
        <div class="mt-4">
          <a
            :href="article.link"
            target="_blank"
            rel="noopener noreferrer"
            class="text-sm font-medium text-democratic-red hover:underline"
            >{{ t("medium.readMore") }} →</a
          >
        </div>
      </article>
    </div>

    <!-- 無文章時顯示 -->
    <div v-else class="py-8 text-center">
      <p class="text-gray-600">{{ t("medium.noArticles") }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useI18n } from "vue-i18n";

const { locale, t } = useI18n();

// 固定 Medium 用戶名
const MEDIUM_USERNAME = "vtaiwan.tw";

interface Article {
  id: string;
  title: string;
  link: string;
  summary: string;
  pubDate: string;
  author: string;
  categories: string[];
}

const articles = ref<Article[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

const formatDate = (dateString: string) => {
  try {
    return new Date(dateString).toLocaleDateString(locale.value, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
};

// 截取純文字摘要
const getSummary = (content: string): string => {
  if (!content) return "";
  const textContent = content.replace(/<[^>]*>/g, "");
  return textContent.length > 150 ? textContent.substring(0, 150) + "..." : textContent;
};

const getElementTextByTagName = (element: Element, tagNames: string[]): string => {
  for (const tagName of tagNames) {
    const text = element.getElementsByTagName(tagName)[0]?.textContent;
    if (text) return text;
  }
  return "";
};

// 解析 RSS XML（瀏覽器 API，SSR 時回傳空陣列）
const parseRSS = (xmlText: string): Article[] => {
  if (typeof DOMParser === "undefined") return [];
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");
    if (xmlDoc.querySelector("parsererror")) return [];

    let items = xmlDoc.querySelectorAll("item");
    if (items.length === 0) items = xmlDoc.querySelectorAll("entry");
    if (items.length === 0) return [];

    const result: Article[] = [];
    items.forEach((item, index) => {
      try {
        const title = getElementTextByTagName(item, ["title"]);
        const link = getElementTextByTagName(item, ["link"]);
        const summary = getSummary(
          getElementTextByTagName(item, ["content:encoded", "content", "description"]),
        );
        const pubDate = getElementTextByTagName(item, ["pubDate", "published", "updated"]);
        const author = getElementTextByTagName(item, ["dc:creator", "author", "name"]);
        const id = getElementTextByTagName(item, ["guid"]) || link || `article-${index}`;
        const categories: string[] = [];
        Array.from(item.getElementsByTagName("category")).forEach((cat) => {
          const text = cat.textContent || cat.getAttribute("term") || "";
          if (text) categories.push(text);
        });
        if (title && link) result.push({ id, title, link, summary, pubDate, author, categories });
      } catch {
        // 跳過解析失敗的個別條目
      }
    });
    return result;
  } catch {
    return [];
  }
};

// 透過自己的後端 proxy 取得 RSS feed
const fetchRSS = async (username: string): Promise<Article[]> => {
  const rssUrl = encodeURIComponent(`https://medium.com/feed/@${username}`);
  const response = await fetch(`/api/proxy?url=${rssUrl}`, {
    headers: { Accept: "application/rss+xml, application/xml, text/xml, */*" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const xmlText = await response.text();
  const parsed = parseRSS(xmlText);
  if (!parsed.length) throw new Error("No articles found");
  return parsed;
};

const loadArticles = async () => {
  loading.value = true;
  error.value = null;
  articles.value = [];
  try {
    articles.value = await fetchRSS(MEDIUM_USERNAME);
  } catch (err) {
    console.error("取得 Medium 文章失敗:", err);
    error.value = t("medium.fetchError");
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadArticles();
});
</script>

<style scoped>
.prose :deep(a) {
  @apply text-democratic-red underline hover:opacity-80;
}
.prose :deep(p) {
  @apply mb-2;
}
</style>
