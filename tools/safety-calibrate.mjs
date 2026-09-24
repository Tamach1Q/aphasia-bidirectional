// T056 / OQ-10 — measure the safety layer's false-positive rate.
//
// Runs the checks over the real model output captured during Stage 0. Those responses
// were read by hand and judged correct, so anything the layer suppresses here is a FALSE
// POSITIVE — a correct candidate the product would have thrown away.
//
// This is the number OQ-10 needs. Over-suppression is the safe direction, but a layer
// that suppresses correct output at a high rate does not make the product careful, it
// makes it useless: everything degrades to fallback while looking rigorous.
//
//   env -u NODE_OPTIONS node tools/safety-calibrate.mjs

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as safety from '../app/safety/index.js';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const RUNS = path.join(ROOT, 'tools/runs');
const FIXTURES = path.join(ROOT, 'app/fixtures');

if (!existsSync(RUNS)) {
  console.error('No tools/runs/ — run model-eval.mjs first.');
  process.exit(1);
}

const fixtures = new Map(
  readdirSync(FIXTURES).filter((f) => f.endsWith('.json'))
    .map((f) => {
      const d = JSON.parse(readFileSync(path.join(FIXTURES, f), 'utf8'));
      return [d.name, d];
    }),
);

/** The partner utterance a simplify output was generated from. */
function sourceFor(fixture) {
  const partner = fixture.turns.find((t) => t.speaker === 'partner');
  return partner ? partner.text : '';
}

const rows = [];

for (const dir of readdirSync(RUNS)) {
  const full = path.join(RUNS, dir);
  const op = dir.startsWith('simplify') ? 'simplify' : 'hypotheses';
  for (const file of readdirSync(full)) {
    if (file === '_summary.json' || !file.endsWith('.json')) continue;
    const d = JSON.parse(readFileSync(path.join(full, file), 'utf8'));
    if (d.error || !d.raw) continue;
    const fixture = fixtures.get(d.fixture);
    if (!fixture) continue;

    let parsed;
    try { parsed = JSON.parse(d.raw); } catch { continue; }

    if (op === 'simplify') {
      // Judge the WHOLE rendered output, not line by line. A structured simplification
      // splits one utterance across lines, so each line legitimately carries only part of
      // the meaning — scoring 「お風呂：入って大丈夫です」 on its own reported a dropped
      // negation that was in fact sitting in the next line. What the person sees is the
      // whole block, and that is what the layer judges in production too.
      const source = sourceFor(fixture);
      const text = [parsed.meaning, ...(parsed.structure || []), ...(parsed.options || [])]
        .filter(Boolean).join('\n');
      const r = safety.check(text, source, { mode: 'restate' });
      rows.push({ op, model: d.model, fixture: d.fixture, text, source, ...r });
    } else {
      const frag = d.request?.fragment?.text || '';
      const ctxTurns = (d.request?.shortTerm || []).map((t) => t.text).join(' ');
      const source = `${ctxTurns} ${frag}`.trim();
      const ctx = { personalContext: d.request?.personalContext, confirmed: [] };
      for (const h of parsed.hypotheses || []) {
        const r = safety.check(h.text, source, { ...ctx, mode: 'interpret' });
        rows.push({ op, model: d.model, fixture: d.fixture, text: h.text, source, ...r });
      }
    }
  }
}

const suppressed = rows.filter((r) => !r.ok);

console.log(`candidates judged correct during the Stage 0 rubric pass: ${rows.length}`);
console.log(`suppressed by the safety layer (FALSE POSITIVES):          ${suppressed.length}`);
if (rows.length) {
  console.log(`false-positive rate:                                      ${((suppressed.length / rows.length) * 100).toFixed(1)}%`);
}

if (suppressed.length) {
  console.log('\n--- what fired, and on what ---');
  const byCheck = new Map();
  for (const r of suppressed) {
    for (const v of r.violations) byCheck.set(v.check, (byCheck.get(v.check) || 0) + 1);
  }
  for (const [check, n] of [...byCheck].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${check.padEnd(12)} ${n}`);
  }
  console.log('');
  for (const r of suppressed.slice(0, 12)) {
    console.log(`  [${r.fixture.slice(0, 3)}] ${r.text}`);
    console.log(`     source: ${r.source.slice(0, 60)}`);
    for (const v of r.violations) console.log(`     ${v.check}: ${v.detail}`);
  }
}

console.log('\nOver-suppression is the SAFE direction — a suppressed candidate degrades to');
console.log('the fallback, while a missed inversion reaches a person. But a layer that');
console.log('suppresses correct output often makes the product useless rather than careful.');
console.log('Record this figure in research.md §9 (OQ-10).');
