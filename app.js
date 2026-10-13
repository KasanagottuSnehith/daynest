import { emptyState, localDate, lastDays, displayDate, filteredTasks, toggleHabit, validateState, loadState, saveState } from './model.js';

const $ = selector => document.querySelector(selector);
const view = $('#view');
let state = emptyState();
let blocked = false;
let storage;
let taskFilter = 'all';
let noteSearch = '';
let editor = null;
let toastTimer;
let today = localDate();

function showError(message) {
  $('#error-banner').textContent = message;
  $('#error-banner').hidden = false;
}
try { storage = window.localStorage; state = loadState(storage); }
catch {
  blocked = true;
  showError('Your saved planner could not be read. It has not been overwritten. Try reopening this page, or restore a valid backup in Backups.');
}

// Only commit UI state after persistent storage succeeds.
function commit(next, { restore = false } = {}) {
  if (blocked && !restore) {
    showError('Saving is paused because existing data could not be read. Restore a valid backup before making changes.');
    return false;
  }
  try {
    storage = storage || window.localStorage;
    state = saveState(storage, next);
    blocked = false;
    $('#error-banner').hidden = true;
    return true;
  } catch {
    showError('Could not save your change. Your previous data is unchanged. Browser storage may be full or disabled. Export a backup and try again.');
    return false;
  }
}
function toast(message) {
  clearTimeout(toastTimer);
  $('#toast').textContent = message; $('#toast').hidden = false;
  toastTimer = setTimeout(() => { $('#toast').hidden = true; }, 3500);
}
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
function button(text, className, action, label) {
  const node = el('button', className, text); node.type = 'button';
  if (label) node.setAttribute('aria-label', label);
  node.addEventListener('click', action); return node;
}
function heading(eyebrow, title, subtitle, action) {
  const wrap = el('div', 'page-heading');
  const copy = el('div'); copy.append(el('p', 'eyebrow', eyebrow), el('h1', '', title), el('p', 'subtitle', subtitle));
  wrap.append(copy); if (action) wrap.append(action); view.append(wrap);
}
function empty(container, title, message) {
  const node = el('div', 'empty-state');
  node.append(el('span', 'empty-mark', '✳'), el('h3', '', title), el('p', '', message)); container.append(node);
}
function section(title, subtitle, action) {
  const card = el('section', 'card');
  const head = el('div', 'section-heading'); const copy = el('div');
  copy.append(el('h2', '', title)); if (subtitle) copy.append(el('p', '', subtitle));
  head.append(copy); if (action) head.append(action); card.append(head); return card;
}
function link(text, href) { const a = el('a', 'text-link', text); a.href = href; return a; }
function currentView() { const value = location.hash.slice(1); return ['today', 'tasks', 'habits', 'notes', 'backup'].includes(value) ? value : 'today'; }
function render() {
  today = localDate();
  $('#date-label').textContent = displayDate(today, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const page = currentView();
  document.querySelectorAll('[data-view]').forEach(a => {
    a.classList.toggle('active', a.dataset.view === page);
    if (a.dataset.view === page) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  view.replaceChildren();
  ({ today: renderToday, tasks: renderTasks, habits: renderHabits, notes: renderNotes, backup: renderBackup })[page]();
}

function quickAdd(container) {
  const form = el('form', 'quick-add');
  const label = el('label', 'sr-only', 'Quick task title'); label.htmlFor = 'quick-title';
  const input = el('input'); input.id = 'quick-title'; input.name = 'title'; input.placeholder = 'What would you like to do today?'; input.required = true; input.maxLength = 200;
  const add = el('button', 'button', '+ Add task'); add.type = 'submit';
  form.append(label, input, add);
  form.addEventListener('submit', event => {
    event.preventDefault(); const title = input.value.trim();
    if (!title) { input.setCustomValidity('Enter a task title.'); input.reportValidity(); return; }
    if (commit({ ...state, tasks: [...state.tasks, { id: crypto.randomUUID(), title, dueDate: localDate(), priority: 'normal', completed: false }] })) {
      render(); $('#quick-title')?.focus(); toast('Task added to today.');
    }
  });
  input.addEventListener('input', () => input.setCustomValidity(''));
  container.append(form);
}
function taskRow(task) {
  const row = el('div', 'task-row');
  const check = el('input'); check.type = 'checkbox'; check.checked = task.completed; check.setAttribute('aria-label', `Complete ${task.title}`);
  check.addEventListener('change', () => {
    if (commit({ ...state, tasks: state.tasks.map(t => t.id === task.id ? { ...t, completed: check.checked } : t) })) { render(); toast(check.checked ? 'One more thing done.' : 'Task reopened.'); }
    else check.checked = task.completed;
  });
  const copy = el('div', 'task-copy'); copy.append(el('strong', task.completed ? 'completed-title' : '', task.title));
  const meta = el('div', 'task-meta');
  const overdue = !task.completed && task.dueDate && task.dueDate < today;
  meta.append(el('span', overdue ? 'overdue' : '', task.dueDate ? `${overdue ? 'Overdue · ' : ''}${task.dueDate === today ? 'Today' : displayDate(task.dueDate, {month:'short', day:'numeric', year:'numeric'})}` : 'No due date'));
  if (task.priority !== 'normal') meta.append(el('span', `priority ${task.priority}`, task.priority === 'high' ? 'High priority' : 'Low priority'));
  copy.append(meta);
  const actions = el('div', 'row-actions'); actions.append(
    button('Edit', 'quiet-button', () => openEditor('task', task), `Edit task ${task.title}`),
    button('×', 'icon-button', () => removeItem('tasks', task), `Delete task ${task.title}`));
  row.append(check, copy, actions); return row;
}
function taskList(container, tasks, emptyTitle = 'A little breathing room', emptyMessage = 'Add a task to make your next step clear.') {
  if (!tasks.length) return empty(container, emptyTitle, emptyMessage);
  const list = el('div', 'task-list'); tasks.forEach(task => list.append(taskRow(task))); container.append(list);
}
function renderToday() {
  heading('A FRESH PAGE', 'Make room for a good day.', 'A few small steps, a little more headspace.');
  const hero = el('section', 'daily-hero');
  const copy = el('div', 'hero-copy'); copy.append(el('span', 'eyebrow', 'ONE THING AT A TIME'), el('h2', '', 'Start small. Keep going.'), el('p', '', 'Put your plans here and let your mind breathe.'));
  quickAdd(copy);
  const art = el('div', 'hero-art'); art.setAttribute('aria-hidden', 'true'); art.append(el('div', 'sun'), el('div', 'leaf leaf-one'), el('div', 'leaf leaf-two'), el('div', 'leaf leaf-three'), el('div', 'stem'), el('div', 'pot'));
  hero.append(copy, art); view.append(hero);
  const due = filteredTasks(state.tasks, 'today', today);
  const overdue = filteredTasks(state.tasks, 'overdue', today);
  const done = state.tasks.filter(t => t.dueDate === today && t.completed).length;
  const habitsDone = state.habits.filter(h => h.completedDates.includes(today)).length;
  const stats = el('div', 'stats-grid');
  [['TODAY’S TASKS', due.length, 'ready for your attention'], ['COMPLETED TODAY', done, 'tasks due today, checked off'], ['DAILY HABITS', `${habitsDone}/${state.habits.length}`, 'small wins that add up']].forEach(([label, value, detail]) => {
    const card = el('div', 'stat-card'); card.append(el('span', 'eyebrow', label), el('strong', 'stat-value', String(value)), el('p', '', detail)); stats.append(card);
  }); view.append(stats);
  const grid = el('div', 'dashboard-grid');
  const tasks = section('On your list today', 'Keep your next steps close.', link('All tasks →', '#tasks'));
  taskList(tasks, due, 'Your day is open', 'Add today’s first task above, or enjoy the breathing room.');
  if (overdue.length) {
    const alert = el('div', 'overdue-heading'); alert.append(el('h3', '', `Needs a little attention · ${overdue.length}`)); tasks.append(alert); taskList(tasks, overdue);
  }
  const habits = section('Little daily rituals', 'Consistency starts with showing up.', link('All habits →', '#habits'));
  if (!state.habits.length) empty(habits, 'Build your first ritual', 'Reading, walking, drinking water — start with one.');
  state.habits.slice(0, 5).forEach(h => habits.append(habitRow(h, false)));
  grid.append(tasks, habits); view.append(grid);
  const notes = section('Keep a thought', 'Ideas, reminders, and the things you don’t want to forget.', button('+ New note', 'quiet-button', () => openEditor('note')));
  if (!state.notes.length) empty(notes, 'A place for your thoughts', 'Save a quick note and find it here whenever you need it.');
  else { const cards = el('div', 'notes-grid'); state.notes.slice(0, 3).forEach(n => cards.append(noteCard(n))); notes.append(cards); }
  view.append(notes);
}
function renderTasks() {
  heading('CLEAR YOUR HEAD', 'Your tasks, in one place.', 'A manageable list for the things that matter.', button('+ New task', 'button', () => openEditor('task')));
  const card = section('Make your next step clear'); quickAdd(card);
  const filters = el('div', 'filter-bar'); filters.setAttribute('role', 'group'); filters.setAttribute('aria-label', 'Filter tasks');
  [['all', 'All active'], ['today', 'Today'], ['upcoming', 'Upcoming'], ['overdue', 'Overdue'], ['completed', 'Completed']].forEach(([id, label]) => {
    const b = button(label, `filter-button ${taskFilter === id ? 'selected' : ''}`, () => { taskFilter = id; render(); });
    b.setAttribute('aria-pressed', String(taskFilter === id)); filters.append(b);
  }); card.append(filters);
  taskList(card, filteredTasks(state.tasks, taskFilter, today), 'Nothing on this list', taskFilter === 'completed' ? 'Your checked-off tasks will appear here.' : 'Add a task, or try another filter.'); view.append(card);
}
function habitRow(habit, full = true) {
  const wrap = el('div', full ? 'habit-card' : 'habit-row');
  const head = el('div', 'habit-heading');
  head.append(el('strong', '', habit.title));
  const checked = habit.completedDates.includes(today);
  const toggle = button(checked ? '✓ Done today' : '+ Check in', `button ${checked ? 'checked' : 'secondary'}`, () => {
    if (commit({ ...state, habits: state.habits.map(h => h.id === habit.id ? toggleHabit(h, localDate()) : h) })) { render(); toast(checked ? 'Check-in undone.' : 'A small win for today.'); }
  }, `${checked ? 'Undo' : 'Check in'} ${habit.title}`);
  toggle.setAttribute('aria-pressed', String(checked)); head.append(toggle); wrap.append(head);
  if (full) {
    const week = el('div', 'habit-week');
    lastDays(today).forEach(date => {
      const day = el('div', `habit-day ${habit.completedDates.includes(date) ? 'done' : ''} ${date === today ? 'current' : ''}`);
      const name = displayDate(date, { weekday: 'short' });
      day.append(el('span', '', name), el('strong', '', habit.completedDates.includes(date) ? '✓' : '·'));
      day.setAttribute('aria-label', `${displayDate(date, {month:'long', day:'numeric'})}: ${habit.completedDates.includes(date) ? 'completed' : 'not completed'}`); week.append(day);
    }); wrap.append(week);
    const foot = el('div', 'habit-footer');
    foot.append(el('span', '', `${lastDays(today).filter(d => habit.completedDates.includes(d)).length} of 7 days`), button('Edit', 'quiet-button', () => openEditor('habit', habit), `Edit habit ${habit.title}`), button('Delete', 'quiet-button danger', () => removeItem('habits', habit), `Delete habit ${habit.title}`)); wrap.append(foot);
  }
  return wrap;
}
function renderHabits() {
  heading('SMALL WINS ADD UP', 'Build your everyday rituals.', 'No pressure to be perfect. Just a little progress, every day.', button('+ New habit', 'button', () => openEditor('habit')));
  if (!state.habits.length) { const card = section('Your last seven days'); empty(card, 'Start with something small', 'Create one daily habit you want to make room for.'); view.append(card); }
  else { const grid = el('div', 'habits-grid'); state.habits.forEach(h => grid.append(habitRow(h))); view.append(grid); }
}
function noteCard(note) {
  const card = el('article', 'note-card'); card.append(el('span', 'note-date', `Updated ${displayDate(note.updatedDate, {month:'short', day:'numeric', year:'numeric'})}`), el('h3', '', note.title), el('p', 'note-body', note.body || 'No extra details yet.'));
  const actions = el('div', 'note-actions'); actions.append(button('Open & edit →', 'quiet-button', () => openEditor('note', note), `Edit note ${note.title}`), button('×', 'icon-button', () => removeItem('notes', note), `Delete note ${note.title}`)); card.append(actions); return card;
}
function renderNotes() {
  heading('SAVE A LITTLE THOUGHT', 'A home for your notes.', 'Catch an idea now. Come back to it later.', button('+ New note', 'button', () => openEditor('note')));
  const search = el('div', 'search-field'); const label = el('label', 'sr-only', 'Search notes'); label.htmlFor = 'note-search';
  const input = el('input'); input.id = 'note-search'; input.type = 'search'; input.placeholder = 'Search your notes…'; input.value = noteSearch;
  search.append(label, input); view.append(search);
  const grid = el('div', 'notes-grid'); view.append(grid);
  const update = () => {
    grid.replaceChildren(); const query = noteSearch.trim().toLowerCase();
    const notes = state.notes.filter(n => `${n.title} ${n.body}`.toLowerCase().includes(query));
    if (!notes.length) empty(grid, query ? 'No matching notes' : 'Make room for a thought', query ? 'Try a different word.' : 'A reminder, an idea, a shopping list — it all fits here.');
    notes.forEach(n => grid.append(noteCard(n)));
  };
  input.addEventListener('input', () => { noteSearch = input.value; update(); }); update();
}
function renderBackup() {
  heading('KEEP YOUR PLANS SAFE', 'A backup, just in case.', 'Your planner stays in this browser. Keep a copy somewhere safe.');
  const grid = el('div', 'backup-grid');
  const exportCard = section('Take a copy with you', 'Download all your tasks, habits, and notes as a JSON file.');
  exportCard.append(el('p', 'backup-detail', 'A backup is useful before clearing browser data or moving to a different browser.'), button('↓ Export backup', 'button', () => {
    if (blocked) { showError('Export is paused because your original data could not be read. Restore a valid backup first.'); return; }
    const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = `daynest-backup-${localDate()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); toast('Backup download started.');
  }));
  const importCard = section('Restore your planner', 'Choose a DayNest backup to replace the planner in this browser.');
  importCard.append(el('p', 'backup-detail', 'We check the file first and ask before replacing anything. Export your current planner before restoring.'));
  const input = el('input', 'file-input'); input.type = 'file'; input.accept = '.json,application/json'; input.id = 'backup-file';
  const label = el('label', 'button secondary', '↑ Choose backup file'); label.htmlFor = input.id;
  input.addEventListener('change', async () => {
    const file = input.files[0]; if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('This file is too large. Choose a DayNest backup under 5 MB.');
      let next;
      try { next = validateState(JSON.parse(await file.text())); }
      catch { throw new Error('This is not a valid DayNest v1 backup. Your existing data has not changed.'); }
      if (await confirmAction('Replace your planner?', `This backup contains ${next.tasks.length} tasks, ${next.habits.length} habits, and ${next.notes.length} notes. It will replace the data in this browser.`, 'Restore backup')) {
        if (commit(next, { restore: true })) { render(); toast('Your planner has been restored.'); }
      }
    } catch (error) { showError(error.message); }
    finally { input.value = ''; }
  }); importCard.append(input, label); grid.append(exportCard, importCard); view.append(grid);
  const info = el('section', 'privacy-note'); info.append(el('h2', '', 'A few things to know'), el('p', '', 'There is no account and no cloud sync. Other browsers and devices have their own planner. Clearing site data removes your saved planner. Backups contain your notes and tasks, so keep them somewhere private.')); view.append(info);
}
function field(label, name, type, value = '', maxLength) {
  const wrap = el('div', 'form-field'); const id = `edit-${name}`;
  const labelNode = el('label', '', label); labelNode.htmlFor = id;
  const input = el(type === 'textarea' ? 'textarea' : type === 'select' ? 'select' : 'input');
  input.id = id; input.name = name;
  if (input.tagName === 'INPUT') input.type = type;
  if (type === 'select') ['low', 'normal', 'high'].forEach(p => { const option = el('option', '', `${p[0].toUpperCase()}${p.slice(1)}`); option.value = p; input.append(option); });
  input.value = value; if (maxLength) input.maxLength = maxLength;
  if (name === 'title') input.required = true;
  if (type === 'date') { input.min = '1900-01-01'; input.max = '9999-12-31'; }
  input.addEventListener('input', () => input.setCustomValidity(''));
  wrap.append(labelNode, input); return wrap;
}
function openEditor(type, item) {
  editor = { type, item };
  $('#editor-title').textContent = `${item ? 'Edit' : 'New'} ${type}`;
  const fields = $('#editor-fields'); fields.replaceChildren();
  fields.append(field(type === 'habit' ? 'Daily habit' : 'Title', 'title', 'text', item?.title || '', type === 'task' ? 200 : type === 'habit' ? 100 : 120));
  if (type === 'task') fields.append(field('Due date (optional)', 'dueDate', 'date', item?.dueDate ?? localDate()), field('Priority', 'priority', 'select', item?.priority || 'normal'));
  if (type === 'note') fields.append(field('Note', 'body', 'textarea', item?.body || '', 10000));
  $('#editor').showModal(); $('#edit-title').focus();
}
$('#editor-form').addEventListener('submit', event => {
  event.preventDefault(); const data = new FormData(event.currentTarget); const title = data.get('title').trim();
  if (!title) { $('#edit-title').setCustomValidity('Enter a title.'); $('#edit-title').reportValidity(); return; }
  const { type, item } = editor; const id = item?.id || crypto.randomUUID(); let key, value;
  if (type === 'task') { key = 'tasks'; value = { id, title, dueDate: data.get('dueDate'), priority: data.get('priority'), completed: item?.completed || false }; }
  if (type === 'habit') { key = 'habits'; value = { id, title, completedDates: item?.completedDates || [] }; }
  if (type === 'note') { key = 'notes'; value = { id, title, body: data.get('body'), updatedDate: localDate() }; }
  const next = { ...state, [key]: item ? state[key].map(x => x.id === id ? value : x) : [value, ...state[key]] };
  if (commit(next)) { $('#editor').close(); render(); toast(`${type[0].toUpperCase()}${type.slice(1)} saved.`); }
});
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => $('#editor').close()));
function confirmAction(title, message, action) {
  $('#confirm-title').textContent = title; $('#confirm-message').textContent = message; $('#confirm-ok').textContent = action;
  return new Promise(resolve => {
    const dialog = $('#confirmation');
    const finish = accepted => {
      $('#confirm-ok').onclick = null; $('#confirm-cancel').onclick = null; dialog.removeEventListener('cancel', cancel);
      dialog.close(); resolve(accepted);
    };
    const cancel = event => { event.preventDefault(); finish(false); };
    $('#confirm-ok').onclick = () => finish(true); $('#confirm-cancel').onclick = () => finish(false);
    dialog.addEventListener('cancel', cancel); dialog.showModal(); $('#confirm-cancel').focus();
  });
}
async function removeItem(key, item) {
  if (await confirmAction(`Delete ${key === 'habits' ? 'habit' : key === 'notes' ? 'note' : 'task'}?`, `“${item.title}” will be removed. Export a backup first if you want to keep a copy.`, 'Delete')) {
    if (commit({ ...state, [key]: state[key].filter(x => x.id !== item.id) })) { render(); toast('Removed from your planner.'); }
  }
}
window.addEventListener('hashchange', () => { render(); $('#main').focus(); });
window.addEventListener('storage', event => {
  if (event.key !== 'daynest.v1') return;
  try { state = loadState(storage); blocked = false; $('#error-banner').hidden = true; $('#editor').close(); render(); toast('Planner updated from another tab.'); }
  catch { blocked = true; showError('Data changed in another tab and could not be read. Saving is paused. Restore a valid backup.'); }
});
function refreshDate() { if (localDate() !== today && !$('#editor').open && !$('#confirmation').open) render(); }
window.addEventListener('focus', refreshDate);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshDate(); });
setInterval(refreshDate, 30000);
render();
