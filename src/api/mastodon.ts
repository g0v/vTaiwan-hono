import { corsFor } from "./cors";
import type { App } from "./types";

export function registerMastodonApi(app: App) {
  app.use("/api/mastodon", corsFor(['GET']));
  app.get("/api/mastodon", async (c) => {
    const token = c.env.MASTODON_TOKEN;
    if (!token) return c.json({ error: "MASTODON_TOKEN not configured" }, 500);

    const response = await fetch(
      "https://g0v.social/api/v1/timelines/tag/vtaiwan?limit=20&local=true",
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      },
    );
    const data = await response.json();
    return c.json(data, response.status as Parameters<typeof c.json>[1]);
  });
}
