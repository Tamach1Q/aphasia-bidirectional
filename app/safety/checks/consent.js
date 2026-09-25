// Consent and refusal (FR-027).
//
// Agreeing on someone's behalf is the failure Constitution VII exists to prevent, and it
// is the one a partner is least able to detect: a confident 「はい、お願いします」 looks
// like the person's answer.
//
// This is narrower than `polarity`. It fires only when a candidate ASSERTS agreement or
// refusal that the source did not — a system that turns a hesitant fragment into a
// commitment has decided for the person.

const AGREE = ['お願いします', 'はい、', 'そうします', '大丈夫です', '結構です', '了解',
  '承知', '同意', '受けます', 'やります', 'いいです'];
const REFUSE = ['いいえ', '断り', 'やめておき', '遠慮し', '結構です', 'いりません', '不要'];

// 結構です is genuinely ambiguous in Japanese — it can accept or decline. It appears in
// both lists so that either direction counts as "consent language is present", and the
// check never tries to resolve which.
//
// An occurrence followed by か does not count. 「いつがいいですか」 and 「大丈夫ですか」 ASK;
// they assert nothing, and this check exists to catch assertion (see the header). Found
// during Stage 5: the plain substring test suppressed 「いつがいいですか」 — a correct
// simplification of a partner asking which of two times suits — on the 'いいです' inside it,
// which would have silently disabled the most ordinary receptive case there is
// (research.md §9). Applied to the source as well as the candidate, which is deliberately
// the STRICTER reading: a partner asking 「大丈夫ですか」 gives no grounds for a candidate
// that answers 「大丈夫です」 on the person's behalf.
function has(list, text) {
  const t = String(text ?? '');
  return list.filter((w) => {
    let from = 0;
    for (;;) {
      const at = t.indexOf(w, from);
      if (at === -1) return false;
      if (t[at + w.length] !== 'か') return true;   // an assertion, not a question
      from = at + 1;
    }
  });
}

export const name = 'consent';

// BOTH modes. Asserting agreement for someone is what Constitution VII forbids.
export const modes = ['restate', 'interpret'];

export function check(candidate, source) {
  const srcAgree = has(AGREE, source);
  const srcRefuse = has(REFUSE, source);
  const candAgree = has(AGREE, candidate);
  const candRefuse = has(REFUSE, candidate);

  const sourceHasAny = srcAgree.length || srcRefuse.length;

  if (!sourceHasAny && (candAgree.length || candRefuse.length)) {
    return {
      ok: false,
      detail: `candidate asserts consent or refusal the source did not: ${[...candAgree, ...candRefuse].join(', ')}`,
    };
  }

  // Direction flipped: the source declined and the candidate accepts, or the reverse.
  if (srcRefuse.length && candAgree.length && !srcAgree.length && !candRefuse.length) {
    return { ok: false, detail: 'refusal became agreement' };
  }
  if (srcAgree.length && candRefuse.length && !srcRefuse.length && !candAgree.length) {
    return { ok: false, detail: 'agreement became refusal' };
  }
  return { ok: true };
}
