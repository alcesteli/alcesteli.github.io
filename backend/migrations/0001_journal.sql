CREATE TABLE posts (
  id TEXT PRIMARY KEY NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  published INTEGER NOT NULL DEFAULT 0 CHECK (published IN (0, 1)),
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX posts_published_date ON posts(published, published_at);
CREATE TABLE comments (
  id TEXT PRIMARY KEY NOT NULL,
  post_slug TEXT NOT NULL,
  parent_id TEXT REFERENCES comments(id) ON DELETE CASCADE,
  author_name TEXT NOT NULL,
  body TEXT NOT NULL,
  approved INTEGER NOT NULL DEFAULT 0 CHECK (approved IN (0, 1)),
  is_admin INTEGER NOT NULL DEFAULT 0 CHECK (is_admin IN (0, 1)),
  created_at TEXT NOT NULL
);
CREATE INDEX comments_post_approved_date ON comments(post_slug, approved, created_at);
CREATE INDEX comments_parent ON comments(parent_id);
CREATE INDEX comments_approved_date ON comments(approved, created_at);
CREATE TABLE comment_limits (key TEXT PRIMARY KEY, last_sent INTEGER NOT NULL);
