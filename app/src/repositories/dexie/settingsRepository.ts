import { DexieRepository } from './baseRepository';
import type { ISettingsRepository, SettingRecord } from '../types';

export class DexieSettingsRepository
  extends DexieRepository<SettingRecord>
  implements ISettingsRepository
{
  protected readonly entity = 'settings' as const;

  /** Hard delete for local-only keys (runner drafts) that must never sync. */
  async delete(key: string): Promise<void> {
    await this.deleteRow(key);
  }
}
