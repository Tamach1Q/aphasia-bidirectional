// Expressive pipeline — Person → Partner (§13, §A4).
//
// fragment → op=hypotheses → safety(mode=interpret) → evidence verification → hint store
//
// The final arrow is DATA ONLY. This module never renders and never imports the hint-store
// reader. A generated hypothesis may sit here indefinitely without interrupting anyone.

import * as session from '../core/session.js';
import * as personalContext from '../core/personal-context.js';
import * as safety from '../safety/index.js';
import { verifyHypotheses } from '../evidence/verify.js';
import { clearHints, setHypotheses, setUnknown } from '../core/hint-store.js';

let transport = null;

export function setTransport(fn) {
  transport = fn;
}

/**
 * Construct exactly what is sent to the model. Config is enforced here rather than by
 * sending extra context and asking downstream code to ignore it (FR-040).
 */
export function buildRequest(fragmentTurn, config = session.getConfig() || {}) {
  const fragment = {
    id: String(fragmentTurn && fragmentTurn.id || ''),
    text: String(fragmentTurn && fragmentTurn.text || '').trim(),
  };
  if (!fragment.id || !fragment.text) return null;

  const body = { op: 'hypotheses', fragment };
  const ctx = ['none', 'session', 'personal'].includes(config.ctx) ? config.ctx : 'personal';

  if (ctx === 'session' || ctx === 'personal') {
    body.shortTerm = session.getTurns()
      .filter((turn) => turn.id !== fragment.id)
      .map((turn) => ({ id: turn.id, speaker: turn.speaker, text: turn.text }));
    body.confirmed = session.getConfirmed()
      .map((item) => ({ id: item.id, text: item.text }));
  }

  if (ctx === 'personal') {
    // C2 contains all four fields even when no personal context was loaded. An explicit
    // empty object is different from silently changing the research condition.
    body.personalContext = personalContext.getPersonalContext() || {};
  }

  return body;
}

function leafText(value, out) {
  if (value === null || value === undefined) return;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    const text = String(value).trim();
    if (text) out.push(text);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) leafText(item, out);
    return;
  }
  if (typeof value === 'object') {
    // Values only. Object keys and ids are schema, not information the lexical Safety
    // checks should accidentally match.
    for (const item of Object.values(value)) leafText(item, out);
  }
}

/**
 * OQ-11: source text is a projection of the EXACT request the model received.
 * IDs and field names are deliberately omitted; only semantic/textual values enter Safety.
 */
export function groundingText(request) {
  if (!request || typeof request !== 'object') return '';
  const values = [];
  leafText(request.fragment && request.fragment.text, values);
  for (const turn of request.shortTerm || []) leafText(turn && turn.text, values);
  for (const item of request.confirmed || []) leafText(item && item.text, values);
  if ('personalContext' in request) leafText(request.personalContext, values);
  return values.join('\n');
}

/**
 * Generate and store hypotheses for one settled person turn.
 *
 * @returns a diagnostic result for tests/logging. No returned value is rendered here.
 */
export async function handleFragment(fragmentTurn, options = {}) {
  const config = options.config || session.getConfig() || {};
  const generation = clearHints();

  const body = buildRequest(fragmentTurn, config);
  if (!body) {
    setUnknown(fragmentTurn && fragmentTurn.id || null, generation);
    return { state: 'unknown', skipped: 'empty', generation };
  }

  if (config.ai === 'off') {
    // A0: no Worker request. clearHints() above already left the store empty.
    return { state: 'empty', skipped: 'ai-off', generation };
  }

  if (!transport) {
    setUnknown(body.fragment.id, generation);
    return { state: 'unknown', skipped: 'no-transport', generation, request: body };
  }

  let response;
  try {
    response = await transport(body);
  } catch (err) {
    setUnknown(body.fragment.id, generation);
    return {
      state: 'unknown',
      skipped: 'request-failed',
      generation,
      request: body,
      error: String(err && err.message || err),
    };
  }

  const raw = Array.isArray(response && response.hypotheses)
    ? response.hypotheses.slice(0, 3)
    : [];

  if (!response || response.error || response.result === 'unknown' || raw.length === 0) {
    setUnknown(body.fragment.id, generation);
    return {
      state: 'unknown',
      skipped: response && response.error ? 'request-error' : null,
      generation,
      request: body,
      error: response && response.error || null,
    };
  }

  const source = groundingText(body);
  const safetyResult = safety.filter(raw, source, {
    mode: 'interpret',
    confirmed: body.confirmed || [],
    personalContext: body.personalContext || null,
  });

  if (!safetyResult.kept.length) {
    setUnknown(body.fragment.id, generation);
    return {
      state: 'unknown',
      generation,
      request: body,
      suppressed: safetyResult.suppressed,
      allSuppressed: safetyResult.allSuppressed,
    };
  }

  // Verification does not vouch for Safety and Safety does not vouch for citations.
  // Invalid pointers disappear; candidates that already passed Safety remain.
  const verified = verifyHypotheses(safetyResult.kept, { request: body });
  const stored = setHypotheses(body.fragment.id, verified.hypotheses, generation);

  return {
    state: stored ? 'ready' : 'stale',
    generation,
    request: body,
    hypotheses: stored ? verified.hypotheses : [],
    evidenceFailures: verified.failures,
    suppressed: safetyResult.suppressed,
  };
}


/** Session/reset lifecycle: invalidate any in-flight response and empty held hints. */
export function reset() {
  return clearHints();
}
