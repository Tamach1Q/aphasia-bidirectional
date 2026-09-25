// Phase 4 / T072 — structural enforcement of the hint-store read boundary.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { stripComments } from './_source.js';

const APP = fileURLToPath(new URL('../../app/', import.meta.url));

function jsFiles(dir = APP, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === 'context' || name === 'fixtures' || name === 'icons') continue;
      jsFiles(full, acc);
    } else if (name.endsWith('.js')) acc.push(full);
  }
  return acc;
}

function code(file) {
  return stripComments(readFileSync(file, 'utf8'), file);
}

const rel = (file) => path.relative(APP, file).replaceAll(path.sep, '/');

test('getHintSnapshot is referenced in app code only by views/partner.js', () => {
  const offenders = [];
  for (const file of jsFiles()) {
    const r = rel(file);
    if (r === 'core/hint-store.js' || r === 'views/partner.js') continue;
    if (/\bgetHintSnapshot\b/.test(code(file))) offenders.push(r);
  }
  assert.deepEqual(offenders, []);
});

test('views/person.js imports nothing from core/hint-store.js', () => {
  const src = code(path.join(APP, 'views/person.js'));
  const imports = src.match(/^\s*import[\s\S]*?from\s*['"][^'"]+['"];?/gm) || [];
  assert.equal(
    imports.some((line) => line.includes('hint-store.js')),
    false,
    'person view must never read or write the hypothesis store',
  );
});

test('expressive pipeline may import writers but never the reader', () => {
  const file = path.join(APP, 'pipelines/expressive.js');
  if (!existsSync(file)) return;
  const src = code(file);
  assert.equal(/\bgetHintSnapshot\b/.test(src), false);
  assert.match(src, /\b(setHypotheses|setUnknown|clearHints)\b/);
});
