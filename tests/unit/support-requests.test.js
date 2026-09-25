// Phase 5 / T092 — support requests keep their distinct kinds.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SUPPORT_REQUESTS, dispatchSupportRequest } from '../../app/views/person.js';

test('the four required support requests are present and distinguishable', () => {
  assert.deepEqual(
    SUPPORT_REQUESTS.map((item) => item.kind),
    ['repeat', 'slow', 'short', 'different'],
  );
  assert.deepEqual(
    SUPPORT_REQUESTS.map((item) => item.label),
    ['もう一回', 'ゆっくり', '短く', 'ちがう'],
  );
  assert.equal(new Set(SUPPORT_REQUESTS.map((item) => item.kind)).size, 4);
});

test('each support kind is independently dispatchable', () => {
  for (const request of SUPPORT_REQUESTS) {
    const result = dispatchSupportRequest(request.kind);
    assert.equal(result.kind, request.kind);
    assert.equal(result.label, request.label);
  }
  assert.equal(dispatchSupportRequest('generic-help'), null);
});

test('repeat and different are not aliases for the same repair', () => {
  const repeat = dispatchSupportRequest('repeat');
  const different = dispatchSupportRequest('different');
  assert.notEqual(repeat.kind, different.kind);
  assert.notEqual(repeat.message, different.message);
});
