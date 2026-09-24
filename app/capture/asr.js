// Speech recognition — both capture modes.
//
// Two modes with different lifetimes:
//   partner     continuous, runs for the whole session, restarts itself on end
//   expressive  one utterance, started and finished by the person
//
// This module touches no DOM. It submits through capture/intake.js like every other
// source and reports state through callbacks, so the view layer decides what to draw.
// Keeping it DOM-free is also what makes the state machine testable in node.
//
// Two rules it exists to hold:
//
//   FR-039  When ai is off, NO recognition object is ever constructed. Browser recognition
//           may be implemented as a remote service, so leaving it running would transmit
//           participant audio during a condition that claims to be assistance-free.
//
//   Never fabricate. If recognition is unavailable, say so. Inventing a plausible partner
//           utterance would put words no one said into the context store, where they would
//           go on to feed hypothesis generation.

import * as intake from './intake.js';

// ---------------------------------------------------------------- availability

let RecognitionCtor;

/** Resolved lazily so tests can substitute one, and so `ai=off` can skip it entirely. */
function resolveCtor() {
  if (RecognitionCtor !== undefined) return RecognitionCtor;
  RecognitionCtor = (typeof window !== 'undefined'
    && (window.SpeechRecognition || window.webkitSpeechRecognition)) || null;
  return RecognitionCtor;
}

export function isAvailable() {
  return Boolean(resolveCtor());
}

/** Test seam. Pass null to simulate a browser without recognition. */
export function __setRecognitionForTests(ctor) {
  RecognitionCtor = ctor;
}

export function friendlyError(error) {
  return ({
    'not-allowed': 'マイクが使えないようです。文字でも入力できます。',
    'no-speech': '声を聞き取れませんでした。もう一度試せます。',
    network: '音声を処理できませんでした。もう一度試してください。',
  })[error] || '音声を使えませんでした。文字でも入力できます。';
}

// ---------------------------------------------------------------- partner (continuous)

let partnerRec = null;
let partnerGeneration = 0;
let partnerWanted = false;

export function stopPartner() {
  partnerWanted = false;
  // Bumping the generation invalidates any handler still in flight, so a late result
  // cannot resurrect a stopped session. Carried over from the original implementation.
  partnerGeneration += 1;
  if (partnerRec) {
    partnerRec.onresult = null;
    partnerRec.onerror = null;
    partnerRec.onend = null;
    try { partnerRec.stop(); } catch (_) { /* already stopped */ }
    partnerRec = null;
  }
}

/**
 * @returns {{started: boolean, reason?: string}} `reason` is 'ai-off' or 'unavailable'
 *          when nothing was started. The caller reports it; this module never invents text.
 */
export function startPartner({ enabled = true, onError = () => {}, onLatency = () => {} } = {}) {
  if (!enabled) return { started: false, reason: 'ai-off' };   // FR-039 — no construction
  if (!resolveCtor()) return { started: false, reason: 'unavailable' };
  if (partnerWanted && partnerRec) return { started: true };

  stopPartner();
  partnerWanted = true;
  const generation = ++partnerGeneration;
  const Ctor = resolveCtor();
  partnerRec = new Ctor();
  partnerRec.lang = 'ja-JP';
  partnerRec.continuous = true;
  partnerRec.interimResults = true;

  let started = now();
  partnerRec.onresult = (event) => {
    if (generation !== partnerGeneration) return;
    let finalText = '';
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const line = event.results[i][0].transcript;
      if (event.results[i].isFinal) finalText += line; else interim += line;
    }
    if (interim) intake.submitInterim(interim, 'partner');
    if (finalText) {
      onLatency('asr: partner transcription', started, finalText);
      intake.submitTurn({ speaker: 'partner', text: finalText, source: 'asr' });
      started = now();
    }
  };
  partnerRec.onerror = (event) => {
    if (generation !== partnerGeneration) return;
    onError(friendlyError(event.error), event.error);
  };
  partnerRec.onend = () => {
    if (generation !== partnerGeneration) return;
    // Continuous mode ends on its own after a pause; restart while the session wants it.
    if (partnerWanted) { try { partnerRec.start(); } catch (_) { /* racing a stop */ } }
  };

  try { partnerRec.start(); } catch (_) {
    stopPartner();
    return { started: false, reason: 'start-failed' };
  }
  return { started: true };
}

/** Pause while the person speaks; the session is still open. */
export function pausePartner() {
  if (!partnerRec) return false;
  const wanted = partnerWanted;
  stopPartner();
  partnerWanted = false;
  return wanted;
}

export function isPartnerRunning() {
  return Boolean(partnerRec) && partnerWanted;
}

// ---------------------------------------------------------------- expressive (one-shot)

let exprRec = null;
let exprGeneration = 0;
let exprPartial = '';
let exprActive = false;

export function stopExpressiveRecognition() {
  exprGeneration += 1;
  exprActive = false;
  if (exprRec) {
    exprRec.onresult = null;
    exprRec.onerror = null;
    try { exprRec.stop(); } catch (_) { /* already stopped */ }
    exprRec = null;
  }
}

export function startExpressive({
  enabled = true, onPartial = () => {}, onFinal = () => {},
  onError = () => {}, onLatency = () => {},
} = {}) {
  if (!enabled) return { started: false, reason: 'ai-off' };   // FR-039
  if (!resolveCtor()) return { started: false, reason: 'unavailable' };

  stopExpressiveRecognition();
  exprActive = true;
  exprPartial = '';
  const generation = ++exprGeneration;
  const Ctor = resolveCtor();
  exprRec = new Ctor();
  exprRec.lang = 'ja-JP';
  exprRec.continuous = false;
  exprRec.interimResults = true;

  const started = now();
  exprRec.onresult = (event) => {
    if (generation !== exprGeneration || !exprActive) return;
    const text = event.results[0][0].transcript;
    exprPartial = text;
    onPartial(text);
    if (event.results[0].isFinal) {
      onLatency('asr: expressive fragment', started, text);
      finishExpressive(text, onFinal);
    }
  };
  exprRec.onerror = (event) => {
    if (generation !== exprGeneration) return;
    stopExpressiveRecognition();
    onError(friendlyError(event.error), event.error);
  };

  try { exprRec.start(); } catch (_) {
    stopExpressiveRecognition();
    return { started: false, reason: 'start-failed' };
  }
  return { started: true };
}

/**
 * Settle the person's fragment. Submits through intake like every other source.
 *
 * FR-013: this does NOT require the person to review or correct the result first.
 */
export function finishExpressive(text, onFinal = () => {}) {
  if (!exprActive) return null;
  exprActive = false;
  stopExpressiveRecognition();
  const fragment = String(text ?? exprPartial ?? '').trim();
  const turn = fragment
    ? intake.submitTurn({ speaker: 'person', text: fragment, source: 'asr' })
    : null;
  onFinal(fragment, turn);
  return turn;
}

export function isExpressiveActive() {
  return exprActive;
}

export function getExpressivePartial() {
  return exprPartial;
}

// ---------------------------------------------------------------- misc

function now() {
  return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
}

/** Test-only. */
export function __resetForTests() {
  stopPartner();
  stopExpressiveRecognition();
  RecognitionCtor = undefined;
  partnerGeneration = 0;
  exprGeneration = 0;
  exprPartial = '';
}
