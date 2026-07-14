import { getTopic } from "../lib/discourse-server";
import type { App } from "./types";

export function registerDiscourseTopicIdApi(app: App) {
  app.get("/api/discourse/topic/:id", async (c) => {
    try {
      const topic = await getTopic(c.req.param("id"));
      return c.json(topic);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.json({ error: "Discourse request failed", message }, 502);
    }
  });
}
