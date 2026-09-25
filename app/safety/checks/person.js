// Person and subject (FR-027).
//
// Who does what is the part a partner acts on. "Your daughter is taking you to the
// hospital" and "you are taking your daughter to the hospital" use the same words and
// lead to different plans — and the person has no way to tell which one the system chose.
//
// Two rules, with different scopes:
//
//   invented person   BOTH modes. A person who appears in neither the source nor the
//                     personal context has been introduced by the system.
//
//   subject swap      RESTATE only. When the output claims to say the same thing, the
//                     doer must be the same doer. In `interpret` mode it must NOT apply:
//                     a hypothesis is the PERSON's meaning answering the partner's
//                     question, so a subject differing from the question's subject is
//                     normal («娘さんが行くんですか？» → «私が行きます»).
//
// Hearing evidence keeps this honest: a person word in a fragment is a MENTION, not
// automatically the subject. 「娘に」 names a recipient, not a doer. So the swap rule fires
// only when BOTH texts mark a subject explicitly, and never guesses at an omitted one.

const PERSON = [
  '娘', '息子', '妻', '夫', '母', '父', '兄', '姉', '弟', '妹',
  '家族', '孫', '友達', '友人', '先生', '看護師', '医者', 'お医者',
  '私', 'わたし', '自分', 'あなた', '本人',
];

const SELF = new Set(['私', 'わたし', '自分']);

/** Collapse spelling variants so 私 and わたし are not read as two different people. */
function canonical(p) {
  return SELF.has(p) ? '私' : p;
}

/**
 * Person words that occur anywhere, canonicalised.
 *
 * Canonicalising here matters as much as in `subjects`: without it, restating 「私」 as
 * 「わたし」 reads as introducing a person who was never mentioned, and the invented-person
 * rule fires on a pure rewording.
 */
function mentioned(text) {
  const t = String(text ?? '');
  return new Set(PERSON.filter((p) => t.includes(p)).map(canonical));
}

/**
 * Persons explicitly marked as the doer, by が or は.
 *
 * Deliberately shallow. It does not parse; it looks for `<person>が` / `<person>は`, which
 * is the marking a simplification would have to move in order to swap a subject.
 */
function subjects(text) {
  const t = String(text ?? '');
  const found = new Set();
  for (const p of PERSON) {
    if (new RegExp(`${p}\\s*[がは]`).test(t)) found.add(canonical(p));
  }
  return found;
}

/** Persons marked as a target or recipient, by を / に / と. */
function nonSubjects(text) {
  const t = String(text ?? '');
  const found = new Set();
  for (const p of PERSON) {
    if (new RegExp(`${p}\\s*[をにと]`).test(t)) found.add(canonical(p));
  }
  return found;
}

export const name = 'person';

// BOTH modes — but the swap rule inside is restate-only, see the header.
export const modes = ['restate', 'interpret'];

export function check(candidate, source, context = {}) {
  const src = mentioned(source);
  const cand = mentioned(candidate);

  // --- invented person (both modes) ---------------------------------------------
  // Names and relations the person actually knows are legitimate even when absent from
  // this utterance: the model may be resolving a fragment against personal context,
  // which is its job.
  const known = new Set();
  for (const p of (context.personalContext?.people || [])) {
    if (p?.name) known.add(canonical(p.name));
    if (p?.relation) known.add(canonical(p.relation));
  }

  const invented = [...cand].filter((p) => !src.has(p) && !known.has(p));
  if (invented.length) {
    return {
      ok: false,
      detail: `person(s) not present in the source or personal context: ${invented.join(', ')}`,
    };
  }

  // --- subject swap (restate only) -----------------------------------------------
  if (context.mode === 'interpret') return { ok: true };

  const srcSubjects = subjects(source);
  const candSubjects = subjects(candidate);

  // Only comparable when both sides mark a subject. An omitted subject is a known
  // limitation, not a violation — guessing at one would suppress correct output.
  if (!srcSubjects.size || !candSubjects.size) return { ok: true };

  const srcOthers = nonSubjects(source);
  const swapped = [...candSubjects].filter((p) => !srcSubjects.has(p) && srcOthers.has(p));

  if (swapped.length) {
    return {
      ok: false,
      detail: `subject swapped: ${[...srcSubjects].join('/')} was the doer in the source, `
        + `but ${swapped.join('/')} is the doer in the candidate — the same words, a different plan`,
    };
  }

  return { ok: true };
}

export const __mentioned = mentioned;
export const __subjects = subjects;
export const __nonSubjects = nonSubjects;
