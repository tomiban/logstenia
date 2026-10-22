// Storage-agnostic repository for plans.
// Implementations: idb (local), future: HTTP backend.

export interface PlansData {
  categories: any[];
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
const ROOT_KEY = 'root';
const VIDEO_CATALOG_VERSION_KEY = 'video-catalog-version';

function getDB() {
  return getSharedDB();
}

export const idbPlansRepository: PlansRepository = {
  async load() {
    const db = await getDB();
    const rec = await db.get(STORE, ROOT_KEY);
    return rec ? (rec.data as PlansData) : null;
  },
  async save(data) {
    const db = await getDB();
    await db.put(STORE, { id: ROOT_KEY, data });
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
