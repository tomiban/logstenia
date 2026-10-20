import { db } from '../db';
import { getProgram } from './plans';

export interface Stats {
  sessions: number;
  totalMin: number;
  streak: number;
  byPlan: { planId: string; name: string; count: number }[];
}

export async function computeStats(): Promise<Stats> {
  const sessions = await db.sessions.toArray();
  const totalSec = sessions.reduce((a, s) => a + s.durationSec, 0);
  const days = new Set(sessions.map(s => s.date.slice(0, 10)));
  let streak = 0;
  const cur = new Date();
  let d = new Date(cur);
  if (!days.has(d.toISOString().slice(0, 10))) {
    d.setDate(d.getDate() - 1);
  }
  while (days.has(d.toISOString().slice(0, 10))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  const counts: Record<string, number> = {};
  sessions.forEach(s => { counts[s.planId] = (counts[s.planId] || 0) + 1; });
  const byPlan = Object.entries(counts).map(([planId, count]) => ({
    planId, count, name: getProgram(planId)?.name || planId,
  }));
  return { sessions: sessions.length, totalMin: Math.round(totalSec / 60), streak, byPlan };
}
