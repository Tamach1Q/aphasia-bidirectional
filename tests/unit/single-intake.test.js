// The single-door invariant: ALL captured text enters through app/capture/intake.js.
//
// This exists because the claim "an injected turn is indistinguishable from an ASR turn
// downstream" (FR-043) is only true if there IS one downstream. If ASR reaches the session
// by its own route, the injected path tests a road no participant drives, and every browser
// test built on it proves less than it appears to.
//
// Reviewing for this by eye does not work — the bypass is one plausible-looking line.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { stripComments } from './_source.js';

const APP = fileURLToPath(new URL('../../app/', import.meta.url));

/** Source files under app/, excluding data and assets. */
function jsFiles(dir = APP, acc = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === 'context' || name === 'fixtures' || name === 'icons') continue;
      jsFiles(full, acc);
    } else if (name.endsWith('.js')) {
      acc.push(full);
    }
  }
  return acc;
}

/** Strip comments so a mention in prose is not mistaken for a call. */
function code(file) {
  return stripComments(readFileSync(file, 'utf8'), file);
}

const rel = (f) => path.relative(APP, f);

test('only the capture layer calls session.appendTurn (single-door invariant)', () => {
  const offenders = [];
  for (const file of jsFiles()) {
    const r = rel(file);
    if (r === 'core/session.js') continue;        // defines it
    if (r === 'capture/intake.js') continue;      // the one permitted caller
    if (/\.\s*appendTurn\s*\(/.test(code(file))) offenders.push(r);
  }
  assert.deepEqual(
    offenders, [],
    `these bypass capture/intake.js and append turns directly: ${offenders.join(', ')}`,
  );
});

test('capture/inject.js reaches the session only through intake', () => {
  const src = code(path.join(APP, 'capture/inject.js'));
  assert.equal(
    /session\s*\.\s*appendTurn\s*\(/.test(src), false,
    'inject.js must submit through intake, not append directly',
  );
  assert.match(src, /intake\.submitTurn\s*\(/);
});

test('app.js reaches the session only through intake', () => {
  const src = code(path.join(APP, 'app.js'));
  assert.equal(
    /sessionStore\s*\.\s*appendTurn\s*\(/.test(src), false,
    'app.js must call intake.submitTurn, not sessionStore.appendTurn',
  );
  assert.match(src, /intake\.submitTurn\s*\(/);
});

test('interim text goes through the single door, and only a listener paints the strip', () => {
  // The recognition handler now lives in capture/asr.js. The invariant is unchanged:
  // interim reaches the strip only by way of intake.
  const asrSrc = code(path.join(APP, 'capture/asr.js'));
  const appSrc = code(path.join(APP, 'app.js'));
  assert.match(asrSrc, /intake\.submitInterim\s*\(/, 'ASR interim must go through intake');
  assert.match(appSrc, /intake\.onInterim\s*\(/, 'the strip must be painted from the intake listener');
});

test('the capture layer touches no DOM — which is why it is testable at all', () => {
  // Stronger than the rule it replaces. If a capture module could paint, it could paint
  // from inside a recognition handler, and the single-door property would be bypassable
  // without any call to session.appendTurn showing up.
  for (const rel of ['capture/asr.js', 'capture/intake.js', 'capture/inject.js']) {
    const src = code(path.join(APP, rel));
    for (const forbidden of ['document.', 'setPartnerTranscript', 'innerHTML', 'getElementById']) {
      assert.equal(
        src.includes(forbidden), false,
        `${rel} references ${forbidden}; capture must report through callbacks, not draw`,
      );
    }
  }
});

test('asr.js never fabricates a transcript when recognition is unavailable', () => {
  // The superseded implementation showed an invented partner utterance here. Under the
  // new model that text would become a Turn, enter the context store, and go on to feed
  // hypothesis generation — words nobody said, cited as evidence.
  const src = code(path.join(APP, 'capture/asr.js'));
  assert.match(src, /reason:\s*'unavailable'/, 'unavailability must be reported, not papered over');
  assert.equal(
    /submitTurn\s*\(\s*\{[^}]*text:\s*['"][^'"]/.test(src), false,
    'no literal text may be submitted as a turn',
  );
});

test('no consumer branches on turn source (FR-043)', () => {
  const offenders = [];
  for (const file of jsFiles()) {
    const r = rel(file);
    if (r === 'capture/inject.js') continue;      // sets the value
    if (/['"]injected['"]\s*(===|!==|==|!=)/.test(code(file))) offenders.push(r);
    if (/(===|!==|==|!=)\s*['"]injected['"]/.test(code(file))) offenders.push(r);
  }
  assert.deepEqual(
    [...new Set(offenders)], [],
    'branching on source makes injected turns distinguishable and voids the FR-043 test path',
  );
});
