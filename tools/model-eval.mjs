// T018 / T018a / T018b — Stage 0 model evaluation harness.
//
// Scores candidate models for `simplify` and `hypotheses` against app/fixtures/, using the
// annotations each fixture carries. Those annotations were written BEFORE any model ran,
// so this compares against a prior expectation rather than a judgement formed after
// seeing output (research.md §2).
//
// Rules this file lives by:
//   - It MUST NOT import from app/. It is an evaluation tool, not application code.
//   - No dependencies. Node standard library only.
//   - The key comes from GEMINI_API_KEY and is written nowhere.
//
// What it decides and what it does not:
//   AUTOMATED  schema validity, `result` correctness, f06 restraint, evidence-pointer
//              validity, latency. All decidable from structure.
//   RUBRIC     meaning preservation, polarity reversal, anchoring. `mustNotProduce` is a
//              SCREEN, not a verdict — 「薬を服用してください」 evades f04's list and
//              「10時の通院予定」 evades f08's while meaning exactly what those fixtures
//              forbid. Every raw response is persisted so a human reads the real output.
//
//   env -u NODE_OPTIONS node tools/model-eval.mjs --op simplify
//   env -u NODE_OPTIONS node tools/model-eval.mjs --op hypotheses --runs 3
//   env -u NODE_OPTIONS node tools/model-eval.mjs --op simplify --models a,b
//   env -u NODE_OPTIONS node tools/model-eval.mjs --op hypotheses --fixtures f06,f08

import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const FIXTURES = path.join(ROOT, 'app/fixtures');
const PROMPTS = path.join(ROOT, 'worker/prompts');
const RUNS = path.join(ROOT, 'tools/runs');

const KEY = process.env.GEMINI_API_KEY;
if (!KEY) {
  console.error('GEMINI_API_KEY is not set. Export it in your shell profile; never commit it.');
  process.exit(1);
}

// ---------------------------------------------------------------- args

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const OP = arg('op');
if (OP !== 'simplify' && OP !== 'hypotheses') {
  console.error('usage: model-eval.mjs --op simplify|hypotheses [--runs N] [--models a,b,c]');
  process.exit(1);
}
const RUNS_PER_FIXTURE = Number(arg('runs', '3'));

// research.md §2 "Selection, per operation"
const DEFAULT_MODELS = {
  simplify: ['gemini-3.6-flash', 'gemini-3.8-flash', 'gemini-3.5-flash-lite'],
  hypotheses: ['gemini-3.6-flash', 'gemini-3.8-flash', 'gemini-3.7-flash'],
};
const MODELS = (arg('models') || DEFAULT_MODELS[OP].join(',')).split(',').map((s) => s.trim());

// ---------------------------------------------------------------- fixtures

const fixtures = readdirSync(FIXTURES)
  .filter((f) => f.endsWith('.json'))
  .sort()
  .map((f) => JSON.parse(readFileSync(path.join(FIXTURES, f), 'utf8')));

/**
 * T018a — deterministic ids.
 *
 * A fixture has no ids; the session normally supplies them. Assigning them here by
 * position means a rerun produces byte-identical requests, so a scored result can be
 * reproduced and an evidence pointer is resolvable at all.
 */
function withIds(fixture) {
  const turns = fixture.turns.map((t, i) => ({ id: `t${i + 1}`, ...t }));
  return { ...fixture, turns };
}

/** Which fixtures each operation is scored on. */
function appliesTo(op, fixture) {
  const e = fixture.expect || {};
  if (op === 'simplify') return e.gate === 'pass';
  return Boolean(e.hypotheses);
}

// ---------------------------------------------------------------- request building

const SIMPLIFY_PROMPT = readFileSync(path.join(PROMPTS, 'simplify.txt'), 'utf8');
const HYPOTHESES_PROMPT = readFileSync(path.join(PROMPTS, 'hypotheses.txt'), 'utf8');

function fill(template, values) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in values ? values[k] : ''));
}

function simplifyPrompt(fixture) {
  const partner = fixture.turns.find((t) => t.speaker === 'partner');
  return fill(SIMPLIFY_PROMPT, { TEXT: partner ? partner.text : '', LEVEL: 'standard' });
}

