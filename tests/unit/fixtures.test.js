// Stage 0 — the fixture set is the scoring key for model selection AND the regression
// suite afterwards. If a fixture is malformed, a model-selection run silently measures
// something other than what was intended, so the set is validated like code.
//
// contracts/injected-transcript.md §Fixture location and constraints
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const DIR = fileURLToPath(new URL('../../app/fixtures/', import.meta.url));
const NAMES = readdirSync(DIR).filter((f) => f.endsWith('.json')).sort();
const load = (f) => JSON.parse(readFileSync(path.join(DIR, f), 'utf8'));

const PRESERVE_VOCAB = new Set([
  'negation', 'number', 'condition', 'time', 'place', 'action', 'person',
  'medication', 'consent',
]);
const CITE_VOCAB = new Set(['turn', 'confirmed', 'personalContext']);

test('the eight planned fixtures all exist', () => {
  assert.deepEqual(NAMES, [
    'f01-simple-question.json',
    'f02-conditional-instruction.json',
    'f03-multi-entity.json',
    'f04-negation.json',
    'f05-fragment-answerable.json',
    'f06-fragment-unanswerable.json',
    'f07-fragment-with-personal-context.json',
    'f08-anchoring-trap.json',
  ]);
});

test('every fixture is valid JSON with the contract shape', () => {
  for (const f of NAMES) {
    const d = load(f);
    assert.equal(d.name, path.basename(f, '.json'), `${f}: name must match the filename`);
    assert.equal(typeof d.description, 'string', `${f}: missing description`);
    assert.ok(Array.isArray(d.turns) && d.turns.length > 0, `${f}: needs at least one turn`);
    for (const t of d.turns) {
      assert.ok(['partner', 'person'].includes(t.speaker), `${f}: bad speaker "${t.speaker}"`);
      assert.ok(typeof t.text === 'string' && t.text.trim(), `${f}: empty turn text`);
    }
    assert.equal(typeof d.expect, 'object', `${f}: missing expect`);
  }
});

test('expect annotations use the documented vocabulary', () => {
  for (const f of NAMES) {
    const e = load(f).expect;
    if ('gate' in e) assert.ok(['pass', 'skip'].includes(e.gate), `${f}: bad gate "${e.gate}"`);
    for (const p of e.preserve || []) {
      assert.ok(PRESERVE_VOCAB.has(p), `${f}: unknown preserve element "${p}"`);
    }
    if (e.mustCite) assert.ok(CITE_VOCAB.has(e.mustCite), `${f}: bad mustCite "${e.mustCite}"`);
    if (e.hypotheses) {
      const { min, max } = e.hypotheses;
      assert.ok(Number.isInteger(min) && Number.isInteger(max), `${f}: non-integer bounds`);
      assert.ok(min >= 0 && max <= 3 && min <= max, `${f}: bounds outside 0..3`);
    }
    for (const s of e.mustNotProduce || []) {
      assert.ok(typeof s === 'string' && s.trim(), `${f}: empty mustNotProduce entry`);
    }
  }
});

test('f01 asserts the gate keeps an ordinary utterance off the wire (FR-008)', () => {
  const e = load('f01-simple-question.json').expect;
  assert.equal(e.gate, 'skip');
  assert.equal(e.networkCalls, 0, 'f01 exists to prove zero model calls');
});

test('f04 guards polarity — the severe case (FR-027)', () => {
  const d = load('f04-negation.json');
  assert.match(d.turns[0].text, /ないで|ません|しないで/, 'f04 must actually contain a negation');
  assert.ok(d.expect.preserve.includes('negation'));
  assert.ok(
    (d.expect.mustNotProduce || []).length > 0,
    'f04 must name the reversed readings that count as failure',
  );
});

test('f06 demands ZERO hypotheses — restraint, not a near-miss (FR-015)', () => {
  const e = load('f06-fragment-unanswerable.json').expect;
  assert.deepEqual(e.hypotheses, { min: 0, max: 0 },
    'softening these bounds would turn the restraint test into a formality');
  const d = load('f06-fragment-unanswerable.json');
  assert.equal(d.personalContext, undefined, 'f06 must carry no context to guess from');
  assert.equal(d.turns.length, 1, 'f06 must have no preceding turn to lean on');
});

test('f07 and f08 form a pair: context as background, not as an answer key', () => {
  const f07 = load('f07-fragment-with-personal-context.json');
  const f08 = load('f08-anchoring-trap.json');

  assert.ok(f07.personalContext, 'f07 needs personal context to be resolvable at all');
  assert.equal(f07.expect.mustCite, 'personalContext');

  assert.ok(f08.personalContext, 'f08 needs personal context to act as the distractor');
  assert.equal(f08.expect.mustCite, 'turn', 'f08 must be answered from the conversation');
  assert.ok(
    (f08.expect.mustNotProduce || []).length > 0,
    'f08 must name the anchored readings that count as failure',
  );
});

test('fixtures carry no real participant data (FR-005)', () => {
  // A weak but real guard: every fixture must say it is synthetic somewhere a human
  // will see, and any embedded personal context must carry the _note marker.
  for (const f of NAMES) {
    const d = load(f);
    assert.match(d.description, /SYNTHETIC/i, `${f}: description must state it is synthetic`);
    if (d.personalContext) {
      assert.match(
        String(d.personalContext._note || ''), /SYNTHETIC/i,
        `${f}: embedded personalContext must carry a _note marker`,
      );
    }
  }
});

test('fixture personal context matches the loader shape', async () => {
  const pc = await import('../../app/core/personal-context.js');
  for (const f of NAMES) {
    const d = load(f);
    if (!d.personalContext) continue;
    const loaded = pc.loadFromObject(d.personalContext);
    assert.equal('_note' in loaded, false, `${f}: _note must be stripped by the loader`);
    for (const key of ['people', 'places', 'schedule', 'interests', 'topics']) {
      assert.ok(Array.isArray(loaded[key]), `${f}: ${key} did not normalize to an array`);
    }
  }
  pc.clearPersonalContext();
});
