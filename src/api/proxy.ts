import type { App } from "./types";

const allowedHosts = ["medium.com", "vtaiwantw.substack.com"];

export function registerProxyApi(app: App) {
  app.get("/api/proxy", async (c) => {
    const rawUrl = c.req.query("url");
    if (!rawUrl) return c.json({ error: "Missing url parameter" }, 400);

    let targetUrl: URL;
    try {
      targetUrl = new URL(rawUrl);
    } catch {
      return c.json({ error: "Invalid url" }, 400);
    }

    if (targetUrl.protocol !== "https:" && targetUrl.protocol !== "http:") {
      return c.json({ error: "Only http(s) URLs are allowed" }, 400);
    }

    const isAllowed = allowedHosts.some(
      (host) =>
        targetUrl.hostname === host || targetUrl.hostname.endsWith(`.${host}`),
    );
    if (!isAllowed) {
      return c.json(
        { error: "Target host not allowed", hostname: targetUrl.hostname },
        403,
      );
    }

    try {
      const upstream = await fetch(targetUrl.toString(), {
        headers: { Accept: "application/rss+xml, application/xml, text/xml, */*" },
        redirect: "follow",
      });
      const contentType = upstream.headers.get("Content-Type") || "text/xml";
      const body = await upstream.arrayBuffer();
      return new Response(body, {
        status: upstream.status,
        headers: { "Content-Type": contentType },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return c.json({ error: "Upstream request failed", message }, 502);
    }
  });
}
