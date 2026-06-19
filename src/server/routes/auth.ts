import { nanoid } from "nanoid";
import { z } from "zod";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { BuildAppOptions } from "../app";
import { createUserRepository, type UserRecord } from "../repositories/users";
import { verifyPassword } from "../security";

declare module "fastify" {
  interface FastifyRequest {
    currentUser?: Pick<UserRecord, "id" | "role" | "name">;
  }
}

const loginSchema = z.object({
  name: z.string().trim().min(1),
  password: z.string().min(1)
});

export async function loadCurrentUser(request: FastifyRequest, options: BuildAppOptions): Promise<UserRecord | undefined> {
  const repo = createUserRepository(options.db);
  if (options.nodeEnv === "test") {
    const testUserId = request.headers["x-test-user-id"];
    if (typeof testUserId === "string") return repo.findById(Number(testUserId));
  }
  const sessionId = request.cookies.session_id;
  if (!sessionId) return undefined;
  const row = options.db
    .prepare(
      `SELECT users.* FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.id = ? AND sessions.expires_at > datetime('now') AND users.status = 'active'`
    )
    .get(sessionId) as UserRecord | undefined;
  return row;
}

export async function requireUser(request: FastifyRequest, options: BuildAppOptions): Promise<UserRecord> {
  const user = await loadCurrentUser(request, options);
  if (!user) throw Object.assign(new Error("unauthorized"), { statusCode: 401 });
  request.currentUser = { id: user.id, role: user.role, name: user.name };
  return user;
}

export async function registerAuthRoutes(app: FastifyInstance, options: BuildAppOptions): Promise<void> {
  app.post("/api/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "用户名或密码不正确" });
    const repo = createUserRepository(options.db);
    const user = repo.findByName(parsed.data.name);
    if (!user || !(await verifyPassword(parsed.data.password, user.password_hash))) {
      return reply.code(401).send({ error: "用户名或密码不正确" });
    }
    const sessionId = nanoid(32);
    options.db
      .prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, datetime('now', '+30 days'))")
      .run(sessionId, user.id);
    reply.setCookie("session_id", sessionId, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: options.externalUrl.startsWith("https://")
    });
    return { id: user.id, role: user.role, name: user.name, phone: user.phone };
  });

  app.post("/api/auth/logout", async (request, reply) => {
    const sessionId = request.cookies.session_id;
    if (sessionId) options.db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
    reply.clearCookie("session_id", { path: "/" });
    return { ok: true };
  });

  app.get("/api/auth/me", async (request, reply) => {
    const user = await loadCurrentUser(request, options);
    if (!user) return reply.code(401).send({ error: "未登录" });
    return { id: user.id, role: user.role, name: user.name, phone: user.phone };
  });
}
