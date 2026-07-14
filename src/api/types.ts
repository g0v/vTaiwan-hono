import type { Hono } from "hono";

export type AppBindings = {
  ASSETS?: {
    fetch: (request: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  };
  MASTODON_TOKEN?: string;
  DB?: D1Database;
  R2?: R2Bucket;
  AI?: Ai;
  JAAS_APP_ID?: string;
  JAAS_KEY_ID?: string;
  JAAS_PRIVATE_KEY?: string;
};

export type AppEnv = {
  Bindings: AppBindings;
};

export type App = Hono<AppEnv>;
