export type ConfigField = 'database_id' | 'CF_ACCESS_TEAM' | 'CF_ACCESS_AUD';

export interface ConfigProblem {
  field: ConfigField;
  problem: string;
  fix: string;
}

export function collectProblems(configText: string): ConfigProblem[];
