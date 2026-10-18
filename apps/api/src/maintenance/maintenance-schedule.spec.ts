import { advanceNextDue, catchUpNextDue } from './maintenance-schedule';

describe('maintenance-schedule', () => {
  it('gunluk ve haftalik vadeyi ileri alir', () => {
    const start = new Date('2026-01-01T08:00:00.000Z');
    expect(advanceNextDue(start, 'DAILY', 2).toISOString()).toBe('2026-01-03T08:00:00.000Z');
    expect(advanceNextDue(start, 'WEEKLY', 1).toISOString()).toBe('2026-01-08T08:00:00.000Z');
  });

  it('aylik vadeyi takvim ayi olarak ilerletir', () => {
    const start = new Date('2026-01-31T08:00:00.000Z');
    const next = advanceNextDue(start, 'MONTHLY', 1);
    expect(next.getUTCMonth()).toBe(2);
  });

  it('gecmis vadeleri now sonrasina tasir', () => {
    const from = new Date('2026-01-01T00:00:00.000Z');
    const now = new Date('2026-01-20T00:00:00.000Z');
    const next = catchUpNextDue(from, 'WEEKLY', 1, now);
    expect(next.getTime()).toBeGreaterThan(now.getTime());
  });
});
