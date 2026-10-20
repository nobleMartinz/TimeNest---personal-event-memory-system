import {
  BILL_STATUS,
  BILL_TIMING,
  createBill,
  deleteBill,
  getBill,
  getBillTiming,
  listBills,
  markBillPaid,
  markBillUnpaid,
  updateBill
} from '../services/bill-service.js?v=1';
import { DEFAULT_CURRENCY, currencySymbol, formatAmount } from '../services/currency-service.js?v=2';
import { getSettings } from '../data/storage.js?v=4';
import { normalizeDate } from '../services/date-service.js';

let activeCurrency = DEFAULT_CURRENCY;

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

function statusFor(bill) {
  if (bill.paid) return { label: 'Paid', className: 'status--success' };
  const timing = getBillTiming(bill);
  if (timing === BILL_TIMING.today) return { label: 'Due today', className: 'status--warning' };
  if (timing === BILL_TIMING.overdue) return { label: 'Overdue', className: 'status--danger' };
  return { label: 'Upcoming', className: 'status--upcoming' };
}

function emptyState(filter) {
  const messages = {
    [BILL_STATUS.unpaid]: 'Nothing is waiting to be paid. Add a bill to keep the next payment in view.',
    [BILL_STATUS.paid]: 'No bills have been settled yet.',
    all: 'No bills yet. Add the payments you want to keep track of.'
  };
  const headings = {
    [BILL_STATUS.unpaid]: 'No unpaid bills',
    [BILL_STATUS.paid]: 'Nothing paid yet',
    all: 'No bills yet'
  };
  const key = messages[filter] ? filter : 'all';
  return `<div class="empty-state empty-state--compact"><div class="empty-state__illustration" aria-hidden="true">¤</div><h3>${headings[key]}</h3><p>${messages[key]}</p><button class="button button--primary" type="button" data-open-bill-form>Add bill</button></div>`;
}

function billCard(bill) {
  const status = statusFor(bill);
  const payAction = bill.paid
    ? `<button class="button button--small button--secondary" type="button" data-bill-action="unpay" data-bill-id="${escapeHtml(bill.id)}">Mark unpaid</button>`
    : `<button class="button button--small button--secondary" type="button" data-bill-action="pay" data-bill-id="${escapeHtml(bill.id)}">Mark paid</button>`;
  const paidDate = bill.paid && bill.paidDate ? `<span class="bill-card__paid-date">Paid ${escapeHtml(formatDate(bill.paidDate))}</span>` : '';
  return `<article class="bill-card${bill.paid ? ' bill-card--paid' : ''}" data-bill-id="${escapeHtml(bill.id)}">
    <div class="bill-card__main">
      <div class="bill-card__title-row"><span class="bill-card__marker" aria-hidden="true"></span><h3>${escapeHtml(bill.title)}</h3></div>
      <p class="bill-card__meta">${escapeHtml(bill.category)}</p>
      ${bill.notes ? `<p class="bill-card__notes">${escapeHtml(bill.notes)}</p>` : ''}
    </div>
    <div class="bill-card__due">
      <strong>${escapeHtml(formatDate(bill.dueDate))}</strong>
      <span class="status ${status.className}">${status.label}</span>
    </div>
    <div class="bill-card__amount">
      <strong>${escapeHtml(formatAmount(bill.amount, activeCurrency))}</strong>
      ${paidDate}
    </div>
    <div class="bill-card__actions">
      ${payAction}
      <button class="icon-button icon-button--light" type="button" aria-label="View ${escapeHtml(bill.title)}" data-bill-action="detail" data-bill-id="${escapeHtml(bill.id)}">→</button>
    </div>
  </article>`;
}

