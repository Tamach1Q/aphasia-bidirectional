// T114 — app.js is a composition bootstrap only. Runtime orchestration lives in runtime.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripComments } from './_source.js';

const app = stripComments(
  readFileSync(new URL('../../app/app.js', import.meta.url), 'utf8'),
  'app/app.js',
).trim();
const runtime = stripComments(
  readFileSync(new URL('../../app/runtime.js', import.meta.url), 'utf8'),
  'app/runtime.js',
);

test('app.js is bootstrap wiring only (T114)', () => {
  assert.equal(app, "import { boot } from './runtime.js';\n\nboot();");
  for (const forbidden of ['function ', 'fetch(', 'document.', 'sessionStore', 'SpeechRecognition']) {
    assert.equal(app.includes(forbidden), false, 'bootstrap contains logic: ' + forbidden);
  }
});

test('runtime owns orchestration behind one explicit boot entry point', () => {
  assert.match(runtime, /export function boot\s*\(\)/);
  assert.match(runtime, /from '\.\/capture\/intake\.js'/);
  assert.match(runtime, /from '\.\/views\/person\.js'/);
  assert.match(runtime, /from '\.\/pipelines\/expressive\.js'/);
});


test('session stop uses the full reset lifecycle rather than only stopping partner ASR', () => {
  assert.match(
    runtime,
    /function stopListening\s*\(\)\s*\{[\s\S]*?reset\(\);[\s\S]*?\}/,
    'stop must clear session data, person view state, hints, and in-flight recognition together',
  );
});


test('person-side capture can explicitly start the session before submitting a turn', () => {
  assert.match(runtime, /function ensureSessionActive\s*\(\)[\s\S]*?sessionStore\.startSession\(config\)/);
  assert.match(
    runtime,
    /function startExpressive\s*\(\)[\s\S]*?ensureSessionActive\(\);[\s\S]*?asr\.startExpressive\(/,
    'spoken expressive capture must start a session before ASR can submit a final turn',
  );
  assert.match(
    runtime,
    /typedForm'[\s\S]*?ensureSessionActive\(\);[\s\S]*?intake\.submitTurn/,
    'typed expressive capture must use the same session lifecycle',
  );
});
