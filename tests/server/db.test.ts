import { describe, expect, it } from "vitest";
import { createDatabase } from "../../src/server/db";

describe("database migrations", () => {
  it("creates the core tables", () => {
    const db = createDatabase(":memory:");
    const rows = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as Array<{
      name: string;
    }>;

    expect(rows.map((row) => row.name)).toContain("users");
    expect(rows.map((row) => row.name)).toContain("vehicles");
    expect(rows.map((row) => row.name)).toContain("move_requests");
    expect(rows.map((row) => row.name)).toContain("sessions");
    expect(rows.map((row) => row.name)).toContain("rate_limits");
  });
});
