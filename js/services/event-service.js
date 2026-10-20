import { eventRepository } from '../data/storage.js?v=4';
import { differenceInDays, normalizeDate } from './date-service.js';

const EVENT_TIMING = Object.freeze({
  past: 'past',
  today: 'today',
  upcoming: 'upcoming'
});

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function nowIso() {
  return new Date().toISOString();
}

function validateTitle(title) {
  const value = String(title || '').trim();
  if (!value) {
    throw new Error('An event title is required.');
  }
  return value;
}

function normalizeTime(value, label) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (!TIME_PATTERN.test(text)) {
    throw new Error(`${label} must use HH:MM format.`);
  }
  return text;
}

// An explicit `undefined` should not wipe an existing value during a partial
// update, so undefined entries are dropped before merging.
function withoutUndefined(input) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}

function normalizeEventInput(input) {
  const date = normalizeDate(input.date, 'event date');
  const endDate = input.endDate ? normalizeDate(input.endDate, 'event end date') : '';
  if (endDate && endDate < date) {
    throw new Error('The end date cannot be before the start date.');
  }

  const time = normalizeTime(input.time, 'Start time');
  const endTime = normalizeTime(input.endTime, 'End time');
  if (time && endTime && endTime < time) {
    throw new Error('The end time cannot be before the start time.');
  }

  return {
    title: validateTitle(input.title),
    date,
    endDate,
    time,
    endTime,
    category: String(input.category || 'General').trim() || 'General',
    location: String(input.location || '').trim(),
    notes: String(input.notes || '').trim(),
    tags: Array.isArray(input.tags) ? input.tags : [],
    cancelled: Boolean(input.cancelled)
  };
}

// Whether an event is past or upcoming is derived from its date rather than
// stored, so the answer can never go stale as the days pass.
function getEventTiming(event, today = normalizeDate(new Date())) {
  const days = differenceInDays(today, event.date);
  if (days > 0) return EVENT_TIMING.upcoming;
  if (days === 0) return EVENT_TIMING.today;
  return EVENT_TIMING.past;
}

function isEventUpcoming(event, today = normalizeDate(new Date())) {
  return getEventTiming(event, today) !== EVENT_TIMING.past;
}

async function listEvents({ timing = 'all', query = '', category = '', includeCancelled = false } = {}) {
  const events = await eventRepository.getAll();
  const today = normalizeDate(new Date());
  const normalizedQuery = query.trim().toLowerCase();

  const filtered = events.filter((event) => {
    if (!includeCancelled && event.cancelled) return false;

    const eventTiming = getEventTiming(event, today);
    if (timing === EVENT_TIMING.upcoming && eventTiming === EVENT_TIMING.past) return false;
    if (timing === EVENT_TIMING.past && eventTiming !== EVENT_TIMING.past) return false;

    if (category && event.category !== category) return false;

    if (normalizedQuery) {
      const searchable = `${event.title} ${event.category} ${event.location} ${event.notes} ${(event.tags || []).join(' ')}`.toLowerCase();
      if (!searchable.includes(normalizedQuery)) return false;
    }

    return true;
  });

  const timingOrder = { [EVENT_TIMING.today]: 0, [EVENT_TIMING.upcoming]: 1, [EVENT_TIMING.past]: 2 };
  return filtered.sort((first, second) => {
    const firstTiming = timingOrder[getEventTiming(first, today)];
    const secondTiming = timingOrder[getEventTiming(second, today)];
    if (firstTiming !== secondTiming) return firstTiming - secondTiming;
    if (firstTiming === EVENT_TIMING.past) return second.date.localeCompare(first.date);
    return first.date.localeCompare(second.date);
  });
}

async function getEvent(id) {
  return eventRepository.get(id);
}

async function createEvent(input) {
  const timestamp = nowIso();
  return eventRepository.add({
    ...normalizeEventInput(input),
    createdAt: timestamp,
    updatedAt: timestamp
  });
}

async function updateEvent(id, input) {
  const existing = await getEvent(id);
  if (!existing) {
    throw new Error('Event could not be found.');
  }

  const merged = { ...existing, ...withoutUndefined(input) };
  return eventRepository.update({
    ...existing,
    ...normalizeEventInput(merged),
    id,
    createdAt: existing.createdAt,
    updatedAt: nowIso()
  });
}

async function deleteEvent(id) {
  await eventRepository.remove(id);
}

async function setEventCancelled(id, cancelled) {
  const existing = await getEvent(id);
  if (!existing) {
    throw new Error('Event could not be found.');
  }
  return eventRepository.update({ ...existing, cancelled: Boolean(cancelled), updatedAt: nowIso() });
}

async function cancelEvent(id) {
  return setEventCancelled(id, true);
}

async function restoreEvent(id) {
  return setEventCancelled(id, false);
}

export {
  EVENT_TIMING,
  cancelEvent,
  createEvent,
  deleteEvent,
  getEvent,
  getEventTiming,
  isEventUpcoming,
  listEvents,
  normalizeEventInput,
  restoreEvent,
  setEventCancelled,
  updateEvent
};
