import { test, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { App } from './App';
import { dateString } from './calendar';

const dom = new JSDOM('<div id="root"></div>', { url: 'http://localhost' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage, IS_REACT_ACT_ENVIRONMENT: true });
const { createRoot } = await import('react-dom/client');
const rootElement = document.getElementById('root')!;
const root = createRoot(rootElement);
function button(text: string): HTMLButtonElement {
  const found = [...document.querySelectorAll('button')].find(b => b.textContent === text);
  if (!found) throw new Error(`Button not found: ${text}`);
  return found;
}
function inputValue(input: HTMLInputElement | HTMLSelectElement, value: string) {
  const prototype = input instanceof dom.window.HTMLSelectElement ? dom.window.HTMLSelectElement.prototype : dom.window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(input, value);
  input.dispatchEvent(new dom.window.Event(input instanceof dom.window.HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
}

test('알림 권한 거부와 실패에도 일정이 저장되고 다시 읽힌다', async () => {
  for (const permission of ['denied', 'error'] as const) {
    localStorage.clear();
    const requestPermission = async () => { if (permission === 'error') throw new Error('failed'); return 'denied' as NotificationPermission; };
    Object.assign(dom.window, { Notification: { permission: 'default', requestPermission } });
    Object.assign(globalThis, { Notification: dom.window.Notification });
    await act(async () => root.render(<App />));
    await act(async () => button('+ 일정 추가').click());
    await act(async () => {
      inputValue(document.querySelector('input[placeholder]')!, `테스트 ${permission}`);
      inputValue(document.querySelector('input[type="time"]')!, '09:30');
    });
    await act(async () => document.querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })));
    assert.match(rootElement.textContent!, permission === 'denied' ? /알림 권한이 없어/ : /알림을 설정하지 못했습니다/);
    assert.match(localStorage.getItem('honjasallim-events-v1')!, new RegExp(`테스트 ${permission}`));
    await act(async () => root.render(<></>));
    await act(async () => root.render(<App />));
    assert.match(rootElement.textContent!, new RegExp(`테스트 ${permission}`));
    await act(async () => root.render(<></>));
  }
});

after(async () => { await act(async () => root.unmount()); dom.window.close(); });


test('일정 수정과 반복 발생 건 삭제가 저장된다', async () => {
  localStorage.clear();
  Object.assign(dom.window, { confirm: () => true });
  await act(async () => root.render(<App />));
  await act(async () => button('+ 일정 추가').click());
  await act(async () => {
    inputValue(document.querySelector('input[placeholder]')!, '반복 테스트');
    inputValue(document.querySelectorAll('select')[1], 'weekly');
  });
  await act(async () => document.querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })));
  assert.match(rootElement.textContent!, /반복 테스트/);
  await act(async () => button('수정').click());
  await act(async () => inputValue(document.querySelector('input[placeholder]')!, '수정된 일정'));
  await act(async () => document.querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })));
  assert.match(rootElement.textContent!, /수정된 일정/);
  await act(async () => button('이날만 삭제').click());
  const saved = JSON.parse(localStorage.getItem('honjasallim-events-v1')!);
  assert.equal(saved[0].title, '수정된 일정');
  assert.deepEqual(saved[0].excluded, [saved[0].date]);
  assert.doesNotMatch(rootElement.textContent!, /수정된 일정/);
  await act(async () => root.render(<></>));
});

test('알림 시각에 표시하고 재렌더링 시 중복 표시하지 않는다', async () => {
  localStorage.clear(); sessionStorage.clear();
  const messages: string[] = [];
  class MockNotification {
    static permission = 'granted';
    static requestPermission = async () => 'granted';
    constructor(title: string) { messages.push(title); }
  }
  Object.assign(dom.window, { Notification: MockNotification });
  Object.assign(globalThis, { Notification: MockNotification });
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  await act(async () => root.render(<App />));
  await act(async () => button('+ 일정 추가').click());
  await act(async () => {
    inputValue(document.querySelector('input[placeholder]')!, '알림 테스트');
    inputValue(document.querySelector('input[type="time"]')!, time);
  });
  await act(async () => document.querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })));
  assert.deepEqual(messages, ['알림 테스트']);
  await act(async () => root.render(<></>));
  await act(async () => root.render(<App />));
  assert.deepEqual(messages, ['알림 테스트']);
  await act(async () => root.render(<></>));
});

