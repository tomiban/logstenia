import { db } from '@/db';
import type { ISessionRepository, SessionRecord } from '../types';

export class DexieSessionRepository implements ISessionRepository {
  async list(): Promise<SessionRecord[]> {
    return (await db.sessions.toArray()) as SessionRecord[];
  }
  async add(session: SessionRecord): Promise<void> {
    await db.sessions.add(session);
  }
}
