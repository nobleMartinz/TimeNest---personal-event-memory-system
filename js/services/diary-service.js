import { diaryRepository } from '../data/storage.js?v=2';
import { normalizeDate } from './date-service.js';

function normalizeDiaryInput(input) {
  const title = String(input.title || '').trim();
  const content = String(input.content || '').trim();
  if (!title) throw new Error('A diary title is required.');
  if (!content) throw new Error('Diary content is required.');
  return {
    date: normalizeDate(input.date, 'diary date'),
    time: String(input.time || ''),
    title,
    content,
    category: String(input.category || 'General').trim() || 'General',
    tags: Array.isArray(input.tags) ? input.tags : []
  };
}

async function listDiaryEntries({ query = '', category = '', date = '', sort = 'newest' } = {}) {
  const entries = await diaryRepository.getAll();
  const normalizedQuery = query.trim().toLowerCase();
  const filtered = entries.filter((entry) => {
    const searchable = `${entry.title} ${entry.content} ${entry.category} ${(entry.tags || []).join(' ')}`.toLowerCase();
    return (!normalizedQuery || searchable.includes(normalizedQuery))
      && (!category || entry.category === category)
      && (!date || entry.date === date);
  });

  return filtered.sort((first, second) => {
    if (sort === 'oldest') return first.date.localeCompare(second.date);
    if (sort === 'title') return first.title.localeCompare(second.title);
    return second.date.localeCompare(first.date) || (second.createdAt || '').localeCompare(first.createdAt || '');
  });
}

async function getDiaryEntry(id) {
  return diaryRepository.get(id);
}

async function createDiaryEntry(input) {
  const timestamp = new Date().toISOString();
  return diaryRepository.add({
    ...normalizeDiaryInput(input),
    createdAt: timestamp,
    updatedAt: timestamp
  });
}

async function updateDiaryEntry(id, input) {
  const existing = await getDiaryEntry(id);
  if (!existing) throw new Error('Diary entry could not be found.');
  return diaryRepository.update({
    ...existing,
    ...normalizeDiaryInput({ ...existing, ...input }),
    id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString()
  });
}

async function deleteDiaryEntry(id) {
  await diaryRepository.remove(id);
}

export {
  createDiaryEntry,
  deleteDiaryEntry,
  getDiaryEntry,
  listDiaryEntries,
  normalizeDiaryInput,
  updateDiaryEntry
};