test('알림 표시 오류가 발생해도 일정은 유지된다', async () => {
  localStorage.clear(); sessionStorage.clear();
  class FailingNotification {
    static permission = 'granted';
    constructor() { throw new Error('notification failed'); }
  }
  Object.assign(dom.window, { Notification: FailingNotification });
  Object.assign(globalThis, { Notification: FailingNotification });
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const reminder = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  localStorage.setItem('honjasallim-events-v1', JSON.stringify([{ id: 'failure', title: '알림 실패 테스트', kind: 'chore', date, recurrence: 'none', until: '', reminder, completed: [], excluded: [] }]));
  await act(async () => root.render(<App />));
  assert.match(rootElement.textContent!, /알림을 표시하지 못했습니다/);
  assert.match(rootElement.textContent!, /알림 실패 테스트/);
  assert.match(localStorage.getItem('honjasallim-events-v1')!, /알림 실패 테스트/);
  await act(async () => root.render(<></>));
});

test('앱을 열린 채 날짜가 바뀌면 오늘 목록도 갱신된다', async (t) => {
  const RealDate = globalThis.Date;
  const realSetInterval = window.setInterval;
  const realClearInterval = window.clearInterval;
  let tick = () => {};
  try {
    t.mock.timers.enable({ apis: ['Date'], now: new RealDate(2026, 9, 29, 23, 59) });
    Object.assign(window, { setInterval: (fn: () => void) => { tick = fn; return 1; }, clearInterval: () => {} });
    localStorage.clear();
    localStorage.setItem('honjasallim-events-v1', JSON.stringify([{ id: 'tomorrow', title: '내일 일정', kind: 'chore', date: '2026-10-30', recurrence: 'none', until: '', reminder: '', completed: [], excluded: [] }]));
    await act(async () => root.render(<App />));
    assert.match(rootElement.textContent!, /오늘 할 일 0/);
    t.mock.timers.setTime(new RealDate(2026, 9, 30, 0, 0).getTime());
    await act(async () => tick());
    assert.match(rootElement.textContent!, /오늘 할 일 1/);
    assert.match(rootElement.textContent!, /내일 일정/);
    await act(async () => root.render(<></>));
  } finally {
    t.mock.timers.reset();
    Object.assign(window, { setInterval: realSetInterval, clearInterval: realClearInterval });
  }
});

test('저장 실패 시 기존 데이터를 유지하고 사용자에게 안내한다', async () => {
  localStorage.clear();
  const originalData = JSON.stringify([{ id: 'existing', title: '기존 일정', kind: 'chore', date: dateString(new Date()), recurrence: 'none', until: '', reminder: '', completed: [], excluded: [] }]);
  localStorage.setItem('honjasallim-events-v1', originalData);
  await act(async () => root.render(<App />));
  await act(async () => button('+ 일정 추가').click());
  await act(async () => inputValue(document.querySelector('input[placeholder]')!, '저장 실패 일정'));
  const storagePrototype = dom.window.Storage.prototype;
  const original = storagePrototype.setItem;
  storagePrototype.setItem = () => { throw new Error('quota exceeded'); };
  try {
    await act(async () => document.querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })));
    assert.match(rootElement.textContent!, /저장하지 못했습니다/);
    assert.equal(localStorage.getItem('honjasallim-events-v1'), originalData);
    assert.match(rootElement.textContent!, /기존 일정/);
    assert.ok(document.querySelector('form'));
  } finally {
    storagePrototype.setItem = original;
    await act(async () => root.render(<></>));
  }
});

test('일정 입력창은 키보드 포커스를 가두고 Escape로 닫는다', async () => {
  localStorage.clear();
  await act(async () => root.render(<App />));
  const opener = button('+ 일정 추가');
  opener.focus();
  await act(async () => opener.click());
  const dialog = document.querySelector('[role="dialog"]')!;
  const first = dialog.querySelector<HTMLButtonElement>('button')!;
  const last = [...dialog.querySelectorAll<HTMLButtonElement>('button')].at(-1)!;
  first.focus();
  await act(async () => first.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true })));
  assert.equal(document.activeElement, last);
  await act(async () => last.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })));
  assert.equal(document.activeElement, first);
  await act(async () => first.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })));
  assert.equal(document.querySelector('[role="dialog"]'), null);
  assert.equal(document.activeElement, opener);
  await act(async () => root.render(<></>));
});

test('월을 이동하면 선택 날짜와 새 일정 날짜가 보이는 달로 바뀐다', async () => {
  localStorage.clear();
  await act(async () => root.render(<App />));
  const next = document.querySelector<HTMLButtonElement>('button[aria-label="다음 달"]')!;
  await act(async () => next.click());
  const selected = document.querySelector<HTMLButtonElement>('.days button[aria-pressed="true"]')!;
  assert.ok(selected);
  const date = selected.getAttribute('aria-label')!.slice(0, 10);
  assert.equal(date.slice(-2), '01');
  await act(async () => button('+ 일정 추가').click());
  assert.equal(document.querySelector<HTMLInputElement>('input[type="date"]')!.value, date);
  await act(async () => root.render(<></>));
});

