// Partner-facing hypothesis store.
//
// This module is deliberately plain data. Writing here never renders, announces, or signals
// that a hypothesis exists. The partner view is the only production reader (FR-019, FR-022).

let generation = 0;
let hypothesisCounter = 0;

let store = {
  state: 'empty',
  fragmentTurnId: null,
  hypotheses: [],
  producedAt: null,
};

function freezeEvidence(items) {
  return Object.freeze((Array.isArray(items) ? items : []).map((item) =>
    Object.freeze({ ...item })));
}

function normalizeHypotheses(items) {
  return Object.freeze((Array.isArray(items) ? items : [])
    .slice(0, 3)
    .map((item) => Object.freeze({
      id: item && item.id ? String(item.id) : 'h' + (++hypothesisCounter),
      text: String(item && item.text || '').trim(),
      evidence: freezeEvidence(item && item.evidence),
    }))
    .filter((item) => item.text));
}

// Starts a new generation and empties the visible-to-partner snapshot.
// Returning the generation lets the async pipeline tag its response without importing
// the reader. Calling this on reset also invalidates any response still in flight.
export function clearHints() {
  generation += 1;
  store = {
    state: 'empty',
    fragmentTurnId: null,
    hypotheses: [],
    producedAt: null,
  };
  return generation;
}

export function setHypotheses(fragmentTurnId, hypotheses, responseGeneration) {
  if (responseGeneration !== generation) return false;
  const normalized = normalizeHypotheses(hypotheses);
  if (!normalized.length) return setUnknown(fragmentTurnId, responseGeneration);
  store = {
    state: 'ready',
    fragmentTurnId: fragmentTurnId || null,
    hypotheses: normalized,
    producedAt: Date.now(),
  };
  return true;
}

export function setUnknown(fragmentTurnId, responseGeneration) {
  if (responseGeneration !== generation) return false;
  store = {
    state: 'unknown',
    fragmentTurnId: fragmentTurnId || null,
    hypotheses: [],
    producedAt: Date.now(),
  };
  return true;
}

// Production reader. Import invariant: views/partner.js only.
export function getHintSnapshot() {
  return Object.freeze({
    state: store.state,
    fragmentTurnId: store.fragmentTurnId,
    hypotheses: Object.freeze([...store.hypotheses]),
    producedAt: store.producedAt,
  });
}

// Test support only.
export function __resetForTests() {
  generation = 0;
  hypothesisCounter = 0;
  store = {
    state: 'empty',
    fragmentTurnId: null,
    hypotheses: [],
    producedAt: null,
  };
}
