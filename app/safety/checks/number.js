// Number and quantity (FR-027).
//
// A changed or invented number is a violation. 10時 becoming 11時 is not a paraphrase —
// it is a different appointment, and the person has no way to tell it was the system that
// moved it.
//
// Asymmetric on purpose: DROPPING a number is handled by over-reduction, not here, because
// simplification legitimately omits detail. Adding or altering one is never legitimate.

/** Normalises the kanji digits that appear in times and counts. */
const KANJI = { 〇: '0', 一: '1', 二: '2', 三: '3', 四: '4', 五: '5', 六: '6', 七: '7', 八: '8', 九: '9' };

function normalize(text) {
  return String(text ?? '')
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[：]/g, ':')
    .replace(/十(\d)/g, (_, d) => `1${d}`)
    .replace(/(\d)十/g, (_, d) => `${d}0`)
    .replace(/十/g, '10')
    .replace(/[〇一二三四五六七八九]/g, (c) => KANJI[c]);
}

/**
 * Canonicalise clock forms so a rewording is not read as an invented number.
 *
 * 「10時半」 and `10:30` are the same appointment, and rendering one as the other is a
 * clearer output, not a fabrication. Measured against real Stage 0 output this was the
 * last remaining false positive: a correct simplification of f03 was suppressed because
 * it wrote 10:30 and 14:00 where the source said 10時半 and 14時.
 */
function canonicalClock(text) {
  return normalize(text)
    .replace(/(\d{1,2})\s*時\s*半/g, (_, h) => `${h}:30`)
    .replace(/(\d{1,2})\s*時\s*(\d{1,2})\s*分/g, (_, h, m) => `${h}:${String(m).padStart(2, '0')}`)
    .replace(/(\d{1,2})\s*時(?!\s*間)/g, (_, h) => `${h}:00`);
}

function numbers(text) {
  // Strip list markers before extracting. 「1. 朝ごはん…」 enumerates a step; it does not
  // assert a quantity, and treating it as one flagged correct structured output.
  const stripped = canonicalClock(text)
    .replace(/^\s*\d+\s*[.、)）]\s*/gm, '')
    .replace(/^\s*[(（]\d+[)）]\s*/gm, '');
  return (stripped.match(/\d+/g) || []).map(Number);
}

export const name = 'number';

// RESTATEMENT only. A hypothesis exists to propose a reading the source does not state
// literally — resolving 「じゅう」 to 10時 is the product working, not a fabrication.
export const modes = ['restate'];

export function check(candidate, source) {
  const src = numbers(source);
  const cand = numbers(candidate);

  const srcSet = new Set(src);
  const invented = cand.filter((n) => !srcSet.has(n));

  if (invented.length) {
    return {
      ok: false,
      detail: `number(s) not present in the source: ${invented.join(', ')} (source had: ${src.join(', ') || 'none'})`,
    };
  }
  return { ok: true };
}

export const __numbers = numbers;
