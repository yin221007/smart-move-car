import { describe, expect, it, vi } from "vitest";
import { buildApp } from "../../src/server/app";
import { createDatabase } from "../../src/server/db";

function seedVehicle() {
  const db = createDatabase(":memory:");
  db.prepare("INSERT INTO users (id, role, name, password_hash) VALUES (1, 'owner', '张三', 'hash')").run();
  db.prepare(`
    INSERT INTO vehicles (
      owner_id, vehicle_code, plate_number, plate_display, brand_model, color, parking_hint,
      owner_phone, pushplus_token, allow_phone_call, allow_wechat_notify
    )
    VALUES (1, 'abc123', '沪A12345', '沪A·2345', '特斯拉 Model Y', '白色', '地库 B2', '13800138000', 'token', 1, 1)
  `).run();
  return db;
}

function chinaDateStamp() {
  const parts = new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}${values.month}${values.day}`;
}

describe("public vehicle API", () => {
  it("returns public vehicle details without secrets", async () => {
    const app = buildApp({
      db: seedVehicle(),
      externalUrl: "https://car.example.com",
      sessionSecret: "x".repeat(32),
      rateLimitSeconds: 60
    });

    const response = await app.inject({ method: "GET", url: "/api/public/vehicles/abc123" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ plateDisplay: "沪A·2345", maskedPhone: "138****8000" });
    expect(response.body).not.toContain("token");
  });

  it("creates a move request and sends a PushPlus notification", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ code: 200, msg: "请求成功" })
    });
    const db = seedVehicle();
    const app = buildApp({
      db,
      externalUrl: "https://car.example.com",
      sessionSecret: "x".repeat(32),
      rateLimitSeconds: 60,
      fetchImpl: fetchMock
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/public/vehicles/abc123/notify",
      payload: {
        locationText: "地库 B2 电梯口",
        latitude: 31.2304,
        longitude: 121.4737,
        message: "挡住出口了",
        clientRequestId: "client-1"
      }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "sent", message: "已通知车主" });
    expect(response.json().requestCode).toBe(`${chinaDateStamp()}-0001`);
    expect(fetchMock).toHaveBeenCalledOnce();
    const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body as string) as { content: string };
    const rows = db.prepare("SELECT * FROM move_requests").all() as Array<{ request_code: string; owner_reply_token: string }>;
    expect(rows).toHaveLength(1);
    expect(sentBody.content).toContain(`https://car.example.com/r/${rows[0].owner_reply_token}`);
    expect(sentBody.content).not.toContain(`https://car.example.com/r/${rows[0].request_code}`);
  });

  it("generates readable daily request codes in sequence", async () => {
    const db = seedVehicle();
    db.prepare(`
      INSERT INTO vehicles (
        owner_id, vehicle_code, plate_number, plate_display, brand_model, color, parking_hint,
        owner_phone, pushplus_token, allow_phone_call, allow_wechat_notify
      )
      VALUES (1, 'def456', '沪B12345', '沪B·2345', '比亚迪 汉', '黑色', '', '13800138001', 'token', 1, 1)
    `).run();
    const app = buildApp({
      db,
      externalUrl: "https://car.example.com",
      sessionSecret: "x".repeat(32),
      rateLimitSeconds: 60,
      fetchImpl: vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ code: 200 })
      })
    });

    const first = await app.inject({
      method: "POST",
      url: "/api/public/vehicles/abc123/notify",
      payload: { locationText: "A", message: "B", clientRequestId: "1" }
    });
    const second = await app.inject({
      method: "POST",
      url: "/api/public/vehicles/def456/notify",
      payload: { locationText: "A", message: "B", clientRequestId: "2" }
    });

    expect(first.json().requestCode).toBe(`${chinaDateStamp()}-0001`);
    expect(second.json().requestCode).toBe(`${chinaDateStamp()}-0002`);
  });

  it("rate limits repeated vehicle notifications", async () => {
    const db = seedVehicle();
    const app = buildApp({
      db,
      externalUrl: "https://car.example.com",
      sessionSecret: "x".repeat(32),
      rateLimitSeconds: 60,
      fetchImpl: vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ code: 200 })
      })
    });

    await app.inject({
      method: "POST",
      url: "/api/public/vehicles/abc123/notify",
      payload: { locationText: "A", message: "B", clientRequestId: "1" }
    });
    const response = await app.inject({
      method: "POST",
      url: "/api/public/vehicles/abc123/notify",
      payload: { locationText: "A", message: "B", clientRequestId: "2" }
    });

    expect(response.statusCode).toBe(429);
    expect(response.json()).toMatchObject({ status: "rate_limited" });
  });

  it("lets an owner reply to a move request and lets the scanner read it", async () => {
    const db = seedVehicle();
    db.prepare(`
      INSERT INTO move_requests (
        vehicle_id, request_code, owner_reply_token, location_text, message, notify_channel, notify_status
      ) VALUES (1, 'req-owner-reply', 'reply-token-1', '地库 B2', '挡路了请挪车', 'pushplus', 'sent')
    `).run();
    const app = buildApp({
      db,
      externalUrl: "https://car.example.com",
      sessionSecret: "x".repeat(32),
      rateLimitSeconds: 60
    });

    const replyResponse = await app.inject({
      method: "POST",
      url: "/api/public/replies/reply-token-1",
      payload: { reply: "马上下来" }
    });
    const statusResponse = await app.inject({
      method: "GET",
      url: "/api/public/requests/req-owner-reply"
    });

    expect(replyResponse.statusCode).toBe(200);
    expect(statusResponse.json()).toMatchObject({ requestCode: "req-owner-reply", ownerReply: "马上下来" });
  });

  it("does not let the scanner request code write an owner reply", async () => {
    const db = seedVehicle();
    db.prepare(`
      INSERT INTO move_requests (
        vehicle_id, request_code, owner_reply_token, location_text, message, notify_channel, notify_status
      ) VALUES (1, 'req-visible-to-scanner', 'reply-secret-token', '地库 B2', '挡路了请挪车', 'pushplus', 'sent')
    `).run();
    const app = buildApp({
      db,
      externalUrl: "https://car.example.com",
      sessionSecret: "x".repeat(32),
      rateLimitSeconds: 60
    });

    const response = await app.inject({
      method: "POST",
      url: "/api/public/requests/req-visible-to-scanner/reply",
      payload: { reply: "伪造回复" }
    });

    expect(response.statusCode).toBe(404);
    expect(db.prepare("SELECT owner_reply FROM move_requests WHERE request_code = ?").get("req-visible-to-scanner")).toMatchObject({
      owner_reply: null
    });
  });
});
