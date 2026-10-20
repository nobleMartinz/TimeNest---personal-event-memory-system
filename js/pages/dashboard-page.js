import { diaryRepository } from '../data/storage.js?v=4';
import { completeReminder, listReminders } from '../services/reminder-service.js';
import { listEvents } from '../services/event-service.js?v=1';
import { differenceInDays, normalizeDate } from '../services/date-service.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[character]));
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`));
}

// Only the first name is used, so a profile called "Martin Smith" greets the
// person as Martin rather than with the whole name.
function greetingFor(displayName) {
  const name = String(displayName || '').trim().split(/\s+/)[0] || '';
  return name ? `Hello ${name}, make today count.` : 'Hello, make today count.';
}

function emptyState(title, message, action = '') {
  return `<div class="empty-state empty-state--compact"><div class="empty-state__illustration" aria-hidden="true">◌</div><h3>${title}</h3><p>${message}</p>${action}</div>`;
}

function reminderRow(reminder, includeComplete = false) {
  return `<article class="dashboard-row"><div><strong>${escapeHtml(reminder.title)}</strong><span>${escapeHtml(reminder.category || 'General')}</span></div><time datetime="${escapeHtml(reminder.nextDueDate)}">${escapeHtml(formatDate(reminder.nextDueDate))}</time>${includeComplete ? `<button class="button button--small button--secondary" type="button" data-dashboard-complete="${escapeHtml(reminder.id)}">Complete</button>` : ''}</article>`;
}

function diaryRow(entry) {
  return `<article class="dashboard-row dashboard-row--diary"><div><strong>${escapeHtml(entry.title)}</strong><span>${escapeHtml(entry.content || entry.category || 'Diary entry')}</span></div><time datetime="${escapeHtml(entry.date)}">${escapeHtml(formatDate(entry.date))}</time></article>`;
}

function eventRow(event) {
  const detail = [event.time, event.location, event.category].filter(Boolean).join(' · ');
  return `<article class="dashboard-row dashboard-row--event"><div><strong>${escapeHtml(event.title)}</strong><span>${escapeHtml(detail || 'Event')}</span></div><time datetime="${escapeHtml(event.date)}">${escapeHtml(formatDate(event.date))}</time></article>`;
}

function completedRow(item) {
  return `<article class="dashboard-row"><div><strong>${escapeHtml(item.title)}</strong><span>Completed ${escapeHtml(formatDate(item.completedAt.slice(0, 10)))}</span></div><time datetime="${escapeHtml(item.dueDate)}">Due ${escapeHtml(formatDate(item.dueDate))}</time></article>`;
}

function initDashboardPage() {
  const dashboardDate = document.querySelector('[data-dashboard-date]');
  const greeting = document.querySelector('#dashboard-greeting');
  const todayValue = document.querySelector('[data-dashboard-value="today"]');
  const upcomingValue = document.querySelector('[data-dashboard-value="upcoming"]');
  const overdueValue = document.querySelector('[data-dashboard-value="overdue"]');
  const eventsValue = document.querySelector('[data-dashboard-value="events"]');
  const eventsNote = document.querySelector('[data-dashboard-events-note]');
  const upcomingList = document.querySelector('#upcoming-reminders-list');
  const overdueList = document.querySelector('#overdue-reminders-list');
  const completedList = document.querySelector('#recent-completed-list');
  const diaryList = document.querySelector('#recent-diary-list');
  const eventsList = document.querySelector('#upcoming-events-list');
  const toastRegion = document.querySelector('#toast-region');

  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.setAttribute('role', 'status');
    toast.textContent = message;
    toastRegion.append(toast);
    window.setTimeout(() => toast.remove(), 3600);
  }

  // The greeting uses the name from the local profile, so it changes as soon
  // as the profile is renamed.
  function setGreeting(displayName) {
    if (!greeting) return;
    greeting.textContent = greetingFor(displayName);
  }

  async function refresh() {
    const today = normalizeDate(new Date());
    const reminders = await listReminders();
    const activeReminders = reminders.filter((reminder) => reminder.status === 'active');
    const todayReminders = activeReminders.filter((reminder) => reminder.nextDueDate === today);
    const upcomingReminders = activeReminders.filter((reminder) => {
      const days = differenceInDays(today, reminder.nextDueDate);
      return days > 0 && days <= 7;
    });
    const overdueReminders = activeReminders.filter((reminder) => differenceInDays(today, reminder.nextDueDate) < 0);
    const completedReminders = reminders.flatMap((reminder) => (reminder.completionHistory || []).map((entry) => ({ ...entry, title: reminder.title })))
      .sort((first, second) => second.completedAt.localeCompare(first.completedAt))
      .slice(0, 5);
    const diaryEntries = (await diaryRepository.getAll())
      .sort((first, second) => second.date.localeCompare(first.date) || second.createdAt.localeCompare(first.createdAt))
      .slice(0, 4);
    const upcomingEvents = (await listEvents({ timing: 'upcoming' })).slice(0, 4);

    dashboardDate.textContent = new Intl.DateTimeFormat(undefined, { dateStyle: 'full' }).format(new Date(`${today}T00:00:00`));
    todayValue.textContent = todayReminders.length;
    upcomingValue.textContent = upcomingReminders.length;
    overdueValue.textContent = overdueReminders.length;
    eventsValue.textContent = upcomingEvents.length;
    eventsNote.textContent = upcomingEvents.length ? 'Coming up' : 'Nothing scheduled';
    todayValue.nextElementSibling.textContent = todayReminders.length ? 'Needs your attention' : 'Nothing pressing today';
    upcomingValue.nextElementSibling.textContent = 'In the next 7 days';
    overdueValue.nextElementSibling.textContent = overdueReminders.length ? 'Needs a response' : 'All caught up';

    upcomingList.innerHTML = upcomingReminders.length
      ? upcomingReminders.map((reminder) => reminderRow(reminder, true)).join('')
      : emptyState('Your future is wide open', 'Add a reminder for something you want to remember, repeat, or prepare for.', '<button class="button button--secondary" type="button" data-open-reminder-form>Create your first reminder</button>');
    overdueList.innerHTML = overdueReminders.length
      ? overdueReminders.map((reminder) => reminderRow(reminder, true)).join('')
      : emptyState('Nothing overdue', 'Completed and upcoming items will stay visible here when they need attention.');
    completedList.innerHTML = completedReminders.length
      ? completedReminders.map(completedRow).join('')
      : '<div class="history-empty"><span class="history-empty__line" aria-hidden="true"></span><p>Completed reminders will appear here, so progress does not disappear.</p></div>';
    diaryList.innerHTML = diaryEntries.length
      ? diaryEntries.map(diaryRow).join('')
      : emptyState('Leave yourself a note', 'Capture a moment, a detail, or something you will be glad to remember.', '<button class="button button--ghost" type="button" data-open-diary-form>Write an entry <span aria-hidden="true">→</span></button>');
    eventsList.innerHTML = upcomingEvents.length
      ? upcomingEvents.map(eventRow).join('')
      : emptyState('Nothing on the horizon', 'Add an event for something you want to remember, whether it has happened or is still ahead.', '<button class="button button--secondary" type="button" data-open-event-form>Add event</button>');
  }

  document.addEventListener('click', async (event) => {
    const completeTrigger = event.target.closest('[data-dashboard-complete]');
    if (completeTrigger) {
      try {
        await completeReminder(completeTrigger.dataset.dashboardComplete);
        await refresh();
        showToast('Reminder completed.');
        window.dispatchEvent(new CustomEvent('timenest:data-changed'));
      } catch (error) {
        showToast(error.message, 'error');
      }
    }
  });

  return { refresh, setGreeting };
}

export { initDashboardPage };
