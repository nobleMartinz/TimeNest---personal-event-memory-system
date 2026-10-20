import {
  createDiaryEntry,
  deleteDiaryEntry,
  getDiaryEntry,
  listDiaryEntries,
  updateDiaryEntry
} from '../services/diary-service.js';

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

function entryCard(entry) {
  return `<article class="diary-card" data-diary-id="${escapeHtml(entry.id)}"><div class="diary-card__date"><strong>${escapeHtml(formatDate(entry.date))}</strong>${entry.time ? `<span>${escapeHtml(entry.time)}</span>` : ''}</div><div class="diary-card__body"><p class="eyebrow">${escapeHtml(entry.category)}</p><h3>${escapeHtml(entry.title)}</h3><p>${escapeHtml(entry.content)}</p></div><div class="diary-card__actions"><button class="button button--small button--secondary" type="button" data-diary-action="edit" data-diary-id="${escapeHtml(entry.id)}">Edit</button><button class="icon-button icon-button--light" type="button" aria-label="View ${escapeHtml(entry.title)}" data-diary-action="detail" data-diary-id="${escapeHtml(entry.id)}">→</button></div></article>`;
}

function initDiaryPage() {
  const page = document.querySelector('#diary-view');
  const list = document.querySelector('#diary-list');
  const search = document.querySelector('#diary-search');
  const category = document.querySelector('#diary-category-filter');
  const date = document.querySelector('#diary-date-filter');
  const sort = document.querySelector('#diary-sort');
  const formDialog = document.querySelector('#diary-form-dialog');
  const detailDialog = document.querySelector('#diary-detail-dialog');
  const form = document.querySelector('#diary-form');
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

  function openForm(entry) {
    editingId = entry?.id || null;
    form.reset();
    form.elements.date.value = entry?.date || new Date().toISOString().slice(0, 10);
    form.elements.time.value = entry?.time || '';
    form.elements.category.value = entry?.category || 'General';
    form.elements.title.value = entry?.title || '';
    form.elements.content.value = entry?.content || '';
    document.querySelector('#diary-form-title').textContent = entry ? 'Edit diary entry' : 'Add diary entry';
    showDialog(formDialog);
    form.elements.title.focus();
  }

  async function refreshCategories() {
    const entries = await listDiaryEntries();
    const selected = category.value;
    const categories = [...new Set(entries.map((entry) => entry.category).filter(Boolean))].sort();
    category.innerHTML = '<option value="">All categories</option>' + categories.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
    category.value = categories.includes(selected) ? selected : '';
  }

  async function refresh() {
    const sequence = ++refreshSequence;
    await refreshCategories();
    if (sequence !== refreshSequence) return;
    const entries = await listDiaryEntries({ query: search.value, category: category.value, date: date.value, sort: sort.value });
    if (sequence !== refreshSequence) return;
    list.innerHTML = entries.length
      ? entries.map(entryCard).join('')
      : '<div class="empty-state empty-state--compact"><div class="empty-state__illustration" aria-hidden="true">✎</div><h3>No diary entries found</h3><p>Try a different search or record something worth remembering.</p><button class="button button--primary" type="button" data-open-diary-form>Add diary entry</button></div>';
  }

  async function renderDetail(id) {
    const entry = await getDiaryEntry(id);
    if (!entry) return;
    document.querySelector('#diary-detail-content').innerHTML = `<div class="detail-heading"><div><p class="eyebrow">Diary entry</p><h2 id="diary-detail-title">${escapeHtml(entry.title)}</h2><span class="status status--success">${escapeHtml(formatDate(entry.date))}</span></div><button class="icon-button icon-button--light" type="button" aria-label="Close diary details" data-close-dialog="diary-detail-dialog">×</button></div><div class="diary-detail-meta">${escapeHtml(entry.category)}${entry.time ? ` · ${escapeHtml(entry.time)}` : ''}</div><div class="detail-notes diary-detail-content"><p>${escapeHtml(entry.content)}</p></div><div class="modal__footer"><button class="button button--secondary" type="button" data-diary-action="edit" data-diary-id="${escapeHtml(id)}">Edit</button><button class="button button--danger" type="button" data-diary-action="delete" data-diary-id="${escapeHtml(id)}">Delete</button></div>`;
    detailDialog.showModal();
  }

  async function handleAction(action, id) {
    try {
      if (action === 'detail') return renderDetail(id);
      if (action === 'edit') {
        detailDialog.close();
        return openForm(await getDiaryEntry(id));
      }
      if (action === 'delete') {
        if (!window.confirm('Delete this diary entry permanently?')) return;
        await deleteDiaryEntry(id);
        detailDialog.close();
        await refresh();
        window.dispatchEvent(new CustomEvent('timenest:data-changed'));
        showToast('Diary entry deleted.');
      }
    } catch (error) {
      showToast(error.message, 'error');
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    try {
      const input = { date: data.get('date'), time: data.get('time'), title: data.get('title'), content: data.get('content'), category: data.get('category') };
      if (editingId) await updateDiaryEntry(editingId, input);
      else await createDiaryEntry(input);
      formDialog.close();
      await refresh();
      window.dispatchEvent(new CustomEvent('timenest:data-changed'));
      showToast(editingId ? 'Diary entry updated.' : 'Diary entry saved.');
    } catch (error) {
      showToast(error.message, 'error');
    }
  });

  [search, category, date, sort].forEach((control) => control.addEventListener(control === search || control === date ? 'input' : 'change', refresh));
  document.addEventListener('click', (event) => {
    const openTrigger = event.target.closest('[data-open-diary-form]');
    if (openTrigger) {
      event.preventDefault();
      try {
        openForm();
      } catch (error) {
        showToast(error.message, 'error');
      }
      return;
    }
    const actionTrigger = event.target.closest('[data-diary-action]');
    if (actionTrigger) handleAction(actionTrigger.dataset.diaryAction, actionTrigger.dataset.diaryId);
    const closeTrigger = event.target.closest('[data-close-dialog="diary-form-dialog"], [data-close-dialog="diary-detail-dialog"]');
    if (closeTrigger) document.querySelector(`#${closeTrigger.dataset.closeDialog}`)?.close();
  });

  return { refresh, openForm, page };
}

export { initDiaryPage };
