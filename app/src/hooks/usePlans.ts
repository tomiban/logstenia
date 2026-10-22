import { useSyncExternalStore } from 'react';
import { subscribePlans, getPlansVersion, getCategories, getProgram, getModel } from '@/features/plans/plans';

export function usePlansVersion(): number {
  return useSyncExternalStore(subscribePlans, getPlansVersion, getPlansVersion);
}

export function useCategories() {
  usePlansVersion();
  return getCategories();
}

export function useProgram(id: string) {
  usePlansVersion();
  return getProgram(id);
}

export function useModel(id: string) {
  usePlansVersion();
  return getModel(id);
}
