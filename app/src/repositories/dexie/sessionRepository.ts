import { DexieRepository } from './baseRepository';
import type { ISessionRepository, SessionRecord } from '../types';

export class DexieSessionRepository
  extends DexieRepository<SessionRecord>
  implements ISessionRepository
{
  protected readonly entity = 'sessions' as const;
}
