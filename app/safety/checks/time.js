// Time (FR-027).
//
// 明日 becoming 今日 is a missed appointment. Like `number`, this refuses INVENTED
// temporal expressions rather than policing omission, since simplification may drop
// detail legitimately but may never introduce a day that was never said.

const RELATIVE = ['今日', 'きょう', '明日', 'あした', 'あす', '明後日', '昨日', 'きのう',
  '今週', '来週', '先週', '今月', '来月', '先月', '今朝', '今晩', '今夜'];
const DAYS = ['月曜', '火曜', '水曜', '木曜', '金曜', '土曜', '日曜'];
const PARTS = ['午前', '午後', '朝', '昼', '夕方', '夜', '深夜'];

const ALL = [...RELATIVE, ...DAYS, ...PARTS];

function expressions(text) {
  const t = String(text ?? '');
  return new Set(ALL.filter((e) => t.includes(e)));
}

export const name = 'time';

// RESTATEMENT only, for the same reason as `number`: interpreting a fragment into a day
// is the expressive pipeline's job.
export const modes = ['restate'];

export function check(candidate, source, context = {}) {
  const src = expressions(source);
  const cand = expressions(candidate);

  // Times already confirmed in this conversation are legitimate: the model may be
  // resolving a fragment against context it was correctly given.
  const confirmed = new Set();
  for (const c of (context.confirmed || [])) {
    for (const e of expressions(c.text ?? c)) confirmed.add(e);
  }

  const invented = [...cand].filter((e) => !src.has(e) && !confirmed.has(e));

  // 明日 and あした are the same day; do not flag a rewording.
  const synonyms = [['明日', 'あした', 'あす'], ['今日', 'きょう'], ['昨日', 'きのう']];
  const stillInvented = invented.filter((e) => {
    const group = synonyms.find((g) => g.includes(e));
    if (!group) return true;
    return !group.some((alt) => src.has(alt) || confirmed.has(alt));
  });

  if (stillInvented.length) {
    return {
      ok: false,
      detail: `time expression(s) not present in the source or confirmed context: ${stillInvented.join(', ')}`,
    };
  }
  return { ok: true };
}

export const __expressions = expressions;
