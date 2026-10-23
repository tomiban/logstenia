import { DexieRepository } from './baseRepository';
import type { IProgressRepository, ProgressRecord } from '../types';

export class DexieProgressRepository
  extends DexieRepository<ProgressRecord>
  implements IProgressRepository
{
  protected readonly entity = 'progress' as const;
}
