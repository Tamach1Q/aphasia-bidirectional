// Phase 3 — T057. The gate decides what costs nothing.
//
// Its most important property is the negative one: an ordinary utterance must produce no
// network call at all. A gate that quietly passes everything would look like it works
// while sending every sentence a partner says to a model.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as gate from '../../app/pipelines/gate.js';

const fixture = (n) => JSON.parse(
  readFileSync(new URL(`../../app/fixtures/${n}.json`, import.meta.url), 'utf8'),
);
const partnerText = (f) => f.turns.find((t) => t.speaker === 'partner').text;

test('f01 gates OUT — an ordinary question costs nothing (FR-008)', () => {
  const f = fixture('f01-simple-question');
  const r = gate.evaluate(partnerText(f));
  assert.equal(r.pass, false, `f01 must not reach the network: ${r.reason}`);
  assert.equal(f.expect.gate, 'skip', 'fixture and gate must agree');
});

test('f02 gates IN — condition plus actions', () => {
  const f = fixture('f02-conditional-instruction');
  const r = gate.evaluate(partnerText(f));
  assert.equal(r.pass, true);
  assert.ok(r.signals.includes('condition'), `expected a condition signal, got ${r.signals}`);
});

test('f03 gates IN — several times, numbers and a place', () => {
  const f = fixture('f03-multi-entity');
  const r = gate.evaluate(partnerText(f));
  assert.equal(r.pass, true);
  assert.ok(r.signals.includes('entities'), `expected an entity signal, got ${r.signals}`);
});

test('f04 gates IN — the contrastive case that drove the signal set', () => {
  // f04 is not long, has no もし-conditional, and carries one instruction pair. What makes
  // it hard is the CONTRAST across 〜ですが: a permission and a prohibition in one
  // utterance, where dropping half inverts a medication decision (research.md §5).
  const f = fixture('f04-negation');
  const r = gate.evaluate(partnerText(f));
  assert.equal(r.pass, true, `f04 must be simplified: ${r.reason}`);
  assert.ok(r.signals.includes('condition'), `expected the contrastive signal, got ${r.signals}`);
});

test('every fixture agrees with its own gate annotation', () => {
  for (const name of [
    'f01-simple-question', 'f02-conditional-instruction',
    'f03-multi-entity', 'f04-negation',
  ]) {
    const f = fixture(name);
    const expected = f.expect.gate === 'pass';
    assert.equal(gate.evaluate(partnerText(f)).pass, expected, `${name} disagrees with its annotation`);
  }
});

test('each signal fires independently', () => {
  const cases = {
    length: 'あ'.repeat(gate.THRESHOLDS.length + 1),
    instructions: '座ってください。そのあとで名前を書いてください。',
    condition: 'もし寒かったら言ってね',
    embeddedQuestion: '来週の予定なんですが、火曜日はご都合いかがですか？',
    entities: '火曜日の10時か、木曜日の14時です',
  };
  for (const [signal, text] of Object.entries(cases)) {
    const r = gate.evaluate(text);
    assert.ok(r.signals.includes(signal), `${signal} did not fire on "${text}" (got ${r.signals})`);
  }
});

test('short ordinary utterances gate out', () => {
  for (const text of ['はい', 'そうですね', 'おはよう', '元気ですか？', 'これ、どうぞ']) {
    assert.equal(gate.evaluate(text).pass, false, `"${text}" should not be simplified`);
  }
});

test('empty input gates out rather than throwing', () => {
  for (const empty of ['', '   ', null, undefined]) {
    assert.equal(gate.evaluate(empty).pass, false);
  }
});

test('the decision names what fired, for calibration', () => {
  const r = gate.evaluate('もし10時に来られない場合は、3階の受付にお電話ください。');
  assert.ok(r.signals.length > 0);
  assert.match(r.reason, /signals:/);
});

test('the entity signal counts ALTERNATIVES, not entities of any kind', () => {
  // One time plus one place is a single fact, not a load. Two times is a choice to hold.
  assert.equal(gate.__maxSameKind('明日、病院行く？'), 1, 'a day and a place is one of each');
  assert.equal(gate.__maxSameKind('火曜日か木曜日'), 2, 'two candidate days is a choice');
  assert.equal(gate.__maxSameKind('10時半か14時'), 2);
});

test('a single appointment stated plainly does not gate in', () => {
  // Short, one time, one number, one place — nothing to choose between.
  assert.equal(gate.evaluate('明日の10時に病院に来てください。').pass, false);
});

test('repetition is not a second entity', () => {
  // 「病院、病院」 is one place mentioned twice.
  assert.equal(gate.__maxSameKind('病院に行く。病院は遠い。'), 1);
});
