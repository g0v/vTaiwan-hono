// Discourse client：透過本站 /api/discourse/* 代理取得資料（不直接跨網域打 talk.vtaiwan.tw，
// 實際抓取與分頁邏輯在 Worker 端 discourse-server.ts；此檔僅薄封裝 + 型別轉出，體積極小）。
import { formatTopicData, type DiscourseTopic, type FormattedTopicData } from "./discourse-types";

export type { DiscoursePost, DiscourseTopic, FormattedTopicData } from "./discourse-types";

// 依 path 去重的請求快取：多個議題元件在同頁各自 getTopic(sameId) 時只打一次 /api/discourse
const inflight = new Map<string, Promise<unknown>>();

function getJson<T>(path: string): Promise<T> {
  //@ verify
  //@ requires path.length > 0
  //@ contract deduplicates in-flight requests by path; on HTTP error removes path from cache and rejects; on success resolves with parsed JSON of type T
  const cached = inflight.get(path);
  if (cached) return cached as Promise<T>;

  const promise = fetch(path, { headers: { Accept: "application/json" } }).then((response) => {
    if (!response.ok) {
      inflight.delete(path);
      throw new Error(`Discourse proxy error: ${response.status}`);
    }
    return response.json() as Promise<T>;
  });
  inflight.set(path, promise);
  return promise;
}

export interface DiscourseAPI {
  getAllTopics(): Promise<DiscourseTopic[]>;
  getAllCategoryTopics(categoryUri: string): Promise<DiscourseTopic[]>;
  getTopic(topicId: string | number): Promise<DiscourseTopic>;
  formatTopicData(topicData: DiscourseTopic): FormattedTopicData;
}

const discourseAPI: DiscourseAPI = {
  getAllTopics() {
    return getJson<DiscourseTopic[]>("/api/discourse/topics");
  },

  getAllCategoryTopics(categoryUri: string) {
    //@ verify
    //@ requires categoryUri.length > 0
    return getJson<DiscourseTopic[]>(
      `/api/discourse/topics?category=${encodeURIComponent(categoryUri)}`,
    );
  },

  getTopic(topicId: string | number) {
    //@ verify
    //@ requires String(topicId).length > 0
    return getJson<DiscourseTopic>(`/api/discourse/topic/${encodeURIComponent(String(topicId))}`);
  },

  formatTopicData,
};

export default discourseAPI;
