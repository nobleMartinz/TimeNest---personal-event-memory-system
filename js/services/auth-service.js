import { STORE_NAMES, requestToPromise, withStore } from '../data/database.js?v=3';

const ACCOUNT_ID_PREFIX = 'account';
const SESSION_ID_PREFIX = 'session';
const SESSION_STORAGE_KEY = 'timenest.session';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const REMEMBERED_SESSION_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const PASSWORD_ALGORITHM = 'PBKDF2';
const PASSWORD_HASH = 'SHA-256';
const PASSWORD_ITERATIONS = 600000;
const PASSWORD_SALT_BYTES = 16;
const PASSWORD_KEY_BYTES = 32;
const MINIMUM_PASSWORD_LENGTH = 8;

class AuthError extends Error {
  constructor(message, { code = 'auth_error' } = {}) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}

function createId(prefix) {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function getWebCrypto() {
  const webCrypto = globalThis.crypto;
  if (!webCrypto?.subtle || !webCrypto.getRandomValues) {
    throw new AuthError('Secure sign-in needs a secure context. Open TimeNest from http://127.0.0.1 or over https.', { code: 'insecure_context' });
  }
  return webCrypto;
}

function bytesToBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function bytesEqual(first, second) {
  if (first.length !== second.length) return false;
  let difference = 0;
  for (let index = 0; index < first.length; index += 1) {
    difference |= first[index] ^ second[index];
  }
  return difference === 0;
}

async function derivePasswordKey(password, salt) {
  const webCrypto = getWebCrypto();
  const keyMaterial = await webCrypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    PASSWORD_ALGORITHM,
    false,
    ['deriveBits']
  );
  const bits = await webCrypto.subtle.deriveBits(
    {
      name: PASSWORD_ALGORITHM,
      hash: PASSWORD_HASH,
      salt,
      iterations: PASSWORD_ITERATIONS
    },
    keyMaterial,
    PASSWORD_KEY_BYTES * 8
  );
  return new Uint8Array(bits);
}

async function hashPassword(password) {
  const webCrypto = getWebCrypto();
  const salt = webCrypto.getRandomValues(new Uint8Array(PASSWORD_SALT_BYTES));
  const derivedKey = await derivePasswordKey(password, salt);
  return {
    algorithm: PASSWORD_ALGORITHM,
    hash: PASSWORD_HASH,
    iterations: PASSWORD_ITERATIONS,
    salt: bytesToBase64(salt),
    passwordHash: bytesToBase64(derivedKey)
  };
}

