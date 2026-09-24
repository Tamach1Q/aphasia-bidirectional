// Person and subject (FR-027).
//
// Who does what is the part a partner acts on. "Your daughter is going to the hospital"
// and "you are going to the hospital" differ by one word and lead to different plans.
//
// Hearing evidence makes this concrete: a person word appearing in a fragment is a
// MENTION, not automatically the subject. 「娘に」 names a recipient, not a doer. So this
// check does not try to parse who the subject is — it only refuses a person who was never
// mentioned at all, which is the failure it can detect reliably.

const PERSON = [
  '娘', '息子', '妻', '夫', '母', '父', '兄', '姉', '弟', '妹',
  '家族', '孫', '友達', '友人', '先生', '看護師', '医者', 'お医者',
  '私', 'わたし', '自分', 'あなた', '本人',
];

function mentioned(text) {
  const t = String(text ?? '');
  return new Set(PERSON.filter((p) => t.includes(p)));
}

export const name = 'person';

// BOTH modes. Applies to both; already lenient about names from personal context.
export const modes = ['restate', 'interpret'];

export function check(candidate, source, context = {}) {
  const src = mentioned(source);
  const cand = mentioned(candidate);

  // Names the person actually knows are legitimate even when absent from this utterance —
  // the model may be resolving a fragment against personal context, which is its job.
  const known = new Set();
  for (const p of (context.personalContext?.people || [])) {
    if (p?.name) known.add(p.name);
    if (p?.relation) known.add(p.relation);
  }

  const invented = [...cand].filter((p) => !src.has(p) && !known.has(p));

  if (invented.length) {
    return {
      ok: false,
      detail: `person(s) not present in the source or personal context: ${invented.join(', ')}`,
    };
  }
  return { ok: true };
}

export const __mentioned = mentioned;
