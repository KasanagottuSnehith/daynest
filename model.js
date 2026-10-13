export const STORAGE_KEY = 'daynest.v1';
export const emptyState = () => ({ version: 1, tasks: [], habits: [], notes: [] });

export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function isDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setFullYear(year, month - 1, day); date.setHours(12, 0, 0, 0);
  return year >= 1900 && year <= 9999 && localDate(date) === value;
}
export function lastDays(today = localDate(), count = 7) {
  const [year, month, day] = today.split('-').map(Number);
  return Array.from({ length: count }, (_, i) => localDate(new Date(year, month - 1, day - count + i + 1, 12)));
}
export function displayDate(value, options = { month: 'short', day: 'numeric' }) {
  const [year, month, day] = value.split('-').map(Number);
  return new Intl.DateTimeFormat(undefined, options).format(new Date(year, month - 1, day, 12));
}
export function filteredTasks(tasks, filter, today = localDate()) {
  return tasks.filter(task => {
    if (filter === 'completed') return task.completed;
    if (task.completed) return false;
    if (filter === 'today') return task.dueDate === today;
    if (filter === 'upcoming') return task.dueDate > today;
    if (filter === 'overdue') return Boolean(task.dueDate && task.dueDate < today);
    return true;
  }).sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || ({high:0, normal:1, low:2}[a.priority] - {high:0, normal:1, low:2}[b.priority]));
}
export function toggleHabit(habit, date = localDate()) {
  return { ...habit, completedDates: habit.completedDates.includes(date)
    ? habit.completedDates.filter(d => d !== date)
    : [...habit.completedDates, date].sort() };
}
export function validateState(input) {
  const fail = () => { throw new Error('This is not a valid DayNest v1 backup. Your existing data has not changed.'); };
  const text = (v, max, allowEmpty = false) => typeof v === 'string' && v.length <= max && (allowEmpty || v.trim().length > 0);
  const list = input && ['tasks', 'habits', 'notes'].every(key => Array.isArray(input[key]) && input[key].length <= 10000);
  if (!list || input.version !== 1) fail();
  const ids = new Set();
  const id = item => {
    if (!item || !text(item.id, 100) || ids.has(item.id)) fail();
    ids.add(item.id);
  };
  const tasks = input.tasks.map(t => {
    id(t);
    if (!text(t.title, 200) || !(t.dueDate === '' || isDate(t.dueDate)) || !['low', 'normal', 'high'].includes(t.priority) || typeof t.completed !== 'boolean') fail();
    return { id: t.id, title: t.title, dueDate: t.dueDate, priority: t.priority, completed: t.completed };
  });
  const habits = input.habits.map(h => {
    id(h);
    if (!text(h.title, 100) || !Array.isArray(h.completedDates) || h.completedDates.length > 50000 || !h.completedDates.every(isDate) || new Set(h.completedDates).size !== h.completedDates.length) fail();
    return { id: h.id, title: h.title, completedDates: [...h.completedDates].sort() };
  });
  const notes = input.notes.map(n => {
    id(n);
    if (!text(n.title, 120) || !text(n.body, 10000, true) || !isDate(n.updatedDate)) fail();
    return { id: n.id, title: n.title, body: n.body, updatedDate: n.updatedDate };
  });
  return { version: 1, tasks, habits, notes };
}
export function loadState(storage) {
  const value = storage.getItem(STORAGE_KEY);
  return value === null ? emptyState() : validateState(JSON.parse(value));
}
export function saveState(storage, state) {
  const valid = validateState(state);
  storage.setItem(STORAGE_KEY, JSON.stringify(valid));
  return valid;
}
