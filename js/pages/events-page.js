import {
  EVENT_TIMING,
  cancelEvent,
  createEvent,
  deleteEvent,
  getEvent,
  getEventTiming,
  listEvents,
  restoreEvent,
  updateEvent
} from '../services/event-service.js?v=1';
import { normalizeDate } from '../services/date-service.js';

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

function formatDateRange(event) {
  if (!event.endDate) return formatDate(event.date);
  if (event.endDate === event.date) return formatDate(event.date);
  return `${formatDate(event.date)} - ${formatDate(event.endDate)}`;
}

function formatTimeRange(event) {
  if (!event.time) return '';
  return event.endTime ? `${event.time} - ${event.endTime}` : event.time;
}

function timingFor(event) {
  const timing = getEventTiming(event);
  if (event.cancelled) return { label: 'Cancelled', className: 'status--muted' };
  if (timing === EVENT_TIMING.today) return { label: 'Happening today', className: 'status--warning' };
  if (timing === EVENT_TIMING.past) return { label: 'Past', className: 'status--muted' };
  return { label: 'Upcoming', className: 'status--upcoming' };
}

function emptyState(filter) {
  const messages = {
    [EVENT_TIMING.upcoming]: 'Nothing scheduled yet. Add an event for something you are looking forward to.',
    [EVENT_TIMING.past]: 'No past events recorded yet. Events you have lived through will collect here.',
    all: 'No events yet. Add the moments you want to remember.'
  };
  const headings = {
    [EVENT_TIMING.upcoming]: 'Nothing coming up',
    [EVENT_TIMING.past]: 'Nothing in the past yet',
    all: 'No events yet'
  };
  const key = messages[filter] ? filter : 'all';
  return `<div class="empty-state empty-state--compact"><div class="empty-state__illustration" aria-hidden="true">◈</div><h3>${headings[key]}</h3><p>${messages[key]}</p><button class="button button--primary" type="button" data-open-event-form>Add event</button></div>`;
}

function eventCard(event) {
  const status = timingFor(event);
  const time = formatTimeRange(event);
  const location = event.location ? `<p class="event-card__location">${escapeHtml(event.location)}</p>` : '';
  const cancelAction = event.cancelled
    ? `<button class="button button--small button--secondary" type="button" data-event-action="restore" data-event-id="${escapeHtml(event.id)}">Restore</button>`
    : `<button class="button button--small button--secondary" type="button" data-event-action="cancel" data-event-id="${escapeHtml(event.id)}">Cancel</button>`;
  return `<article class="event-card${event.cancelled ? ' event-card--cancelled' : ''}" data-event-id="${escapeHtml(event.id)}">
    <div class="event-card__main">
      <div class="event-card__title-row"><span class="event-card__marker" aria-hidden="true"></span><h3>${escapeHtml(event.title)}</h3></div>
      <p class="event-card__meta">${escapeHtml(event.category)}</p>
      ${location}
      ${event.notes ? `<p class="event-card__notes">${escapeHtml(event.notes)}</p>` : ''}
    </div>
    <div class="event-card__date">
      <strong>${escapeHtml(formatDateRange(event))}</strong>
      ${time ? `<span class="event-card__time">${escapeHtml(time)}</span>` : ''}
      <span class="status ${status.className}">${status.label}</span>
    </div>
    <div class="event-card__actions">
      ${cancelAction}
      <button class="icon-button icon-button--light" type="button" aria-label="View ${escapeHtml(event.title)}" data-event-action="detail" data-event-id="${escapeHtml(event.id)}">→</button>
    </div>
  </article>`;
}

