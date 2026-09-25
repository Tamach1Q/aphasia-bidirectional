// Phase 3 — T058. Chunks settle; settled content is never silently replaced (FR-010).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as chunker from '../../app/pipelines/chunker.js';

const fresh = () => chunker.reset();

test('one settled turn becomes one chunk (research.md §4, provisional)', () => {
  fresh();
  const c = chunker.accept('明日の病院、何時だった？', { turnId: 't1' });
  assert.equal(c.text, '明日の病院、何時だった？');
  assert.equal(c.turnId, 't1');
  assert.equal(c.revises, null);
});

test('a chunk once settled is never re-emitted', () => {
  fresh();
  chunker.accept('ひとつめ');
  chunker.accept('ふたつめ');
  const settled = chunker.getSettled();
  assert.equal(settled.length, 2);
  assert.deepEqual(settled.map((s) => s.text), ['ひとつめ', 'ふたつめ']);
  assert.notEqual(settled[0].id, settled[1].id);
});

test('a growing re-emission is marked as a REVISION, not settled twice', () => {
  // Recognition sometimes re-emits a lengthening string as separate finals. Treating that
  // as two chunks would leave a truncated fragment settled above its own continuation.
  fresh();
  const first = chunker.accept('朝ごはんのあとに薬を');
  const second = chunker.accept('朝ごはんのあとに薬を飲んでください');
  assert.equal(second.revises, first.id, 'the continuation must point at what it supersedes');
});

test('unrelated content is new, not a revision', () => {
  fresh();
  chunker.accept('明日の病院、何時だった？');
  const next = chunker.accept('10時です。');
  assert.equal(next.revises, null, 'wrongly marking a revision is as confusing as missing one');
});

test('an identical repeat is not a revision of itself', () => {
  fresh();
  chunker.accept('同じ文');
  const again = chunker.accept('同じ文');
  assert.equal(again.revises, null);
});

test('only the immediately preceding chunk can be revised', () => {
  // Conservative on purpose: a later restatement of something two chunks back is treated
  // as new content rather than guessed at.
  fresh();
  const first = chunker.accept('あさ');
  chunker.accept('まったく別の話');
  const third = chunker.accept('あさごはん');
  assert.equal(third.revises, null, `should not reach back past the previous chunk (got ${third.revises})`);
  assert.ok(first.id);
});

test('empty input settles nothing', () => {
  fresh();
  for (const empty of ['', '   ', null, undefined]) {
    assert.equal(chunker.accept(empty), null);
  }
  assert.equal(chunker.getSettled().length, 0);
});

test('reset clears settled state between sessions', () => {
  fresh();
  chunker.accept('あ');
  chunker.reset();
  assert.deepEqual(chunker.getSettled(), []);
  // Ids restart, so a new session does not inherit the previous one's numbering.
  assert.equal(chunker.accept('い').id, 'k1');
});
