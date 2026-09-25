// Phase 4 / T070 — hint store invariants.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripComments } from './_source.js';
import * as hints from '../../app/core/hint-store.js';

function fresh() {
  hints.__resetForTests();
}

test('hint store starts empty and clearHints returns a generation token', () => {
  fresh();
  assert.deepEqual(hints.getHintSnapshot(), {
    state: 'empty',
    fragmentTurnId: null,
    hypotheses: [],
    producedAt: null,
  });
  assert.equal(hints.clearHints(), 1);
  assert.equal(hints.clearHints(), 2);
});

test('setHypotheses transitions empty to ready and assigns ids', () => {
  fresh();
  const generation = hints.clearHints();
  assert.equal(hints.setHypotheses('t2', [
    { text: '10時', evidence: [{ source: 'turn', id: 't2', excerpt: '10' }] },
  ], generation), true);

  const snapshot = hints.getHintSnapshot();
  assert.equal(snapshot.state, 'ready');
  assert.equal(snapshot.fragmentTurnId, 't2');
  assert.equal(snapshot.hypotheses.length, 1);
  assert.match(snapshot.hypotheses[0].id, /^h\d+$/);
  assert.equal(snapshot.hypotheses[0].text, '10時');
});

test('zero hypotheses is the unknown state, not an error', () => {
  fresh();
  const generation = hints.clearHints();
  hints.setHypotheses('t9', [], generation);
  const snapshot = hints.getHintSnapshot();
  assert.equal(snapshot.state, 'unknown');
  assert.deepEqual(snapshot.hypotheses, []);
});

test('setUnknown transitions to unknown and clearHints returns to empty', () => {
  fresh();
  const generation = hints.clearHints();
  assert.equal(hints.setUnknown('t3', generation), true);
  assert.equal(hints.getHintSnapshot().state, 'unknown');
  hints.clearHints();
  assert.equal(hints.getHintSnapshot().state, 'empty');
});

test('a stale generation cannot overwrite a newer fragment', () => {
  fresh();
  const oldGeneration = hints.clearHints();
  const currentGeneration = hints.clearHints();

  assert.equal(hints.setHypotheses('old', [{ text: '古い候補' }], oldGeneration), false);
  assert.equal(hints.getHintSnapshot().state, 'empty');

  assert.equal(hints.setHypotheses('new', [{ text: '新しい候補' }], currentGeneration), true);
  assert.equal(hints.getHintSnapshot().fragmentTurnId, 'new');
  assert.equal(hints.getHintSnapshot().hypotheses[0].text, '新しい候補');
});

test('writers have no DOM or render surface (FR-019, FR-022)', () => {
  const src = stripComments(
    readFileSync(new URL('../../app/core/hint-store.js', import.meta.url), 'utf8'),
    'app/core/hint-store.js',
  );
  for (const forbidden of ['document.', 'window.', 'innerHTML', 'textContent', 'appendChild', 'render(']) {
    assert.equal(src.includes(forbidden), false, 'hint-store must not render via ' + forbidden);
  }
});
