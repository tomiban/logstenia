import { describe, it, expect } from 'vitest';
import plansJson from './plans.json';
import raw from './exercise-videos.json';
import type { Exercise, PlanData } from '../types';

interface RawEntry {
  id: string | null;
  title: string | null;
  channel: string | null;
  url: string | null;
  thumbnail: string | null;
  pdf: string | null;
  program: string;
  model: string;
  status?: string;
}

const plans = plansJson as PlanData;
const rawEntries = raw as Record<string, RawEntry>;

function allExercises(): Exercise[] {
  const out: Exercise[] = [];
  for (const c of plans.categories) {
    for (const p of c.programs) {
      for (const m of p.models) {
        for (const b of m.blocks) {
          out.push(...b.exercises);
        }
      }
    }
  }
  return out;
}

const exercises = allExercises();
const uniqueNames = [...new Set(exercises.map((e) => e.name))];

describe('exercise videos', () => {
  it('has a raw entry for every exercise name', () => {
    const missing = uniqueNames.filter((name) => !(name in rawEntries));
    expect(missing).toEqual([]);
  });

  it('links a video to most of the exercises', () => {
    const withVideo = exercises.filter((e) => e.video).length;
    const ratio = withVideo / exercises.length;
    expect(ratio).toBeGreaterThanOrEqual(0.6);
  });

  it('keeps video url and thumbnail consistent', () => {
    for (const e of exercises) {
      if (!e.video) continue;
      const v = e.video;
      expect(v.id, e.name).toMatch(/^[A-Za-z0-9_-]{11}$/);
      expect(v.url, e.name).toBe(`https://www.youtube.com/watch?v=${v.id}`);
      expect(v.thumbnail, e.name).toBe(`https://i.ytimg.com/vi/${v.id}/hqdefault.jpg`);
      expect(v.title.length, e.name).toBeGreaterThan(0);
      expect(v.channel.length, e.name).toBeGreaterThan(0);
    }
  });

  it('keeps plans.json in sync with the raw data', () => {
    const drifted: string[] = [];
    for (const e of exercises) {
      const entry = rawEntries[e.name];
      if (!entry) continue;
      const expected = entry.id
        ? { id: entry.id, title: entry.title, channel: entry.channel, url: entry.url, thumbnail: entry.thumbnail }
        : undefined;
      if (JSON.stringify(e.video) !== JSON.stringify(expected)) drifted.push(e.name);
    }
    expect(drifted).toEqual([]);
  });

  it('collects the exercises in PDF order', () => {
    const keys = Object.keys(rawEntries);
    expect(keys.length).toBeGreaterThan(0);
    expect(rawEntries[keys[0]].pdf).toBe('cardio.pdf');
    expect(rawEntries[keys[keys.length - 1]].pdf).toBe('pdf-rutinas-de-resistencia-planche_compress.pdf');
  });
});
