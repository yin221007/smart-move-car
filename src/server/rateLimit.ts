import type { SqliteDatabase } from "./db";

export function createRateLimiter(db: SqliteDatabase) {
  return {
    consume(scope: string, scopeKey: string, seconds: number): boolean {
      db.prepare("DELETE FROM rate_limits WHERE expires_at <= datetime('now')").run();
      const existing = db
        .prepare("SELECT id FROM rate_limits WHERE scope = ? AND scope_key = ? AND expires_at > datetime('now') LIMIT 1")
        .get(scope, scopeKey);
      if (existing) return false;
      db.prepare("INSERT INTO rate_limits (scope, scope_key, expires_at) VALUES (?, ?, datetime('now', ?))").run(
        scope,
        scopeKey,
        `+${seconds} seconds`
      );
      return true;
    }
  };
}
