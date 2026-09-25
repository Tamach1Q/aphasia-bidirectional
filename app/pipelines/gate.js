// Simplification gate (FR-008, §11.2, §A3.1).
//
// Runs LOCALLY, before any network call. An utterance that fails the gate costs nothing:
// no request, no latency, and no replacement of the main area. That is the point — most
// of what a partner says is ordinary, and the product should be silent for it.
//
// Biased toward NOT simplifying. An unnecessary simplification takes over the largest
// element on screen and competes for attention; a missed one is recoverable with `[短く]`
// (FR-009). The two errors are not symmetric, so the threshold is not either.
//
// Thresholds here are provisional (research.md §5) and are calibrated in Stage 5 against
// the fixtures. `f01` must gate out; `f02` and `f03` must gate in.

/** Provisional. research.md §5, OQ-2. */
export const THRESHOLDS = {
  length: 40,        // Japanese characters
  entities: 2,       // distinct times / numbers / places in one utterance
  instructions: 2,   // imperatives or requests
};

const SIGNALS = {
  /** A long utterance is more than the person can hold, whatever else is true of it. */
  length: (t) => t.length > THRESHOLDS.length,

  /** More than one thing to do. */
  instructions: (t) => count(t, /(?:ください|ましょう|して(?:ね|)|下さい)/g) >= THRESHOLDS.instructions,

  /**
   * A condition, or an exception. Both make part of the utterance apply only sometimes,
   * which is exactly what gets lost when a person holds only the first half.
   *
   * 〜ですが / 〜けれど are CONTRASTIVE rather than conditional, and were added after f04
   * showed the gap: a permission and a prohibition joined by 〜ですが is the shape where
   * dropping half inverts a medication decision (research.md §5).
   */
  condition: (t) => /もし|たら|れば|なら|場合|ただし|でなければ|ときは|ですが|ますが|けれど|一方で/.test(t),

  /** A question buried inside other material, rather than asked on its own. */
  embeddedQuestion: (t) => /[？?]/.test(t) && t.replace(/[？?]/g, '').length > 12,

  /**
   * Several things of the SAME KIND — two times, two numbers, two places.
   *
   * Counting entities of any kind was the first attempt and it was wrong: 「明日、病院
   * 行く？」 has a day and a place and is a perfectly ordinary question. What is hard is
   * holding ALTERNATIVES — two candidate appointments, two amounts — because the person
   * has to keep both and choose. One time and one place is a single fact.
   */
  entities: (t) => maxSameKind(t) >= THRESHOLDS.entities,
};

function count(text, re) {
  return (String(text).match(re) || []).length;
}

/** Distinct entities, grouped by kind. */
function entities(text) {
  const t = String(text);
  const by = { number: new Set(), time: new Set(), place: new Set() };
  for (const m of t.matchAll(/\d+|[〇一二三四五六七八九十]+(?=[時分日月年階個人回])/g)) by.number.add(m[0]);
  for (const m of t.matchAll(/今日|明日|明後日|昨日|今週|来週|先週|月曜|火曜|水曜|木曜|金曜|土曜|日曜|午前|午後|朝|昼|夕方|夜/g)) by.time.add(m[0]);
  for (const m of t.matchAll(/病院|受付|駅|自宅|お家|教室|窓口|薬局/g)) by.place.add(m[0]);
  return by;
}

/** The largest group. Two of a kind means alternatives to hold; one of each does not. */
function maxSameKind(text) {
  const by = entities(text);
  return Math.max(by.number.size, by.time.size, by.place.size);
}

/**
 * @param {string} text the partner's settled utterance
 * @returns {{pass: boolean, signals: string[], reason: string}}
 *          `pass` true means simplify. `signals` names what fired, for calibration.
 */
export function evaluate(text) {
  const t = String(text ?? '').trim();
  if (!t) return { pass: false, signals: [], reason: 'empty' };

  const signals = Object.entries(SIGNALS)
    .filter(([, test]) => test(t))
    .map(([name]) => name);

  return {
    pass: signals.length > 0,
    signals,
    reason: signals.length ? `signals: ${signals.join(', ')}` : 'ordinary utterance — no signal fired',
  };
}

/** Convenience for call sites that only need the decision. */
export function shouldSimplify(text) {
  return evaluate(text).pass;
}

export const __entities = entities;
export const __maxSameKind = maxSameKind;