function initEventsPage() {
  const page = document.querySelector('#events-view');
  const list = document.querySelector('#event-list');
  const filter = document.querySelector('#event-filter');
  const search = document.querySelector('#event-search');
  const category = document.querySelector('#event-category-filter');
  const formDialog = document.querySelector('#event-form-dialog');
  const detailDialog = document.querySelector('#event-detail-dialog');
  const form = document.querySelector('#event-form');
  const toastRegion = document.querySelector('#toast-region');
  let editingId = null;
  let refreshSequence = 0;

  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.setAttribute('role', 'status');
    toast.textContent = message;
    toastRegion.append(toast);
    window.setTimeout(() => toast.remove(), 3600);
  }

  function showDialog(dialog) {
    if (!dialog) return;
    if (dialog.open) dialog.close();
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  function openForm(event) {
    editingId = event?.id || null;
    form.reset();
    form.elements.title.value = event?.title || '';
    form.elements.date.value = event?.date || normalizeDate(new Date());
    form.elements.endDate.value = event?.endDate || '';
    form.elements.time.value = event?.time || '';
    form.elements.endTime.value = event?.endTime || '';
    form.elements.category.value = event?.category || 'General';
    form.elements.location.value = event?.location || '';
    form.elements.notes.value = event?.notes || '';
    document.querySelector('#event-form-title').textContent = event ? 'Edit event' : 'Add event';
    showDialog(formDialog);
    form.elements.title.focus();
  }

  async function refreshCategories() {
    const events = await listEvents({ includeCancelled: true });
    const selected = category.value;
    const categories = [...new Set(events.map((event) => event.category).filter(Boolean))].sort();
    category.innerHTML = '<option value="">All categories</option>' + categories.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
    category.value = categories.includes(selected) ? selected : '';
  }

  async function refresh() {
    const sequence = ++refreshSequence;
    await refreshCategories();
    if (sequence !== refreshSequence) return;
    const events = await listEvents({
      timing: filter.value,
      query: search.value,
      category: category.value,
      // Cancelled events stay listed so they can be restored instead of
      // disappearing for good.
      includeCancelled: true
    });
    if (sequence !== refreshSequence) return;
    list.innerHTML = events.length ? events.map(eventCard).join('') : emptyState(filter.value);
  }

  async function renderDetail(id) {
    const event = await getEvent(id);
    if (!event) return;
    const status = timingFor(event);
    const time = formatTimeRange(event);
    const notes = event.notes ? `<div class="detail-notes"><h3>Notes</h3><p>${escapeHtml(event.notes)}</p></div>` : '';
    const cancelAction = event.cancelled
      ? `<button class="button button--secondary" type="button" data-event-action="restore" data-event-id="${escapeHtml(id)}">Restore</button>`
      : `<button class="button button--secondary" type="button" data-event-action="cancel" data-event-id="${escapeHtml(id)}">Cancel event</button>`;
    document.querySelector('#event-detail-content').innerHTML = `<div class="detail-heading"><div><p class="eyebrow">Event detail</p><h2 id="event-detail-title">${escapeHtml(event.title)}</h2><span class="status ${status.className}">${status.label}</span></div><button class="icon-button icon-button--light" type="button" aria-label="Close event details" data-close-dialog="event-detail-dialog">×</button></div>
      <dl class="detail-list"><div><dt>Date</dt><dd>${escapeHtml(formatDateRange(event))}</dd></div><div><dt>Time</dt><dd>${escapeHtml(time || 'Not set')}</dd></div><div><dt>Category</dt><dd>${escapeHtml(event.category)}</dd></div><div><dt>Location</dt><dd>${escapeHtml(event.location || 'Not set')}</dd></div></dl>
      ${notes}
      <div class="modal__footer">${cancelAction}<button class="button button--secondary" type="button" data-event-action="edit" data-event-id="${escapeHtml(id)}">Edit</button><button class="button button--danger" type="button" data-event-action="delete" data-event-id="${escapeHtml(id)}">Delete</button></div>`;
    detailDialog.showModal();
  }

  async function handleAction(action, id) {
    try {
      if (action === 'detail') return renderDetail(id);
      if (action === 'edit') {
        detailDialog.close();
        return openForm(await getEvent(id));
      }
      if (action === 'delete') {
        if (!window.confirm('Delete this event permanently?')) return;
        await deleteEvent(id);
        detailDialog.close();
        await refresh();
        window.dispatchEvent(new CustomEvent('timenest:data-changed'));
        showToast('Event deleted.');
        return;
      }
      if (action === 'cancel') await cancelEvent(id);
      if (action === 'restore') await restoreEvent(id);
      await refresh();
      window.dispatchEvent(new CustomEvent('timenest:data-changed'));
      if (detailDialog.open) await renderDetail(id);
      showToast(action === 'cancel' ? 'Event cancelled.' : 'Event restored.');
    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    try {
      const input = {
        title: data.get('title'),
        date: data.get('date'),
        endDate: data.get('endDate'),
        time: data.get('time'),
        endTime: data.get('endTime'),
        category: data.get('category'),
        location: data.get('location'),
        notes: data.get('notes')
      };
      if (editingId) await updateEvent(editingId, input);
      else await createEvent(input);
      formDialog.close();
      await refresh();
      window.dispatchEvent(new CustomEvent('timenest:data-changed'));
      showToast(editingId ? 'Event updated.' : 'Event saved.');
    } catch (error) {
      showToast(error.message, 'error');
    }
  });

  filter.addEventListener('change', refresh);
  search.addEventListener('input', refresh);
  category.addEventListener('change', refresh);
  document.addEventListener('click', (event) => {
    const openTrigger = event.target.closest('[data-open-event-form]');
    if (openTrigger) {
      event.preventDefault();
      try {
        openForm();
      } catch (error) {
        showToast(error.message, 'error');
      }
      return;
    }
    const actionTrigger = event.target.closest('[data-event-action]');
    if (actionTrigger) handleAction(actionTrigger.dataset.eventAction, actionTrigger.dataset.eventId);
    const closeTrigger = event.target.closest('[data-close-dialog="event-form-dialog"], [data-close-dialog="event-detail-dialog"]');
    if (closeTrigger) document.querySelector(`#${closeTrigger.dataset.closeDialog}`)?.close();
  });

  return { refresh, openForm, page };
}

export { initEventsPage };
