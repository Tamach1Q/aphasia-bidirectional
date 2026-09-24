// Confirms `node --test` runs with zero dependencies — no package.json, no lockfile,
// no install step. If this file ever needs a dependency to pass, the delivery
// constraint in plan.md ("no build step") has been broken.
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('node --test runs with no dependencies', () => {
  assert.equal(1 + 1, 2);
});
