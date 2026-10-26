-- Multi-user sync: one row set per owner (`design-plans/multi-user.md` §2).
--
-- SQLite cannot add a column to a primary key, so the table is rebuilt. Every existing row is
-- parked under the `legacy@local` marker, which no Access identity can ever present: the
-- deploy adopts them with `npm run adopt -- <email>` (docs/DEPLOY.md), which normalizes the
-- email with JavaScript rules and refuses to finish while a row stays parked. `rev` values
-- are copied unchanged so every device keeps its cursor and a pull after the migration is a
-- no-op.

CREATE TABLE rows_v2 (
  owner      TEXT    NOT NULL,
  entity     TEXT    NOT NULL,
  id         TEXT    NOT NULL,
  rev        INTEGER NOT NULL,
  updated_at TEXT    NOT NULL,
  deleted_at TEXT,
  payload    TEXT    NOT NULL,
  PRIMARY KEY (owner, entity, id)
);

INSERT INTO rows_v2 (owner, entity, id, rev, updated_at, deleted_at, payload)
  SELECT 'legacy@local', entity, id, rev, updated_at, deleted_at, payload FROM rows;

DROP TABLE rows;

ALTER TABLE rows_v2 RENAME TO rows;

DROP INDEX IF EXISTS rows_rev;

CREATE INDEX rows_owner_rev ON rows (owner, rev);
