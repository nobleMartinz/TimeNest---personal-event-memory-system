import {
  getSettings,
  notificationHistoryRepository,
  updateSettings
} from '../data/storage.js?v=4';
import { reminderRepository } from '../data/storage.js?v=4';
import { differenceInDays, normalizeDate } from './date-service.js';

const NOTIFICATION_KINDS = Object.freeze({
  lead: 'lead',
  due: 'due',
  overdue: 'overdue'
});

function getNotificationStatus() {
  const supported = typeof globalThis.Notification !== 'undefined';
  const permission = supported ? globalThis.Notification.permission : 'unsupported';
  return {
    supported,
    permission,
    canRequest: supported && permission === 'default',
    message: !supported
      ? 'This browser does not support notifications. TimeNest will still show reminders in the app.'
      : permission === 'denied'
        ? 'Notifications are blocked in this browser. You can still use all reminder features.'
        : permission === 'granted'
          ? 'Notifications are enabled for this browser.'
          : 'Notifications are available after you grant permission.'
  };
}

async function requestNotificationPermission() {
  const status = getNotificationStatus();
  if (!status.supported) return { ...status, permission: 'unsupported' };
  if (status.permission !== 'default') return getNotificationStatus();
  await globalThis.Notification.requestPermission();
  return getNotificationStatus();
}

function getNotificationEligibility(reminder, date, settings) {
  if (reminder.status !== 'active' || reminder.archived) return null;
  const daysUntilDue = differenceInDays(date, reminder.nextDueDate);
  if (daysUntilDue < 0) {
    return settings.overdueRemindersEnabled ? NOTIFICATION_KINDS.overdue : null;
  }
  if (daysUntilDue === 0) return NOTIFICATION_KINDS.due;
  if (daysUntilDue <= reminder.reminderDaysBefore) return NOTIFICATION_KINDS.lead;
  return null;
}

function notificationHistoryKey(reminderId, kind, date) {
  return `${reminderId}:${kind}:${date}`;
}

function notificationCopy(reminder, kind) {
  if (kind === NOTIFICATION_KINDS.due) {
    return { title: `Due today: ${reminder.title}`, body: 'This reminder is due today.' };
  }
  if (kind === NOTIFICATION_KINDS.overdue) {
    return { title: `Overdue: ${reminder.title}`, body: 'This reminder still needs your attention.' };
  }
  return { title: `Coming up: ${reminder.title}`, body: `Due on ${reminder.nextDueDate}.` };
}

async function checkAndNotifyReminders({ now = new Date(), NotificationConstructor = globalThis.Notification, notificationStatus = getNotificationStatus() } = {}) {
  const settings = await getSettings();
  const date = normalizeDate(now);
  const status = notificationStatus;
  const reminders = await reminderRepository.getAll();
  const eligible = reminders.map((reminder) => ({
    reminder,
    kind: getNotificationEligibility(reminder, date, settings)
  })).filter((item) => item.kind);

  const report = {
    date,
    status: 'checked',
    eligible: eligible.length,
    sent: 0,
    skipped: 0,
    reason: null
  };

  if (!settings.notificationEnabled) {
    report.status = 'disabled';
    report.reason = 'Notifications are disabled in Settings.';
    return report;
  }
  if (!status.supported || status.permission !== 'granted' || !NotificationConstructor) {
    report.status = 'unavailable';
    report.reason = status.message;
    return report;
  }

  const history = await notificationHistoryRepository.getAll();
  const sentKeys = new Set(history.map((entry) => entry.key));
  for (const item of eligible) {
    const key = notificationHistoryKey(item.reminder.id, item.kind, date);
    if (sentKeys.has(key)) {
      report.skipped += 1;
      continue;
    }
    const copy = notificationCopy(item.reminder, item.kind);
    new NotificationConstructor(copy.title, { body: copy.body, tag: key });
    await notificationHistoryRepository.add({
      id: `notification-${key}`,
      key,
      reminderId: item.reminder.id,
      kind: item.kind,
      date,
      sentAt: new Date().toISOString()
    });
    sentKeys.add(key);
    report.sent += 1;
  }
  return report;
}

async function setNotificationsEnabled(enabled) {
  return updateSettings({ notificationEnabled: Boolean(enabled) });
}

async function setOverdueNotificationsEnabled(enabled) {
  return updateSettings({ overdueRemindersEnabled: Boolean(enabled) });
}

export {
  NOTIFICATION_KINDS,
  checkAndNotifyReminders,
  getNotificationEligibility,
  getNotificationStatus,
  notificationHistoryKey,
  requestNotificationPermission,
  setNotificationsEnabled,
  setOverdueNotificationsEnabled
};
