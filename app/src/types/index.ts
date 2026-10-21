export type Level = 'beginner' | 'intermediate' | 'advanced';
export type Intensity = 1 | 2 | 3;
export type BlockType = 'single' | 'biseries' | 'superseries';

/** Example video for an exercise, collected with Playwright. */
export interface ExerciseVideo {
  /** YouTube video id. */
  id: string;
  title: string;
  channel: string;
  /** Video URL. */
  url: string;
  /** Thumbnail image URL. */
  thumbnail: string;
}

export interface Exercise {
  id?: string;
  name: string;
  reps?: string;
  timeSec?: number;
  cadence?: string;
  notes?: string;
  tags?: string[];
  /** Associated example video (collected with Playwright). */
  video?: ExerciseVideo;
}

export interface Block {
  type: BlockType;
  sets: number;
  restBetweenSetsSec: number;
  restBetweenExercisesSec?: number;
  exercises: Exercise[];
}

export interface Goal {
  id: string;
  name: string;
  unit: 'sec' | 'reps';
  target: number;
}

export interface Model {
  id: string;
  name: string;
  intensity: Intensity;
  totalTimeMin: number;
  benchmark?: boolean;
  blocks: Block[];
  tags?: string[];
}

export interface Program {
  id: string;
  categoryId: string;
  name: string;
  level: Level;
  description: string;
  objectives: string[];
  goals: Goal[];
  frequency: string;
  restBetweenSessions: string;
  rules: string[];
  models: Model[];
  optional?: boolean;
  tags?: string[];
}

export interface Category {
  id: string;
  name: string;
  description: string;
  programs: Program[];
}

export interface PlanData {
  categories: Category[];
}