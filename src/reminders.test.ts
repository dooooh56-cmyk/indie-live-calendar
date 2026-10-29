import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { reminderStatus } from './reminders.ts';

test('알림 권한 상태와 오류를 사용자에게 알린다', async () => {
  assert.match(await reminderStatus(undefined), /지원하지 않습니다.*저장/);
  assert.match(await reminderStatus({ requestPermission: async () => 'denied' }), /권한이 없어.*저장/);
  assert.match(await reminderStatus({ requestPermission: async () => { throw new Error('failure'); } }), /설정하지 못했습니다.*저장/);
  assert.match(await reminderStatus({ requestPermission: async () => 'granted' }), /연 상태에서만 시도/);
});
