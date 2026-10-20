import { diaryRepository } from '../data/storage.js?v=2';
import { reminderRepository } from '../data/storage.js?v=2';
import { eventRepository } from '../data/storage.js?v=2';
import { daysInMonth, normalizeDate } from '../services/date-service.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[character]));
}

function dateKey(year, monthIndex, day) {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(`${value}T00:00:00`));
}

function initCalendarPage() {
  const page = document.querySelector('#calendar-view');
  const title = document.querySelector('#calendar-title');
  const grid = document.querySelector('#calendar-grid');
  const selectedDateLabel = document.querySelector('#calendar-selected-date');
  const selectedItems = document.querySelector('#calendar-selected-items');
  const today = normalizeDate(new Date());
  const todayParts = today.split('-').map(Number);
  const state = { year: todayParts[0], month: todayParts[1] - 1, selected: today };
  let renderSequence = 0;

  async function renderSelected(date, diaries, reminders, events) {
    state.selected = date;
    selectedDateLabel.textContent = formatDate(date);
    const dateDiaries = diaries.filter((entry) => entry.date === date);
    const dateReminders = reminders.filter((reminder) => reminder.nextDueDate === date);
    const dateEvents = events.filter((event) => event.date === date || (event.endDate && event.endDate >= date && event.date <= date));
    const items = [
      ...dateReminders.map((reminder) => `<li class="calendar-item calendar-item--reminder"><strong>${escapeHtml(reminder.title)}</strong><span>Reminder</span></li>`),
      ...dateDiaries.map((entry) => `<li class="calendar-item calendar-item--diary"><strong>${escapeHtml(entry.title)}</strong><span>Diary entry</span></li>`),
      ...dateEvents.map((event) => `<li class="calendar-item calendar-item--event"><strong>${escapeHtml(event.title)}</strong><span>Event${event.cancelled ? ' (cancelled)' : ''}</span></li>`)
    ];
    selectedItems.innerHTML = items.length ? `<ul class="calendar-item-list">${items.join('')}</ul>` : '<p class="detail-muted">Nothing recorded for this date.</p>';
  }

  async function refresh() {
    const sequence = ++renderSequence;
    const [diaries, reminders, events] = await Promise.all([diaryRepository.getAll(), reminderRepository.getAll(), eventRepository.getAll()]);
    if (sequence !== renderSequence) return;
    const firstDay = new Date(Date.UTC(state.year, state.month, 1)).getUTCDay();
    const monthLength = daysInMonth(state.year, state.month);
    const previousMonthLength = daysInMonth(state.year, state.month - 1);
    title.textContent = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(new Date(Date.UTC(state.year, state.month, 1)));
    const cells = [];

    for (let index = 0; index < 42; index += 1) {
      const dayNumber = index - firstDay + 1;
      let year = state.year;
      let month = state.month;
      let day = dayNumber;
      let muted = false;
      if (dayNumber < 1) {
        muted = true;
        month -= 1;
        if (month < 0) { month = 11; year -= 1; }
        day = previousMonthLength + dayNumber;
      } else if (dayNumber > monthLength) {
        muted = true;
        month += 1;
        if (month > 11) { month = 0; year += 1; }
        day = dayNumber - monthLength;
      }
      const key = dateKey(year, month, day);
      const hasDiary = diaries.some((entry) => entry.date === key);
      const hasReminder = reminders.some((reminder) => reminder.nextDueDate === key && reminder.status !== 'archived');
      const hasEvent = events.some((event) => event.date === key || (event.endDate && event.endDate >= key && event.date <= key));
      const classes = ['calendar-day'];
      if (muted) classes.push('calendar-day--muted');
      if (key === today) classes.push('calendar-day--today');
      if (key === state.selected) classes.push('calendar-day--selected');
      const itemLabel = `${hasDiary ? ' Diary entry.' : ''}${hasReminder ? ' Reminder.' : ''}${hasEvent ? ' Event.' : ''}`;
      cells.push(`<button class="${classes.join(' ')}" type="button" data-calendar-date="${key}" aria-label="${escapeHtml(formatDate(key))}.${itemLabel}"><span aria-hidden="true">${day}</span><span class="calendar-day__markers" aria-hidden="true">${hasDiary ? '<i class="calendar-marker calendar-marker--diary"></i>' : ''}${hasReminder ? '<i class="calendar-marker calendar-marker--reminder"></i>' : ''}${hasEvent ? '<i class="calendar-marker calendar-marker--event"></i>' : ''}</span></button>`);
    }
    grid.innerHTML = cells.join('');
    if (sequence !== renderSequence) return;
    await renderSelected(state.selected, diaries, reminders, events);
  }

  function moveMonth(amount) {
    state.month += amount;
    if (state.month < 0) { state.month = 11; state.year -= 1; }
    if (state.month > 11) { state.month = 0; state.year += 1; }
    state.selected = dateKey(state.year, state.month, 1);
    void refresh();
  }

  page.addEventListener('click', (event) => {
    const dateButton = event.target.closest('[data-calendar-date]');
    if (dateButton) {
      state.selected = dateButton.dataset.calendarDate;
      void refresh();
    }
    if (event.target.closest('[data-calendar-prev]')) {
      moveMonth(-1);
    }
    if (event.target.closest('[data-calendar-next]')) {
      moveMonth(1);
    }
    if (event.target.closest('[data-calendar-today]')) {
      const parts = today.split('-').map(Number);
      state.year = parts[0];
      state.month = parts[1] - 1;
      state.selected = today;
      void refresh();
    }
  });

  return { refresh, page };
}

export { initCalendarPage };
