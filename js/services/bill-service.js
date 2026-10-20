import { billRepository } from '../data/storage.js?v=4';
import { differenceInDays, normalizeDate } from './date-service.js';
const BILL_STATUS = Object.freeze({
  paid: 'paid',
  unpaid: 'unpaid'
});

const BILL_TIMING = Object.freeze({
  overdue: 'overdue',
  today: 'today',
  upcoming: 'upcoming',
  paid: 'paid'
});

function nowIso() {
  return new Date().toISOString();
}

function validateTitle(title) {
  const value = String(title || '').trim();
  if (!value) {
    throw new Error('A bill name is required.');
  }
  return value;
}

function validateAmount(amount) {
  const numeric = amount === '' || amount === null || amount === undefined ? Number.NaN : Number(amount);
  if (!Number.isFinite(numeric)) {
    throw new Error('A bill amount is required.');
  }
  if (numeric < 0) {
    throw new Error('A bill amount cannot be negative.');
  }
  return Math.round(numeric * 100) / 100;
}

function normalizeBillInput(input) {
  const paid = Boolean(input.paid);
  const paidDate = paid ? normalizeDate(input.paidDate || normalizeDate(new Date()), 'bill paid date') : '';

  return {
    title: validateTitle(input.title),
    amount: validateAmount(input.amount),
    dueDate: normalizeDate(input.dueDate, 'bill due date'),
    category: String(input.category || 'General').trim() || 'General',
    notes: String(input.notes || '').trim(),
    paid,
    paidDate
  };
}

// Whether a bill is overdue, due today, or still ahead is derived from the
// due date rather than stored, so the answer can never go stale as days pass.
function getBillTiming(bill, today = normalizeDate(new Date())) {
  if (bill.paid) return BILL_TIMING.paid;
  const days = differenceInDays(today, bill.dueDate);
  if (days > 0) return BILL_TIMING.upcoming;
  if (days === 0) return BILL_TIMING.today;
  return BILL_TIMING.overdue;
}

async function listBills({ status = 'all', query = '', category = '', sort = 'due' } = {}) {
  const bills = await billRepository.getAll();
  const normalizedQuery = query.trim().toLowerCase();

  const filtered = bills.filter((bill) => {
    if (status === BILL_STATUS.paid && !bill.paid) return false;
    if (status === BILL_STATUS.unpaid && bill.paid) return false;
    if (category && bill.category !== category) return false;

    if (normalizedQuery) {
      const searchable = `${bill.title} ${bill.category} ${bill.notes}`.toLowerCase();
      if (!searchable.includes(normalizedQuery)) return false;
    }

    return true;
  });

  return filtered.sort((first, second) => {
    // Settled bills move to the end of the list so what still needs attention
    // stays at the top.
    if (first.paid !== second.paid) return first.paid ? 1 : -1;
    if (sort === 'amount') return second.amount - first.amount;
    if (sort === 'title') return first.title.localeCompare(second.title);
    return first.dueDate.localeCompare(second.dueDate);
  });
}

async function getBill(id) {
  return billRepository.get(id);
}

async function createBill(input) {
  const timestamp = nowIso();
  return billRepository.add({
    ...normalizeBillInput(input),
    createdAt: timestamp,
    updatedAt: timestamp
  });
}

async function updateBill(id, input) {
  const existing = await getBill(id);
  if (!existing) {
    throw new Error('Bill could not be found.');
  }

  return billRepository.update({
    ...existing,
    ...normalizeBillInput({ ...existing, ...input }),
    id,
    createdAt: existing.createdAt,
    updatedAt: nowIso()
  });
}

async function deleteBill(id) {
  await billRepository.remove(id);
}

async function markBillPaid(id, paidDate = normalizeDate(new Date())) {
  const existing = await getBill(id);
  if (!existing) {
    throw new Error('Bill could not be found.');
  }
  return billRepository.update({
    ...existing,
    paid: true,
    paidDate: normalizeDate(paidDate, 'bill paid date'),
    updatedAt: nowIso()
  });
}

async function markBillUnpaid(id) {
  const existing = await getBill(id);
  if (!existing) {
    throw new Error('Bill could not be found.');
  }
  return billRepository.update({
    ...existing,
    paid: false,
    paidDate: '',
    updatedAt: nowIso()
  });
}

export {
  BILL_STATUS,
  BILL_TIMING,
  createBill,
  deleteBill,
  getBill,
  getBillTiming,
  listBills,
  markBillPaid,
  markBillUnpaid,
  normalizeBillInput,
  updateBill
};
