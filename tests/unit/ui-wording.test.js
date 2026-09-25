// Phase 5 / T096-T097 — no obsolete blame/failure surface remains.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripComments } from './_source.js';

const app = stripComments(readFileSync(new URL('../../app/app.js', import.meta.url), 'utf8'), 'app/app.js');
const person = readFileSync(new URL('../../app/views/person.js', import.meta.url), 'utf8');
const partner = readFileSync(new URL('../../app/views/partner.js', import.meta.url), 'utf8');

test('old dont-understand and fallback machinery is gone (T097)', () => {
  assert.equal(/\bshowDontUnderstand\b/.test(app), false);
  assert.equal(/\bshowFallback\b/.test(app), false);
  assert.equal(app.includes('どれも違います'), false);
});

test('support controls name the requested repair rather than blaming the person (FR-032)', () => {
  for (const label of ['もう一回', 'ゆっくり', '短く', 'ちがう']) {
    assert(person.includes(label));
  }
  assert.equal(person.includes('わかりません'), false);
  assert.equal(partner.includes('話せません'), false);
  assert.equal(partner.includes('理解できません'), false);
});