/**
 * Builds the id-bearing request shape from contracts/worker-api.md. The fragment is the
 * person's last turn and carries its own id, so evidence can point at it even when no
 * context is sent (ctx=none would otherwise be unsatisfiable).
 */
function hypothesesInput(fixture, ctx = 'personal') {
  const fragmentTurn = [...fixture.turns].reverse().find((t) => t.speaker === 'person');
  if (!fragmentTurn) return null;
  const shortTerm = fixture.turns
    .filter((t) => t.id !== fragmentTurn.id)
    .map((t) => ({ id: t.id, speaker: t.speaker, text: t.text }));

  const body = { fragment: { id: fragmentTurn.id, text: fragmentTurn.text } };
  if (ctx === 'session' || ctx === 'personal') {
    body.shortTerm = shortTerm;
    body.confirmed = [];
  }
  if (ctx === 'personal' && fixture.personalContext) {
    const { _note, ...clean } = fixture.personalContext;
    body.personalContext = clean;
  }
  return body;
}

function hypothesesPrompt(body) {
  const j = (v) => (v === undefined ? '(渡されていません)' : JSON.stringify(v, null, 2));
  return fill(HYPOTHESES_PROMPT, {
    FRAGMENT: j(body.fragment),
    SHORT_TERM: j(body.shortTerm),
    CONFIRMED: j(body.confirmed),
    PERSONAL_CONTEXT: j(body.personalContext),
  });
}

const SCHEMAS = {
  simplify: {
    type: 'OBJECT',
    properties: {
      meaning: { type: 'STRING' },
      structure: { type: 'ARRAY', items: { type: 'STRING' } },
      options: { type: 'ARRAY', items: { type: 'STRING' }, maxItems: 3 },
    },
    required: ['meaning'],
  },
  hypotheses: {
    type: 'OBJECT',
    properties: {
      result: { type: 'STRING', enum: ['ok', 'unknown'] },
      hypotheses: {
        type: 'ARRAY',
        // minItems 0 is the whole point: zero candidates must be representable (FR-015).
        minItems: 0,
        maxItems: 3,
        items: {
          type: 'OBJECT',
          properties: {
            text: { type: 'STRING' },
            evidence: {
              type: 'ARRAY',
              items: {
                type: 'OBJECT',
                properties: {
                  source: { type: 'STRING', enum: ['turn', 'confirmed', 'personalContext'] },
                  id: { type: 'STRING' },
                  path: { type: 'STRING' },
                  excerpt: { type: 'STRING' },
                },
                required: ['source', 'excerpt'],
              },
            },
          },
          required: ['text', 'evidence'],
        },
      },
    },
    required: ['result', 'hypotheses'],
  },
};

/**
 * Transient 503/429 are documented free-tier behaviour and the Worker already retries them
 * (f918a1d). The harness must too, or a model gets scored for the queue it was in rather
 * than for what it produced.
 *
 * `ms` is the latency of the SUCCESSFUL attempt. Backoff time is deliberately excluded —
 * mixing it in would make a model look slow for someone else's capacity problem. `retries`
 * is reported separately so a high rate is still visible.
 */
const BACKOFF_MS = [0, 600, 1800, 4000];

async function callOnce(model, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const started = performance.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: SCHEMAS[OP],
      },
    }),
  });
  const ms = Math.round(performance.now() - started);
  if (!res.ok) {
    const body = await res.text();
    return { ms, status: res.status, error: `HTTP ${res.status} ${body.slice(0, 160)}`, raw: null };
  }
  const data = await res.json();
  const raw = data.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
  let parsed = null;
  try { parsed = JSON.parse(raw); } catch { /* scored as a schema failure */ }
  return { ms, status: 200, error: null, raw, parsed };
}

async function callModel(model, prompt) {
  let last = null;
  for (let i = 0; i < BACKOFF_MS.length; i += 1) {
    if (BACKOFF_MS[i]) await new Promise((r) => setTimeout(r, BACKOFF_MS[i]));
    last = await callOnce(model, prompt);
    if (!last.error) return { ...last, retries: i };
    // Only capacity errors are worth retrying; a 400 will not fix itself.
    if (last.status !== 503 && last.status !== 429) break;
  }
  return { ...last, retries: BACKOFF_MS.length - 1 };
}

