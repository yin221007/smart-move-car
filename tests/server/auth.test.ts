import { describe, expect, it } from "vitest";
import { createDatabase } from "../../src/server/db";
import { createUserRepository } from "../../src/server/repositories/users";
import { hashPassword, maskPhone, verifyPassword } from "../../src/server/security";

describe("security helpers", () => {
  it("hashes and verifies passwords", async () => {
    const hash = await hashPassword("correct horse battery staple");

    expect(hash).not.toContain("correct horse");
    await expect(verifyPassword("correct horse battery staple", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong password", hash)).resolves.toBe(false);
  });

  it("masks phone numbers", () => {
    expect(maskPhone("13800138000")).toBe("138****8000");
    expect(maskPhone(null)).toBeNull();
  });
});

describe("user repository", () => {
  it("creates exactly one initial admin", async () => {
    const db = createDatabase(":memory:");
    const repo = createUserRepository(db);

    await repo.ensureInitialAdmin("AdminPass123!");
    await repo.ensureInitialAdmin("AnotherPass123!");

    const admins = db.prepare("SELECT role FROM users WHERE role = 'admin'").all();
    expect(admins).toHaveLength(1);
  });
});
