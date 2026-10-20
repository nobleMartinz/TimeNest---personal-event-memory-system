const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const RECURRENCE_TYPES = Object.freeze({
  once: 'once',
  daily: 'daily',
  weekly: 'weekly',
  monthly: 'monthly',
  yearly: 'yearly',
  custom: 'custom'
});
const RECURRENCE_UNITS = Object.freeze({
  days: 'days',
  weeks: 'weeks',
  months: 'months',
  years: 'years'
});
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

class DateServiceError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DateServiceError';
  }
}

function assertValidDate(date, label = 'date') {
  if (Number.isNaN(date.getTime())) {
    throw new DateServiceError(`Invalid ${label}`);
  }
  return date;
}

function parseDateOnly(value, label = 'date') {
  if (value instanceof Date) {
    return assertValidDate(new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate())), label);
  }

  if (typeof value !== 'string') {
    throw new DateServiceError(`${label} must be a Date or YYYY-MM-DD string`);
  }

  if (!DATE_PATTERN.test(value)) {
    throw new DateServiceError(`${label} must use YYYY-MM-DD format`);
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  assertValidDate(date, label);

  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new DateServiceError(`Invalid ${label}: ${value}`);
  }

  return date;
}

function formatDateOnly(date) {
  return [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate()]
    .map((part, index) => index === 0 ? String(part).padStart(4, '0') : String(part).padStart(2, '0'))
    .join('-');
}

function normalizeDate(value, label = 'date') {
  return formatDateOnly(parseDateOnly(value, label));
}

function daysInMonth(year, monthIndex) {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

function addDays(value, amount) {
  const date = parseDateOnly(value);
  date.setUTCDate(date.getUTCDate() + validatePositiveInteger(amount, 'days'));
  return formatDateOnly(date);
}

function subtractDays(value, amount) {
  const date = parseDateOnly(value);
  date.setUTCDate(date.getUTCDate() - validateNonNegativeInteger(amount, 'days'));
  return formatDateOnly(date);
}

function differenceInDays(startValue, endValue) {
  const start = parseDateOnly(startValue, 'start date');
  const end = parseDateOnly(endValue, 'end date');
  return Math.round((end.getTime() - start.getTime()) / MILLISECONDS_PER_DAY);
}

function calculateReminderStartDate(dueDate, reminderDaysBefore = 7) {
  return subtractDays(dueDate, validateNonNegativeInteger(reminderDaysBefore, 'reminder lead time'));
}

function addMonthsPreservingEndOfMonth(value, amount) {
  const date = parseDateOnly(value);
  const originalDay = date.getUTCDate();
  const sourceMonthLastDay = daysInMonth(date.getUTCFullYear(), date.getUTCMonth());
  const targetMonthIndex = date.getUTCMonth() + validatePositiveInteger(amount, 'months');
  const targetYear = date.getUTCFullYear() + Math.floor(targetMonthIndex / 12);
  const normalizedMonthIndex = ((targetMonthIndex % 12) + 12) % 12;
  const targetMonthLastDay = daysInMonth(targetYear, normalizedMonthIndex);
  const targetDay = originalDay === sourceMonthLastDay ? targetMonthLastDay : Math.min(originalDay, targetMonthLastDay);
  return formatDateOnly(new Date(Date.UTC(targetYear, normalizedMonthIndex, targetDay)));
}

function addYearsPreservingEndOfMonth(value, amount) {
  const date = parseDateOnly(value);
  const years = validatePositiveInteger(amount, 'years');
  const targetYear = date.getUTCFullYear() + years;
  const targetMonth = date.getUTCMonth();
  const sourceMonthLastDay = daysInMonth(date.getUTCFullYear(), targetMonth);
  const targetMonthLastDay = daysInMonth(targetYear, targetMonth);
  const targetDay = date.getUTCDate() === sourceMonthLastDay
    ? targetMonthLastDay
    : Math.min(date.getUTCDate(), targetMonthLastDay);
  return formatDateOnly(new Date(Date.UTC(targetYear, targetMonth, targetDay)));
}

function calculateNextOccurrence(dueDate, recurrence = { type: RECURRENCE_TYPES.once }) {
  const normalizedDueDate = normalizeDate(dueDate, 'due date');
  const normalizedRecurrence = normalizeRecurrence(recurrence);

  switch (normalizedRecurrence.type) {
    case RECURRENCE_TYPES.once:
      return null;
    case RECURRENCE_TYPES.daily:
      return addDays(normalizedDueDate, normalizedRecurrence.interval);
    case RECURRENCE_TYPES.weekly:
      return addDays(normalizedDueDate, normalizedRecurrence.interval * 7);
    case RECURRENCE_TYPES.monthly:
      return addMonthsPreservingEndOfMonth(normalizedDueDate, normalizedRecurrence.interval);
    case RECURRENCE_TYPES.yearly:
      return addYearsPreservingEndOfMonth(normalizedDueDate, normalizedRecurrence.interval);
    case RECURRENCE_TYPES.custom:
      return calculateCustomOccurrence(normalizedDueDate, normalizedRecurrence);
    default:
      throw new DateServiceError(`Unsupported recurrence type: ${normalizedRecurrence.type}`);
  }
}

function calculateCustomOccurrence(dueDate, recurrence) {
  switch (recurrence.unit) {
    case RECURRENCE_UNITS.days:
      return addDays(dueDate, recurrence.interval);
    case RECURRENCE_UNITS.weeks:
      return addDays(dueDate, recurrence.interval * 7);
    case RECURRENCE_UNITS.months:
      return addMonthsPreservingEndOfMonth(dueDate, recurrence.interval);
    case RECURRENCE_UNITS.years:
      return addYearsPreservingEndOfMonth(dueDate, recurrence.interval);
    default:
      throw new DateServiceError(`Unsupported custom recurrence unit: ${recurrence.unit}`);
  }
}

function normalizeRecurrence(recurrence) {
  if (!recurrence || typeof recurrence !== 'object') {
    throw new DateServiceError('Recurrence must be an object');
  }

  const type = recurrence.type;
  if (type === RECURRENCE_TYPES.once) {
    return { type };
  }

  const interval = validatePositiveInteger(recurrence.interval ?? 1, 'recurrence interval');
  if ([RECURRENCE_TYPES.daily, RECURRENCE_TYPES.weekly, RECURRENCE_TYPES.monthly, RECURRENCE_TYPES.yearly].includes(type)) {
    return { type, interval };
  }

  if (type === RECURRENCE_TYPES.custom) {
    if (!Object.values(RECURRENCE_UNITS).includes(recurrence.unit)) {
      throw new DateServiceError('Custom recurrence requires a valid unit');
    }
    return { type, interval, unit: recurrence.unit };
  }

  throw new DateServiceError(`Unsupported recurrence type: ${type}`);
}

function validatePositiveInteger(value, label) {
  if (!Number.isInteger(value) || value < 1) {
    throw new DateServiceError(`${label} must be a positive integer`);
  }
  return value;
}

function validateNonNegativeInteger(value, label) {
  if (!Number.isInteger(value) || value < 0) {
    throw new DateServiceError(`${label} must be a non-negative integer`);
  }
  return value;
}

export {
  DateServiceError,
  RECURRENCE_TYPES,
  RECURRENCE_UNITS,
  addDays,
  addMonthsPreservingEndOfMonth,
  addYearsPreservingEndOfMonth,
  calculateNextOccurrence,
  calculateReminderStartDate,
  daysInMonth,
  differenceInDays,
  normalizeDate,
  normalizeRecurrence,
  subtractDays
};
