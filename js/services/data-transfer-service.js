import {
  DEFAULT_SETTINGS,
  billRepository,
  diaryRepository,
  eventRepository,
  getSettings,
  notificationHistoryRepository,
  reminderRepository,
  saveSettings
} from '../data/storage.js?v=4';
import { normalizeDiaryInput } from './diary-service.js';
import { normalizeEventInput } from './event-service.js?v=1';
import { normalizeBillInput } from './bill-service.js?v=1';
import { isSupportedCurrency } from './currency-service.js?v=2';
import { normalizeReminderInput } from './reminder-service.js';

const EXPORT_VERSION = 1;
const IMPORT_MODES = Object.freeze({ merge: 'merge', replace: 'replace' });
const THEME_VALUES = new Set(['system', 'light', 'dark']);
const REMINDER_STATUSES = new Set(['active', 'completed', 'archived']);

function importError(message) {
  return new Error(`Import failed: ${message}`);
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function requireId(record, collection) {
  if (!isRecord(record) || typeof record.id !== 'string' || !record.id.trim()) {
    throw importError(`every ${collection} record needs a non-empty id.`);
  }
  return record.id;
}

function verifyUniqueIds(records, collection) {
  const ids = new Set();
  records.forEach((record) => {
    const id = requireId(record, collection);
    if (ids.has(id)) throw importError(`duplicate ${collection} id "${id}".`);
    ids.add(id);
  });
}

function normalizeSettings(settings) {
  if (!isRecord(settings)) throw importError('settings must be an object.');
  const value = { ...DEFAULT_SETTINGS, ...settings, key: DEFAULT_SETTINGS.key };
  if (!THEME_VALUES.has(value.theme)) throw importError('settings.theme must be system, light, or dark.');
  if (!isSupportedCurrency(value.currency)) throw importError('settings.currency must be a supported currency code.');
  if (!Number.isInteger(value.defaultReminderDays) || value.defaultReminderDays < 0) {
    throw importError('settings.defaultReminderDays must be a non-negative whole number.');
  }
  if (typeof value.defaultReminderTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value.defaultReminderTime)) {
    throw importError('settings.defaultReminderTime must use HH:MM format.');
  }
  if (typeof value.notificationEnabled !== 'boolean' || typeof value.overdueRemindersEnabled !== 'boolean') {
    throw importError('notification settings must be true or false.');
  }
  return value;
}

function normalizeImportedReminder(record) {
  const id = requireId(record, 'reminder');
  if (record.status !== undefined && !REMINDER_STATUSES.has(record.status)) {
    throw importError(`reminder "${id}" has an invalid status.`);
  }
  if (record.archived !== undefined && typeof record.archived !== 'boolean') {
    throw importError(`reminder "${id}" archived must be true or false.`);
  }
  try {
    return {
      ...normalizeReminderInput(record),
      id,
      createdAt: typeof record.createdAt === 'string' ? record.createdAt : new Date().toISOString(),
      updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : new Date().toISOString()
    };
  } catch (error) {
    throw importError(`reminder "${id}" is invalid: ${error.message}`);
  }
}

function normalizeImportedDiary(record) {
  const id = requireId(record, 'diary entry');
  try {
    return {
      ...normalizeDiaryInput(record),
      id,
      createdAt: typeof record.createdAt === 'string' ? record.createdAt : new Date().toISOString(),
      updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : new Date().toISOString()
    };
  } catch (error) {
    throw importError(`diary entry "${id}" is invalid: ${error.message}`);
  }
}

function normalizeImportedEvent(record) {
  const id = requireId(record, 'event');
  try {
    return {
      ...normalizeEventInput(record),
      id,
      createdAt: typeof record.createdAt === 'string' ? record.createdAt : new Date().toISOString(),
      updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : new Date().toISOString()
    };
  } catch (error) {
    throw importError(`event "${id}" is invalid: ${error.message}`);
  }
}

function normalizeImportedBill(record) {
  const id = requireId(record, 'bill');
  try {
    return {
      ...normalizeBillInput(record),
      id,
      createdAt: typeof record.createdAt === 'string' ? record.createdAt : new Date().toISOString(),
      updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : new Date().toISOString()
    };
  } catch (error) {
    throw importError(`bill "${id}" is invalid: ${error.message}`);
  }
}

