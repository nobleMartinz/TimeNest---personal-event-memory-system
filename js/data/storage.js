import { STORE_NAMES, requestToPromise, withStore } from './database.js';

function createId(prefix) {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createRepository(storeName, idPrefix) {
  return {
    async add(record) {
      const value = { ...record, id: record.id || createId(idPrefix) };
      await withStore(storeName, 'readwrite', 'add', (store) => requestToPromise(store.add(value), 'add', storeName));
      return value;
    },

    async get(id) {
      return withStore(storeName, 'readonly', 'get', (store) => requestToPromise(store.get(id), 'get', storeName));
    },

    async getAll() {
      return withStore(storeName, 'readonly', 'getAll', (store) => requestToPromise(store.getAll(), 'getAll', storeName));
    },

    async update(record) {
      if (!record?.id) {
        throw new TypeError(`Cannot update a ${storeName} record without an id`);
      }
      const value = { ...record };
      await withStore(storeName, 'readwrite', 'update', (store) => requestToPromise(store.put(value), 'update', storeName));
      return value;
    },

    async remove(id) {
      await withStore(storeName, 'readwrite', 'delete', (store) => requestToPromise(store.delete(id), 'delete', storeName));
    },

    async clear() {
      await withStore(storeName, 'readwrite', 'clear', (store) => requestToPromise(store.clear(), 'clear', storeName));
    }
  };
}

const reminderRepository = createRepository(STORE_NAMES.reminders, 'reminder');
const diaryRepository = createRepository(STORE_NAMES.diaryEntries, 'diary');
const notificationHistoryRepository = createRepository(STORE_NAMES.notificationHistory, 'notification');

const DEFAULT_SETTINGS = Object.freeze({
  key: 'app',
  theme: 'system',
  notificationEnabled: true,
  defaultReminderDays: 7,
  defaultReminderTime: '09:00',
  overdueRemindersEnabled: true
});

async function getSettings() {
  const savedSettings = await withStore(STORE_NAMES.settings, 'readonly', 'get settings', (store) => requestToPromise(store.get(DEFAULT_SETTINGS.key), 'get settings', STORE_NAMES.settings));
  return { ...DEFAULT_SETTINGS, ...(savedSettings || {}) };
}

async function saveSettings(settings) {
  const value = { ...DEFAULT_SETTINGS, ...settings, key: DEFAULT_SETTINGS.key };
  await withStore(STORE_NAMES.settings, 'readwrite', 'save settings', (store) => requestToPromise(store.put(value), 'save settings', STORE_NAMES.settings));
  return value;
}

async function updateSettings(changes) {
  return saveSettings({ ...(await getSettings()), ...changes });
}

const repositories = Object.freeze({
  reminders: reminderRepository,
  diaryEntries: diaryRepository,
  notificationHistory: notificationHistoryRepository
});

export {
  DEFAULT_SETTINGS,
  diaryRepository,
  getSettings,
  notificationHistoryRepository,
  reminderRepository,
  repositories,
  saveSettings,
  updateSettings
};
