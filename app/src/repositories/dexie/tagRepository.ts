import { DexieRepository } from './baseRepository';
import type { ITagRepository, TagRecord } from '../types';

export class DexieTagRepository extends DexieRepository<TagRecord> implements ITagRepository {
  protected readonly entity = 'tags' as const;
}
