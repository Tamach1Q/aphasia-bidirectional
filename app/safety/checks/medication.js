// Medication (FR-027).
//
// A drug name or dose that was not in the source must never appear in generated text.
// This is the narrowest check and the least forgiving, because there is no benign reason
// for the system to introduce one: the model has no knowledge of this person's
// prescription that did not come through the input.
//
// It does not try to recognise drug names. It recognises DOSE PATTERNS and the vocabulary
// around medication, which is what a fabrication would have to use.

const DOSE = [
  /\d+\s*(?:mg|ｍｇ|ミリ|錠|包|カプセル|滴|単位)/gi,
  /\d+\s*回\s*\d*\s*(?:日|錠|包)?/g,
  /[一二三四五六七八九十]\s*(?:錠|包|カプセル)/g,
];

const CONTEXT_WORDS = ['薬', '服用', '内服', '処方', '点眼', '塗り薬', '座薬', '注射'];

function doses(text) {
  const t = String(text ?? '');
  const found = [];
  for (const re of DOSE) {
    const m = t.match(re);
    if (m) found.push(...m.map((x) => x.replace(/\s+/g, '')));
  }
  return found;
}

function mentionsMedication(text) {
  const t = String(text ?? '');
  return CONTEXT_WORDS.some((w) => w.length > 2 && t.includes(w)) || t.includes('薬');
}

export const name = 'medication';

// BOTH modes. Inventing a dose is never legitimate.
export const modes = ['restate', 'interpret'];

export function check(candidate, source) {
  // Only engages when medication is actually in play. Otherwise a dose-looking number in
  // an unrelated sentence (「3階の受付」) would be flagged for no reason.
  if (!mentionsMedication(candidate) && !mentionsMedication(source)) return { ok: true };

  const src = new Set(doses(source));
  const invented = doses(candidate).filter((d) => !src.has(d));

  if (invented.length) {
    return {
      ok: false,
      detail: `dose not present in the source: ${invented.join(', ')}`,
    };
  }

  // Medication introduced where the source mentioned none at all.
  if (mentionsMedication(candidate) && !mentionsMedication(source)) {
    return {
      ok: false,
      detail: 'candidate refers to medication where the source did not',
    };
  }
  return { ok: true };
}

export const __doses = doses;
