import {
  DEFAULT_SETTINGS,
  diaryRepository,
  getSettings,
  notificationHistoryRepository,
  reminderRepository,
  saveSettings
} from '../data/storage.js';
import { normalizeDiaryInput } from './diary-service.js';
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

function validateImportDocument(document) {
  if (!isRecord(document) || document.version !== EXPORT_VERSION || !isRecord(document.data)) {
    throw importError(`expected a TimeNest export with version ${EXPORT_VERSION}.`);
  }
  const { reminders, diaryEntries, settings } = document.data;
  if (!Array.isArray(reminders) || !Array.isArray(diaryEntries)) {
    throw importError('reminders and diaryEntries must be arrays.');
  }
  verifyUniqueIds(reminders, 'reminder');
  verifyUniqueIds(diaryEntries, 'diary entry');
  return {
    reminders: reminders.map(normalizeImportedReminder),
    diaryEntries: diaryEntries.map(normalizeImportedDiary),
    settings: normalizeSettings(settings)
  };
}

async function createExportDocument() {
  const [reminders, diaryEntries, settings] = await Promise.all([
    reminderRepository.getAll(), diaryRepository.getAll(), getSettings()
  ]);
  return { version: EXPORT_VERSION, exportedAt: new Date().toISOString(), data: { reminders, diaryEntries, settings } };
}

async function importDocument(document, mode) {
  if (!Object.values(IMPORT_MODES).includes(mode)) throw importError('choose merge or replace.');
  const imported = validateImportDocument(document);
  const [existingReminders, existingEntries] = await Promise.all([reminderRepository.getAll(), diaryRepository.getAll()]);
  const reminderIds = new Set(existingReminders.map((record) => record.id));
  const diaryIds = new Set(existingEntries.map((record) => record.id));
  let skipped = 0;

  if (mode === IMPORT_MODES.replace) {
    await Promise.all([reminderRepository.clear(), diaryRepository.clear(), notificationHistoryRepository.clear()]);
    reminderIds.clear();
    diaryIds.clear();
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
  await saveSettings(imported.settings);
  return { imported: imported.reminders.length + imported.diaryEntries.length - skipped, skipped };
}

async function clearAllData() {
  await Promise.all([reminderRepository.clear(), diaryRepository.clear(), notificationHistoryRepository.clear()]);
  await saveSettings(DEFAULT_SETTINGS);
}

export { EXPORT_VERSION, IMPORT_MODES, clearAllData, createExportDocument, importDocument, validateImportDocument };
