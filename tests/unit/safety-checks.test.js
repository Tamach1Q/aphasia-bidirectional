// Stage 4 — T054. The remaining six checks.
//
// Each check has a false-positive test alongside its catch test. A suppression rule that
// fires on correct output is not safe, it is unusable: everything degrades to fallback
// and the product stops working while looking careful.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as number from '../../app/safety/checks/number.js';
import * as person from '../../app/safety/checks/person.js';
import * as time from '../../app/safety/checks/time.js';
import * as action from '../../app/safety/checks/action.js';
import * as medication from '../../app/safety/checks/medication.js';
import * as consent from '../../app/safety/checks/consent.js';

const F03 = '次の予約ですが、来週の火曜日の10時半か、木曜日の14時が空いています。どちらも3階の受付に来ていただく形になります。';

// --- number ----------------------------------------------------------------------

test('number: an invented time is caught', () => {
  const r = number.check('来週の火曜日の11時です。', F03);
  assert.equal(r.ok, false);
  assert.match(r.detail, /11/);
});

test('number: the real f03 output passes', () => {
  const r = number.check('火曜 10時半 / 木曜 14時、3階の受付', F03);
  assert.equal(r.ok, true, r.detail);
});

test('number: kanji, full-width and clock forms all canonicalise to the same value', () => {
  // A bare hour canonicalises to H:00, so 「十時」 yields [10, 0] rather than [10].
  assert.deepEqual(number.__numbers('十時'), [10, 0]);
  assert.deepEqual(number.__numbers('１０時'), [10, 0]);
  assert.equal(number.check('10時', '十時に来てください').ok, true, 'a kanji source covers an arabic candidate');
});

test('number: a clock rewording is not an invented number', () => {
  // Measured against real Stage 0 output, this was the last false positive: a correct f03
  // simplification wrote 10:30 and 14:00 where the source said 10時半 and 14時. Rendering
  // one as the other is a clearer output, not a fabrication.
  const source = '来週の火曜日の10時半か、木曜日の14時が空いています。';
  assert.equal(number.check('火曜 10:30 / 木曜 14:00', source).ok, true);
  assert.equal(number.check('火曜日の10時30分', source).ok, true);
});

test('number: a genuinely different time is still caught after canonicalisation', () => {
  // The widening must not have made the check blind — 10:45 was never offered.
  const source = '来週の火曜日の10時半が空いています。';
  assert.equal(number.check('火曜 10:45', source).ok, false);
});

test('number: a list marker is not a quantity', () => {
  // 「1. 朝ごはん…」 enumerates a step. Counting it as a number suppressed correct
  // structured output during calibration.
  assert.equal(number.check('1. 朝ごはんのあとに薬を飲む', '朝ごはんのあとに薬を飲んでください。').ok, true);
});

test('number: dropping a number is not this check\'s concern', () => {
  // Over-reduction handles omission; this check only refuses invention.
  assert.equal(number.check('火曜日の10時半です。', F03).ok, true);
});

// --- person ----------------------------------------------------------------------

test('person: an invented subject is caught', () => {
  const r = person.check('娘が病院に行きます。', '明日 病院');
  assert.equal(r.ok, false);
  assert.match(r.detail, /娘/);
});

test('person: a person named in the source passes', () => {
  assert.equal(person.check('娘が病院に行きます。', '娘 明日 病院').ok, true);
});

test('person: a relation from personal context is legitimate', () => {
  // Resolving a fragment against context the model was correctly given is its job.
  const ctx = { personalContext: { people: [{ name: 'みどり', relation: '娘' }] } };
  assert.equal(person.check('娘が来ます。', 'みどり 来る', ctx).ok, true);
});

// --- subject swap ---------------------------------------------------------------

test('person: a SUBJECT SWAP is caught — same words, different plan', () => {
  // Both 娘 and 私 appear in the source, so the invented-person rule sees nothing wrong.
  // Who is doing the taking has nevertheless been reversed.
  const r = person.check(
    '私が娘を病院へ連れていきます',
    '娘が私を病院へ連れていきます',
    { mode: 'restate' },
  );
  assert.equal(r.ok, false, 'a reversed subject must not pass');
  assert.match(r.detail, /subject swapped/);
});

test('person: the same subject reworded passes', () => {
  assert.equal(
    person.check('娘が病院へ行きます', '娘が病院に行きます', { mode: 'restate' }).ok,
    true,
  );
});

