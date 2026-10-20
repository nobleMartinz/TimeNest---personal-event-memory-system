import {
  RECURRENCE_TYPES,
  RECURRENCE_UNITS,
  addDays,
  addMonthsPreservingEndOfMonth,
  addYearsPreservingEndOfMonth,
  calculateNextOccurrence,
  calculateReminderStartDate,
  differenceInDays,
  normalizeDate
} from './date-service.js';

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, received ${actual}`);
  }
}

function runDateVerification() {
  const checks = [];
  const check = (label, actual, expected) => {
    assertEqual(actual, expected, label);
    checks.push(label);
  };

  check('date normalization', normalizeDate('2026-09-12'), '2026-09-12');
  check('date normalization from Date', normalizeDate(new Date(2026, 8, 12)), '2026-09-12');
  check('days between dates', differenceInDays('2026-09-01', '2026-09-12'), 11);
  check('reverse days between dates', differenceInDays('2026-09-12', '2026-09-01'), -11);
  check('reminder start date', calculateReminderStartDate('2026-09-11', 7), '2026-09-04');
  check('daily recurrence', calculateNextOccurrence('2026-09-12', { type: RECURRENCE_TYPES.daily }), '2026-09-13');
  check('weekly recurrence', calculateNextOccurrence('2026-09-12', { type: RECURRENCE_TYPES.weekly }), '2026-09-19');
  check('monthly recurrence', calculateNextOccurrence('2026-09-12', { type: RECURRENCE_TYPES.monthly }), '2026-10-12');
  check('yearly recurrence', calculateNextOccurrence('2026-09-12', { type: RECURRENCE_TYPES.yearly }), '2027-09-12');
  check('custom daily interval', calculateNextOccurrence('2026-09-12', { type: RECURRENCE_TYPES.custom, interval: 3, unit: RECURRENCE_UNITS.days }), '2026-09-15');
  check('custom weekly interval', calculateNextOccurrence('2026-09-12', { type: RECURRENCE_TYPES.custom, interval: 2, unit: RECURRENCE_UNITS.weeks }), '2026-09-26');
  check('custom monthly interval', calculateNextOccurrence('2026-09-12', { type: RECURRENCE_TYPES.custom, interval: 2, unit: RECURRENCE_UNITS.months }), '2026-11-12');
  check('custom yearly interval', calculateNextOccurrence('2026-09-12', { type: RECURRENCE_TYPES.custom, interval: 2, unit: RECURRENCE_UNITS.years }), '2028-09-12');
  check('one-time recurrence', calculateNextOccurrence('2026-09-12', { type: RECURRENCE_TYPES.once }), null);
  check('monthly end-of-month rule', addMonthsPreservingEndOfMonth('2026-01-31', 1), '2026-02-28');
  check('monthly leap-year end-of-month rule', addMonthsPreservingEndOfMonth('2024-01-31', 1), '2024-02-29');
  check('yearly leap-year fallback', addYearsPreservingEndOfMonth('2024-02-29', 1), '2025-02-28');
  check('yearly leap-year return', addYearsPreservingEndOfMonth('2024-02-29', 4), '2028-02-29');
  check('year boundary daily recurrence', addDays('2026-12-31', 1), '2027-01-01');
  check('year boundary monthly recurrence', addMonthsPreservingEndOfMonth('2026-12-31', 1), '2027-01-31');

  return { passed: true, checks };
}

export { runDateVerification };
