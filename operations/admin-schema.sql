-- D1 database: zgland-admin (private). Run once before activation.
CREATE TABLE IF NOT EXISTS admin_attempts (
  ip_key TEXT PRIMARY KEY,
  failures INTEGER NOT NULL CHECK(failures BETWEEN 0 AND 20),
  locked_until INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS admin_sessions_expiry ON admin_sessions(expires_at);
CREATE TABLE IF NOT EXISTS admin_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at INTEGER NOT NULL,
  event TEXT NOT NULL,
  ip_key TEXT NOT NULL,
  ip_address TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  region TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS admin_audit_time ON admin_audit(created_at);