// ---------------------------------------------------------------- scoring: automated only

/** T019 — simplify: structure and the over-reduction screen. */
function scoreSimplify(fixture, parsed) {
  const s = { schemaValid: false, preserveScreen: {}, blockedHit: [] };
  if (!parsed || typeof parsed.meaning !== 'string' || !parsed.meaning.trim()) return s;
  s.schemaValid = true;

  const text = [parsed.meaning, ...(parsed.structure || []), ...(parsed.options || [])].join(' ');

  // A SCREEN, not a verdict — see the header. Reported so a rubric reader knows where to look.
  // Observed 2026-09-24: this screen produced a FALSE NEGATIVE on f02, marking condition
  // absent from 「ふらつくときは飲むのをやめる」 because the probe lacked 〜ときは. The
  // condition was in fact preserved. Treat a red cell as "go read this one", never as a
  // failure; a green cell is equally not a pass.
  const probes = {
    negation: /ない|ません|しないで|やめ/,
    condition: /もし|たら|場合|ただし|なら|ときは|とき:|時は/,
    number: /\d|[一二三四五六七八九十]/,
    time: /時|分|日|曜|朝|昼|夜|午前|午後/,
    place: /階|受付|病院|家|駅/,
    action: /する|して|やめ|行|来|電話|飲/,
    person: /私|娘|息子|家族|先生/,
    medication: /薬/,
  };
  for (const el of fixture.expect.preserve || []) {
    s.preserveScreen[el] = probes[el] ? probes[el].test(text) : null;
  }
  for (const bad of fixture.expect.mustNotProduce || []) {
    if (text.includes(bad)) s.blockedHit.push(bad);
  }
  return s;
}

/** T020 — hypotheses: everything decidable from structure. */
function scoreHypotheses(fixture, parsed, body) {
  const s = {
    schemaValid: false, count: null, resultField: null,
    restraintOk: null, evidenceTotal: 0, evidenceValid: 0, citedSources: [],
    mustCiteOk: null, blockedHit: [],
  };
  if (!parsed || !Array.isArray(parsed.hypotheses)) return s;
  s.schemaValid = true;
  s.count = parsed.hypotheses.length;
  s.resultField = parsed.result ?? null;

  const { min, max } = fixture.expect.hypotheses;
  // f06: any hypothesis is a failure, never a near-miss (research.md §2).
  s.restraintOk = s.count >= min && s.count <= max;

  // Evidence validity — resolvable against what was actually SENT, which is the point of
  // the id-bearing request shape.
  const turnIds = new Set([
    body.fragment.id,
    ...(body.shortTerm || []).map((t) => t.id),
  ]);
  const turnText = new Map([
    [body.fragment.id, body.fragment.text],
    ...(body.shortTerm || []).map((t) => [t.id, t.text]),
  ]);

  for (const h of parsed.hypotheses) {
    for (const ev of h.evidence || []) {
      s.evidenceTotal += 1;
      s.citedSources.push(ev.source);
      if (ev.source === 'turn') {
        if (turnIds.has(ev.id) && String(turnText.get(ev.id) || '').includes(ev.excerpt)) {
          s.evidenceValid += 1;
        }
      } else if (ev.source === 'personalContext') {
        const flat = JSON.stringify(body.personalContext || {});
        if (ev.path && flat.includes(ev.excerpt)) s.evidenceValid += 1;
      }
      // `confirmed` is always empty in fixtures, so any such citation is unverifiable.
    }
  }
  if (fixture.expect.mustCite) {
    s.mustCiteOk = s.citedSources.includes(fixture.expect.mustCite);
  }
  const all = parsed.hypotheses.map((h) => h.text).join(' ');
  for (const bad of fixture.expect.mustNotProduce || []) {
    if (all.includes(bad)) s.blockedHit.push(bad);
  }
  return s;
}

// ---------------------------------------------------------------- run

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const runDir = path.join(RUNS, `${OP}-${stamp}`);
mkdirSync(runDir, { recursive: true });

// --fixtures f06,f07 — fill a specific gap without spending quota on cells already measured.
const ONLY = (arg('fixtures') || '').split(',').map((x) => x.trim()).filter(Boolean);
const applicable = fixtures
  .filter((f) => appliesTo(OP, f))
  .filter((f) => !ONLY.length || ONLY.some((o) => f.name.startsWith(o)))
  .map(withIds);
