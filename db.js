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

    CREATE TABLE IF NOT EXISTS clipboard_items (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL UNIQUE,
      createdAt INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_snippets_updatedAt ON snippets(updatedAt DESC);
    CREATE INDEX IF NOT EXISTS idx_snippets_title ON snippets(title);
    CREATE INDEX IF NOT EXISTS idx_clipboard_createdAt ON clipboard_items(createdAt DESC);
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

  const insertClipStmt = db.prepare(`
    INSERT INTO clipboard_items (id, text, createdAt)
    VALUES (@id, @text, @createdAt)
  `);

  const listClipStmt = db.prepare(`
    SELECT id, text, createdAt FROM clipboard_items
    ORDER BY createdAt DESC
    LIMIT ?
  `);

  const searchClipStmt = db.prepare(`
    SELECT id, text, createdAt FROM clipboard_items
    WHERE lower(text) LIKE @p
    ORDER BY createdAt DESC
    LIMIT @limit
  `);

  const pruneClipStmt = db.prepare(`
    DELETE FROM clipboard_items
    WHERE id IN (
      SELECT id FROM clipboard_items
      ORDER BY createdAt DESC
      LIMIT -1 OFFSET ?
    )
  `);

  // small helper
  function now() { return Date.now(); }

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
      const current = now();
      const row = {
        id: cryptoRandomId(),
        title: (title || "").trim() || "(Untitled)",
        body: body || "",
        tags: (tags || "").trim(),
        createdAt: current,
        updatedAt: current
      };
      createStmt.run(row);
      return row;
    },
    update({ id, title, body, tags }) {
      const current = now();
      updateStmt.run({
        id,
        title: (title || "").trim() || "(Untitled)",
        body: body || "",
        tags: (tags || "").trim(),
        updatedAt: current
      });
      return { id };
    },
    delete(id) {
      deleteStmt.run(id);
      return { id };
    },

    /**
     * Add a clipboard entry and prune to maxItems (default 200)
     */
addClipboard(text, maxItems = 200) {
  const t = String(text ?? "");
  if (!t.trim()) return null;
  if (t.length > 100_000) return null;

  const current = Date.now();

  // Atomic upsert: insert new row, or update createdAt if text already exists
  db.prepare(`
    INSERT INTO clipboard_items (id, text, createdAt)
    VALUES (?, ?, ?)
    ON CONFLICT(text)
    DO UPDATE SET createdAt = excluded.createdAt
  `).run(cryptoRandomId(), t, current);

  // prune to keep only newest `maxItems`
  pruneClipStmt.run(maxItems);

  return true;
},

    /**
     * List recent clipboard items (most recent first)
     */
    listClipboard(limit = 100) {
      return listClipStmt.all(limit);
    },

    /**
     * Search clipboard items by text (case-insensitive)
     */
    searchClipboard(q, limit = 100) {
      const p = `%${(q || "").trim().toLowerCase()}%`;
      return searchClipStmt.all({ p, limit });
    }
  };
}

module.exports = { openDb, makeRepo };