function validateImportDocument(document) {
  if (!isRecord(document) || document.version !== EXPORT_VERSION || !isRecord(document.data)) {
    throw importError(`expected a TimeNest export with version ${EXPORT_VERSION}.`);
  }
  const { reminders, diaryEntries, events = [], bills = [], settings } = document.data;
  if (!Array.isArray(reminders) || !Array.isArray(diaryEntries)) {
    throw importError('reminders and diaryEntries must be arrays.');
  }
  if (!Array.isArray(events)) {
    throw importError('events must be an array.');
  }
  if (!Array.isArray(bills)) {
    throw importError('bills must be an array.');
  }
  verifyUniqueIds(reminders, 'reminder');
  verifyUniqueIds(diaryEntries, 'diary entry');
  verifyUniqueIds(events, 'event');
  verifyUniqueIds(bills, 'bill');
  return {
    reminders: reminders.map(normalizeImportedReminder),
    diaryEntries: diaryEntries.map(normalizeImportedDiary),
    events: events.map(normalizeImportedEvent),
    bills: bills.map(normalizeImportedBill),
    settings: normalizeSettings(settings)
  };
}

async function createExportDocument() {
  const [reminders, diaryEntries, events, bills, settings] = await Promise.all([
    reminderRepository.getAll(), diaryRepository.getAll(), eventRepository.getAll(), billRepository.getAll(), getSettings()
  ]);
  return { version: EXPORT_VERSION, exportedAt: new Date().toISOString(), data: { reminders, diaryEntries, events, bills, settings } };
}

async function importDocument(document, mode) {
  if (!Object.values(IMPORT_MODES).includes(mode)) throw importError('choose merge or replace.');
  const imported = validateImportDocument(document);
  const [existingReminders, existingEntries, existingEvents, existingBills] = await Promise.all([
    reminderRepository.getAll(), diaryRepository.getAll(), eventRepository.getAll(), billRepository.getAll()
  ]);
  const reminderIds = new Set(existingReminders.map((record) => record.id));
  const diaryIds = new Set(existingEntries.map((record) => record.id));
  const eventIds = new Set(existingEvents.map((record) => record.id));
  const billIds = new Set(existingBills.map((record) => record.id));
  let skipped = 0;

  if (mode === IMPORT_MODES.replace) {
    await Promise.all([
      reminderRepository.clear(),
      diaryRepository.clear(),
      eventRepository.clear(),
      billRepository.clear(),
      notificationHistoryRepository.clear()
    ]);
    reminderIds.clear();
    diaryIds.clear();
    eventIds.clear();
    billIds.clear();
  }

  for (const reminder of imported.reminders) {
    if (reminderIds.has(reminder.id)) { skipped += 1; continue; }
    await reminderRepository.add(reminder);
    reminderIds.add(reminder.id);
  }
  for (const entry of imported.diaryEntries) {
    if (diaryIds.has(entry.id)) { skipped += 1; continue; }
    await diaryRepository.add(entry);
    diaryIds.add(entry.id);
  }
  for (const event of imported.events) {
    if (eventIds.has(event.id)) { skipped += 1; continue; }
    await eventRepository.add(event);
    eventIds.add(event.id);
  }
  for (const bill of imported.bills) {
    if (billIds.has(bill.id)) { skipped += 1; continue; }
    await billRepository.add(bill);
    billIds.add(bill.id);
  }
  await saveSettings(imported.settings);
  const total = imported.reminders.length + imported.diaryEntries.length + imported.events.length + imported.bills.length;
  return { imported: total - skipped, skipped };
}

async function clearAllData() {
  await Promise.all([
    reminderRepository.clear(),
    diaryRepository.clear(),
    eventRepository.clear(),
    billRepository.clear(),
    notificationHistoryRepository.clear()
  ]);
  await saveSettings(DEFAULT_SETTINGS);
}

export { EXPORT_VERSION, IMPORT_MODES, clearAllData, createExportDocument, importDocument, validateImportDocument };
