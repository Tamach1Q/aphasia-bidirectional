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
function has(list, text) {
  const t = String(text ?? '');
  return list.filter((w) => t.includes(w));
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
