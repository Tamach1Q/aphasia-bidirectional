// Phase 4 migration invariant: the superseded expressive flow is actually gone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripComments } from './_source.js';

const app = stripComments(
  readFileSync(new URL('../../app/app.js', import.meta.url), 'utf8')
    + '\n' + readFileSync(new URL('../../app/runtime.js', import.meta.url), 'utf8'),
  'app bootstrap + runtime',
);
const runtime = stripComments(
  readFileSync(new URL('../../app/runtime.js', import.meta.url), 'utf8'),
  'app/runtime.js',
);
const css = readFileSync(new URL('../../app/styles.css', import.meta.url), 'utf8');
const html = readFileSync(new URL('../../app/index.html', import.meta.url), 'utf8');

test('clarification and direct-candidate machinery is absent (T086)', () => {
  for (const name of [
    'ambiguities', 'nextClarification', 'showClarification', 'noneOfThese', 'choicesFor',
    'contentChoicesFor', 'contentClause', 'buildMessage', 'timeWord', 'topicWord',
    'personMention', 'directCandidates', 'showDirectCandidates',
  ]) {
    assert.equal(new RegExp('\\b' + name + '\\b').test(app), false, name + ' must be deleted');
  }
});

test('modeA and the old flat state object are absent (T087)', () => {
  assert.equal(/\bmodeA\b/.test(app), false);
  assert.equal(/\bconst\s+state\s*=/.test(app), false);
  assert.equal(/\bstate\./.test(app), false);
});

test('old confirmation/output/speech surface is absent (T088)', () => {
  for (const name of ['showConfirm', 'showOutput', 'speakConfirmed']) {
    assert.equal(new RegExp('\\b' + name + '\\b').test(app), false);
  }
  assert.equal(html.includes('outputOverlay'), false);
  assert.equal(css.includes('rotate(180deg)'), false);
});

test('shared DOM mechanics live in views/dom.js (T089)', () => {
  assert.match(runtime, /from '\.\/views\/dom\.js'/);
  assert.equal(/function\s+setMain\b/.test(app), false);
  assert.equal(/function\s+escapeHtml\b/.test(app), false);
});
