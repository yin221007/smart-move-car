import cookie from "@fastify/cookie";
import fastify from "fastify";
import type { SqliteDatabase } from "./db";
import { registerAdminRoutes } from "./routes/admin";
import { registerAuthRoutes } from "./routes/auth";
import { registerPublicRoutes } from "./routes/public";

export interface BuildAppOptions {
  db: SqliteDatabase;
  externalUrl: string;
  sessionSecret: string;
  rateLimitSeconds: number;
  nodeEnv?: string;
  fetchImpl?: typeof fetch;
}

export function buildApp(options: BuildAppOptions) {
  const app = fastify({ logger: false });
  app.register(cookie, { secret: options.sessionSecret });
  app.register(registerPublicRoutes, options);
  app.register(registerAuthRoutes, options);
  app.register(registerAdminRoutes, options);
  app.get("/api/health", async () => ({ ok: true }));
  return app;
}
