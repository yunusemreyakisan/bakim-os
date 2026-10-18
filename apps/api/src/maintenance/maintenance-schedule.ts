import type { MaintenanceCadence } from '@bakimos/api-contracts';

export function advanceNextDue(
  from: Date,
  cadence: MaintenanceCadence,
  interval: number,
): Date {
  const next = new Date(from.getTime());
  const step = interval > 0 ? interval : 1;
  if (cadence === 'DAILY') next.setUTCDate(next.getUTCDate() + step);
  else if (cadence === 'WEEKLY') next.setUTCDate(next.getUTCDate() + 7 * step);
  else next.setUTCMonth(next.getUTCMonth() + step);
  return next;
}

/** Bir açık görev varken kaçırılan periyotları atlar; nextDueAt'i now sonrasına taşır. */
export function catchUpNextDue(
  from: Date,
  cadence: MaintenanceCadence,
  interval: number,
  now: Date,
): Date {
  let cursor = from;
  let guard = 0;
  while (cursor.getTime() <= now.getTime() && guard < 500) {
    cursor = advanceNextDue(cursor, cadence, interval);
    guard += 1;
  }
  return cursor;
}