test('반복 일정의 완료와 선택 날짜 삭제는 다른 발생일에 영향을 주지 않는다', async (t) => {
  const RealDate = Date;
  t.mock.timers.enable({ apis: ['Date'], now: new RealDate(2026, 9, 31, 12) });
  try {
    localStorage.clear();
    localStorage.setItem('honjasallim-events-v1', JSON.stringify([{ id: 'monthly', title: '월말 일정', kind: 'bill', date: '2026-10-31', recurrence: 'monthly', until: '', reminder: '', completed: [], excluded: [] }]));
    Object.assign(window, { confirm: () => true });
    await act(async () => root.render(<App />));
    const octoberCheckboxes = document.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
    await act(async () => octoberCheckboxes[octoberCheckboxes.length - 1].click());
    await act(async () => document.querySelector<HTMLButtonElement>('button[aria-label="다음 달"]')!.click());
    await act(async () => document.querySelector<HTMLButtonElement>('button[aria-label^="2026-11-30"]')!.click());
    assert.equal(document.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked, false);
    await act(async () => button('이날만 삭제').click());
    assert.doesNotMatch(rootElement.textContent!, /월말 일정/);
    await act(async () => document.querySelector<HTMLButtonElement>('button[aria-label="다음 달"]')!.click());
    await act(async () => document.querySelector<HTMLButtonElement>('button[aria-label^="2026-12-31"]')!.click());
    assert.equal(document.querySelector<HTMLInputElement>('input[type="checkbox"]')!.checked, false);
    const saved = JSON.parse(localStorage.getItem('honjasallim-events-v1')!);
    assert.deepEqual(saved[0].completed, ['2026-10-31']);
    assert.deepEqual(saved[0].excluded, ['2026-11-30']);
    await act(async () => root.render(<></>));
  } finally { t.mock.timers.reset(); }
});

test('저장 직후 알림 표시가 실패하면 성공 안내가 실패 안내를 덮지 않는다', async () => {
  localStorage.clear(); sessionStorage.clear();
  class FailingNotification {
    static permission = 'granted';
    static requestPermission = async () => 'granted';
    constructor() { throw new Error('notification failed'); }
  }
  Object.assign(dom.window, { Notification: FailingNotification });
  Object.assign(globalThis, { Notification: FailingNotification });
  const now = new Date();
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  await act(async () => root.render(<App />));
  await act(async () => button('+ 일정 추가').click());
  await act(async () => {
    inputValue(document.querySelector('input[placeholder]')!, '표시 오류 일정');
    inputValue(document.querySelector('input[type="time"]')!, time);
  });
  await act(async () => document.querySelector('form')!.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true })));
  assert.match(rootElement.textContent!, /알림을 표시하지 못했습니다/);
  assert.match(localStorage.getItem('honjasallim-events-v1')!, /표시 오류 일정/);
  await act(async () => root.render(<></>));
});

test('손상된 저장 데이터를 덮어쓰지 않고 일정 추가를 막는다', async () => {
  localStorage.clear();
  const corrupt = '{"broken":';
  localStorage.setItem('honjasallim-events-v1', corrupt);
  await act(async () => root.render(<App />));
  assert.match(rootElement.textContent!, /저장된 일정을 읽을 수 없습니다/);
  assert.equal(button('+ 일정 추가').disabled, true);
  assert.equal(localStorage.getItem('honjasallim-events-v1'), corrupt);
  await act(async () => root.render(<></>));
});

test('프리셋 필터와 선택한 집안일 추가는 기존 일정을 보존한다', async () => {
  localStorage.clear();
  const previous = { id: 'existing', title: '기존 일정', kind: 'bill', date: dateString(new Date()), recurrence: 'none', until: '', reminder: '', completed: [], excluded: [] };
  localStorage.setItem('honjasallim-events-v1', JSON.stringify([previous]));
  await act(async () => root.render(<App />));
  await act(async () => button('집안일 프리셋').click());
  await act(async () => button('최소주의').click());
  assert.match(rootElement.textContent!, /설거지 하기/);
  assert.doesNotMatch(rootElement.textContent!, /세면대 & 변기 닦기/);
  const checkbox = document.querySelector<HTMLInputElement>('.preset-item input')!;
  await act(async () => checkbox.click());
  await act(async () => button('선택한 1개 추가').click());
  const saved = JSON.parse(localStorage.getItem('honjasallim-events-v1')!);
  assert.deepEqual(saved[0], previous);
  assert.equal(saved[1].presetId, 'KITCHEN_DAILY_DISHES');
  assert.equal(saved[1].recurrence, 'daily');
  assert.equal(saved[1].reminder, '');
  await act(async () => button('집안일 프리셋').click());
  const item = [...document.querySelectorAll('.preset-item')].find(el => el.textContent?.includes('설거지 하기'))!;
  assert.equal(item.querySelector<HTMLInputElement>('input')!.disabled, true);
  await act(async () => root.render(<></>));
});
