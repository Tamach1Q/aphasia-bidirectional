// Stage 4 — T053. The severe case (product.md §17.1).
//
// Every case here is one where a similarity score would see nothing wrong: the sentences
// share almost all their words and differ only in whether the person should take the
// medicine. That is the whole reason this check exists separately.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as polarity from '../../app/safety/checks/polarity.js';
import { check } from '../../app/safety/index.js';

const F04 = 'お風呂は入っていただいて大丈夫ですが、今日は薬を飲まないでください。';

test('the f04 reversal is caught — prohibition became instruction', () => {
  const r = polarity.check('お風呂は入って大丈夫です。今日は薬を飲んでください。', F04);
  assert.equal(r.ok, false);
  assert.match(r.detail, /dropped/);
});

test('the f04 output that actually occurred passes', () => {
  // Observed from gemini-3.5-flash-lite during Stage 0. A real correct output must not
  // trip the check, or the check is useless however safe it looks.
  const r = polarity.check('お風呂は入れますが、今日は薬を飲まないでください。', F04);
  assert.equal(r.ok, true, r.detail);
});

test('negation ADDED to an affirmative source is caught', () => {
  const r = polarity.check('薬を飲まないでください。', '朝ごはんのあとに薬を飲んでください。');
  assert.equal(r.ok, false);
  assert.match(r.detail, /added/);
});

test('the documented reconstruction failure is caught', () => {
  // "I don't feel good" → "I feel good", from the published study §17.1 cites.
  const r = polarity.check('気分がいいです。', '気分がよくないです。');
  assert.equal(r.ok, false);
});

test('a stop instruction that becomes a continue is caught', () => {
  const r = polarity.check('その日も薬を飲みます。', 'その日は飲むのをやめてください。');
  assert.equal(r.ok, false);
});

test('rewording that preserves the negation passes', () => {
  for (const [candidate, source] of [
    ['今日は薬を飲まない。', '今日は薬を飲まないでください。'],
    ['薬：今日は飲まない', '今日は薬を飲まないでください。'],
  ]) {
    assert.equal(polarity.check(candidate, source).ok, true, `${candidate} should pass`);
  }
});

test('nested negation forms are counted once, not twice', () => {
  // 飲まないでください contains both 〜ないで and 〜ない. Double-counting would make an
  // identical rewording look like a change.
  assert.equal(polarity.__countNegation('飲まないでください'), 1);
  assert.equal(polarity.__countNegation('飲まない'), 1);
});

test('an affirmative source and an affirmative candidate pass', () => {
  assert.equal(polarity.check('朝ごはんのあとに薬を飲む。', '朝ごはんのあとに薬を飲んでください。').ok, true);
});

test('polarity is reached through the safety entry point', () => {
  const r = check('今日は薬を飲んでください。', F04);
  assert.equal(r.ok, false);
  assert.ok(r.violations.some((v) => v.check === 'polarity'), JSON.stringify(r.violations));
});
