import Database from "better-sqlite3";

export type SqliteDatabase = Database.Database;

export function createDatabase(filename: string): SqliteDatabase {
  const db = new Database(filename);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

export function migrate(db: SqliteDatabase): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT NOT NULL CHECK (role IN ('admin', 'owner')),
      name TEXT NOT NULL UNIQUE,
      phone TEXT,
      password_hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS vehicles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      vehicle_code TEXT NOT NULL UNIQUE,
      plate_number TEXT NOT NULL,
      plate_display TEXT NOT NULL,
      brand_model TEXT NOT NULL,
      color TEXT NOT NULL,
      parking_hint TEXT NOT NULL DEFAULT '',
      owner_phone TEXT,
      pushplus_token TEXT,
      allow_phone_call INTEGER NOT NULL DEFAULT 1,
      allow_wechat_notify INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS move_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vehicle_id INTEGER NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
      request_code TEXT NOT NULL UNIQUE,
      location_text TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      map_url TEXT,
      message TEXT NOT NULL,
      ip_hash TEXT,
      user_agent TEXT,
      notify_channel TEXT NOT NULL,
      notify_status TEXT NOT NULL CHECK (notify_status IN ('pending', 'sent', 'failed', 'rate_limited')),
      notify_response TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS rate_limits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      scope TEXT NOT NULL,
      scope_key TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_vehicles_owner_id ON vehicles(owner_id);
    CREATE INDEX IF NOT EXISTS idx_move_requests_vehicle_id ON move_requests(vehicle_id);
    CREATE INDEX IF NOT EXISTS idx_rate_limits_scope_key ON rate_limits(scope, scope_key);
  `);
  addColumnIfMissing(db, "move_requests", "owner_reply", "TEXT");
  addColumnIfMissing(db, "move_requests", "owner_replied_at", "TEXT");
  addColumnIfMissing(db, "move_requests", "owner_reply_token", "TEXT");
  db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_move_requests_owner_reply_token ON move_requests(owner_reply_token)");
}

function addColumnIfMissing(db: SqliteDatabase, table: string, column: string, definition: string): void {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (columns.some((item) => item.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
