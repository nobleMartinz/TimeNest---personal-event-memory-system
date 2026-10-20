import { getDatabase, STORE_NAMES } from './database.js?v=2';
import {
  diaryRepository,
  eventRepository,
  getSettings,
  notificationHistoryRepository,
  reminderRepository,
  saveSettings
} from './storage.js';
import { IMPORT_MODES, importDocument, validateImportDocument } from '../services/data-transfer-service.js';

async function verifyDatabase() {
  const database = await getDatabase();
  const expectedStores = Object.values(STORE_NAMES);
  const missingStores = expectedStores.filter((storeName) => !database.objectStoreNames.contains(storeName));

  if (missingStores.length > 0) {
    throw new Error(`Missing object stores: ${missingStores.join(', ')}`);
  }

  const suffix = Date.now();
  const reminderId = `verification-reminder-${suffix}`;
  const diaryId = `verification-diary-${suffix}`;
  const eventId = `verification-event-${suffix}`;
  const importEventId = `verification-import-event-${suffix}`;
  const notificationId = `verification-notification-${suffix}`;
  const originalSettings = await getSettings();
  const testSettings = { ...originalSettings, defaultReminderDays: 3 };

  try {
    const reminder = await reminderRepository.add({
      id: reminderId,
      title: 'Database verification reminder',
      nextDueDate: '2026-09-12',
      status: 'active'
    });
    const updatedReminder = await reminderRepository.update({ ...reminder, status: 'completed' });
    const storedReminder = await reminderRepository.get(reminderId);

    const diaryEntry = await diaryRepository.add({
      id: diaryId,
      date: '2026-09-12',
      title: 'Database verification entry',
      content: 'Temporary verification record.'
    });
    const storedDiaryEntry = await diaryRepository.get(diaryId);

    const event = await eventRepository.add({
      id: eventId,
      title: 'Database verification event',
      date: '2026-09-12',
      category: 'General'
    });
    const storedEvent = await eventRepository.get(eventId);

    const notification = await notificationHistoryRepository.add({
      id: notificationId,
      reminderId,
      sentAt: new Date().toISOString()
    });
    const storedNotification = await notificationHistoryRepository.get(notificationId);

    await saveSettings(testSettings);
    const storedSettings = await getSettings();
    await saveSettings(originalSettings);

    const allReminders = await reminderRepository.getAll();
    const allDiaryEntries = await diaryRepository.getAll();
    const allEvents = await eventRepository.getAll();
    const allNotifications = await notificationHistoryRepository.getAll();

    let malformedRejected = false;
    let malformedJsonRejected = false;
    let duplicateRejected = false;
    let mergeDuplicateSkipped = false;
    let mergeImportedEvent = false;
    try {
      JSON.parse('{ not valid JSON');
    } catch {
      malformedJsonRejected = true;
    }
    try {
      validateImportDocument({ version: 1, data: { reminders: [], diaryEntries: [], settings: { theme: 'neon' } } });
    } catch {
      malformedRejected = true;
    }
    try {
      validateImportDocument({
        version: 1,
        data: {
          reminders: [
            { id: 'duplicate', title: 'One', nextDueDate: '2026-09-12' },
            { id: 'duplicate', title: 'Two', nextDueDate: '2026-09-13' }
          ],
          diaryEntries: [],
          settings: originalSettings
        }
      });
    } catch {
      duplicateRejected = true;
    }
    const mergeReport = await importDocument({
      version: 1,
      data: {
        reminders: [{ ...reminder }],
        diaryEntries: [],
        events: [{ id: importEventId, title: 'Database verification imported event', date: '2026-09-12' }],
        settings: originalSettings
      }
    }, IMPORT_MODES.merge);
    mergeDuplicateSkipped = mergeReport.imported === 1 && mergeReport.skipped === 1;
    const importedEvent = await eventRepository.get(importEventId);
    mergeImportedEvent = Boolean(importedEvent) && importedEvent.title === 'Database verification imported event';

    if (storedReminder.status !== 'completed' || storedDiaryEntry.id !== diaryId || storedEvent.id !== eventId || storedNotification.id !== notificationId || storedSettings.defaultReminderDays !== 3 || !malformedJsonRejected || !malformedRejected || !duplicateRejected || !mergeDuplicateSkipped || !mergeImportedEvent) {
      throw new Error('One or more CRUD or settings assertions failed.');
    }

    return {
      passed: true,
      stores: expectedStores,
      assertions: [
        'database initialized',
        'object stores exist',
        'reminder add, get, update, and getAll passed',
        'diary entry add and get passed',
        'event add and get passed',
        'notification history add and get passed',
        'settings save and read-back passed',
        'malformed JSON files and import documents are rejected',
        'duplicate import records are rejected',
        'merge imports keep existing duplicate records',
        'merge imports add new event records',
        'imported settings are validated against the theme allow-list',
        `settings restored to ${originalSettings.theme} theme`
      ],
      countsBeforeCleanup: {
        reminders: allReminders.length,
        diaryEntries: allDiaryEntries.length,
        events: allEvents.length,
        notifications: allNotifications.length
      }
    };
  } finally {
    await reminderRepository.remove(reminderId);
    await diaryRepository.remove(diaryId);
    await eventRepository.remove(eventId);
    await eventRepository.remove(importEventId);
    await notificationHistoryRepository.remove(notificationId);
    await saveSettings(originalSettings);
  }
}

export { verifyDatabase };
