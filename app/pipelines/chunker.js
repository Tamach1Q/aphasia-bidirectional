// Semantic chunk boundaries (FR-010, §11.3, §A3.2).
//
// Decides when displayed content SETTLES. Once a chunk settles it is never silently
// replaced — the person may still be reading it, and text changing under them is a
// cognitive cost the product has no reason to impose.
//
// Provisional rule (research.md §4, OQ-1): one ASR `isFinal` result is one chunk. It is
// what recognition already yields, needs no heuristic, and is the cheapest thing that
// satisfies "never rewrite settled content".
//
// Its known weakness, stated rather than discovered later: a single `isFinal` sometimes
// covers only part of a sentence, so a chunk can settle mid-thought. Confirmed or replaced
// in Stage 5 against f02 and f03. The alternative — accumulating finals until a
// sentence-end cue or a pause — trades completeness for latency, and that trade has to be
// measured rather than assumed.

let counter = 0;
const settled = new Map();   // chunkId -> text, so a revision can be detected

/**
 * Accept a settled turn as a chunk.
 *
 * @returns {{id: string, text: string, revises: string|null}}
 *          `revises` names an earlier chunk this one supersedes, so the view can MARK the
 *          change instead of swapping silently (FR-010).
 */
export function accept(text, { turnId = null } = {}) {
  const value = String(text ?? '').trim();
  if (!value) return null;

  const id = `k${++counter}`;
  const revises = findRevised(value);
  settled.set(id, { text: value, turnId });
  return { id, text: value, turnId, revises };
}

/**
 * A later chunk revises an earlier one when it restates it rather than continuing it.
 *
 * Deliberately conservative: only an exact extension of the immediately preceding chunk
 * counts. Recognition sometimes re-emits a growing string as separate finals, and treating
 * that as two chunks would leave a truncated fragment settled above its own continuation.
 * Anything less obvious is treated as new content, because wrongly marking a revision is
 * as confusing as missing one.
 */
function findRevised(value) {
  const entries = [...settled.entries()];
  if (!entries.length) return null;
  const [lastId, last] = entries[entries.length - 1];
  if (value !== last.text && value.startsWith(last.text)) return lastId;
  return null;
}

export function getSettled() {
  return [...settled.entries()].map(([id, v]) => ({ id, ...v }));
}

export function reset() {
  settled.clear();
  counter = 0;
}
