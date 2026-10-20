const DATABASE_NAME = 'timenest-local';
const DATABASE_VERSION = 3;

const STORE_NAMES = Object.freeze({
  reminders: 'reminders',
  diaryEntries: 'diaryEntries',
  events: 'events',
  settings: 'settings',
  notificationHistory: 'notificationHistory',
  accounts: 'accounts',
  sessions: 'sessions'
});

class DatabaseError extends Error {
  constructor(message, { operation, storeName, cause } = {}) {
    super(message, { cause });
    this.name = 'DatabaseError';
    this.operation = operation;
    this.storeName = storeName;
    this.cause = cause;
  }
}

let databasePromise;

function createDatabaseError(operation, storeName, cause) {
  const detail = cause?.message || cause?.name || 'Unknown database error';
  return new DatabaseError(`IndexedDB ${operation} failed: ${detail}`, {
    operation,
    storeName,
    cause
  });
}

function requestToPromise(request, operation, storeName) {
  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => resolve(request.result), { once: true });
    request.addEventListener('error', () => reject(createDatabaseError(operation, storeName, request.error)), { once: true });
  });
}

function transactionToPromise(transaction, operation, storeName) {
  return new Promise((resolve, reject) => {
    transaction.addEventListener('complete', () => resolve(), { once: true });
    transaction.addEventListener('abort', () => reject(createDatabaseError(operation, storeName, transaction.error)), { once: true });
    transaction.addEventListener('error', () => reject(createDatabaseError(operation, storeName, transaction.error)), { once: true });
  });
}

function createObjectStores(database) {
  if (!database.objectStoreNames.contains(STORE_NAMES.reminders)) {
    const reminders = database.createObjectStore(STORE_NAMES.reminders, { keyPath: 'id' });
    reminders.createIndex('nextDueDate', 'nextDueDate', { unique: false });
    reminders.createIndex('category', 'category', { unique: false });
    reminders.createIndex('status', 'status', { unique: false });
  }

  if (!database.objectStoreNames.contains(STORE_NAMES.diaryEntries)) {
    const diaryEntries = database.createObjectStore(STORE_NAMES.diaryEntries, { keyPath: 'id' });
    diaryEntries.createIndex('date', 'date', { unique: false });
    diaryEntries.createIndex('category', 'category', { unique: false });
  }

  if (!database.objectStoreNames.contains(STORE_NAMES.events)) {
    const events = database.createObjectStore(STORE_NAMES.events, { keyPath: 'id' });
    events.createIndex('date', 'date', { unique: false });
    events.createIndex('category', 'category', { unique: false });
  }

  if (!database.objectStoreNames.contains(STORE_NAMES.settings)) {
    database.createObjectStore(STORE_NAMES.settings, { keyPath: 'key' });
  }

  if (!database.objectStoreNames.contains(STORE_NAMES.notificationHistory)) {
    database.createObjectStore(STORE_NAMES.notificationHistory, { keyPath: 'id' });
  }

  if (!database.objectStoreNames.contains(STORE_NAMES.accounts)) {
    const accounts = database.createObjectStore(STORE_NAMES.accounts, { keyPath: 'id' });
    accounts.createIndex('email', 'email', { unique: true });
  }

  if (!database.objectStoreNames.contains(STORE_NAMES.sessions)) {
    const sessions = database.createObjectStore(STORE_NAMES.sessions, { keyPath: 'id' });
    sessions.createIndex('accountId', 'accountId', { unique: false });
  }
}

function openDatabase() {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new DatabaseError('IndexedDB is not supported in this browser', {
      operation: 'initialize'
    }));
  }

  const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
  request.addEventListener('upgradeneeded', () => {
    createObjectStores(request.result);
  });

  return new Promise((resolve, reject) => {
    request.addEventListener('success', () => {
      const database = request.result;
      database.addEventListener('versionchange', () => database.close());
      resolve(database);
    }, { once: true });
    request.addEventListener('error', () => reject(createDatabaseError('initialize', undefined, request.error)), { once: true });
    request.addEventListener('blocked', () => reject(new DatabaseError('IndexedDB upgrade is blocked by another open connection', {
      operation: 'initialize'
    })), { once: true });
  });
}

function getDatabase() {
  databasePromise ??= openDatabase().catch((error) => {
    databasePromise = undefined;
    throw error;
  });
  return databasePromise;
}

async function withStore(storeName, mode, operation, callback) {
  if (!Object.values(STORE_NAMES).includes(storeName)) {
    throw new DatabaseError(`Unknown object store: ${storeName}`, { operation, storeName });
  }

  const database = await getDatabase();
  const transaction = database.transaction(storeName, mode);
  const store = transaction.objectStore(storeName);

  try {
    const result = await callback(store, transaction);
    await transactionToPromise(transaction, operation, storeName);
    return result;
  } catch (error) {
    if (error instanceof DatabaseError) {
      throw error;
    }
    throw createDatabaseError(operation, storeName, error);
  }
}

export {
  DATABASE_NAME,
  DATABASE_VERSION,
  DatabaseError,
  STORE_NAMES,
  getDatabase,
  requestToPromise,
  withStore
};
