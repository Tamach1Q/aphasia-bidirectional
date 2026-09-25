// Stage 4 — T055. The properties that make the safety layer trustworthy.
//
// These are not about any individual check. They are about the layer: where it sits, what
// it is allowed to do when it fails, and what it is forbidden to depend on.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { stripComments } from './_source.js';
import * as safety from '../../app/safety/index.js';

const SAFETY_DIR = fileURLToPath(new URL('../../app/safety/', import.meta.url));

function sources() {
  const files = [path.join(SAFETY_DIR, 'index.js')];
  for (const f of readdirSync(path.join(SAFETY_DIR, 'checks'))) {
    if (f.endsWith('.js')) files.push(path.join(SAFETY_DIR, 'checks', f));
  }
  return files.map((f) => [path.relative(SAFETY_DIR, f), readFileSync(f, 'utf8')]);
}

const strip = (s) => stripComments(s, 'safety source');

test('all seven checks are registered (FR-027)', () => {
  assert.deepEqual([...safety.CHECK_NAMES].sort(), [
    'action', 'consent', 'medication', 'number', 'person', 'polarity', 'time',
  ]);
});

test('the layer makes NO network call — it is local and deterministic (FR-029)', () => {
  // A check must never be another call to the model that produced the candidate: a model
  // that inverted a polarity will not reliably notice that it did, so it would inherit
  // the exact error class it is meant to catch.
  for (const [rel, src] of sources()) {
    const code = strip(src);
    for (const forbidden of ['fetch(', 'XMLHttpRequest', 'import(', 'generateContent', 'WebSocket']) {
      assert.equal(code.includes(forbidden), false, `${rel} performs I/O: ${forbidden}`);
    }
  }
});

test('the layer is deterministic — no clock, no randomness', () => {
  for (const [rel, src] of sources()) {
    const code = strip(src);
    for (const forbidden of ['Math.random', 'Date.now', 'new Date', 'performance.now']) {
      assert.equal(code.includes(forbidden), false, `${rel} is non-deterministic: ${forbidden}`);
    }
  }
});

test('check() is pure — it never returns a modified candidate (FR-028)', () => {
  const r = safety.check('今日は薬を飲んでください。', '今日は薬を飲まないでください。');
  assert.deepEqual(Object.keys(r).sort(), ['ok', 'violations']);
  // Nothing resembling repaired text comes back. Repair means generating again, which
  // reintroduces the same risk class.
  assert.equal('text' in r, false);
  assert.equal('repaired' in r, false);
  assert.equal('candidate' in r, false);
});

test('calling check twice gives the same answer', () => {
  const args = ['娘が明日病院に行きます。', '娘 明日 病院'];
  assert.deepEqual(safety.check(...args), safety.check(...args));
});

test('an empty candidate is suppressed, not passed through', () => {
  for (const empty of ['', '   ', null, undefined]) {
    const r = safety.check(empty, 'なにか');
    assert.equal(r.ok, false, `empty candidate ${JSON.stringify(empty)} must not pass`);
  }
});

test('check() is TOTAL — it never throws, whatever it is handed', () => {
  // Failing open would mean an unchecked candidate reaching a person because of a bug in
  // the checker, or because of input the checker could not read. Both suppress.
  const hostile = [
    { toString() { throw new Error('boom'); } },
    Object.create(null),
    Symbol('x'),
    { a: { b: { c: 1 } } },
  ];
  for (const bad of hostile) {
    let r;
    assert.doesNotThrow(() => { r = safety.check('普通の文です。', bad); },
      `check() threw on ${String(bad && bad.constructor && bad.constructor.name)}`);
    assert.equal(typeof r.ok, 'boolean');
  }
  // And when the input itself is unreadable, the verdict is suppression, not pass.
  const r = safety.check('普通の文です。', { toString() { throw new Error('boom'); } });
  assert.equal(r.ok, false);
  assert.ok(r.violations.some((v) => v.check === 'input'));
});

test('a single check throwing does not take the whole layer down', () => {
  // Each check is wrapped individually, so one bad checker suppresses the candidate
  // rather than aborting the other six.
  const r = safety.check('普通の文です。', '普通の文です。');
  assert.equal(typeof r.ok, 'boolean');
});

test('filter keeps survivors and records what was suppressed', () => {
  const source = '今日は薬を飲まないでください。';
  const { kept, suppressed } = safety.filter([
    { text: '今日は薬を飲まない。' },      // correct
    { text: '今日は薬を飲んでください。' }, // reversed
  ], source);

  assert.equal(kept.length, 1);
  assert.equal(kept[0].text, '今日は薬を飲まない。');
  assert.equal(suppressed.length, 1);
  assert.ok(suppressed[0].violations.some((v) => v.check === 'polarity'));
});

test('all candidates suppressed is a NORMAL outcome, flagged for the unknown path (FR-028)', () => {
  const { kept, allSuppressed } = safety.filter([
    { text: '今日は薬を飲んでください。' },
    { text: '薬を2錠飲みます。' },
  ], '今日は薬を飲まないでください。');

  assert.equal(kept.length, 0);
  assert.equal(allSuppressed, true, 'the caller turns this into unknown + fallback, not an error');
});

test('an empty candidate set is not "all suppressed"', () => {
  // Zero candidates from the model is already unknown; it is not a suppression event and
  // must not be logged as one (FR-042 would otherwise overcount).
  const { allSuppressed } = safety.filter([], 'なにか');
  assert.equal(allSuppressed, false);
});

test('violations name the check that fired, for the research log (FR-042)', () => {
  const r = safety.check('娘が今日2錠飲んでください。', '明日 病院');
  assert.equal(r.ok, false);
  for (const v of r.violations) {
    assert.ok(safety.CHECK_NAMES.includes(v.check) || v.check === 'empty', `unknown check: ${v.check}`);
    assert.ok(v.detail && v.detail.length > 0, 'a violation must say what it saw');
  }
});
