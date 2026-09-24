// Action direction (FR-027).
//
// Distinct from `polarity`: this catches inversions expressed WITHOUT negation.
// 「やめてください」 → 「続けてください」 flips the instruction while both sentences are
// affirmative, so a negation count sees nothing wrong.
//
// Paired opposites only. The check refuses a candidate that asserts the opposite pole of
// an action the source asserted — not one that simply omits it.

const OPPOSITES = [
  [['やめ', '中止', '止め', 'ストップ', '控え'], ['続け', '継続', '再開']],
  [['行く', '行き', '向かい', '出かけ'], ['帰る', '帰り', '戻る', '戻り']],
  [['来る', '来て', '来まし'], ['行かない', '来ない']],
  [['始め', '開始'], ['終わ', '終了']],
  [['増やし', '増量'], ['減らし', '減量']],
  [['入れ', '追加'], ['出し', '削除', '取り消']],
];

function poles(text) {
  const t = String(text ?? '');
  const found = [];
  OPPOSITES.forEach(([a, b], i) => {
    const inA = a.some((w) => w && t.includes(w));
    const inB = b.some((w) => w && t.includes(w));
    if (inA && !inB) found.push(`${i}:A`);
    if (inB && !inA) found.push(`${i}:B`);
  });
  return new Set(found);
}

export const name = 'action';

// BOTH modes. Inverting an instruction is never legitimate.
export const modes = ['restate', 'interpret'];

export function check(candidate, source) {
  const src = poles(source);
  const cand = poles(candidate);

  const flipped = [];
  for (const p of cand) {
    const [i, side] = p.split(':');
    const other = `${i}:${side === 'A' ? 'B' : 'A'}`;
    if (src.has(other)) flipped.push(i);
  }

  if (flipped.length) {
    return {
      ok: false,
      detail: `action direction inverted without negation (pair ${flipped.join(', ')}) — the instruction now points the other way`,
    };
  }
  return { ok: true };
}

export const __poles = poles;