console.log(`op: ${OP}   models: ${MODELS.join(', ')}`);
console.log(`fixtures: ${applicable.map((f) => f.name.slice(0, 3)).join(', ')}   runs each: ${RUNS_PER_FIXTURE}`);
console.log(`raw output → tools/runs/${path.basename(runDir)}/  (gitignored)\n`);

const summary = [];

for (const model of MODELS) {
  for (const fixture of applicable) {
    const body = OP === 'hypotheses' ? hypothesesInput(fixture) : null;
    if (OP === 'hypotheses' && !body) continue;
    const prompt = OP === 'simplify' ? simplifyPrompt(fixture) : hypothesesPrompt(body);

    for (let attempt = 1; attempt <= RUNS_PER_FIXTURE; attempt += 1) {
      const { ms, error, raw, parsed, retries } = await callModel(model, prompt);
      const score = error ? null
        : OP === 'simplify' ? scoreSimplify(fixture, parsed) : scoreHypotheses(fixture, parsed, body);

      // T018b — persist the raw response. The rubric pass reads this, not a summary.
      writeFileSync(
        path.join(runDir, `${model}__${fixture.name}__${attempt}.json`),
        JSON.stringify({ model, fixture: fixture.name, attempt, ms, retries, error, request: body, raw, score }, null, 2),
      );

      summary.push({ model, fixture: fixture.name, attempt, ms, retries, error, score });
      const tag = error ? 'ERR' : score.schemaValid ? 'ok ' : 'BAD';
      const extra = error ? error.slice(0, 60)
        : OP === 'hypotheses'
          ? `n=${score.count} restraint=${score.restraintOk ? 'y' : 'N'} ev=${score.evidenceValid}/${score.evidenceTotal}${score.blockedHit.length ? ` BLOCKED:${score.blockedHit.join('|')}` : ''}`
          : `${score.blockedHit.length ? `BLOCKED:${score.blockedHit.join('|')}` : Object.entries(score.preserveScreen).map(([k, v]) => `${k}:${v ? 'y' : 'N'}`).join(' ')}`;
      console.log(`${tag} ${model.padEnd(24)} ${fixture.name.slice(0, 3)} #${attempt} ${String(ms).padStart(5)}ms${retries ? ` r${retries}` : '   '}  ${extra}`);
    }
  }
}

writeFileSync(path.join(runDir, '_summary.json'), JSON.stringify(summary, null, 2));

// ---------------------------------------------------------------- aggregate

console.log('\n--- per model ---');
for (const model of MODELS) {
  const rows = summary.filter((r) => r.model === model && !r.error);
  if (!rows.length) { console.log(`${model}: no successful calls`); continue; }
  const lat = rows.map((r) => r.ms).sort((a, b) => a - b);
  const median = lat[Math.floor(lat.length / 2)];
  const worst = lat.at(-1);
  const schemaOk = rows.filter((r) => r.score.schemaValid).length;
  const blocked = rows.filter((r) => r.score.blockedHit.length).length;

  const retried = rows.filter((r) => r.retries > 0).length;
  const failed = summary.filter((r) => r.model === model && r.error).length;
  let line = `${model.padEnd(24)} schema ${schemaOk}/${rows.length}  p50 ${median}ms  max ${worst}ms  retried ${retried}  gaveUp ${failed}  screenHits ${blocked}`;
  if (OP === 'hypotheses') {
    const restraint = rows.filter((r) => r.score.restraintOk).length;
    const evT = rows.reduce((a, r) => a + r.score.evidenceTotal, 0);
    const evV = rows.reduce((a, r) => a + r.score.evidenceValid, 0);
    line += `  restraint ${restraint}/${rows.length}  evidence ${evV}/${evT}`;
  }
  console.log(line);
}

console.log(`\nRUBRIC PASS REQUIRED. Screens above are not verdicts: a model can evade`);
console.log(`mustNotProduce while meaning exactly what the fixture forbids. Read the raw`);
console.log(`responses in tools/runs/${path.basename(runDir)}/ before recording a decision in research.md §2.`);
