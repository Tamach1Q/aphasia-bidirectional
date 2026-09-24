// Stage 0 — the prompts are part of the contract, not incidental wording.
//
// contracts/worker-api.md §"Prompt requirements" names instructions each prompt MUST
// carry. Those instructions are the difference between a model that says "I cannot tell"
// and one that guesses, so they are pinned here: a later edit that quietly drops one
// should fail a test rather than be discovered during a participant session.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (f) => readFileSync(new URL(`../../worker/prompts/${f}`, import.meta.url), 'utf8');
const SIMPLIFY = read('simplify.txt');
const HYPOTHESES = read('hypotheses.txt');

test('both prompts exist and are substantive', () => {
  assert.ok(SIMPLIFY.length > 400, 'simplify.txt looks truncated');
  assert.ok(HYPOTHESES.length > 400, 'hypotheses.txt looks truncated');
});

test('placeholders match what the Worker will substitute', () => {
  assert.match(SIMPLIFY, /\{\{TEXT\}\}/);
  assert.match(SIMPLIFY, /\{\{LEVEL\}\}/);
  for (const p of ['FRAGMENT', 'SHORT_TERM', 'CONFIRMED', 'PERSONAL_CONTEXT']) {
    assert.match(HYPOTHESES, new RegExp(`\\{\\{${p}\\}\\}`), `hypotheses.txt lacks {{${p}}}`);
  }
});

test('no placeholder is left undocumented or misspelled', () => {
  const known = new Set(['TEXT', 'LEVEL', 'FRAGMENT', 'SHORT_TERM', 'CONFIRMED', 'PERSONAL_CONTEXT']);
  for (const [file, src] of [['simplify.txt', SIMPLIFY], ['hypotheses.txt', HYPOTHESES]]) {
    for (const m of src.matchAll(/\{\{(\w+)\}\}/g)) {
      assert.ok(known.has(m[1]), `${file}: unknown placeholder {{${m[1]}}}`);
    }
  }
});

// --- simplify: the over-reduction guards (FR-011, contracts §Prompt requirements) ---

test('simplify names every element that must survive', () => {
  for (const [label, re] of [
    ['negation', /否定/],
    ['condition', /条件/],
    ['number', /数|時刻|日付/],
    ['person', /人|誰/],
    ['action', /行為|する／やめる|やめる/],
    ['medication', /薬/],
  ]) {
    assert.match(SIMPLIFY, re, `simplify.txt does not require preserving ${label}`);
  }
});

test('simplify forbids adding information and forbids polarity reversal', () => {
  assert.match(SIMPLIFY, /入力にない情報を足さない/);
  assert.match(SIMPLIFY, /否定を反転させない/);
  assert.match(SIMPLIFY, /飲まないでください.*飲んでください/s,
    'the concrete reversal example should be present — it is the dangerous case');
});

test('simplify states that meaning outranks brevity', () => {
  assert.match(SIMPLIFY, /短くすることより、意味を保つこと/);
  assert.match(SIMPLIFY, /落としてまで短くしてはいけません/);
});

test('simplify requires options to differ in meaning, and permits none', () => {
  assert.match(SIMPLIFY, /言い回しだけが違う選択肢は出さない/);
  assert.match(SIMPLIFY, /選択肢を空にしてよい/);
});

// --- hypotheses: the four required instructions ---

test('hypotheses states that ZERO candidates is a correct outcome — the key instruction', () => {
  assert.match(HYPOTHESES, /候補が0個であることは、正しい答えです/);
  assert.match(HYPOTHESES, /もっともらしい候補を作ってはいけません/);
  assert.match(HYPOTHESES, /"result": "unknown"/);
  // It must appear early: an instruction buried at the end is an instruction ignored.
  const at = HYPOTHESES.indexOf('候補が0個であることは、正しい答えです');
  assert.ok(at / HYPOTHESES.length < 0.35, 'the zero-candidate rule must appear near the top');
});

test('hypotheses requires evidence pointing at real input, not justification prose', () => {
  assert.match(HYPOTHESES, /入力のどこを使ったか/);
  assert.match(HYPOTHESES, /「なぜそう思うか」の説明は書かないでください/);
  assert.match(HYPOTHESES, /存在しない発話|入力にない言い回しを引用してはいけません/);
});

test('hypotheses treats personal context as background, not an answer key (f08)', () => {
  assert.match(HYPOTHESES, /背景情報は\*\*背景\*\*であって、答えの鍵ではありません/);
  assert.match(HYPOTHESES, /会話が優先/);
  assert.match(HYPOTHESES, /数字が一致するというだけで/,
    'the f08 trap — matching on a number alone — should be called out explicitly');
});

test('hypotheses says the fragment may be a substitution (product.md §3.1)', () => {
  assert.match(HYPOTHESES, /意味の近い別の語/);
  assert.match(HYPOTHESES, /字義どおりに固定せず/);
});

test('hypotheses fixes the output shape the client parses', () => {
  assert.match(HYPOTHESES, /0個から3個/);
  assert.match(HYPOTHESES, /"source": "turn"/);
  assert.match(HYPOTHESES, /personalContext/);
  assert.match(HYPOTHESES, /schedule\[0\]/, 'the path form should be shown by example');
});

test('neither prompt claims the output is the person speaking (Constitution VII)', () => {
  assert.match(HYPOTHESES, /あなたの出力は本人の発言ではありません/);
  assert.match(HYPOTHESES, /本人が「はい」と答えるまで、意味は決まりません/);
});
