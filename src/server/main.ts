import fs from "node:fs";
import path from "node:path";
import fastifyStatic from "@fastify/static";
import { buildApp } from "./app";
import { loadConfig, sqlitePathFromUrl } from "./config";
import { createDatabase } from "./db";
import { createUserRepository } from "./repositories/users";

const config = loadConfig();
const sqlitePath = sqlitePathFromUrl(config.DATABASE_URL);
fs.mkdirSync(path.dirname(sqlitePath), { recursive: true });
const db = createDatabase(sqlitePath);
await createUserRepository(db).ensureInitialAdmin(config.ADMIN_INITIAL_PASSWORD);
seedTestData();

const app = buildApp({
  db,
  externalUrl: config.EXTERNAL_URL,
  sessionSecret: config.SESSION_SECRET,
  rateLimitSeconds: config.DEFAULT_RATE_LIMIT_SECONDS,
  nodeEnv: config.NODE_ENV
});

const clientPath = path.resolve("dist/client");
if (fs.existsSync(clientPath)) {
  app.register(fastifyStatic, {
    root: clientPath
  });
  app.setNotFoundHandler(async (_request, reply) => {
    return reply.sendFile("index.html");
  });
}

await app.listen({ host: "0.0.0.0", port: config.APP_PORT });

function seedTestData() {
  if (config.NODE_ENV !== "test") return;
  const existing = db.prepare("SELECT id FROM vehicles WHERE vehicle_code = 'seed-demo'").get();
  if (existing) return;
  db.prepare("INSERT OR IGNORE INTO users (id, role, name, phone, password_hash) VALUES (100, 'owner', '测试车主', '13800138000', 'hash')").run();
  db.prepare(`
    INSERT INTO vehicles (
      owner_id, vehicle_code, plate_number, plate_display, brand_model, color, parking_hint,
      owner_phone, pushplus_token, allow_phone_call, allow_wechat_notify
    )
    VALUES (100, 'seed-demo', '沪A12345', '沪A·2345', '特斯拉 Model Y', '白色', '地库 B2', '13800138000', 'test-token', 1, 1)
  `).run();
}
