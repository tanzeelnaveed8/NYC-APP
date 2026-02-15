import { getDatabase } from '../database';
import type { Squad, RdoSchedule } from '../../models';

// ─── Calendar / RDO Repository ───────────────────────────────────────────────

export async function getAllSquads(): Promise<Squad[]> {
  const db = await getDatabase();
  return db.getAllAsync<Squad>('SELECT * FROM squads ORDER BY displayOrder');
}

export async function getScheduleForSquad(squadId: number): Promise<RdoSchedule | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{
    scheduleId: number;
    squadId: number;
    patternType: string;
    cycleLength: number;
    patternArray: string;
    anchorDate: string;
    squadOffset: number;
  }>(
    'SELECT * FROM rdo_schedules WHERE squadId = ?',
    [squadId]
  );

  if (!row) return null;

  return {
    ...row,
    patternType: row.patternType as 'rotating' | 'steady',
    patternArray: JSON.parse(row.patternArray),
  };
}

export async function insertSquad(squad: Squad): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT OR REPLACE INTO squads (squadId, squadName, displayOrder) VALUES (?, ?, ?)',
    [squad.squadId, squad.squadName, squad.displayOrder]
  );
}

export async function insertRdoSchedule(schedule: RdoSchedule): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO rdo_schedules (squadId, patternType, cycleLength, patternArray, anchorDate, squadOffset)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      schedule.squadId,
      schedule.patternType,
      schedule.cycleLength,
      JSON.stringify(schedule.patternArray),
      schedule.anchorDate,
      schedule.squadOffset,
    ]
  );
}

// ─── RDO Calculation Engine ──────────────────────────────────────────────────

/**
 * Compute RDO schedule for a full month.
 * Returns a map of day-of-month (1-31) → boolean (true = RDO day)
 */
export function computeMonthSchedule(
  year: number,
  month: number, // 0-indexed (JS convention)
  schedule: RdoSchedule
): Record<number, boolean> {
  const result: Record<number, boolean> = {};
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const anchorDate = new Date(schedule.anchorDate + 'T00:00:00');

  for (let day = 1; day <= daysInMonth; day++) {
    const targetDate = new Date(year, month, day);
    const diffMs = targetDate.getTime() - anchorDate.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (schedule.patternType === 'rotating') {
      // (daysDiff + squadOffset) mod cycleLength
      let dayIndex = ((diffDays + schedule.squadOffset) % schedule.cycleLength);
      if (dayIndex < 0) dayIndex += schedule.cycleLength;
      result[day] = schedule.patternArray[dayIndex] === 'O';
    } else {
      // Steady: 7-day weekly pattern
      const dayOfWeek = targetDate.getDay(); // 0=Sun
      result[day] = schedule.patternArray[dayOfWeek] === 'O';
    }
  }

  return result;
}
