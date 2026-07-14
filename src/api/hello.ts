import type { App } from "./types";

export function registerHelloApi(app: App) {
  app.get("/api/hello", (c) => c.text("Hello World!"));
}
