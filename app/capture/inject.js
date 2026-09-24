// Injected transcript path — FR-043.
//
// A PRODUCT REQUIREMENT, not test scaffolding. The automated QA environment cannot run
// browser SpeechRecognition (task 001 stalled at needs_human twice for this reason), so
// this is how everything downstream of recognition is verified.
//
//   speech recognition itself      → manual, on a device, by a human
//   everything after recognition   → automated, through this module
//
// Contract: specs/002-context-aware-dyadic-support/contracts/injected-transcript.md
//
// Injected turns go through capture/intake.js, the same door ASR uses, so they are
// indistinguishable downstream. `source: 'injected'` is retained for research logs only;
// no pipeline, view, or safety check may branch on it.

import * as intake from './intake.js';
import * as session from '../core/session.js';
import * as personalContext from '../core/personal-context.js';

let enabled = false;

/**
 * Availability gate. Injection MUST NOT be reachable in a participant session — an
 * injected turn appearing mid-conversation would corrupt both the conversation and the
 * research record.
 */
export function enable(isEnabled) {
  enabled = Boolean(isEnabled);
  return enabled;
}

export function isEnabled() {
  return enabled;
}

function requireEnabled() {
  if (!enabled) throw new Error('inject: not enabled (use ?inject=1 or the test page)');
}

/** Append one settled turn, exactly as recognition would. */
export function turn({ speaker, text, source = 'injected' }) {
  requireEnabled();
  return intake.submitTurn({ speaker, text, source });
}

/**
 * Feed interim text. Exists so FR-010 is testable: interim content must reach the
 * transcript strip and never the settled main area, and must never create a Turn.
 */
export function interim(text, speaker = 'partner') {
  requireEnabled();
  return intake.submitInterim(text, speaker);
}

/**
 * Load a fixture from app/fixtures/ and play its turns in order.
 * Returns the fixture so a caller can read its `expect` annotations.
 */
export async function fixture(name, { fetchImpl = fetch, play = true } = {}) {
  requireEnabled();
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/i.test(String(name || ''))) {
    throw new Error(`inject: invalid fixture name "${name}"`);
  }
  const res = await fetchImpl(`fixtures/${name}.json`);
  if (!res.ok) throw new Error(`inject: fixture "${name}" not found`);
  const data = await res.json();

  if (data.personalContext) personalContext.loadFromObject(data.personalContext);
  if (play) playFixture(data);
  return data;
}

/** Play an already-loaded fixture object. Useful when a test has the data inline. */
export function playFixture(data) {
  requireEnabled();
  const turns = Array.isArray(data && data.turns) ? data.turns : [];
  const created = [];
  for (const t of turns) {
    const made = intake.submitTurn({
      speaker: t.speaker,
      text: t.text,
      source: 'injected',
    });
    if (made) created.push(made);
  }
  return created;
}

/** Clear session state between cases. */
export function reset() {
  session.stopSession();
  personalContext.clearPersonalContext();
}
