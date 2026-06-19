import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  APP_PORT: z.coerce.number().int().positive().default(3000),
  EXTERNAL_URL: z.string().url(),
  DATABASE_URL: z.string().default("file:/volume2/docker/nuoche/data/app.db"),
  SESSION_SECRET: z.string().min(32),
  ADMIN_INITIAL_PASSWORD: z.string().min(10),
  DEFAULT_RATE_LIMIT_SECONDS: z.coerce.number().int().positive().default(60)
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return envSchema.parse(env);
}

export function sqlitePathFromUrl(databaseUrl: string): string {
  if (!databaseUrl.startsWith("file:")) {
    throw new Error("DATABASE_URL must start with file:");
  }
  return databaseUrl.slice("file:".length);
}
