import Dexie, { type Table } from 'dexie';

export interface SessionSet {
  exercise: string;
  setIndex: number;
  value: string;
  unit: 'sec' | 'reps';
  bloqueOrden: number;
  orden: number;
}
export interface SessionRecord {
  id?: number;
  date: string;
  planId: string;
  modelId: string;
  durationSec: number;
  completed: boolean;
  sets?: SessionSet[];
}
export interface ProgressRecord {
  id?: number;
  exerciseId: string;
  week: string; // S1..S8
  value: number;
  date: string;
}
export interface GoalRecord {
  id?: number;
  goalId: string;
  current: number;
  updatedAt: string;
}
export interface SettingRecord {
  key: string;
  value: any;
}

export interface MarkRecord {
  id?: number;
  exercise: string;
  unit: 'sec' | 'reps';
  value: number;
  mesoInicio: string;
  date: string;
}

export interface TagRecord {
  id?: number;
  targetType: 'exercise' | 'routine' | 'program';
  targetId: string;
  tag: string;
}

class LogsteniaDB extends Dexie {
  sessions!: Table<SessionRecord, number>;
  progress!: Table<ProgressRecord, number>;
  goals!: Table<GoalRecord, number>;
  settings!: Table<SettingRecord, string>;
  marks!: Table<MarkRecord, number>;
  tags!: Table<TagRecord, number>;
  constructor() {
    super('logstenia');
    this.version(1).stores({
      sessions: '++id,date,planId,modelId',
      progress: '++id,exerciseId,week',
      goals: '++id,goalId',
      settings: 'key',
    });
    this.version(2).stores({
      sessions: '++id,date,planId,modelId',
      progress: '++id,exerciseId,week',
      goals: '++id,goalId',
      settings: 'key',
      marks: '++id,exercise,mesoInicio',
    });
    this.version(3).stores({
      sessions: '++id,date,planId,modelId',
      progress: '++id,exerciseId,week',
      goals: '++id,goalId',
      settings: 'key',
      marks: '++id,exercise,mesoInicio',
      tags: '++id,targetType,targetId,tag,[targetType+targetId]',
    });
  }
}

export const db = new LogsteniaDB();