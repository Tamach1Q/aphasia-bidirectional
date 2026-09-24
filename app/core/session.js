// Conversation session: short-term turns, confirmed session context, research config.
//
// See specs/002-context-aware-dyadic-support/data-model.md §1-§3, §6, §8.
//
// This module deliberately imports NOTHING from core/hint-store.js. Confirmed meaning is
// built from a snapshot the partner view hands over, never by reading hypotheses — see
// `selectForConfirmation` / `confirmSelected` below.

export const MAX_TURNS = 6;

let turnCounter = 0;
let confirmedCounter = 0;

/** @type {{id:string, startedAt:number, turns:Array, confirmed:Array, config:Object}|null} */
let session = null;

/** Snapshot registered by the partner view; committed by the person's [はい]. */
let pendingConfirmation = null;

// ---------------------------------------------------------------- config

const CTX_VALUES = new Set(['none', 'session', 'personal']);

/**
 * Parse research conditions from a query string. data-model.md §6.
 * Unknown values fall back to the default rather than throwing — a malformed URL
 * during a session must not take the app down.
 */
export function parseConfig(search = '') {
  const q = new URLSearchParams(search);
  const ctx = q.get('ctx');
  return Object.freeze({
    ai: q.get('ai') === 'off' ? 'off' : 'on',
    receptive: q.get('receptive') === 'off' ? 'off' : 'on',
    ctx: CTX_VALUES.has(ctx) ? ctx : 'personal',
    configId: q.get('config') || null,
    inject: q.get('inject') === '1',
  });
}

// ---------------------------------------------------------------- lifecycle

export function startSession(config) {
  session = {
    id: `s${Date.now().toString(36)}`,
    startedAt: Date.now(),
    turns: [],
    confirmed: [],
    config: Object.freeze({ ...config }),
  };
  pendingConfirmation = null;
  return getSession();
}

export function stopSession() {
  session = null;
  pendingConfirmation = null;
}

export function isActive() {
  return session !== null;
}

/** Read-only view. Callers must not mutate the returned arrays. */
export function getSession() {
  if (!session) return null;
  return {
    id: session.id,
    startedAt: session.startedAt,
    turns: [...session.turns],
    confirmed: [...session.confirmed],
    config: session.config,
  };
}

export function getConfig() {
  return session ? session.config : null;
}

// ---------------------------------------------------------------- turns

/**
 * Append one SETTLED turn. data-model.md §2.
 *
 * Interim recognition results must never reach here — they belong to the transcript
 * strip only (FR-002). Empty text is discarded rather than appended.
 *
 * @returns the created turn, or null if it was discarded
 */
export function appendTurn({ speaker, text, source = 'asr' }) {
  if (!session) return null;
  if (speaker !== 'partner' && speaker !== 'person') {
    throw new Error(`appendTurn: unknown speaker "${speaker}"`);
  }
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return null;

  const turn = Object.freeze({
    id: `t${++turnCounter}`,
    speaker,
    text: trimmed,
    source,
    at: Date.now(),
  });

  session.turns.push(turn);
  // Oldest-first eviction. An evicted id may still be cited by evidence produced
  // earlier; verification treats that as unverifiable, not as an error (§7).
  while (session.turns.length > MAX_TURNS) session.turns.shift();
  return turn;
}

export function getTurns() {
  return session ? [...session.turns] : [];
}

export function findTurn(id) {
  return session ? session.turns.find((t) => t.id === id) || null : null;
}

// ---------------------------------------------------------------- confirmed

/**
 * Registered by views/partner.js when the partner picks one hypothesis to check with
 * the person. Holds `basis` so that Confirmed can be built without reading hypotheses.
 *
 * data-model.md §8.
 */
export function selectForConfirmation({ hypothesisId, text, basis = [] }) {
  if (!session) return null;
  const clean = String(text ?? '').trim();
  if (!hypothesisId || !clean) return null;
  pendingConfirmation = Object.freeze({
    hypothesisId,
    text: clean,
    basis: Object.freeze([...basis]),
  });
  return getConfirmationRequest();
}

/**
 * What the PERSON's view is allowed to see: the one sentence and its id.
 * No evidence, no alternatives, no confidence, no reasoning (FR-023).
 */
export function getConfirmationRequest() {
  if (!pendingConfirmation) return null;
  return Object.freeze({
    hypothesisId: pendingConfirmation.hypothesisId,
    text: pendingConfirmation.text,
  });
}

/**
 * The person's [はい]. THE ONLY path that appends to `confirmed` (FR-003, FR-024).
 *
 * Takes no arguments: it commits the snapshot the partner view already registered, so
 * a tap cannot introduce text that was never on screen, and this module never needs
 * access to the hint store.
 */
export function confirmSelected() {
  if (!session || !pendingConfirmation) return null;
  const item = Object.freeze({
    id: `c${++confirmedCounter}`,
    text: pendingConfirmation.text,
    basis: pendingConfirmation.basis,
    at: Date.now(),
  });
  session.confirmed.push(item);
  pendingConfirmation = null;
  return item;
}

/** The person's [ちがう]. Clears the pending snapshot; nothing is stored. */
export function rejectSelected() {
  const rejected = pendingConfirmation;
  pendingConfirmation = null;
  return rejected ? rejected.hypothesisId : null;
}

export function getConfirmed() {
  return session ? [...session.confirmed] : [];
}

export function findConfirmed(id) {
  return session ? session.confirmed.find((c) => c.id === id) || null : null;
}

// ---------------------------------------------------------------- test support

/** Reset module-level counters. Test-only; not used by the app. */
export function __resetForTests() {
  session = null;
  pendingConfirmation = null;
  turnCounter = 0;
  confirmedCounter = 0;
}