async function verifyPassword(password, account) {
  if (!account?.passwordHash || !account?.salt) return false;
  const derivedKey = await derivePasswordKey(password, base64ToBytes(account.salt));
  return bytesEqual(derivedKey, base64ToBytes(account.passwordHash));
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function validateEmail(email) {
  if (!email) {
    throw new AuthError('Enter the email address for this profile.', { code: 'email_required' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AuthError('Enter a valid email address.', { code: 'email_invalid' });
  }
  return email;
}

function validatePassword(password) {
  const value = String(password || '');
  if (value.length < MINIMUM_PASSWORD_LENGTH) {
    throw new AuthError(`Use at least ${MINIMUM_PASSWORD_LENGTH} characters for the password.`, { code: 'password_short' });
  }
  return value;
}

function validateDisplayName(value) {
  const name = String(value || '').trim();
  if (!name) {
    throw new AuthError('Enter a name for this profile.', { code: 'name_required' });
  }
  if (name.length > 80) {
    throw new AuthError('Keep the profile name under 80 characters.', { code: 'name_too_long' });
  }
  return name;
}

async function getAllAccounts() {
  return withStore(STORE_NAMES.accounts, 'readonly', 'get accounts', (store) => requestToPromise(store.getAll(), 'get accounts', STORE_NAMES.accounts));
}

async function findAccountByEmail(email) {
  const accounts = await getAllAccounts();
  return accounts.find((account) => account.email === email) || null;
}

async function getAccountById(id) {
  return withStore(STORE_NAMES.accounts, 'readonly', 'get account', (store) => requestToPromise(store.get(id), 'get account', STORE_NAMES.accounts));
}

async function getAllSessions() {
  return withStore(STORE_NAMES.sessions, 'readonly', 'get sessions', (store) => requestToPromise(store.getAll(), 'get sessions', STORE_NAMES.sessions));
}

function readStoredSessionId() {
  try {
    return globalThis.sessionStorage?.getItem(SESSION_STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

function writeStoredSessionId(id, remember) {
  try {
    globalThis.sessionStorage?.setItem(SESSION_STORAGE_KEY, id);
    if (remember) globalThis.localStorage?.setItem(SESSION_STORAGE_KEY, id);
    else globalThis.localStorage?.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Storage can be unavailable in private browsing modes. The session still works in memory.
  }
}

function clearStoredSessionId() {
  try {
    globalThis.sessionStorage?.removeItem(SESSION_STORAGE_KEY);
    globalThis.localStorage?.removeItem(SESSION_STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}

async function findActiveSession() {
  const candidates = [readStoredSessionId(), globalThis.localStorage?.getItem(SESSION_STORAGE_KEY) || null].filter(Boolean);
  if (candidates.length === 0) return null;
  const sessions = await getAllSessions();
  const now = Date.now();
  return sessions.find((session) => candidates.includes(session.id) && Date.parse(session.expiresAt) > now) || null;
}

async function removeExpiredSessions() {
  const sessions = await getAllSessions();
  const now = Date.now();
  await Promise.all(
    sessions
      .filter((session) => Date.parse(session.expiresAt) <= now)
      .map((session) => withStore(STORE_NAMES.sessions, 'readwrite', 'delete session', (store) => requestToPromise(store.delete(session.id), 'delete session', STORE_NAMES.sessions)))
  );
}

function publicAccount(account) {
  if (!account) return null;
  return {
    id: account.id,
    email: account.email,
    displayName: account.displayName,
    createdAt: account.createdAt,
    lastSignedInAt: account.lastSignedInAt || null
  };
}

async function hasAccount() {
  const accounts = await getAllAccounts();
  return accounts.length > 0;
}

async function getCurrentAccount() {
  const session = await findActiveSession();
  if (!session) return null;
  const account = await getAccountById(session.accountId);
  return publicAccount(account);
}

async function getAuthState() {
  const account = await getCurrentAccount();
  return {
    hasAccount: await hasAccount(),
    isAuthenticated: Boolean(account),
    account
  };
}

async function createAccount({ displayName, email, password }) {
  const normalizedEmail = validateEmail(normalizeEmail(email));
  const validatedName = validateDisplayName(displayName);
  const validatedPassword = validatePassword(password);

  if (await findAccountByEmail(normalizedEmail)) {
    throw new AuthError('A profile already uses that email address.', { code: 'email_taken' });
  }
  if (await hasAccount()) {
    throw new AuthError('This device already has a profile. Sign in instead.', { code: 'profile_exists' });
  }

  const timestamp = nowIso();
  const passwordRecord = await hashPassword(validatedPassword);
  const account = {
    id: createId(ACCOUNT_ID_PREFIX),
    email: normalizedEmail,
    displayName: validatedName,
    ...passwordRecord,
    createdAt: timestamp,
    updatedAt: timestamp,
    lastSignedInAt: null
  };

  await withStore(STORE_NAMES.accounts, 'readwrite', 'add account', (store) => requestToPromise(store.add(account), 'add account', STORE_NAMES.accounts));
  return publicAccount(account);
}

async function startSession(accountId, { remember = false } = {}) {
  const ttl = remember ? REMEMBERED_SESSION_TTL_MS : SESSION_TTL_MS;
  const session = {
    id: createId(SESSION_ID_PREFIX),
    accountId,
    createdAt: nowIso(),
    expiresAt: new Date(Date.now() + ttl).toISOString()
  };
  await withStore(STORE_NAMES.sessions, 'readwrite', 'add session', (store) => requestToPromise(store.add(session), 'add session', STORE_NAMES.sessions));
  writeStoredSessionId(session.id, remember);
  return session;
}

async function signIn({ email, password, remember = false } = {}) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    throw new AuthError('Enter the email address for this profile.', { code: 'email_required' });
  }
  const account = await findAccountByEmail(normalizedEmail);
  if (!account) {
    throw new AuthError('Email or password is incorrect.', { code: 'invalid_credentials' });
  }
  const matches = await verifyPassword(String(password || ''), account);
  if (!matches) {
    throw new AuthError('Email or password is incorrect.', { code: 'invalid_credentials' });
  }

  await removeExpiredSessions();
  const updatedAccount = { ...account, lastSignedInAt: nowIso(), updatedAt: nowIso() };
  await withStore(STORE_NAMES.accounts, 'readwrite', 'update account', (store) => requestToPromise(store.put(updatedAccount), 'update account', STORE_NAMES.accounts));
  await startSession(account.id, { remember });
  return publicAccount(updatedAccount);
}

async function signOut() {
  const session = await findActiveSession();
  if (session) {
    await withStore(STORE_NAMES.sessions, 'readwrite', 'delete session', (store) => requestToPromise(store.delete(session.id), 'delete session', STORE_NAMES.sessions));
  }
  clearStoredSessionId();
}

async function changePassword({ currentPassword, newPassword, accountId }) {
  const account = await getAccountById(accountId);
  if (!account) {
    throw new AuthError('Sign in again before changing the password.', { code: 'not_signed_in' });
  }
  const matches = await verifyPassword(String(currentPassword || ''), account);
  if (!matches) {
    throw new AuthError('The current password is incorrect.', { code: 'invalid_credentials' });
  }
  const validatedPassword = validatePassword(newPassword);
  const passwordRecord = await hashPassword(validatedPassword);
  const updatedAccount = { ...account, ...passwordRecord, updatedAt: nowIso() };
  await withStore(STORE_NAMES.accounts, 'readwrite', 'update account', (store) => requestToPromise(store.put(updatedAccount), 'update account', STORE_NAMES.accounts));
  return publicAccount(updatedAccount);
}

async function updateProfile({ displayName, accountId }) {
  const account = await getAccountById(accountId);
  if (!account) {
    throw new AuthError('Sign in again before updating the profile.', { code: 'not_signed_in' });
  }
  const updatedAccount = { ...account, displayName: validateDisplayName(displayName), updatedAt: nowIso() };
  await withStore(STORE_NAMES.accounts, 'readwrite', 'update account', (store) => requestToPromise(store.put(updatedAccount), 'update account', STORE_NAMES.accounts));
  return publicAccount(updatedAccount);
}

async function deleteAccount(accountId) {
  const sessions = await getAllSessions();
  await Promise.all(
    sessions
      .filter((session) => session.accountId === accountId)
      .map((session) => withStore(STORE_NAMES.sessions, 'readwrite', 'delete session', (store) => requestToPromise(store.delete(session.id), 'delete session', STORE_NAMES.sessions)))
  );
  await withStore(STORE_NAMES.accounts, 'readwrite', 'delete account', (store) => requestToPromise(store.delete(accountId), 'delete account', STORE_NAMES.accounts));
  clearStoredSessionId();
}

async function resetLocalProfile() {
  const accounts = await getAllAccounts();
  const sessions = await getAllSessions();
  await Promise.all(
    accounts.map((account) => withStore(STORE_NAMES.accounts, 'readwrite', 'delete account', (store) => requestToPromise(store.delete(account.id), 'delete account', STORE_NAMES.accounts)))
  );
  await Promise.all(
    sessions.map((session) => withStore(STORE_NAMES.sessions, 'readwrite', 'delete session', (store) => requestToPromise(store.delete(session.id), 'delete session', STORE_NAMES.sessions)))
  );
  clearStoredSessionId();
}

export {
  ACCOUNT_ID_PREFIX,
  AuthError,
  MINIMUM_PASSWORD_LENGTH,
  PASSWORD_ALGORITHM,
  PASSWORD_HASH,
  PASSWORD_ITERATIONS,
  SESSION_ID_PREFIX,
  SESSION_STORAGE_KEY,
  SESSION_TTL_MS,
  REMEMBERED_SESSION_TTL_MS,
  changePassword,
  createAccount,
  deleteAccount,
  getAuthState,
  getCurrentAccount,
  hasAccount,
  hashPassword,
  publicAccount,
  resetLocalProfile,
  signIn,
  signOut,
  startSession,
  updateProfile,
  validateEmail,
  validatePassword,
  verifyPassword
};
