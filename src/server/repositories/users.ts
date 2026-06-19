import type { SqliteDatabase } from "../db";
import { hashPassword } from "../security";

export interface UserRecord {
  id: number;
  role: "admin" | "owner";
  name: string;
  phone: string | null;
  password_hash: string;
  status: "active" | "disabled";
}

export function createUserRepository(db: SqliteDatabase) {
  return {
    async ensureInitialAdmin(password: string): Promise<void> {
      const existing = db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
      if (existing) return;
      const passwordHash = await hashPassword(password);
      db.prepare("INSERT INTO users (role, name, password_hash) VALUES ('admin', '管理员', ?)").run(passwordHash);
    },

    findByName(name: string): UserRecord | undefined {
      return db.prepare("SELECT * FROM users WHERE name = ? AND status = 'active'").get(name) as UserRecord | undefined;
    },

    findById(id: number): UserRecord | undefined {
      return db.prepare("SELECT * FROM users WHERE id = ? AND status = 'active'").get(id) as UserRecord | undefined;
    }
  };
}