function initBillsPage() {
  const page = document.querySelector('#bills-view');
  const list = document.querySelector('#bill-list');
  const filter = document.querySelector('#bill-filter');
  const search = document.querySelector('#bill-search');
  const category = document.querySelector('#bill-category-filter');
  const sort = document.querySelector('#bill-sort');
  const formDialog = document.querySelector('#bill-form-dialog');
  const detailDialog = document.querySelector('#bill-detail-dialog');
  const form = document.querySelector('#bill-form');
  const toastRegion = document.querySelector('#toast-region');
  let editingId = null;
  let refreshSequence = 0;

  // A cached copy of the app shell can briefly be older than this controller.
  // Staying quiet keeps the rest of the application working in that case.
  if (!page || !list || !filter || !search || !category || !sort || !formDialog || !detailDialog || !form) {
    return { refresh: async () => {}, openForm: () => {}, page };
  }

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

  function openForm(bill) {
    editingId = bill?.id || null;
    form.reset();
    form.elements.title.value = bill?.title || '';
    form.elements.amount.value = bill?.amount ?? '';
    form.elements.dueDate.value = bill?.dueDate || normalizeDate(new Date());
    form.elements.category.value = bill?.category || 'General';
    form.elements.notes.value = bill?.notes || '';
    document.querySelector('#bill-form-title').textContent = bill ? 'Edit bill' : 'Add bill';
    const amountLabel = document.querySelector('label[for="bill-amount"]');
    if (amountLabel) amountLabel.textContent = `Amount (${currencySymbol(activeCurrency)})`;
    showDialog(formDialog);
    form.elements.title.focus();
  }

  async function refreshCategories() {
    const bills = await listBills();
    const selected = category.value;
    const categories = [...new Set(bills.map((bill) => bill.category).filter(Boolean))].sort();
    category.innerHTML = '<option value="">All categories</option>' + categories.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
    category.value = categories.includes(selected) ? selected : '';
  }

  async function refresh() {
    const sequence = ++refreshSequence;
    const settings = await getSettings();
    activeCurrency = settings.currency || DEFAULT_CURRENCY;
    await refreshCategories();
    if (sequence !== refreshSequence) return;
    const bills = await listBills({
      status: filter.value,
      query: search.value,
      category: category.value,
      sort: sort.value
    });
    if (sequence !== refreshSequence) return;
    list.innerHTML = bills.length ? bills.map(billCard).join('') : emptyState(filter.value);
  }

  async function renderDetail(id) {
    const bill = await getBill(id);
    if (!bill) return;
    const status = statusFor(bill);
    const notes = bill.notes ? `<div class="detail-notes"><h3>Notes</h3><p>${escapeHtml(bill.notes)}</p></div>` : '';
    const payAction = bill.paid
      ? `<button class="button button--secondary" type="button" data-bill-action="unpay" data-bill-id="${escapeHtml(id)}">Mark unpaid</button>`
      : `<button class="button button--secondary" type="button" data-bill-action="pay" data-bill-id="${escapeHtml(id)}">Mark paid</button>`;
    document.querySelector('#bill-detail-content').innerHTML = `<div class="detail-heading"><div><p class="eyebrow">Bill detail</p><h2 id="bill-detail-title">${escapeHtml(bill.title)}</h2><span class="status ${status.className}">${status.label}</span></div><button class="icon-button icon-button--light" type="button" aria-label="Close bill details" data-close-dialog="bill-detail-dialog">×</button></div>
      <dl class="detail-list"><div><dt>Amount</dt><dd>${escapeHtml(formatAmount(bill.amount, activeCurrency))}</dd></div><div><dt>Due date</dt><dd>${escapeHtml(formatDate(bill.dueDate))}</dd></div><div><dt>Category</dt><dd>${escapeHtml(bill.category)}</dd></div><div><dt>Paid on</dt><dd>${escapeHtml(bill.paidDate ? formatDate(bill.paidDate) : 'Not paid yet')}</dd></div></dl>
      ${notes}
      <div class="modal__footer">${payAction}<button class="button button--secondary" type="button" data-bill-action="edit" data-bill-id="${escapeHtml(id)}">Edit</button><button class="button button--danger" type="button" data-bill-action="delete" data-bill-id="${escapeHtml(id)}">Delete</button></div>`;
    detailDialog.showModal();
  }

  async function handleAction(action, id) {
    try {
      if (action === 'detail') return renderDetail(id);
      if (action === 'edit') {
        detailDialog.close();
        return openForm(await getBill(id));
      }
      if (action === 'delete') {
        if (!window.confirm('Delete this bill permanently?')) return;
        await deleteBill(id);
        detailDialog.close();
        await refresh();
        window.dispatchEvent(new CustomEvent('timenest:data-changed'));
        showToast('Bill deleted.');
        return;
      }
      if (action === 'pay') await markBillPaid(id);
      if (action === 'unpay') await markBillUnpaid(id);
      await refresh();
      window.dispatchEvent(new CustomEvent('timenest:data-changed'));
      if (detailDialog.open) await renderDetail(id);
      showToast(action === 'pay' ? 'Bill marked as paid.' : 'Bill marked as unpaid.');
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
        amount: data.get('amount'),
        dueDate: data.get('dueDate'),
        category: data.get('category'),
        notes: data.get('notes')
      };
      if (editingId) await updateBill(editingId, input);
      else await createBill(input);
      formDialog.close();
      await refresh();
      window.dispatchEvent(new CustomEvent('timenest:data-changed'));
      showToast(editingId ? 'Bill updated.' : 'Bill saved.');
    } catch (error) {
      showToast(error.message, 'error');
    }
  });

  filter.addEventListener('change', refresh);
  search.addEventListener('input', refresh);
  category.addEventListener('change', refresh);
  sort.addEventListener('change', refresh);
  document.addEventListener('click', (event) => {
    const openTrigger = event.target.closest('[data-open-bill-form]');
    if (openTrigger) {
      event.preventDefault();
      try {
        openForm();
      } catch (error) {
        showToast(error.message, 'error');
      }
      return;
    }
    const actionTrigger = event.target.closest('[data-bill-action]');
    if (actionTrigger) handleAction(actionTrigger.dataset.billAction, actionTrigger.dataset.billId);
    const closeTrigger = event.target.closest('[data-close-dialog="bill-form-dialog"], [data-close-dialog="bill-detail-dialog"]');
    if (closeTrigger) document.querySelector(`#${closeTrigger.dataset.closeDialog}`)?.close();
  });

  return { refresh, openForm, page };
}

export { initBillsPage };
