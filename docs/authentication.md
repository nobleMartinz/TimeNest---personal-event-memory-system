# Authentication

TimeNest has **no backend and no server**. Everything about your profile — including the password check — happens on your device.

This document explains exactly what the local profile does, how the password is protected, and where the honest limits are.

---

## What a local profile is

A profile is a small record stored in IndexedDB on this device. It holds:

- a display name,
- an email address (used only as an identifier),
- a **hashed** password,
- creation and sign-in timestamps.

That is all. **Your reminders and diary entries are not linked to the profile.** The profile does not own your data — it simply puts a password in front of the app so that someone else opening TimeNest on your device cannot immediately read your diary.

### Why not a real account?

Because there is no server. A real account system needs somewhere to verify a password against, and TimeNest has no server. What it has instead is a **local device profile** — the honest, self-contained equivalent for a local-first app.

| | Local profile (now) | Real account (needs a backend) |
|---|---|---|
| Works offline | Yes | No |
| Survives without a network | Yes | No |
| Syncs across devices | No | Yes |
| Password recovery by email | No | Yes |
| Data leaves the device | Never | Depends on the design |

If TimeNest later grows a backend, the local profile becomes the offline cache and the account becomes the identity. See [Migration path](#migration-path).

---

## Pages

| Page | File | Purpose |
|---|---|---|
| **Sign up** | `signup.html` | Create the local profile for this device. |
| **Sign in** | `login.html` | Unlock TimeNest with the profile password. |

Both are standalone pages with their own layout, stylesheet (`css/auth.css`), and entry module. They are cached by the service worker, so **sign in works with no network**.

### Sign up (`signup.html`)

| Field | Rule |
|---|---|
| Your name | Required, max 80 characters. |
| Email address | Required, must look like an email, normalised to lowercase. Used only as a login identifier. |
| Password | Required, at least 8 characters. |
| Confirm password | Must match. |
| Keep me signed in | Optional. Extends the session from 30 days to 90 days. |

Live feedback while you type:

- A **strength meter** with four levels — *Weak*, *Fair*, *Good*, *Strong*.
- A **requirement checklist** that ticks off as each rule is met: length, mixed case, and a number or symbol.
- **Show / Hide** toggles on both password fields.
- A **mismatch warning** on the confirmation field as soon as the two differ.

On success, the profile is created, a session starts, and you land in the app.

### Sign in (`login.html`)

| Field | Rule |
|---|---|
| Email address | Required. |
| Password | Required. |
| Keep me signed in | Optional. |

The sign-in page adapts to the device state:

| Device state | What you see |
|---|---|
| No profile yet | A notice: *"No profile exists on this device yet."* The link becomes **Create a profile**. |
| Profile exists | The standard form, plus the **Reset the local profile** recovery option. |
| Already signed in | Redirects straight into the app. |

### Password recovery

There is no email to reset a password with, because there is no mail server. The recovery path is explicit instead:

> **Reset the local profile** — removes the password and keeps every reminder and diary entry.

This is a genuine trade-off, and it is worth being blunt about it: **the profile is a privacy screen, not a vault.** Anyone with access to this device and to the browser's developer tools can read the IndexedDB directly. The profile stops casual access — a family member, a shared laptop, someone glancing at an open tab — and nothing more.

If you need protection against an attacker with full device access, you need real encryption with a key derived from the password, or an encrypted backup. Neither exists today.

---

## Password storage

Passwords are **never stored**. The stored value is a salted PBKDF2 derivation.

| Parameter | Value |
|---|---|
| Algorithm | `PBKDF2` |
| Hash | `SHA-256` |
| Iterations | `600,000` |
| Salt | 16 random bytes, unique per account |
| Derived key | 32 bytes, base64-encoded |

Derivation uses the **Web Crypto API** (`crypto.subtle.deriveBits`), which is available in any secure context — `https://` or `http://127.0.0.1`.

### Verification

```js
const derived = await derivePasswordKey(password, salt);
const matches = bytesEqual(derived, storedKey);
```

`bytesEqual()` compares byte by byte and accumulates the difference with a bitwise OR, so the comparison time does not depend on how many bytes match. It always runs the full loop.

### Why Web Crypto

The browser's crypto is a native implementation, far harder to attack with timing or side-channel tricks than hand-written JavaScript. It is also memory-hardened against GPU and ASIC attacks.

### Secure context requirement

`crypto.subtle` is unavailable on `file://` and over plain `http://` on a remote host. TimeNest detects this and fails with a clear message:

> *Secure sign-in needs a secure context. Open TimeNest from http://127.0.0.1 or over https.*

This is not a limitation you will hit in normal use — `http://127.0.0.1` and `http://localhost` both qualify as secure contexts.

---

## The app gate

`js/app.js` runs a gate before the app initialises:

```js
const authState = await getAuthState();

if (authState.hasAccount && !authState.isAuthenticated) {
  const next = encodeURIComponent(window.location.hash || '#dashboard');
  window.location.replace(`./login.html?next=${next}`);
  return;
}
```

| Device state | Result |
| --- | --- |
| No profile | The app opens normally. **No account is required to use TimeNest.** |
| Profile exists, signed out | The app redirects to `login.html`, preserving the intended route in `?next=`. |
| Profile exists, signed in | The app opens normally. |

After signing in, the `?next=` route is restored, so a user who was heading to `#reminders` lands on `#reminders`, not the dashboard.

The gate is deliberately lenient about one thing: **there is always a way in.** `login.html` links to *Continue without signing in*, which returns to the app. The gate protects against casual access, and it never traps a user out of their own data.

---

## Sessions

| Property | Value |
|---|---|
| Storage | The `sessions` object store in IndexedDB |
| Pointer | `sessionStorage` (30-day session) and optionally `localStorage` (90-day session) |
| Key | `timenest.session` |
| Expiry | Stored as an ISO timestamp, compared with `Date.parse()` |

### Session lifecycle

1. `signIn()` verifies the password and creates a session record.
2. The session id is written to `sessionStorage`; with *Keep me signed in*, also to `localStorage`.
3. `findActiveSession()` reads the pointer, loads the sessions, and returns the matching record if it has not expired.
4. Expired sessions are purged on the next successful sign-in.
5. `signOut()` deletes the session record and clears both pointers.

### Checking a session

Because `expiresAt` is an ISO string, it must be compared as a parsed timestamp:

```js
sessions.find((session) => candidates.includes(session.id) && Date.parse(session.expiresAt) > now)
```

Comparing the raw string against `Date.now()` coerces the string to `NaN` and silently treats every session as expired. This is the single easiest mistake to make in this module.

---

## Account management

Open **Settings → Account and access**. The panel reflects the device state.

### Signed in

| Element | Behaviour |
|---| --- |
| Status badge | *Signed in* (success colour). |
| Display name | Editable. **Save profile** writes it. |
| Email address | Shown, read-only in practice. |
| **Change password** | Opens a dialog asking for the current and new password. |
| **Sign out** | Ends the session and returns to `login.html`. |
| **Delete profile** | Removes the account after confirmation. **Your reminders, diary entries, and preferences are kept.** |

### Signed out, profile exists

The badge reads *Locked*, and the panel offers **Sign in** and **Forgot password**. Because the app gate redirects a signed-out visitor to `login.html`, this state is rarely seen in the app itself.

**Forgot password** calls `resetLocalProfile()`, which removes the account and its sessions but **keeps every reminder, diary entry, and preference**. TimeNest then opens without a password. There is no mail server, so this is the only recovery path.

### No profile

The badge reads *No profile*, and the panel offers **Create a profile** and **Sign in**.

### One profile per device

`createAccount()` rejects a second profile with the `profile_exists` error. The data model is not scoped per account, so multiple profiles on one device would create ambiguity about whose data is whose. One profile, one device, one set of data.

### Changing a password

The current password must be correct, the new password must meet the same rules, and the account is re-hashed with a **fresh salt**. The session stays active.

---

## Data model

### `accounts` store

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `string` | `account-<uuid>`. |
| `email` | `string` | Lowercase. Unique index. |
| `displayName` | `string` | Max 80 characters. |
| `passwordHash` | `string` | Base64 of the 32-byte derived key. |
| `salt` | `string` | Base64 of the 16-byte random salt. |
| `algorithm` | `string` | `"PBKDF2"`. |
| `hash` | `string` | `"SHA-256"`. |
| `iterations` | `number` | `600000`. |
| `createdAt` | `string` | ISO timestamp. |
| `updatedAt` | `string` | ISO timestamp. |
| `lastSignedInAt` | `string \| null` | ISO timestamp. |

### `sessions` store

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `string` | `session-<uuid>`. |
| `accountId` | `string` | Indexed. |
| `createdAt` | `string` | ISO timestamp. |
| `expiresAt` | `string` | ISO timestamp. |

### Error codes

`AuthError` carries a `code` property so the UI can react precisely.

| Code | Meaning |
| --- | --- |
| `email_required` | No email was entered. |
| `email_invalid` | The email is not a valid address. |
| `email_taken` | That email already belongs to a profile. |
| `profile_exists` | The device already has a profile. |
| `name_required` | No display name was entered. |
| `name_too_long` | The display name exceeds 80 characters. |
| `password_short` | The password is under 8 characters. |
| `password_long` | The password exceeds 200 characters. |
| `password_blank` | The password is only whitespace. |
| `invalid_credentials` | The email or password was wrong. Deliberately vague, so it does not reveal whether an email exists. |
| `not_signed_in` | The operation needs an active session. |
| `insecure_context` | `crypto.subtle` is unavailable. |

---

## Verification suite

`tests/auth-verification.html` runs 26 assertions in the browser against the live modules:

- The hash format, algorithm, and iteration count.
- A correct password verifies; a wrong one does not.
- The same password hashed twice produces different results, proving the salt is applied.
- The account never exposes its hash or salt.
- Duplicate email, missing name, invalid email, and short password are each rejected with the right code.
- Sign in creates a session; sign out clears it but keeps the account.
- Sign in works again after signing out.
- A second profile is rejected.
- Deleting the account removes it and clears the session.
- Resetting the local profile removes the account and clears the session.

The suite cleans up after itself in a `finally` block.

---

## Migration path

Should TimeNest later gain a backend, the seams already exist:

| Current | Future |
| --- | --- |
| `accounts` store holds a local profile | The same store caches the account returned by an API. |
| `signIn()` verifies locally | `signIn()` posts credentials and stores the returned token. |
| `sessions` store holds a local session | The same store holds an API session token. |
| `getAuthState()` gates the app | Unchanged — it would ask the server. |

Everything above `js/services/auth-service.js` — the pages, the gate, the Settings panel — would not need to change.

---

## Privacy summary

- Your email address is stored locally and **never transmitted anywhere**. There is no server to transmit it to.
- Your password is **never stored** — only a salted, iterated PBKDF2 derivation.
- Your data stays on this device.
- Clearing browser site data removes the profile, the sessions, your reminders, and your diary entries together.
- There is no telemetry and no third-party script on the auth pages.
