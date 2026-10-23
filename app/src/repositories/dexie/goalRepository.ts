import { DexieRepository } from './baseRepository';
import type { GoalRecord, IGoalRepository } from '../types';

export class DexieGoalRepository extends DexieRepository<GoalRecord> implements IGoalRepository {
  protected readonly entity = 'goals' as const;
}
