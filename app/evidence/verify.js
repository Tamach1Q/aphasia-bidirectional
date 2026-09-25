// Local verification of model-authored evidence pointers (FR-017).
//
// Verification answers one narrow question: does this pointer resolve to text that is
// actually present in the live inputs? It does NOT decide whether the hypothesis is safe.
// Invalid pointers are dropped while the hypothesis survives; safety owns suppression.

import * as session from '../core/session.js';
import * as personalContext from '../core/personal-context.js';

function excerptOf(ref) {
  return String(ref && ref.excerpt || '').trim();
}

function textContains(text, excerpt) {
  return Boolean(excerpt) && String(text || '').includes(excerpt);
}

function personalValueContains(value, excerpt) {
  if (!excerpt || value === undefined) return false;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value).includes(excerpt);
  }
  try {
    return JSON.stringify(value).includes(excerpt);
  } catch (_) {
    return false;
  }
}

function sentInRequest(ref, request) {
  if (!request) return true;
  if (ref.source === 'turn') {
    return request.fragment?.id === ref.id
      || (request.shortTerm || []).some((turn) => turn.id === ref.id);
  }
  if (ref.source === 'confirmed') {
    return (request.confirmed || []).some((item) => item.id === ref.id);
  }
  if (ref.source === 'personalContext') {
    return Object.prototype.hasOwnProperty.call(request, 'personalContext');
  }
  return false;
}

export function verifyEvidence(ref, options = {}) {
  if (!ref || typeof ref !== 'object') return { ok: false, reason: 'malformed' };
  if (!sentInRequest(ref, options.request)) return { ok: false, reason: 'not-sent-to-model' };
  const excerpt = excerptOf(ref);
  if (!excerpt) return { ok: false, reason: 'empty-excerpt' };

  if (ref.source === 'turn') {
    const turn = session.findTurn(ref.id);
    if (!turn) return { ok: false, reason: 'turn-not-found' };
    return textContains(turn.text, excerpt)
      ? { ok: true }
      : { ok: false, reason: 'excerpt-not-in-turn' };
  }

  if (ref.source === 'confirmed') {
    const item = session.findConfirmed(ref.id);
    if (!item) return { ok: false, reason: 'confirmed-not-found' };
    return textContains(item.text, excerpt)
      ? { ok: true }
      : { ok: false, reason: 'excerpt-not-in-confirmed' };
  }

  if (ref.source === 'personalContext') {
    const value = personalContext.resolvePath(ref.path);
    if (value === undefined) return { ok: false, reason: 'personal-path-not-found' };
    return personalValueContains(value, excerpt)
      ? { ok: true }
      : { ok: false, reason: 'excerpt-not-in-personal-context' };
  }

  return { ok: false, reason: 'unknown-source' };
}

export function verifyHypotheses(hypotheses, options = {}) {
  const verified = [];
  const failures = [];

  for (const [hypothesisIndex, hypothesis] of (Array.isArray(hypotheses) ? hypotheses : []).entries()) {
    const refs = Array.isArray(hypothesis && hypothesis.evidence) ? hypothesis.evidence : [];
    const keptEvidence = [];
    for (const [evidenceIndex, ref] of refs.entries()) {
      const result = verifyEvidence(ref, options);
      if (result.ok) keptEvidence.push({ ...ref });
      else failures.push({
        hypothesisIndex,
        evidenceIndex,
        source: ref && ref.source || null,
        reason: result.reason,
      });
    }

    // The hypothesis survives even when every pointer failed. Evidence integrity and
    // hypothesis safety are separate decisions by design.
    verified.push({
      ...hypothesis,
      evidence: keptEvidence,
    });
  }

  return { hypotheses: verified, failures };
}
