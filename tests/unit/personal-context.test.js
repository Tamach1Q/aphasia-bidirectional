// Stage 1 acceptance — specs/002-context-aware-dyadic-support/tasks.md T031
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripComments } from './_source.js';
import * as pc from '../../app/core/personal-context.js';

const SRC = readFileSync(new URL('../../app/core/personal-context.js', import.meta.url), 'utf8');
const CODE = stripComments(SRC, 'personal-context.js');

const SAMPLE = JSON.parse(
  readFileSync(new URL('../../app/context/sample-01.json', import.meta.url), 'utf8'),
);

test('no storage API is touched anywhere in the module (FR-004)', () => {
  for (const api of ['localStorage', 'sessionStorage', 'indexedDB', 'document.cookie']) {
    assert.equal(CODE.includes(api), false, `personal-context.js must not reference ${api}`);
  }
});

test('no mutation path is exported — read-only (FR-004)', () => {
  const exported = Object.keys(pc);
  const mutators = exported.filter((k) => /^(set|update|add|push|save|persist|write)/i.test(k));
  assert.deepEqual(mutators, [], `unexpected mutators: ${mutators}`);
});

test('nothing is loaded until a load call is made', () => {
  pc.clearPersonalContext();
  assert.equal(pc.getPersonalContext(), null);
  assert.equal(pc.hasPersonalContext(), false);
});

test('loadFromObject normalizes and freezes', () => {
  const ctx = pc.loadFromObject(SAMPLE);
  assert.equal(Object.isFrozen(ctx), true);
  assert.equal(Object.isFrozen(ctx.people), true);
  assert.throws(() => { 'use strict'; ctx.people.push({ name: 'x' }); }, TypeError);
});

test('the _note field never reaches consumers', () => {
  const ctx = pc.loadFromObject(SAMPLE);
  assert.equal('_note' in ctx, false, '_note exists only because JSON cannot carry comments');
  assert.deepEqual(
    Object.keys(ctx).sort(),
    ['interests', 'people', 'places', 'schedule', 'topics'],
  );
});

test('malformed input degrades to empty rather than throwing', () => {
  assert.deepEqual([...pc.loadFromObject(null).people], []);
  assert.deepEqual([...pc.loadFromObject({ people: 'not an array' }).people], []);
});

test('resolvePath handles the evidence path forms (data-model.md §7)', () => {
  pc.loadFromObject(SAMPLE);
  assert.equal(pc.resolvePath('people[0].relation'), '娘');
  assert.equal(pc.resolvePath('schedule[1].what'), '訪問リハビリ');
  assert.equal(pc.resolvePath('interests[0]'), '電車');
  assert.equal(pc.resolvePath('schedule[99]'), undefined, 'out of range is unverifiable');
  assert.equal(pc.resolvePath('nope.nope'), undefined);
  assert.equal(pc.resolvePath(''), undefined);
});

test('loadFixture rejects ids that could escape app/context/ (FR-005)', async () => {
  const never = () => { throw new Error('fetch must not be called for an invalid id'); };
  for (const bad of ['../secret', 'a/b', '/etc/passwd', '..', '', 'x'.repeat(100)]) {
    await assert.rejects(() => pc.loadFixture(bad, never), /invalid fixture id/);
  }
});

test('loadFixture reads only from app/context/', async () => {
  let requested = null;
  const fakeFetch = async (url) => {
    requested = url;
    return { ok: true, json: async () => SAMPLE };
  };
  await pc.loadFixture('sample-01', fakeFetch);
  assert.equal(requested, 'context/sample-01.json');
});

test('clearPersonalContext discards everything', () => {
  pc.loadFromObject(SAMPLE);
  pc.clearPersonalContext();
  assert.equal(pc.getPersonalContext(), null);
});

test('the shipped sample fixture is well-formed and carries its warning note', () => {
  assert.equal(typeof SAMPLE._note, 'string');
  assert.match(SAMPLE._note, /SYNTHETIC/i);
  for (const key of ['people', 'places', 'schedule', 'interests', 'topics']) {
    assert.ok(Array.isArray(SAMPLE[key]), `sample-01.json is missing ${key}`);
  }
});


test('real participant context can be loaded from a local File-like object in memory only', async () => {
  pc.clearPersonalContext();
  const file = {
    async text() {
      return JSON.stringify({ people: [{ name: '端末内だけの名前', relation: '家族' }] });
    },
  };
  const loaded = await pc.loadFromFile(file);
  assert.equal(loaded.people[0].name, '端末内だけの名前');
  assert.equal(pc.hasPersonalContext(), true);
});

test('local File loading rejects invalid JSON without retaining it', async () => {
  pc.clearPersonalContext();
  await assert.rejects(
    pc.loadFromFile({ async text() { return '{broken'; } }),
    /invalid JSON/,
  );
  assert.equal(pc.hasPersonalContext(), false);
});
