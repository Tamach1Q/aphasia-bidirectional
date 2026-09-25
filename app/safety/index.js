// Meaning safety — between generation and display (product.md §17, §A6, FR-026–FR-030).
//
// Position matters. This runs on what comes BACK from the model, on every path that
// produces language: receptive simplification and expressive hypotheses alike. It is
// never part of the request, and never between the pipelines and the Worker.
//
// Two structural constraints, both deliberate:
//
//   Local and deterministic (FR-029). A check is never another call to the model that
//   produced the candidate — a model that inverted a polarity will not reliably notice
//   that it did. It would inherit the exact error class it is meant to catch. Phase 1
//   makes no network call from here, which also keeps the check off the latency budget.
//
//   Suppress, never repair (FR-028). A failing candidate is dropped, not rewritten.
//   Rewriting means generating again, which reintroduces the same risk. When every
//   candidate is suppressed the result becomes `unknown`, which the product already
//   treats as an ordinary path (§15) rather than an error.
//
// Calibration bias (OQ-10): toward OVER-suppression. A suppressed candidate degrades to
// the fallback; a missed polarity inversion reaches a person and may concern medication
// or consent. The two errors are not symmetric, so the threshold is not either.

import * as polarity from './checks/polarity.js';
import * as person from './checks/person.js';
import * as time from './checks/time.js';
import * as number from './checks/number.js';
import * as action from './checks/action.js';
import * as medication from './checks/medication.js';
import * as consent from './checks/consent.js';
import { logSafetySuppressions } from '../core/telemetry.js';

const CHECKS = [polarity, person, time, number, action, medication, consent];

export const CHECK_NAMES = CHECKS.map((c) => c.name);

/**
 * Two modes, because the two pipelines make different claims about their output.
 *
 *   'restate'   simplify — the output claims to say the SAME THING more simply. Introducing
 *               a number or a day that was not said is fabrication.
 *
 *   'interpret' hypotheses — the output claims to be a POSSIBLE READING of a fragment.
 *               Resolving 「じゅう」 to 10時, or 「さくら」 to さくら台病院, is the product
 *               working. Refusing it would suppress the feature itself.
 *
 * Calibration against real Stage 0 output showed this is not a nicety: applying the
 * restatement checks to hypotheses suppressed correct output at a high rate — including
 * every f08 answer, the fixture that exists to prove the model resists anchoring.
 *
 * What does NOT vary by mode: polarity, action, medication and consent. Inverting an
 * instruction or asserting agreement is never legitimate, whatever the output claims to be.
 */
export const MODES = ['restate', 'interpret'];

function checksFor(mode) {
  return CHECKS.filter((c) => (c.modes || MODES).includes(mode));
}

/**
 * @param {string} candidateText generated text
 * @param {string} sourceText    what it was generated from
 * @param {{mode?: 'restate'|'interpret', confirmed?: Array, personalContext?: Object}} [context]
 * @returns {{ok: boolean, violations: Array<{check: string, detail: string}>}}
 */
export function check(candidateText, sourceText, context = {}) {
  // Default to the stricter mode. A caller that forgets to say what it is producing gets
  // restatement rules, which suppress more — the safe direction to be wrong in.
  const mode = context.mode === 'interpret' ? 'interpret' : 'restate';
  const violations = [];

  // check() must be TOTAL: it never throws. Anything that cannot be evaluated is
  // suppressed, because a throw propagating out of here would reach a caller that may
  // handle it by carrying on — which is failing open on the one path that must not.
  let candidate;
  let source;
  try {
    candidate = String(candidateText ?? '');
    source = String(sourceText ?? '');
  } catch (err) {
    return {
      ok: false,
      violations: [{ check: 'input', detail: `input could not be read: ${err && err.message}` }],
    };
  }

  if (!candidate.trim()) {
    return { ok: false, violations: [{ check: 'empty', detail: 'candidate is empty' }] };
  }

  for (const c of checksFor(mode)) {
    let result;
    try {
      result = c.check(candidate, source, context);
    } catch (err) {
      // A throwing check suppresses. Failing open here would mean an unchecked candidate
      // reaching a person because of a bug in the checker.
      result = { ok: false, detail: `check threw: ${err && err.message}` };
    }
    if (!result.ok) violations.push({ check: c.name, detail: result.detail || 'violation' });
  }

  return { ok: violations.length === 0, violations };
}

/**
 * Filter a set of candidates. Returns the survivors and a log of what was suppressed.
 *
 * An empty `kept` is a NORMAL outcome, not an error: the caller turns it into `unknown`
 * and the fallback path (FR-028, §15.3).
 *
 * @param {Array<{text: string}>} candidates
 */
export function filter(candidates, sourceText, context = {}) {
  const kept = [];
  const suppressed = [];
  for (const c of candidates || []) {
    const result = check(c && c.text, sourceText, context);
    if (result.ok) kept.push(c);
    else suppressed.push({ candidate: c, violations: result.violations });
  }
  logSafetySuppressions(suppressed, context.mode);
  return { kept, suppressed, allSuppressed: Boolean(candidates?.length) && kept.length === 0 };
}
