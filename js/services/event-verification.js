import {
  EVENT_TIMING,
  cancelEvent,
  createEvent,
  deleteEvent,
  getEvent,
  getEventTiming,
  listEvents,
  restoreEvent,
  updateEvent
} from './event-service.js?v=1';
import { addDays, normalizeDate, subtractDays } from './date-service.js';

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, received ${actual}`);
  }
}

function assertTrue(value, label) {
  if (!value) {
    throw new Error(`${label}: expected a truthy value`);
  }
}

async function assertRejects(action, label) {
  try {
    await action();
  } catch {
    return;
  }
  throw new Error(`${label}: expected the call to be rejected`);
}

async function runEventVerification() {
  const checks = [];
  const check = (label, actual, expected) => {
    assertEqual(actual, expected, label);
    checks.push(label);
  };

  // A run-scoped token keeps the assertions independent of whatever records
  // already exist in the browser database.
  const token = `VT${Date.now().toString(36)}`;
  const today = normalizeDate(new Date());
  const yesterday = subtractDays(today, 1);
  const tomorrow = addDays(today, 1);
  const nextWeek = addDays(today, 7);
  const lastWeek = subtractDays(today, 7);

  const created = [];
  const cleanup = async () => {
    for (const id of created) {
      await deleteEvent(id).catch(() => {});
    }
  };

  try {
    const pastEvent = await createEvent({
      title: `${token} past event`,
      date: lastWeek,
      category: `${token} Travel`,
      location: 'Lisbon',
      notes: 'A past event used for verification.'
    });
    created.push(pastEvent.id);

    const upcomingEvent = await createEvent({
      title: `${token} upcoming event`,
      date: nextWeek,
      endDate: addDays(nextWeek, 2),
      time: '09:30',
      endTime: '11:00',
      category: `${token} Travel`,
      location: 'Porto'
    });
    created.push(upcomingEvent.id);

    const todayEvent = await createEvent({
      title: `${token} today event`,
      date: today,
      time: '18:00',
      category: `${token} Wellness`
    });
    created.push(todayEvent.id);

    check('event title is stored', pastEvent.title, `${token} past event`);
    check('event date is stored', pastEvent.date, lastWeek);
    check('event category is stored', upcomingEvent.category, `${token} Travel`);
    check('event location is stored', upcomingEvent.location, 'Porto');
    check('event time is stored', upcomingEvent.time, '09:30');
    check('event end date is stored', upcomingEvent.endDate, addDays(nextWeek, 2));
    check('event starts uncancelled', pastEvent.cancelled, false);
    check('event records a creation timestamp', typeof pastEvent.createdAt, 'string');

    await assertRejects(() => createEvent({ title: '   ', date: today }), 'blank event titles are rejected');
    checks.push('blank event titles are rejected');
    await assertRejects(() => createEvent({ title: 'No date', date: '' }), 'missing event dates are rejected');
    checks.push('missing event dates are rejected');
    await assertRejects(() => createEvent({ title: 'Bad date', date: '12/09/2026' }), 'non ISO event dates are rejected');
    checks.push('non ISO event dates are rejected');
    await assertRejects(() => createEvent({ title: 'Backwards range', date: today, endDate: yesterday }), 'end dates before the start date are rejected');
    checks.push('end dates before the start date are rejected');
    await assertRejects(() => createEvent({ title: 'Bad time', date: today, time: '9am' }), 'malformed event times are rejected');
    checks.push('malformed event times are rejected');
    await assertRejects(() => createEvent({ title: 'Backwards time', date: today, time: '10:00', endTime: '09:00' }), 'end times before the start time are rejected');
    checks.push('end times before the start time are rejected');

    check('today events are timed as today', getEventTiming(todayEvent, today), EVENT_TIMING.today);
    check('future events are timed as upcoming', getEventTiming(upcomingEvent, today), EVENT_TIMING.upcoming);
    check('past events are timed as past', getEventTiming(pastEvent, today), EVENT_TIMING.past);

    const upcomingList = await listEvents({ timing: EVENT_TIMING.upcoming, query: token });
    assertTrue(upcomingList.some((event) => event.id === upcomingEvent.id), 'upcoming filter includes future events');
    assertTrue(!upcomingList.some((event) => event.id === pastEvent.id), 'upcoming filter excludes past events');
    checks.push('upcoming filter separates future events from past events');

    const pastList = await listEvents({ timing: EVENT_TIMING.past, query: token });
    assertTrue(pastList.some((event) => event.id === pastEvent.id), 'past filter includes past events');
    assertTrue(!pastList.some((event) => event.id === upcomingEvent.id), 'past filter excludes future events');
    checks.push('past filter separates past events from future events');

    const allList = await listEvents({ timing: 'all', query: token });
    check('all filter returns every matching event', allList.length, 3);
    checks.push('all filter returns every matching event');

    const todayList = await listEvents({ timing: 'all', query: token });
    assertTrue(todayList.some((event) => event.id === todayEvent.id), 'today events appear in the all filter');
    checks.push('today events appear in the all filter');

    const searched = await listEvents({ timing: 'all', query: 'lisbon' });
    check('search matches the event location', searched.length, 1);
    checks.push('search matches the event location');

    const byCategory = await listEvents({ timing: 'all', category: `${token} Wellness` });
    check('category filter narrows the list', byCategory.length, 1);
    check('category filter returns the matching category', byCategory[0].category, `${token} Wellness`);
    checks.push('category filter narrows the list');

    const cancelled = await cancelEvent(todayEvent.id);
    check('cancelling marks the event as cancelled', cancelled.cancelled, true);
    const hiddenList = await listEvents({ timing: 'all', query: token });
    assertTrue(!hiddenList.some((event) => event.id === todayEvent.id), 'cancelled events are hidden by default');
    checks.push('cancelled events are hidden by default');

    const withCancelled = await listEvents({ timing: 'all', query: token, includeCancelled: true });
    assertTrue(withCancelled.some((event) => event.id === todayEvent.id), 'cancelled events can be shown again');
    checks.push('cancelled events can be shown again');

    const restored = await restoreEvent(todayEvent.id);
    check('restoring clears the cancelled flag', restored.cancelled, false);
    checks.push('restoring clears the cancelled flag');

    const updated = await updateEvent(upcomingEvent.id, { title: `${token} renamed event`, endTime: '12:30' });
    check('updates change the title', updated.title, `${token} renamed event`);
    check('updates change the end time', updated.endTime, '12:30');
    check('updates keep the original creation timestamp', updated.createdAt, upcomingEvent.createdAt);
    checks.push('updates keep the original creation timestamp');

    const reloaded = await getEvent(upcomingEvent.id);
    check('updated events are persisted', reloaded.title, `${token} renamed event`);
    checks.push('updated events are persisted');

    await assertRejects(() => updateEvent('missing-event-id', { title: 'Nothing' }), 'updating a missing event is rejected');
    checks.push('updating a missing event is rejected');

    await deleteEvent(pastEvent.id);
    created.splice(created.indexOf(pastEvent.id), 1);
    check('deleted events are removed', await getEvent(pastEvent.id), undefined);
    checks.push('deleted events are removed');

    return { passed: true, checks };
  } finally {
    await cleanup();
  }
}

export { runEventVerification };
