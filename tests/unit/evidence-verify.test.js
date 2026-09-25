// Phase 4 / T071 — evidence pointer verification.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as session from '../../app/core/session.js';
import * as personalContext from '../../app/core/personal-context.js';
import { verifyHypotheses } from '../../app/evidence/verify.js';

function fresh() {
  session.__resetForTests();
  personalContext.clearPersonalContext();
  session.startSession(session.parseConfig(''));
}

test('a valid turn pointer survives', () => {
  fresh();
  const turn = session.appendTurn({ speaker: 'person', text: '…10…' });
  const result = verifyHypotheses([{
    text: '10時',
    evidence: [{ source: 'turn', id: turn.id, excerpt: '10' }],
  }]);
  assert.equal(result.hypotheses.length, 1);
  assert.equal(result.hypotheses[0].evidence.length, 1);
  assert.equal(result.failures.length, 0);
});

test('a pointer to a non-existent turn is dropped while the hypothesis survives', () => {
  fresh();
  const result = verifyHypotheses([{
    text: '10時',
    evidence: [{ source: 'turn', id: 't999', excerpt: '10' }],
  }]);
  assert.equal(result.hypotheses.length, 1, 'citation failure must not delete the hypothesis');
  assert.deepEqual(result.hypotheses[0].evidence, []);
  assert.equal(result.failures[0].reason, 'turn-not-found');
});

test('an excerpt absent from the cited turn is dropped', () => {
  fresh();
  const turn = session.appendTurn({ speaker: 'partner', text: '明日の病院、何時？' });
  const result = verifyHypotheses([{
    text: '10時',
    evidence: [{ source: 'turn', id: turn.id, excerpt: '10時' }],
  }]);
  assert.equal(result.hypotheses.length, 1);
  assert.deepEqual(result.hypotheses[0].evidence, []);
  assert.equal(result.failures[0].reason, 'excerpt-not-in-turn');
});

test('a reference to an evicted turn is unverifiable, not an error', () => {
  fresh();
  const evicted = session.appendTurn({ speaker: 'partner', text: '最初の発話' });
  for (let i = 0; i < session.MAX_TURNS; i += 1) {
    session.appendTurn({ speaker: 'partner', text: '後の発話' + i });
  }
  assert.equal(session.findTurn(evicted.id), null, 'precondition: oldest turn was evicted');

  let result;
  assert.doesNotThrow(() => {
    result = verifyHypotheses([{
      text: '候補',
      evidence: [{ source: 'turn', id: evicted.id, excerpt: '最初' }],
    }]);
  });
  assert.equal(result.hypotheses.length, 1);
  assert.deepEqual(result.hypotheses[0].evidence, []);
  assert.equal(result.failures[0].reason, 'turn-not-found');
});

test('confirmed pointers are checked against confirmed text', () => {
  fresh();
  const basisTurn = session.appendTurn({ speaker: 'person', text: '10' });
  session.selectForConfirmation({ hypothesisId: 'h1', text: '10時', basis: [basisTurn.id] });
  const confirmed = session.confirmSelected();

  const result = verifyHypotheses([{
    text: '明日は10時',
    evidence: [{ source: 'confirmed', id: confirmed.id, excerpt: '10時' }],
  }]);
  assert.equal(result.hypotheses[0].evidence.length, 1);
});

test('personalContext paths must resolve and contain the excerpt', () => {
  fresh();
  personalContext.loadFromObject({
    places: [{ name: 'さくら台病院', note: '月に一度の外来' }],
  });

  const result = verifyHypotheses([{
    text: 'さくら台病院',
    evidence: [
      { source: 'personalContext', path: 'places[0]', excerpt: 'さくら台病院' },
      { source: 'personalContext', path: 'places[9]', excerpt: 'さくら台病院' },
    ],
  }]);

  assert.equal(result.hypotheses.length, 1);
  assert.equal(result.hypotheses[0].evidence.length, 1);
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].reason, 'personal-path-not-found');
});


test('pipeline scoping can reject evidence that is live but was not sent to the model', () => {
  fresh();
  personalContext.loadFromObject({ places: [{ name: 'さくら台病院' }] });
  const fragment = session.appendTurn({ speaker: 'person', text: 'さくら' });
  const request = { op: 'hypotheses', fragment: { id: fragment.id, text: fragment.text } };

  const result = verifyHypotheses([{
    text: 'さくら台病院',
    evidence: [{ source: 'personalContext', path: 'places[0]', excerpt: 'さくら台病院' }],
  }], { request });

  assert.equal(result.hypotheses.length, 1);
  assert.deepEqual(result.hypotheses[0].evidence, []);
  assert.equal(result.failures[0].reason, 'not-sent-to-model');
});
