const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");
const { app } = require("electron");

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function openDb() {
  const userData = app.getPath("userData");
  ensureDir(userData);

  const dbPath = path.join(userData, "snippets.sqlite");
  const db = new Database(dbPath);

  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS snippets (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '',
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_snippets_updatedAt ON snippets(updatedAt DESC);
    CREATE INDEX IF NOT EXISTS idx_snippets_title ON snippets(title);
  `);

  // Seed if empty
  const count = db.prepare("SELECT COUNT(*) as c FROM snippets").get().c;
  if (count === 0) {
    const now = Date.now();
    const insert = db.prepare(`
      INSERT INTO snippets (id, title, body, tags, createdAt, updatedAt)
      VALUES (@id, @title, @body, @tags, @createdAt, @updatedAt)
    `);
    insert.run({
      id: cryptoRandomId(),
      title: "Git: checkout new branch",
      body: "git checkout -b feature/my-branch",
      tags: "git",
      createdAt: now,
      updatedAt: now
    });
    insert.run({
      id: cryptoRandomId(),
      title: "Docker: prune",
      body: "docker system prune -af",
      tags: "docker",
      createdAt: now,
      updatedAt: now
    });
    insert.run({
      id: cryptoRandomId(),
      title: "K8s: get pods",
      body: "kubectl get pods -A",
      tags: "k8s,kubernetes",
      createdAt: now,
      updatedAt: now
    });
  }

  return db;
}

function cryptoRandomId() {
  // Avoid importing crypto for MVP; fine for IDs.
  return "id_" + Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function makeRepo(db) {
  const createStmt = db.prepare(`
    INSERT INTO snippets (id, title, body, tags, createdAt, updatedAt)
    VALUES (@id, @title, @body, @tags, @createdAt, @updatedAt)
  `);

  const deleteStmt = db.prepare(`DELETE FROM snippets WHERE id = ?`);

  const updateStmt = db.prepare(`
    UPDATE snippets
    SET title=@title, body=@body, tags=@tags, updatedAt=@updatedAt
    WHERE id=@id
  `);

  const recentStmt = db.prepare(`
    SELECT * FROM snippets
    ORDER BY updatedAt DESC
    LIMIT ?
  `);

  const searchStmt = db.prepare(`
    SELECT * FROM snippets
    WHERE lower(title) LIKE @p OR lower(body) LIKE @p OR lower(tags) LIKE @p
    ORDER BY updatedAt DESC
    LIMIT @limit
  `);

  return {
    recent(limit = 50) {
      return recentStmt.all(limit);
    },
    search(query, limit = 50) {
      const q = (query || "").trim().toLowerCase();
      if (!q) return recentStmt.all(limit);
      return searchStmt.all({ p: `%${q}%`, limit });
    },
    create({ title, body, tags }) {
      const now = Date.now();
      const row = {
        id: cryptoRandomId(),
        title: (title || "").trim() || "(Untitled)",
        body: body || "",
        tags: (tags || "").trim(),
        createdAt: now,
        updatedAt: now
      };
      createStmt.run(row);
      return row;
    },
    update({ id, title, body, tags }) {
      const now = Date.now();
      updateStmt.run({
        id,
        title: (title || "").trim() || "(Untitled)",
        body: body || "",
        tags: (tags || "").trim(),
        updatedAt: now
      });
      return { id };
    },
    delete(id) {
      deleteStmt.run(id);
      return { id };
    }
  };
}

module.exports = { openDb, makeRepo };
