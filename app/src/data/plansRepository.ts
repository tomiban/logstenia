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
  getVideoCatalogVersion(): Promise<number>;
  setVideoCatalogVersion(version: number): Promise<void>;
}

// ---- idb implementation ----
import { getDB as getSharedDB } from '../db/open';

const STORE = 'plans';
const VIDEO_CATALOG_VERSION_KEY = 'video-catalog-version';

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

function getDB() {
  return getSharedDB();
}

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
  const db = await getDB();
  return ((await db.getAll(STORE)) as PlansRow[]).filter(isCategoryRow);
}

async function writeRows(rows: CategoryRow[]): Promise<void> {
  if (rows.length === 0) return;
  const db = await getDB();
  const tx = db.transaction(STORE, 'readwrite');
  await Promise.all(rows.map((row) => tx.store.put(row)));
  await tx.done;
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

    await writeRows(writes);
  },
  async seedIfEmpty(seed) {
    const existing = await this.load();
    if (!existing) {
      await this.save(seed);
    }
  },
  async getVideoCatalogVersion() {
    const db = await getDB();
    const record = await db.get(STORE, VIDEO_CATALOG_VERSION_KEY);
    return typeof record?.version === 'number' ? record.version : 0;
  },
  async setVideoCatalogVersion(version) {
    const db = await getDB();
    await db.put(STORE, { id: VIDEO_CATALOG_VERSION_KEY, version });
  },
};

// Default repository (swap for backend implementation later).
export const plansRepository: PlansRepository = idbPlansRepository;
