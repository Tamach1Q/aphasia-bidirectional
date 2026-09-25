// Phase 7 / T106-T108 — visuals are local and only attached when unambiguous.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const names = ['mic', 'keyboard', 'reset', 'stop', 'repeat', 'slow', 'short', 'different'];

test('all operational/support icons are local SVG files with no runtime external asset', () => {
  for (const name of names) {
    const svg = readFileSync(new URL('../../app/icons/' + name + '.svg', import.meta.url), 'utf8');
    assert.match(svg, /^<svg/);
    assert.equal(/https?:\/\//.test(svg), false, name + ' must not load an external asset');
  }
});

test('the app shell references local operational SVGs', () => {
  const html = readFileSync(new URL('../../app/index.html', import.meta.url), 'utf8');
  for (const name of ['mic', 'keyboard', 'reset', 'stop']) {
    assert.ok(html.includes('icons/' + name + '.svg'), name + ' must be used from app/icons/');
  }
  assert.equal(/<svg[\s>]/.test(html), false, 'operational icons should have been extracted from index.html');
});

test('four support requests pair text with their distinct local icons', () => {
  const src = readFileSync(new URL('../../app/views/person.js', import.meta.url), 'utf8');
  assert.match(src, /icon\.src = 'icons\/' \+ request\.kind \+ '\.svg'/);
  for (const kind of ['repeat', 'slow', 'short', 'different']) {
    assert.ok(readFileSync(new URL('../../app/icons/' + kind + '.svg', import.meta.url), 'utf8'));
  }
});

test('arbitrary meaning options do not receive a vague generic icon (T108)', () => {
  const src = readFileSync(new URL('../../app/views/person.js', import.meta.url), 'utf8');
  const start = src.indexOf('if (entry.options.length)');
  const end = src.indexOf('return block;', start);
  assert.ok(start >= 0 && end > start);
  const optionsBlock = src.slice(start, end);
  assert.equal(optionsBlock.includes("createElement('img')"), false,
    'a model-authored arbitrary meaning option has no guaranteed unambiguous pictogram');
});
