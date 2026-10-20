import { reminderRepository } from '../data/storage.js?v=2';
import {
  RECURRENCE_TYPES,
  calculateNextOccurrence,
  calculateReminderStartDate,
  normalizeDate,
  normalizeRecurrence,
  addDays
} from './date-service.js';

const REMINDER_STATUS = Object.freeze({
  active: 'active',
  completed: 'completed',
  archived: 'archived'
});

function nowIso() {
  return new Date().toISOString();
}

function validateTitle(title) {
  const value = String(title || '').trim();
  if (!value) {
    throw new Error('A reminder title is required.');
  }
  return value;
}

function normalizeReminderInput(input) {
  const nextDueDate = normalizeDate(input.nextDueDate || input.startDate, 'due date');
  const recurrence = normalizeRecurrence(input.recurrence || { type: RECURRENCE_TYPES.once });
  const reminderDaysBefore = Number(input.reminderDaysBefore ?? 7);

  if (!Number.isInteger(reminderDaysBefore) || reminderDaysBefore < 0) {
    throw new Error('Reminder lead time must be a non-negative whole number.');
  }

  return {
    title: validateTitle(input.title),
    category: String(input.category || 'General').trim() || 'General',
    startDate: normalizeDate(input.startDate || nextDueDate, 'start date'),
    nextDueDate,
    recurrence,
    reminderDaysBefore,
    reminderStartDate: calculateReminderStartDate(nextDueDate, reminderDaysBefore),
    reminderTime: input.reminderTime || '',
    notes: String(input.notes || '').trim(),
    tags: Array.isArray(input.tags) ? input.tags : [],
    status: input.status || REMINDER_STATUS.active,
    archived: Boolean(input.archived),
    completedAt: input.completedAt || null,
    completionHistory: Array.isArray(input.completionHistory) ? input.completionHistory : [],
    notificationHistory: Array.isArray(input.notificationHistory) ? input.notificationHistory : []
  };
}

async function listReminders({ includeArchived = false } = {}) {
  const reminders = await reminderRepository.getAll();
  return reminders
    .filter((reminder) => includeArchived || reminder.status !== REMINDER_STATUS.archived)
    .sort((first, second) => (first.nextDueDate || '').localeCompare(second.nextDueDate || ''));
}

async function getReminder(id) {
  return reminderRepository.get(id);
}

async function createReminder(input) {
  const timestamp = nowIso();
  const normalized = normalizeReminderInput(input);
  return reminderRepository.add({
    ...normalized,
    createdAt: timestamp,
    updatedAt: timestamp
  });
}

async function updateReminder(id, input) {
  const existing = await getReminder(id);
  if (!existing) {
    throw new Error('Reminder could not be found.');
  }

  const normalized = normalizeReminderInput({ ...existing, ...input });
  return reminderRepository.update({
    ...existing,
    ...normalized,
    id,
    createdAt: existing.createdAt,
    updatedAt: nowIso()
  });
}

async function deleteReminder(id) {
  await reminderRepository.remove(id);
}

async function archiveReminder(id) {
  return updateReminder(id, { status: REMINDER_STATUS.archived, archived: true });
}

async function restoreReminder(id) {
  return updateReminder(id, { status: REMINDER_STATUS.active, archived: false });
}

async function snoozeReminder(id, days = 1) {
  const reminder = await getReminder(id);
  if (!reminder) {
    throw new Error('Reminder could not be found.');
  }
  const snoozedUntil = addDays(reminder.nextDueDate, days);
  return updateReminder(id, { nextDueDate: snoozedUntil, snoozedUntil, status: REMINDER_STATUS.active });
}

async function completeReminder(id) {
  const reminder = await getReminder(id);
  if (!reminder) {
    throw new Error('Reminder could not be found.');
  }

  const completedAt = nowIso();
  const completionHistory = [
    ...reminder.completionHistory,
    { completedAt, dueDate: reminder.nextDueDate }
  ];
  const nextDueDate = calculateNextOccurrence(reminder.nextDueDate, reminder.recurrence);

  return updateReminder(id, {
    completionHistory,
    nextDueDate: nextDueDate || reminder.nextDueDate,
    status: nextDueDate ? REMINDER_STATUS.active : REMINDER_STATUS.completed,
    completedAt: nextDueDate ? undefined : completedAt
  });
}

export {
  REMINDER_STATUS,
  archiveReminder,
  completeReminder,
  createReminder,
  deleteReminder,
  getReminder,
  listReminders,
  normalizeReminderInput,
  restoreReminder,
  snoozeReminder,
  updateReminder
};
