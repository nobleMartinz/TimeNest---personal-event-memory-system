import { getSettings, updateSettings } from '../data/storage.js';
import {
  checkAndNotifyReminders,
  getNotificationStatus,
  requestNotificationPermission,
  setNotificationsEnabled,
  setOverdueNotificationsEnabled
} from '../services/notification-service.js';
import {
  IMPORT_MODES,
  clearAllData,
  createExportDocument,
  importDocument
} from '../services/data-transfer-service.js';
import {
  changePassword,
  deleteAccount,
  getAuthState,
  getCurrentAccount,
  resetLocalProfile,
  signOut,
  updateProfile
} from '../services/auth-service.js';

function applyTheme(theme) {
  document.documentElement.toggleAttribute('data-theme', theme !== 'system');
  if (theme !== 'system') document.documentElement.dataset.theme = theme;
}

async function applySavedTheme() {
  const settings = await getSettings();
  applyTheme(settings.theme);
}

function initSettingsPage() {
  const page = document.querySelector('#settings-view');
  const statusText = document.querySelector('#notification-status-text');
  const permissionText = document.querySelector('#notification-permission');
  const enabledToggle = document.querySelector('#notifications-enabled');
  const overdueToggle = document.querySelector('#overdue-notifications-enabled');
  const requestButton = document.querySelector('#request-notification-permission');
  const checkButton = document.querySelector('#check-notifications');
  const resultText = document.querySelector('#notification-check-result');
  const themeSelect = document.querySelector('#theme-select');
  const defaultDays = document.querySelector('#default-reminder-days');
  const defaultTime = document.querySelector('#default-reminder-time');
  const savePreferencesButton = document.querySelector('#save-preferences');
  const exportButton = document.querySelector('#export-data');
  const importButton = document.querySelector('#import-data');
  const importMode = document.querySelector('#import-mode');
  const importFile = document.querySelector('#import-file');
  const clearDataButton = document.querySelector('#clear-all-data');
  const transferResult = document.querySelector('#data-transfer-result');
  const toastRegion = document.querySelector('#toast-region');
  const accountStatusText = document.querySelector('#account-status-text');
  const accountStatusBadge = document.querySelector('#account-status-badge');
  const accountFields = document.querySelector('#account-fields');
  const accountDisplayName = document.querySelector('#account-display-name');
  const accountEmail = document.querySelector('#account-email');
  const accountActions = document.querySelector('#account-actions');
  const accountPasswordDialog = document.querySelector('#account-password-dialog');
  const accountPasswordForm = document.querySelector('#account-password-form');

  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.setAttribute('role', 'status');
    toast.textContent = message;
    toastRegion.append(toast);
    window.setTimeout(() => toast.remove(), 3600);
  }

  async function refresh() {
    const [settings, status] = await Promise.all([getSettings(), Promise.resolve(getNotificationStatus())]);
    statusText.textContent = status.message;
    permissionText.textContent = `Permission: ${status.permission}`;
    enabledToggle.checked = settings.notificationEnabled;
    overdueToggle.checked = settings.overdueRemindersEnabled;
    themeSelect.value = settings.theme;
    defaultDays.value = settings.defaultReminderDays;
    defaultTime.value = settings.defaultReminderTime;
    applyTheme(settings.theme);
    requestButton.hidden = !status.canRequest;
    checkButton.disabled = !settings.notificationEnabled;
    await refreshAccount();
  }

  async function refreshAccount() {
    if (!accountStatusText || !accountActions) return;
    const authState = await getAuthState();

    if (authState.isAuthenticated && authState.account) {
      accountStatusBadge.textContent = 'Signed in';
      accountStatusBadge.className = 'status status--success';
      accountStatusText.textContent = `Signed in as ${authState.account.displayName}. This profile unlocks TimeNest on this device.`;
      accountFields.hidden = false;
      accountDisplayName.value = authState.account.displayName;
      accountEmail.value = authState.account.email;
      accountActions.innerHTML = `
        <button class="button button--secondary" type="button" data-account-action="save-profile">Save profile</button>
        <button class="button button--secondary" type="button" data-account-action="change-password">Change password</button>
        <button class="button button--secondary" type="button" data-account-action="sign-out">Sign out</button>
        <button class="button button--danger" type="button" data-account-action="delete-profile">Delete profile</button>`;
      return;
    }

    if (authState.hasAccount) {
      accountStatusBadge.textContent = 'Locked';
      accountStatusBadge.className = 'status status--warning';
      accountStatusText.textContent = 'A profile exists on this device. Sign in to open TimeNest.';
      accountFields.hidden = true;
      accountActions.innerHTML = `
        <a class="button button--primary" href="./login.html">Sign in</a>
        <button class="button button--secondary" type="button" data-account-action="reset-profile">Forgot password</button>`;
      return;
    }

    accountStatusBadge.textContent = 'No profile';
    accountStatusBadge.className = 'status status--muted';
    accountStatusText.textContent = 'No profile exists on this device. TimeNest works without one, or you can add a password to protect it.';
    accountFields.hidden = true;
    accountActions.innerHTML = `
      <a class="button button--primary" href="./signup.html">Create a profile</a>
      <a class="button button--secondary" href="./login.html">Sign in</a>`;
  }

  accountActions?.addEventListener('click', async (event) => {
    const trigger = event.target.closest('[data-account-action]');
    if (!trigger) return;
    const action = trigger.dataset.accountAction;
    try {
      if (action === 'save-profile') {
        const account = await getCurrentAccount();
        if (!account) throw new Error('Sign in again before updating the profile.');
        await updateProfile({ displayName: accountDisplayName.value, accountId: account.id });
        await refreshAccount();
        showToast('Profile updated.');
        return;
      }
      if (action === 'change-password') {
        if (typeof accountPasswordDialog.showModal === 'function') accountPasswordDialog.showModal();
        else accountPasswordDialog.setAttribute('open', '');
        return;
      }
      if (action === 'sign-out') {
        await signOut();
        window.location.replace('./login.html');
        return;
      }
      if (action === 'delete-profile') {
        const account = await getCurrentAccount();
        if (!account) throw new Error('Sign in again before deleting the profile.');
        if (!window.confirm('Delete this profile? Your reminders, diary entries, and preferences stay on this device, but the password will be removed.')) return;
        await deleteAccount(account.id);
        showToast('Profile deleted.');
        await refreshAccount();
      }
      if (action === 'reset-profile') {
        if (!window.confirm('Remove the password from this device? Your reminders, diary entries, and preferences stay, but the profile will be gone and TimeNest will open without a password.')) return;
        await resetLocalProfile();
        showToast('Password removed from this device.');
        await refreshAccount();
      }
    } catch (error) {
      showToast(error.message, 'error');
    }
  });

  accountPasswordForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(accountPasswordForm);
    try {
      const account = await getCurrentAccount();
      if (!account) throw new Error('Sign in again before changing the password.');
      await changePassword({
        currentPassword: data.get('currentPassword'),
        newPassword: data.get('newPassword'),
        accountId: account.id
      });
      accountPasswordForm.reset();
      accountPasswordDialog.close();
      showToast('Password updated.');
    } catch (error) {
      showToast(error.message, 'error');
    }
  });

  enabledToggle.addEventListener('change', async () => {
    await setNotificationsEnabled(enabledToggle.checked);
    await refresh();
    showToast(enabledToggle.checked ? 'Notifications enabled.' : 'Notifications disabled.');
  });

  overdueToggle.addEventListener('change', async () => {
    await setOverdueNotificationsEnabled(overdueToggle.checked);
    await refresh();
    showToast(overdueToggle.checked ? 'Overdue notifications enabled.' : 'Overdue notifications disabled.');
  });

  requestButton.addEventListener('click', async () => {
    try {
      await requestNotificationPermission();
      await refresh();
      showToast(getNotificationStatus().permission === 'granted' ? 'Notification permission granted.' : 'Notification permission was not granted.', 'warning');
    } catch (error) {
      showToast(error.message, 'error');
    }
  });

  checkButton.addEventListener('click', async () => {
    try {
      const report = await checkAndNotifyReminders();
      resultText.textContent = report.reason || `Checked ${report.eligible} eligible reminder${report.eligible === 1 ? '' : 's'}; sent ${report.sent}, skipped ${report.skipped} duplicate${report.skipped === 1 ? '' : 's'}.`;
      showToast(report.sent ? `${report.sent} notification${report.sent === 1 ? '' : 's'} sent.` : 'Reminder check complete.');
      await refresh();
    } catch (error) {
      resultText.textContent = error.message;
      showToast(error.message, 'error');
    }
  });

  savePreferencesButton.addEventListener('click', async () => {
    const days = Number(defaultDays.value);
    const time = defaultTime.value;
    if (!Number.isInteger(days) || days < 0) {
      showToast('Default reminder lead time must be a non-negative whole number.', 'error');
      return;
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      showToast('Default reminder time must use HH:MM.', 'error');
      return;
    }
    await updateSettings({ theme: themeSelect.value, defaultReminderDays: days, defaultReminderTime: time });
    applyTheme(themeSelect.value);
    showToast('Preferences saved.');
    window.dispatchEvent(new CustomEvent('timenest:data-changed'));
  });

  themeSelect.addEventListener('change', () => applyTheme(themeSelect.value));

  exportButton.addEventListener('click', async () => {
    try {
      const exportDocument = await createExportDocument();
      const blob = new Blob([JSON.stringify(exportDocument, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = Object.assign(document.createElement('a'), {
        href: url,
        download: `timenest-export-${new Date().toISOString().slice(0, 10)}.json`
      });
      link.click();
      URL.revokeObjectURL(url);
      transferResult.textContent = 'JSON export downloaded.';
    } catch (error) {
      transferResult.textContent = error.message;
      showToast(error.message, 'error');
    }
  });

  importButton.addEventListener('click', async () => {
    const file = importFile.files[0];
    if (!file) {
      showToast('Choose a TimeNest JSON file first.', 'error');
      return;
    }
    const mode = importMode.value;
    const message = mode === IMPORT_MODES.replace
      ? 'Replace all existing reminders, diary entries, and notification history with this import? This cannot be undone.'
      : 'Merge this import with your existing data? Records with matching IDs will be kept as they are.';
    if (!window.confirm(message)) return;
    try {
      const document = JSON.parse(await file.text());
      const report = await importDocument(document, mode);
      transferResult.textContent = `Import complete: ${report.imported} record${report.imported === 1 ? '' : 's'} added${report.skipped ? `; ${report.skipped} duplicate${report.skipped === 1 ? '' : 's'} kept.` : '.'}`;
      importFile.value = '';
      await refresh();
      window.dispatchEvent(new CustomEvent('timenest:data-changed'));
      showToast('Import complete.');
    } catch (error) {
      transferResult.textContent = error instanceof SyntaxError ? 'Import failed: the file is not valid JSON.' : error.message;
      showToast(transferResult.textContent, 'error');
    }
  });

  clearDataButton.addEventListener('click', async () => {
    if (!window.confirm('Clear every reminder, diary entry, notification history item, and preference? This cannot be undone.')) return;
    try {
      await clearAllData();
      transferResult.textContent = 'All local TimeNest data has been cleared.';
      await refresh();
      window.dispatchEvent(new CustomEvent('timenest:data-changed'));
      showToast('All local data cleared.');
    } catch (error) {
      transferResult.textContent = error.message;
      showToast(error.message, 'error');
    }
  });

  return { refresh, page };
}

export { applySavedTheme, applyTheme, initSettingsPage };
