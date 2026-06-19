import { describe, expect, it } from "vitest";
import { buildApp } from "../../src/server/app";
import { createDatabase } from "../../src/server/db";

describe("admin APIs", () => {
  it("prevents an owner from reading another owner's vehicles", async () => {
    const db = createDatabase(":memory:");
    db.prepare("INSERT INTO users (id, role, name, password_hash) VALUES (1, 'owner', 'owner1', 'hash')").run();
    db.prepare("INSERT INTO users (id, role, name, password_hash) VALUES (2, 'owner', 'owner2', 'hash')").run();
    db.prepare(
      "INSERT INTO vehicles (owner_id, vehicle_code, plate_number, plate_display, brand_model, color) VALUES (2, 'v2', '粤B12345', '粤B·2345', '比亚迪 宋', '灰色')"
    ).run();
    const app = buildApp({
      db,
      externalUrl: "https://car.example.com",
      sessionSecret: "x".repeat(32),
      rateLimitSeconds: 60,
      nodeEnv: "test"
    });

    const response = await app.inject({ method: "GET", url: "/api/vehicles", headers: { "x-test-user-id": "1" } });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
  });
});
