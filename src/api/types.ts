import type { Hono } from "hono";

export type AppBindings = {
  ASSETS?: {
    fetch: (request: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  };
  MASTODON_TOKEN?: string;
};

export type AppEnv = {
  Bindings: AppBindings;
};

export type App = Hono<AppEnv>;
