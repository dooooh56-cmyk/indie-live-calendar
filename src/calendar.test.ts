import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { occurs, setCompleted, validate, type Event } from './calendar.ts';
const event: Event = { id: '1', title: '관리비', kind: 'bill', date: '2024-01-31', recurrence: 'monthly', until: '', reminder: '', completed: [], excluded: [] };
test('월말 반복은 원래 일자를 유지하고 윤년을 반영한다', () => {
  assert.equal(occurs(event, '2024-02-29'), true); assert.equal(occurs(event, '2024-03-31'), true); assert.equal(occurs(event, '2024-03-29'), false);
});
test('주간 반복과 종료일, 날짜별 완료', () => {
  const weekly = { ...event, date: '2026-10-27', recurrence: 'weekly' as const, until: '2026-11-10' };
  assert.equal(occurs(weekly, '2026-11-03'), true); assert.equal(occurs(weekly, '2026-11-17'), false);
  const done = setCompleted(weekly, '2026-11-03', true); assert.deepEqual(done.completed, ['2026-11-03']); assert.throws(() => setCompleted(weekly, '2026-11-04', true));
  assert.deepEqual(setCompleted(done, '2026-11-03', false).completed, []);
});
test('잘못된 입력과 제외된 발생 건', () => {
  assert.ok(validate({ ...event, title: '  ' })); assert.ok(validate({ ...event, date: '2026-02-30' })); assert.ok(validate({ ...event, until: '2023-01-01' }));
  assert.equal(occurs({ ...event, excluded: ['2024-02-29'] }, '2024-02-29'), false);
});
test('단일 일정, 주간 반복 및 제외 날짜를 구분한다', () => {
  const once = { ...event, date: '2026-10-31', recurrence: 'none' as const };
  assert.equal(occurs(once, '2026-10-31'), true); assert.equal(occurs(once, '2026-11-01'), false);
  const weekly = { ...event, date: '2026-10-27', recurrence: 'weekly' as const, excluded: ['2026-11-03'] };
  assert.equal(occurs(weekly, '2026-10-27'), true); assert.equal(occurs(weekly, '2026-11-03'), false); assert.equal(occurs(weekly, '2026-11-10'), true);
});
test('유형, 반복 및 알림 시간을 검증한다', () => {
  assert.ok(validate({ ...event, kind: 'invalid' as Event['kind'] }));
  assert.ok(validate({ ...event, recurrence: 'invalid' as Event['recurrence'] }));
  assert.ok(validate({ ...event, reminder: '25:00' }));
  assert.equal(validate({ ...event, reminder: '09:30' }), null);
});
test('프리셋에 필요한 매일, 2일, 2주, 3개월 주기를 계산한다', () => {
  const start = { ...event, date: '2026-01-31' };
  assert.equal(occurs({ ...start, recurrence: 'daily' }, '2026-02-01'), true);
  assert.equal(occurs({ ...start, recurrence: 'every2days' }, '2026-02-01'), false);
  assert.equal(occurs({ ...start, recurrence: 'every2days' }, '2026-02-02'), true);
  assert.equal(occurs({ ...start, recurrence: 'biweekly' }, '2026-02-14'), true);
  assert.equal(occurs({ ...start, recurrence: 'biweekly' }, '2026-02-07'), false);
  assert.equal(occurs({ ...start, recurrence: 'quarterly' }, '2026-04-30'), true);
  assert.equal(occurs({ ...start, recurrence: 'quarterly' }, '2026-05-31'), false);
});
