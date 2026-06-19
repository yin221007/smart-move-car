import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/server/app";
import { createDatabase } from "../../src/server/db";

function seededDb() {
  const db = createDatabase(":memory:");
  db.prepare("INSERT INTO users (id, role, name, password_hash) VALUES (1, 'owner', 'owner1', 'hash')").run();
  db.prepare(`
    INSERT INTO vehicles (id, owner_id, vehicle_code, plate_number, plate_display, brand_model, color, owner_phone)
    VALUES (1, 1, 'abc123', '沪A12345', '沪A·2345', '特斯拉 Model Y', '白色', '13800138000')
  `).run();
  return db;
}

describe("QR and phone routes", () => {
  it("returns svg QR for a vehicle", async () => {
    const app = buildApp({
      db: seededDb(),
      externalUrl: "https://car.example.com",
      sessionSecret: "x".repeat(32),
      rateLimitSeconds: 60,
      nodeEnv: "test"
    });

    const response = await app.inject({ method: "GET", url: "/api/vehicles/1/qr", headers: { "x-test-user-id": "1" } });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toContain("image/svg+xml");
    expect(response.body).toContain("svg");
  });

  it("redirects allowed public phone requests to tel link", async () => {
    const app = buildApp({
      db: seededDb(),
      externalUrl: "https://car.example.com",
      sessionSecret: "x".repeat(32),
      rateLimitSeconds: 60
    });

    const response = await app.inject({ method: "GET", url: "/api/public/vehicles/abc123/phone" });

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe("tel:13800138000");
  });
});
