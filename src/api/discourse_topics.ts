import { corsFor } from "./cors";
import { getAllTopics } from "../lib/discourse-server";
import type { App } from "./types";

export function registerDiscourseTopicsApi(app: App) {
  app.use("/api/discourse/topics", corsFor(["GET"]));
  app.get("/api/discourse/topics", async (c) => {
    const category = c.req.query("category");
    try {
      const topics = await getAllTopics(category || undefined);
      return c.json(topics);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.json({ error: "Discourse request failed", message }, 502);
    }
  });
}
