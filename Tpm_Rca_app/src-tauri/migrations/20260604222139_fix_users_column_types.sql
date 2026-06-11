
CREATE TABLE users_new (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'Viewer',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at TEXT
);

INSERT INTO users_new (id, username, email, password_hash, role, is_active, created_at, last_login_at)
SELECT id, username, email, password_hash, role, CAST(REPLACE(REPLACE(is_active, '''', ''), '"', '') AS INTEGER), created_at, last_login_at FROM users;

DROP TABLE users;

ALTER TABLE users_new RENAME TO users;