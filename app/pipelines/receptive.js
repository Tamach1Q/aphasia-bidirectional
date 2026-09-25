// Receptive pipeline — Partner → Person (§11, §A3).
//
//   ASR final ──▶ chunker ──▶ GATE (local) ──┬── skip ──▶ nothing renders
//                                            └── pass ──▶ Worker op=simplify
//                                                            ↓
//                                                     safety, mode='restate'
//                                                            ↓
//                                                     settled display
//
// The gate runs BEFORE any network call. An ordinary utterance costs nothing — no request,
// no latency, no replacement of the largest element on screen.
//
// Safety runs on what comes BACK, never as part of the request, and a failing
// simplification is SUPPRESSED rather than repaired: the person keeps the raw transcript,
// which is honest, instead of a rewrite that might carry the same error.

import * as gate from './gate.js';
import * as chunker from './chunker.js';
import * as safety from '../safety/index.js';

/** Replaceable so tests can assert the request body and count calls. */
let transport = null;

export function setTransport(fn) {
  transport = fn;
}

/**
 * Handle one settled partner turn.
 *
 * @param {{id?: string, text: string}} turn
 * @param {{force?: boolean, receptiveEnabled?: boolean, aiEnabled?: boolean, level?: string}} options
 *        `force` is `[短く]` — simplify regardless of the gate (FR-009).
 * @returns {Promise<{chunk: Object|null, simplified: Object|null, skipped: string|null}>}
 */
export async function handleTurn(turn, options = {}) {
  const {
    force = false, receptiveEnabled = true, aiEnabled = true, level = 'standard',
  } = options;

  const text = String(turn?.text ?? '').trim();
  if (!text) return { chunk: null, simplified: null, skipped: 'empty' };

  const chunk = chunker.accept(text, { turnId: turn?.id ?? null });

  // A0 baseline and B0 both stop here: the turn is recorded, nothing is produced.
  if (!aiEnabled) return { chunk, simplified: null, skipped: 'ai-off' };
  if (!receptiveEnabled) return { chunk, simplified: null, skipped: 'receptive-off' };

  const decision = gate.evaluate(text);
  if (!decision.pass && !force) {
    return { chunk, simplified: null, skipped: 'gated-out', gate: decision };
  }

  if (!transport) return { chunk, simplified: null, skipped: 'no-transport' };

  let response;
  try {
    response = await transport({ op: 'simplify', text, level });
  } catch (err) {
    // Never fabricate a simplification. The transcript remains, which is honest.
    return { chunk, simplified: null, skipped: 'request-failed', error: String(err && err.message) };
  }
  if (!response || response.error || !response.meaning) {
    return { chunk, simplified: null, skipped: 'no-result', error: response?.error ?? null };
  }

  // Judge the WHOLE rendered block. A structured simplification splits one utterance
  // across lines, so a line on its own can look like it dropped a negation that is sitting
  // in the next one (research.md §9). What the person sees is the block.
  const rendered = [response.meaning, ...(response.structure || []), ...(response.options || [])]
    .filter(Boolean).join('\n');

  const verdict = safety.check(rendered, text, { mode: 'restate' });
  if (!verdict.ok) {
    return {
      chunk, simplified: null, skipped: 'suppressed', violations: verdict.violations, gate: decision,
    };
  }

  return {
    chunk,
    simplified: {
      meaning: response.meaning,
      structure: response.structure || [],
      options: response.options || [],
      forTurnId: turn?.id ?? null,
      revises: chunk?.revises ?? null,
    },
    skipped: null,
    gate: decision,
  };
}

export function reset() {
  chunker.reset();
}
