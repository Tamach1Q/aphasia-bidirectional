// Stage 1 acceptance — specs/002-context-aware-dyadic-support/tasks.md T030
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as session from '../../app/core/session.js';

const fresh = (cfg = {}) => {
  session.__resetForTests();
  return session.startSession({ ai: 'on', receptive: 'on', ctx: 'personal', ...cfg });
};

test('turns: ring buffer bounds at MAX_TURNS', () => {
  fresh();
  for (let i = 1; i <= session.MAX_TURNS + 4; i += 1) {
    session.appendTurn({ speaker: 'partner', text: `u${i}` });
  }
  assert.equal(session.getTurns().length, session.MAX_TURNS);
});

test('turns: eviction is oldest-first', () => {
  fresh();
  for (let i = 1; i <= session.MAX_TURNS + 2; i += 1) {
    session.appendTurn({ speaker: 'partner', text: `u${i}` });
  }
  const texts = session.getTurns().map((t) => t.text);
  assert.equal(texts[0], 'u3', 'the two oldest turns should be gone');
  assert.equal(texts.at(-1), `u${session.MAX_TURNS + 2}`);
});

test('turns: empty or whitespace-only text never creates a Turn (FR-002)', () => {
  fresh();
  assert.equal(session.appendTurn({ speaker: 'person', text: '' }), null);
  assert.equal(session.appendTurn({ speaker: 'person', text: '   ' }), null);
  assert.equal(session.appendTurn({ speaker: 'person', text: null }), null);
  assert.equal(session.getTurns().length, 0);
});

test('turns: an injected turn is indistinguishable from an ASR turn downstream (FR-043)', () => {
  fresh();
  const asr = session.appendTurn({ speaker: 'partner', text: 'あ', source: 'asr' });
  const inj = session.appendTurn({ speaker: 'partner', text: 'い', source: 'injected' });
  const shape = (t) => Object.keys(t).sort().join(',');
  assert.equal(shape(asr), shape(inj));
  assert.equal(asr.speaker, inj.speaker);
});

test('turns: a turn is frozen once appended', () => {
  fresh();
  const t = session.appendTurn({ speaker: 'partner', text: 'あ' });
  assert.throws(() => { 'use strict'; t.text = 'changed'; }, TypeError);
});

test('confirmed: confirmSelected is the ONLY exported function that appends (FR-003)', () => {
  fresh();
  // Register a snapshot so any function that *could* append has something to append.
  session.selectForConfirmation({ hypothesisId: 'h1', text: '10時', basis: [] });

  // Call every exported function except confirmSelected and assert none of them grows
  // `confirmed`. This is stronger than enumerating names, which drifts as the API changes.
  for (const [name, fn] of Object.entries(session)) {
    if (typeof fn !== 'function') continue;
    if (name === 'confirmSelected' || name === '__resetForTests') continue;
    if (name === 'stopSession' || name === 'startSession') continue;
    try { fn({ speaker: 'person', text: 'x', hypothesisId: 'h', basis: [] }); } catch { /* arg shape */ }
    assert.equal(session.getConfirmed().length, 0, `${name}() appended to confirmed`);
  }

  // A returned array is a copy; mutating it must not reach the session.
  session.getConfirmed().push({ id: 'x', text: 'smuggled' });
  assert.equal(session.getConfirmed().length, 0);

  // ...and confirmSelected does append.
  session.selectForConfirmation({ hypothesisId: 'h1', text: '10時', basis: [] });
  session.confirmSelected();
  assert.equal(session.getConfirmed().length, 1);
});

test('confirmed: confirmSelected takes no UI arguments and commits the partner snapshot (§8)', () => {
  fresh();
  const t1 = session.appendTurn({ speaker: 'partner', text: '何時？' });
  const t2 = session.appendTurn({ speaker: 'person', text: '10' });

  session.selectForConfirmation({ hypothesisId: 'h1', text: '10時', basis: [t1.id, t2.id] });

  // What the person's view may see carries no basis (FR-023).
  const req = session.getConfirmationRequest();
  assert.deepEqual(Object.keys(req).sort(), ['hypothesisId', 'text']);

  // Passing anything is ignored — the snapshot is what gets committed.
  const item = session.confirmSelected({ text: 'smuggled text' });
  assert.equal(item.text, '10時');
  assert.deepEqual([...item.basis], [t1.id, t2.id], 'basis survives to Confirmed');
  assert.equal(session.getConfirmed().length, 1);
});

test('confirmed: nothing is stored without a prior selection', () => {
  fresh();
  assert.equal(session.confirmSelected(), null);
  assert.equal(session.getConfirmed().length, 0);
});

test('confirmed: rejectSelected stores nothing and clears the request', () => {
  fresh();
  session.selectForConfirmation({ hypothesisId: 'h9', text: '10時', basis: [] });
  assert.equal(session.rejectSelected(), 'h9');
  assert.equal(session.getConfirmationRequest(), null);
  assert.equal(session.getConfirmed().length, 0);
});

test('config: frozen after start', () => {
  const s = fresh();
  assert.throws(() => { 'use strict'; s.config.ai = 'off'; }, TypeError);
  assert.equal(session.getConfig().ai, 'on');
});

test('config: parseConfig defaults and A0 baseline', () => {
  assert.deepEqual({ ...session.parseConfig('') }, {
    ai: 'on', receptive: 'on', ctx: 'personal', configId: null, inject: false,
  });
  assert.equal(session.parseConfig('?ai=off').ai, 'off');
  assert.equal(session.parseConfig('?receptive=off').receptive, 'off');
  assert.equal(session.parseConfig('?ctx=none').ctx, 'none');
  assert.equal(session.parseConfig('?ctx=bogus').ctx, 'personal', 'unknown value falls back');
});

test('session.js imports nothing from the hint store (data-model.md §5.1, §8)', () => {
  const src = readFileSync(new URL('../../app/core/session.js', import.meta.url), 'utf8');
  const imports = src.match(/^\s*import\s.*$/gm) || [];
  assert.equal(
    imports.filter((l) => l.includes('hint-store')).length, 0,
    'session.js must build Confirmed from the partner snapshot, never by reading hypotheses',
  );
});

test('session: stop clears everything', () => {
  fresh();
  session.appendTurn({ speaker: 'partner', text: 'あ' });
  session.stopSession();
  assert.equal(session.isActive(), false);
  assert.equal(session.getSession(), null);
  assert.deepEqual(session.getTurns(), []);
});
