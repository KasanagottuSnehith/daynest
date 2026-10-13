import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, localDate, isDate, lastDays, filteredTasks, toggleHabit, validateState, loadState, saveState, STORAGE_KEY } from '../model.js';

const task = (id, dueDate, completed = false, priority = 'normal') => ({id, title: `Task ${id}`, dueDate, completed, priority});
const memory = () => {
  const values = new Map();
  return {getItem: key => values.has(key) ? values.get(key) : null, setItem: (key, value) => values.set(key, value)};
};
test('uses local calendar fields rather than UTC date', () => {
  assert.equal(localDate(new Date(2026, 9, 13, 0, 5)), '2026-10-13');
});
test('validates actual dates, including leap years and invalid formats', () => {
  assert.ok(isDate('2024-02-29'));
  for (const invalid of ['2025-02-29','2026-02-30','2026-13-01','2026-00-01','26-01-01','2026-1-01','1899-12-31',null]) assert.equal(isDate(invalid), false);
});
test('seven-day history crosses year and leap-day boundaries', () => {
  assert.deepEqual(lastDays('2026-01-03'), ['2025-12-28','2025-12-29','2025-12-30','2025-12-31','2026-01-01','2026-01-02','2026-01-03']);
  assert.ok(lastDays('2024-03-02').includes('2024-02-29'));
});
test('task filters include correct dates and exclude completed tasks', () => {
  const tasks = [task('today','2026-10-13'), task('old','2026-10-12'), task('future','2026-10-14'), task('none',''), task('done','2026-10-13',true)];
  const ids = filter => filteredTasks(tasks, filter, '2026-10-13').map(t => t.id);
  assert.deepEqual(ids('today'), ['today']); assert.deepEqual(ids('overdue'), ['old']);
  assert.deepEqual(ids('upcoming'), ['future']); assert.deepEqual(ids('completed'), ['done']);
  assert.equal(ids('all').length, 4);
});
test('tasks sort by due date, then priority', () => {
  assert.deepEqual(filteredTasks([task('low','2026-10-13',false,'low'),task('high','2026-10-13',false,'high'),task('none','')], 'all').map(t => t.id), ['high','low','none']);
});
test('habit toggles are reversible and preserve other dates without mutation', () => {
  const habit = {id:'h',title:'Walk',completedDates:['2026-10-12']};
  const done = toggleHabit(habit,'2026-10-13');
  assert.deepEqual(done.completedDates,['2026-10-12','2026-10-13']);
  assert.deepEqual(toggleHabit(done,'2026-10-13'),habit);
  assert.deepEqual(habit.completedDates,['2026-10-12']);
});
test('storage and JSON backup round-trip preserve all data, including text markup', () => {
  const value = {version:1,tasks:[task('t','2026-10-13')],habits:[{id:'h',title:'Read',completedDates:['2026-10-13']}],notes:[{id:'n',title:'<script>alert(1)</script>',body:'A\nB & C',updatedDate:'2026-10-13'}]};
  const storage = memory(); assert.deepEqual(loadState(storage),emptyState());
  saveState(storage,value); assert.deepEqual(loadState(storage),value);
  assert.deepEqual(validateState(JSON.parse(JSON.stringify(value))),value);
});
test('invalid backups are rejected without modifying storage', () => {
  const storage = memory(); const original = {...emptyState(),tasks:[task('safe','')]}; saveState(storage,original);
  for (const bad of [null,[],{...emptyState(),version:2},{...emptyState(),tasks:[{...task('a',''),completed:'false'}]},{...emptyState(),tasks:[task('a','2026-02-30')]},{...emptyState(),tasks:[task('same',''),task('same','')]},{...emptyState(),habits:[{id:'h',title:'Read',completedDates:['2026-10-13','2026-10-13']}]},{...emptyState(),notes:[{id:'n',title:' ',body:'',updatedDate:'2026-10-13'}]}]) {
    assert.throws(() => saveState(storage,bad)); assert.deepEqual(loadState(storage),original);
  }
});
test('corrupt existing storage throws instead of silently resetting', () => {
  const storage = memory(); storage.setItem(STORAGE_KEY,'{bad');
  assert.throws(() => loadState(storage)); assert.equal(storage.getItem(STORAGE_KEY),'{bad');
});
test('storage failures are propagated; validation does not mutate input', () => {
  const input = emptyState(); input.extra = 'ignored';
  assert.equal(validateState(input).extra,undefined); assert.equal(input.extra,'ignored');
  assert.throws(() => saveState({setItem(){throw new Error('Quota exceeded');}},input), /Quota exceeded/);
});
