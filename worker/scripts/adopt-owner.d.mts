export interface OwnerRow {
  owner: string;
  total: number;
}

export interface OwnerProblem {
  owner: string;
  total: number;
  problem: string;
  fix: string;
}

export function normalizeOwner(raw: string): string;

export function buildUpdateCommand(owner: string): string;

export function buildCountCommand(): string;

export function checkOwners(rows: readonly OwnerRow[]): OwnerProblem[];

export function parseCountRows(json: string): OwnerRow[];
