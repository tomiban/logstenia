-- Server schema for the multi-device sync mirror (design-plans/backend-sync.md §4).

CREATE TABLE rows (
  entity      TEXT    NOT NULL,
  id          TEXT    NOT NULL,
  rev         INTEGER NOT NULL,
  updated_at  TEXT    NOT NULL,
  deleted_at  TEXT,
  payload     TEXT    NOT NULL,
  PRIMARY KEY (entity, id)
);

CREATE INDEX rows_rev ON rows (rev);

CREATE TABLE meta (
  key   TEXT PRIMARY KEY,
  value INTEGER NOT NULL
);

INSERT INTO meta (key, value) VALUES ('rev', 0);
