import {
  REMINDER_STATUS,
  archiveReminder,
  completeReminder,
  createReminder,
  deleteReminder,
  getReminder,
  listReminders,
  restoreReminder,
  snoozeReminder,
  updateReminder
} from '../services/reminder-service.js';
import {
  RECURRENCE_TYPES,
  RECURRENCE_UNITS,
  differenceInDays,
  normalizeDate
} from '../services/date-service.js';
import { getSettings } from '../data/storage.js?v=4';

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
  if (!value) return 'No date';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`));
}

function recurrenceLabel(recurrence) {
  if (!recurrence || recurrence.type === RECURRENCE_TYPES.once) return 'One time';
  if (recurrence.type === RECURRENCE_TYPES.custom) return `Every ${recurrence.interval} ${recurrence.unit}`;
  return `Every ${recurrence.interval > 1 ? recurrence.interval : ''} ${recurrence.type}`.replace('  ', ' ').trim();
}

function statusFor(reminder) {
  if (reminder.status === REMINDER_STATUS.archived) return { label: 'Archived', className: 'status--muted' };
  if (reminder.status === REMINDER_STATUS.completed) return { label: 'Completed', className: 'status--success' };
  const days = differenceInDays(normalizeDate(new Date()), reminder.nextDueDate);
  if (days < 0) return { label: 'Overdue', className: 'status--danger' };
  if (days === 0) return { label: 'Due today', className: 'status--warning' };
  return { label: 'Upcoming', className: 'status--upcoming' };
}

function emptyState(filter) {
  const message = filter === REMINDER_STATUS.archived ? 'Archived reminders will appear here.' : 'Create a reminder for an activity you want to remember.';
  return `<div class="empty-state empty-state--compact"><div class="empty-state__illustration" aria-hidden="true">◷</div><h3>No reminders here yet</h3><p>${message}</p><button class="button button--primary" type="button" data-open-reminder-form>Add reminder</button></div>`;
}

function reminderCard(reminder) {
  const status = statusFor(reminder);
  const action = reminder.status === REMINDER_STATUS.archived
    ? `<button class="button button--small button--secondary" type="button" data-reminder-action="restore" data-reminder-id="${escapeHtml(reminder.id)}">Restore</button>`
    : `<button class="button button--small button--secondary" type="button" data-reminder-action="complete" data-reminder-id="${escapeHtml(reminder.id)}">Complete</button>`;
  return `<article class="reminder-card" data-reminder-id="${escapeHtml(reminder.id)}">
    <div class="reminder-card__main">
      <div class="reminder-card__title-row"><span class="category-dot" aria-hidden="true"></span><h3>${escapeHtml(reminder.title)}</h3></div>
      <p class="reminder-card__meta">${escapeHtml(reminder.category)} · ${escapeHtml(recurrenceLabel(reminder.recurrence))}</p>
      ${reminder.notes ? `<p class="reminder-card__notes">${escapeHtml(reminder.notes)}</p>` : ''}
    </div>
    <div class="reminder-card__date"><strong>${escapeHtml(formatDate(reminder.nextDueDate))}</strong><span class="status ${status.className}">${status.label}</span></div>
    <div class="reminder-card__actions">
      ${action}
      <button class="icon-button icon-button--light" type="button" aria-label="View ${escapeHtml(reminder.title)}" data-reminder-action="detail" data-reminder-id="${escapeHtml(reminder.id)}">→</button>
    </div>
  </article>`;
}

function initRemindersPage() {
  const page = document.querySelector('#reminders-view');
  const list = document.querySelector('#reminder-list');
  const filter = document.querySelector('#reminder-filter');
  const formDialog = document.querySelector('#reminder-form-dialog');
  const detailDialog = document.querySelector('#reminder-detail-dialog');
  const form = document.querySelector('#reminder-form');
  const recurrenceType = form.elements.recurrenceType;
  const customUnitField = document.querySelector('#custom-unit-field');
  const intervalField = document.querySelector('#recurrence-interval-field');
  let editingId = null;
  let defaultSettings = { defaultReminderDays: 7, defaultReminderTime: '09:00' };

  function showToast(message, type = 'success') {
    const region = document.querySelector('#toast-region');
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.setAttribute('role', 'status');
    toast.textContent = message;
    region.append(toast);
    window.setTimeout(() => toast.remove(), 3600);
  }

  function updateRecurrenceFields() {
    const isOnce = recurrenceType.value === RECURRENCE_TYPES.once;
    intervalField.hidden = isOnce;
    customUnitField.hidden = recurrenceType.value !== RECURRENCE_TYPES.custom;
    form.elements.recurrenceInterval.required = !isOnce;
  }

  function resetForm(reminder) {
    editingId = reminder?.id || null;
    form.reset();
    form.elements.title.value = reminder?.title || '';
    form.elements.category.value = reminder?.category || 'General';
    form.elements.nextDueDate.value = reminder?.nextDueDate || normalizeDate(new Date());
    form.elements.reminderTime.value = reminder?.reminderTime ?? defaultSettings.defaultReminderTime;
    form.elements.reminderDaysBefore.value = reminder?.reminderDaysBefore ?? defaultSettings.defaultReminderDays;
    form.elements.notes.value = reminder?.notes || '';
    form.elements.recurrenceType.value = reminder?.recurrence?.type || RECURRENCE_TYPES.once;
    form.elements.recurrenceInterval.value = reminder?.recurrence?.interval || 1;
    form.elements.customUnit.value = reminder?.recurrence?.unit || RECURRENCE_UNITS.days;
    document.querySelector('#reminder-form-title').textContent = reminder ? 'Edit reminder' : 'Add reminder';
    updateRecurrenceFields();
  }

  function showDialog(dialog) {
    if (!dialog) return;
    if (dialog.open) dialog.close();
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  async function openForm(reminder) {
    resetForm(reminder);
    showDialog(formDialog);
    form.elements.title.focus();
    try {
      defaultSettings = await getSettings();
      if (!reminder) {
        form.elements.reminderTime.value = defaultSettings.defaultReminderTime;
        form.elements.reminderDaysBefore.value = defaultSettings.defaultReminderDays;
      }
    } catch {
      defaultSettings = { defaultReminderDays: 7, defaultReminderTime: '09:00' };
    }
  }

  async function renderDetail(id) {
    const reminder = await getReminder(id);
    if (!reminder) return;
    const status = statusFor(reminder);
    const history = reminder.completionHistory?.length
      ? `<ol class="completion-history">${[...reminder.completionHistory].reverse().map((entry) => `<li><strong>${escapeHtml(formatDate(entry.dueDate))}</strong><span>Completed ${escapeHtml(formatDate(entry.completedAt.slice(0, 10)))}</span></li>`).join('')}</ol>`
      : '<p class="detail-muted">No completions recorded yet.</p>';
    const archiveAction = reminder.status === REMINDER_STATUS.archived
      ? `<button class="button button--secondary" type="button" data-reminder-action="restore" data-reminder-id="${escapeHtml(id)}">Restore</button>`
      : `<button class="button button--secondary" type="button" data-reminder-action="archive" data-reminder-id="${escapeHtml(id)}">Archive</button>`;
    document.querySelector('#reminder-detail-content').innerHTML = `<div class="detail-heading"><div><p class="eyebrow">Reminder detail</p><h2 id="reminder-detail-title">${escapeHtml(reminder.title)}</h2><span class="status ${status.className}">${status.label}</span></div><button class="icon-button icon-button--light" type="button" aria-label="Close reminder details" data-close-dialog="reminder-detail-dialog">×</button></div>
      <dl class="detail-list"><div><dt>Next due</dt><dd>${escapeHtml(formatDate(reminder.nextDueDate))}</dd></div><div><dt>Repeats</dt><dd>${escapeHtml(recurrenceLabel(reminder.recurrence))}</dd></div><div><dt>Reminder begins</dt><dd>${escapeHtml(formatDate(reminder.reminderStartDate))}</dd></div><div><dt>Category</dt><dd>${escapeHtml(reminder.category)}</dd></div></dl>
      ${reminder.notes ? `<div class="detail-notes"><h3>Notes</h3><p>${escapeHtml(reminder.notes)}</p></div>` : ''}
      <section class="detail-history"><h3>Completion history</h3>${history}</section>
      <div class="modal__footer"><button class="button button--secondary" type="button" data-reminder-action="snooze" data-reminder-id="${escapeHtml(id)}">Snooze 1 day</button>${archiveAction}<button class="button button--secondary" type="button" data-reminder-action="edit" data-reminder-id="${escapeHtml(id)}">Edit</button><button class="button button--danger" type="button" data-reminder-action="delete" data-reminder-id="${escapeHtml(id)}">Delete</button></div>`;
    detailDialog.showModal();
  }

  async function refresh() {
    const selectedFilter = filter.value;
    const reminders = await listReminders({ includeArchived: selectedFilter !== REMINDER_STATUS.active });
    const visible = selectedFilter === 'all' ? reminders : reminders.filter((reminder) => reminder.status === selectedFilter);
    list.innerHTML = visible.length ? visible.map(reminderCard).join('') : emptyState(selectedFilter);
  }

  async function handleAction(action, id) {
    try {
      if (action === 'detail') return renderDetail(id);
      if (action === 'edit') {
        detailDialog.close();
        return openForm(await getReminder(id));
      }
      if (action === 'delete') {
        if (!window.confirm('Delete this reminder permanently?')) return;
        await deleteReminder(id);
        detailDialog.close();
        await refresh();
        window.dispatchEvent(new CustomEvent('timenest:data-changed'));
        showToast('Reminder deleted.');
        return;
      }
      if (action === 'complete') await completeReminder(id);
      if (action === 'archive') await archiveReminder(id);
      if (action === 'restore') await restoreReminder(id);
      if (action === 'snooze') await snoozeReminder(id);
      await refresh();
      window.dispatchEvent(new CustomEvent('timenest:data-changed'));
      if (detailDialog.open) await renderDetail(id);
      showToast(`Reminder ${action}d.`);
    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const recurrence = {
      type: data.get('recurrenceType'),
      interval: Number(data.get('recurrenceInterval') || 1),
      unit: data.get('customUnit')
    };
    try {
      const input = {
        title: data.get('title'),
        category: data.get('category'),
        nextDueDate: data.get('nextDueDate'),
        startDate: data.get('nextDueDate'),
        reminderTime: data.get('reminderTime'),
        reminderDaysBefore: Number(data.get('reminderDaysBefore')),
        notes: data.get('notes'),
        recurrence
      };
      if (editingId) await updateReminder(editingId, input);
      else await createReminder(input);
      formDialog.close();
      await refresh();
      window.dispatchEvent(new CustomEvent('timenest:data-changed'));
      showToast(editingId ? 'Reminder updated.' : 'Reminder created.');
    } catch (error) {
      showToast(error.message, 'error');
    }
  });

  recurrenceType.addEventListener('change', updateRecurrenceFields);
  filter.addEventListener('change', refresh);
  document.addEventListener('click', (event) => {
    const openFormTrigger = event.target.closest('[data-open-reminder-form]');
    if (openFormTrigger) {
      event.preventDefault();
      void openForm().catch((error) => showToast(error.message, 'error'));
      return;
    }
    const actionTrigger = event.target.closest('[data-reminder-action]');
    if (actionTrigger) handleAction(actionTrigger.dataset.reminderAction, actionTrigger.dataset.reminderId);
    const closeTrigger = event.target.closest('[data-close-dialog]');
    if (closeTrigger) document.querySelector(`#${closeTrigger.dataset.closeDialog}`)?.close();
  });

  updateRecurrenceFields();

  return { refresh, openForm, page };
}

export { initRemindersPage };
