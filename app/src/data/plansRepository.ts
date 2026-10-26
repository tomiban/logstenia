// Storage-agnostic repository for plans.
// Implementations: idb (local), future: HTTP backend.

import type { Category } from '@/types';

export interface PlansData {
  categories: Category[];
}

export interface PlansRepository {
  load(): Promise<PlansData | null>;
  save(data: PlansData): Promise<void>;
  seedIfEmpty(seed: PlansData): Promise<void>;
  /**
   * False only before the catalogue was ever seeded. An emptied catalogue must stay empty:
   * without this flag the next init would treat "the user deleted every category" as
   * "nothing was ever stored" and resurrect the bundled seed.
   */
  getSeeded(): Promise<boolean>;
  setSeeded(): Promise<void>;
  getVideoCatalogVersion(): Promise<number>;
  setVideoCatalogVersion(version: number): Promise<void>;
}

// ---- idb implementation ----
import { db } from '@/db';
import { enqueueOutbox, withOutboxWrite } from '../repositories/sync/outbox';

const STORE = 'plans';
const VIDEO_CATALOG_VERSION_KEY = 'video-catalog-version';
const SEEDED_KEY = 'catalogue-seeded';

/**
 * Frozen timestamp of the bundled seed (spec S8, decision L8). The seed is a catalogue
 * nobody edited, so it must never win last-write-wins against a real edit made on another
 * device: a constant old value publishes on an empty server (nothing to compare against),
 * loses against an edited category (`stale_server_newer`), and loses to the pull on a new
 * device that already has a populated server.
 */
export const SEED_UPDATED_AT = '1970-01-01T00:00:00.000Z';

/**
 * One category row (spec S2): the category document is the sync unit, `position` keeps
 * the catalogue order and `updatedAt` / `deletedAt` are the shared LWW/tombstone fields.
 */
interface CategoryRow {
  id: string;
  category: unknown;
  position: number;
  updatedAt: string;
  deletedAt: string | null;
}

type PlansRow = Record<string, unknown>;

function nowISO(): string {
  return new Date().toISOString();
}

/** Category rows hold the document payload; the version row is metadata. */
function isCategoryRow(row: PlansRow): row is PlansRow & CategoryRow {
  return typeof row.id === 'string' && row.category != null && typeof row.category === 'object';
}

function isLive(row: CategoryRow): boolean {
  return row.deletedAt == null;
}

function categoryId(category: unknown): string | null {
  const id = (category as { id?: unknown } | null | undefined)?.id;
  return typeof id === 'string' ? id : null;
}

/** Structural comparison, so an unchanged category (same content, same order) is not rewritten. */
function isSameValue(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a === 'number' && typeof b === 'number') return Number.isNaN(a) && Number.isNaN(b);
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;

  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every(
    (key) => Object.hasOwn(b, key) && isSameValue((a as PlansRow)[key], (b as PlansRow)[key]),
  );
}

async function readCategoryRows(): Promise<(PlansRow & CategoryRow)[]> {
  return ((await db.plans.toArray()) as PlansRow[]).filter(isCategoryRow);
}

/** Whether the catalogue was seeded at least once (the marker row is metadata, not a category). */
async function readSeeded(): Promise<boolean> {
  return (await db.plans.get(SEEDED_KEY)) != null;
}

async function writeSeeded(): Promise<void> {
  await db.plans.put({ id: SEEDED_KEY, seeded: true });
}

/** A catalogue stored before this flag existed counts as seeded, so emptying it stays empty. */
async function adoptSeededFlag(): Promise<void> {
  if (await readSeeded()) return;
  await writeSeeded();
}

/**
 * Stores the changed category rows and their pending push entries in one transaction
 * (spec S5): the row and its outbox entry land together or not at all, so a saved edit
 * can never be missing from the next sync. The metadata row never goes through here.
 */
async function writeCategoryRows(rows: CategoryRow[]): Promise<void> {
  if (rows.length === 0) return;
  // Row and outbox entry must commit in one transaction: the single-store `db` shim cannot express that.
  await withOutboxWrite(STORE, async (tx) => {
    const store = tx.objectStore(STORE);
    for (const row of rows) {
      await store.put(row);
      await enqueueOutbox(tx, {
        entity: STORE,
        id: row.id,
        updatedAt: row.updatedAt,
        deletedAt: row.deletedAt,
        row,
      });
    }
  });
}

/** The version row is metadata; its payload is narrowed like every other stored payload. */
function storedVersion(value: unknown): number {
  const version = (value as { version?: unknown } | null | undefined)?.version;
  return typeof version === 'number' ? version : 0;
}

/** Rows come from storage, so the payload is checked before it reaches the UI. */
function toCategory(value: unknown): Category | null {
  if (typeof value !== 'object' || value === null) return null;
  const category = value as Partial<Category>;
  return typeof category.id === 'string' ? (category as Category) : null;
}

export const idbPlansRepository: PlansRepository = {
  async load() {
    const live = (await readCategoryRows()).filter(isLive);
    const ordered = live.sort((a, b) => a.position - b.position);
    const categories = ordered.flatMap((row) => {
      const category = toCategory(row.category);
      return category === null ? [] : [category];
    });
    return categories.length === 0 ? null : { categories };
  },
  async save(data) {
    const stored = await readCategoryRows();
    const storedById = new Map(stored.map((row) => [row.id, row]));
    const now = nowISO();
    const writes: CategoryRow[] = [];
    const kept = new Set<string>();

    data.categories.forEach((category, position) => {
      const id = categoryId(category);
      if (!id) return;
      kept.add(id);

      const current = storedById.get(id);
      const unchanged =
        current !== undefined &&
        isLive(current) &&
        current.position === position &&
        isSameValue(current.category, category);
      if (unchanged) return;

      writes.push({ id, category, position, updatedAt: now, deletedAt: null });
    });

    for (const row of stored) {
      if (!isLive(row) || kept.has(row.id)) continue;
      writes.push({ ...row, updatedAt: now, deletedAt: now });
    }

    await writeCategoryRows(writes);
  },
  async seedIfEmpty(seed) {
    const existing = await this.load();
    if (existing) {
      await adoptSeededFlag();
      return;
    }
    if (await readSeeded()) return;

    // Stamped here instead of through `save()`: an ordinary save uses the current time,
    // and a seed carrying `now` would overwrite real edits under category-level LWW.
    const rows: CategoryRow[] = [];
    seed.categories.forEach((category, position) => {
      const id = categoryId(category);
      if (!id) return;
      rows.push({ id, category, position, updatedAt: SEED_UPDATED_AT, deletedAt: null });
    });

    await writeCategoryRows(rows);
    await writeSeeded();
  },
  getSeeded: readSeeded,
  setSeeded: writeSeeded,
  async getVideoCatalogVersion() {
    return storedVersion(await db.plans.get(VIDEO_CATALOG_VERSION_KEY));
  },
  async setVideoCatalogVersion(version) {
    await db.plans.put({ id: VIDEO_CATALOG_VERSION_KEY, version });
  },
};

// Default repository (swap for backend implementation later).
export const plansRepository: PlansRepository = idbPlansRepository;