test('person: spelling variants of self are one person, not two', () => {
  // わたし and 私 must not read as a swap.
  assert.equal(
    person.check('わたしが娘を連れていきます', '私が娘を連れていきます', { mode: 'restate' }).ok,
    true,
  );
});

test('person: swap detection is RESTATE only — a hypothesis may have its own subject', () => {
  // A hypothesis is the PERSON's meaning answering the partner. A subject differing from
  // the question's subject is normal, and suppressing it would suppress the feature.
  const args = ['私が行きます', '娘さんが行くんですか？ …わたし…'];
  assert.equal(person.check(...args, { mode: 'interpret' }).ok, true);
});

test('person: an omitted subject is a known limitation, not a violation', () => {
  // The source marks no doer, so there is nothing to compare. Guessing would suppress
  // correct output; the invented-person rule still applies.
  assert.equal(person.check('娘が行きます', '娘 明日 病院', { mode: 'restate' }).ok, true);
  assert.equal(person.check('私が行きます', '娘 明日 病院', { mode: 'restate' }).ok, false,
    '私 was never mentioned — the invented-person rule still fires');
});

test('person: subject and non-subject marking is distinguished', () => {
  assert.deepEqual([...person.__subjects('娘が私を連れていく')], ['娘']);
  assert.deepEqual([...person.__nonSubjects('娘が私を連れていく')], ['私']);
});

// --- time ------------------------------------------------------------------------

test('time: an invented day is caught', () => {
  const r = time.check('今日の病院は10時です。', '明日の病院、何時？');
  assert.equal(r.ok, false);
  assert.match(r.detail, /今日/);
});

test('time: a kana/kanji rewording of the same day passes', () => {
  assert.equal(time.check('あしたの病院は10時。', '明日の病院、何時？').ok, true);
});

test('time: a day already confirmed this session is legitimate', () => {
  const ctx = { confirmed: [{ text: '明日病院に行く' }] };
  assert.equal(time.check('明日の10時です。', '…10…', ctx).ok, true);
});

// --- action ----------------------------------------------------------------------

test('action: an inversion WITHOUT negation is caught', () => {
  // polarity sees nothing here: both sentences are affirmative.
  const r = action.check('薬を続けてください。', 'その日は薬をやめてください。');
  assert.equal(r.ok, false);
  assert.match(r.detail, /inverted/);
});

test('action: preserving the direction passes', () => {
  assert.equal(action.check('その日は薬をやめる。', 'その日は薬をやめてください。').ok, true);
});

test('action: an unrelated sentence is not flagged', () => {
  assert.equal(action.check('3階の受付に行きます。', '3階の受付に来てください。').ok, true);
});

// --- medication ------------------------------------------------------------------

test('medication: an invented dose is caught', () => {
  const r = medication.check('薬を2錠飲んでください。', '朝ごはんのあとに薬を飲んでください。');
  assert.equal(r.ok, false);
  assert.match(r.detail, /2錠/);
});

test('medication: medication introduced where there was none is caught', () => {
  const r = medication.check('薬を飲んでから行きます。', '明日の病院、何時？');
  assert.equal(r.ok, false);
  assert.match(r.detail, /did not/);
});

test('medication: a dose-shaped number in an unrelated sentence is NOT flagged', () => {
  // 「3階」 must not read as a dose. This check engages only when medication is in play.
  assert.equal(medication.check('3階の受付です。', F03).ok, true);
});

test('medication: repeating the source dose passes', () => {
  assert.equal(medication.check('朝に薬を1錠。', '朝ごはんのあとに薬を1錠飲んでください。').ok, true);
});

// --- consent ---------------------------------------------------------------------

test('consent: agreement asserted where the source had none is caught', () => {
  const r = consent.check('はい、お願いします。', '…あの…');
  assert.equal(r.ok, false);
  assert.match(r.detail, /asserts consent/);
});

test('consent: refusal turned into agreement is caught', () => {
  const r = consent.check('お願いします。', 'いいえ、いりません。');
  assert.equal(r.ok, false);
});

test('consent: echoing the source agreement passes', () => {
  assert.equal(consent.check('はい、お願いします。', 'はい、お願いします').ok, true);
});

test('consent: neutral text is not flagged', () => {
  assert.equal(consent.check('明日の病院は10時です。', '明日の病院、何時？').ok, true);
});
