// The single door through which ALL captured text enters the system.
//
// Both speech recognition (capture/asr.js) and the injected transcript path
// (capture/inject.js) call `submitTurn` / `submitInterim`. Nothing else may append
// turns directly.
//
// This is what makes FR-043's guarantee structural rather than incidental: an injected
// turn is indistinguishable from an ASR turn downstream because there is only one path
// downstream. If injection had its own route into the pipelines, tests would pass against
// a path no participant ever exercises.
//
// See specs/002-context-aware-dyadic-support/contracts/injected-transcript.md.

import * as session from '../core/session.js';

const turnListeners = new Set();
const interimListeners = new Set();

/**
 * Settled text from either source. Appends one Turn and notifies listeners.
 * Returns the created Turn, or null if it was discarded (empty/no session).
 */
export function submitTurn({ speaker, text, source = 'asr' }) {
  const turn = session.appendTurn({ speaker, text, source });
  if (!turn) return null;
  for (const fn of turnListeners) {
    try { fn(turn); } catch (err) { console.error('[intake] turn listener failed', err); }
  }
  return turn;
}

/**
 * Interim recognition output. Goes to the transcript strip only — it MUST NOT create a
 * Turn and MUST NOT reach the settled main area (FR-002, FR-010).
 */
export function submitInterim(text, speaker = 'partner') {
  const value = String(text ?? '');
  for (const fn of interimListeners) {
    try { fn(value, speaker); } catch (err) { console.error('[intake] interim listener failed', err); }
  }
  return value;
}

export function onTurn(fn) {
  turnListeners.add(fn);
  return () => turnListeners.delete(fn);
}

export function onInterim(fn) {
  interimListeners.add(fn);
  return () => interimListeners.delete(fn);
}

/** Test-only. */
export function __resetForTests() {
  turnListeners.clear();
  interimListeners.clear();
}
