// Cloudflare Worker: proxies the two current model operations (simplify / hypotheses) and
// retains the older no-`op` answer-candidate handler as a compatibility path.
//
// This is deliberately minimal, demo-scoped infrastructure. The model key stays server-side;
// the static app calls the current op-discriminated contract from app/runtime.js. Whoever takes
// this over may replace Cloudflare/Gemini without changing that app-facing contract.

// Prompts are imported as Text modules (see wrangler.toml [[rules]]) rather than pasted
// in here. worker/prompts/*.txt stays the single source of truth, so a prompt cannot drift
// from the version the tests pin and the evaluation harness measured.
import SIMPLIFY_PROMPT from './prompts/simplify.txt';
import HYPOTHESES_PROMPT from './prompts/hypotheses.txt';

const ALLOWED_ORIGINS = new Set([
  'https://tamach1q.github.io',
]);

// Legacy compatibility path only. The current app no longer calls { text } -> { choices };
// it remains intentionally available alongside op=simplify / op=hypotheses.
//
// The two current operations name DIFFERENT models (wrangler.toml [vars], chosen in
// research.md §2b) and must not be folded back onto a single constant: simplify was
// chosen for latency on the critical path, hypotheses for restraint and evidence fidelity.
const GEMINI_MODEL = 'gemini-3.6-flash';

function isAllowedOrigin(origin) {
  if (ALLOWED_ORIGINS.has(origin)) return true;
  try {
    const url = new URL(origin);
    return url.protocol === 'http:' && url.hostname === 'localhost';
  } catch (_) {
    return false;
  }
}

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowed = isAllowedOrigin(origin);
  return {
    'Access-Control-Allow-Origin': allowed ? origin : 'null',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
}

export default {
  async fetch(request, env) {
    const headers = corsHeaders(request);

    if (request.method === 'OPTIONS') return new Response(null, { headers });
    if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, headers);
    if (headers['Access-Control-Allow-Origin'] === 'null') return json({ error: 'Origin not allowed' }, 403, headers);

    let body;
    try { body = await request.json(); } catch (_) { return json({ error: 'invalid JSON body' }, 400, headers); }

    // 002: current app requests are op-discriminated. A body WITHOUT `op` reaches the
    // superseded { text } -> { choices } compatibility handler. The current app does not
    // depend on that path.
    if (body?.op === 'simplify') return handleSimplify(body, env, headers);
    if (body?.op === 'hypotheses') return handleHypotheses(body, env, headers);

    const text = String(body?.text || '').trim().slice(0, 500);
    if (!text) return json({ error: 'text is required' }, 400, headers);

    const prompt = `あなたは失語症の人が会話するのを助けるアシスタントです。
会話の相手が次のように話しかけました:「${text}」
これははい/いいえでは答えられない、開かれた質問です。
失語症の人がタップするだけで答えられるように、質問の内容から自然に推測できる、具体的で互いに意味が異なる答えの候補を2〜3個、短い日本語の言葉で提案してください。
出力は候補の配列だけのJSONにしてください。他の文章は含めないでください。`;

    // Google's own free-tier "high demand" 503s are explicitly documented as transient --
    // retry a couple of times with a short backoff before giving up.
    const attempts = [0, 500, 1500];
    let lastError = null;
    for (const delay of attempts) {
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                responseMimeType: 'application/json',
                responseSchema: { type: 'ARRAY', items: { type: 'STRING' }, minItems: 2, maxItems: 3 },
              },
            }),
          }
        );

        if (!res.ok) {
          let detail = `HTTP ${res.status}`;
          try {
            const errBody = await res.json();
            if (errBody?.error?.message) detail += `: ${errBody.error.message}`;
          } catch (_) {}
          lastError = detail;
          if (res.status === 503 || res.status === 429) continue; // transient -- worth retrying
          return json({ error: detail }, 502, headers);
        }

        const data = await res.json();
        const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
        const choices = JSON.parse(raw);
        if (!Array.isArray(choices) || !choices.length) { lastError = '候補が空でした'; continue; }
        return json({ choices: choices.slice(0, 3).map(String) }, 200, headers);
      } catch (err) {
        lastError = err.message || String(err);
      }
    }
    return json({ error: lastError || '不明なエラー' }, 502, headers);
  },
};

// ---------------------------------------------------------------- 002: op=simplify

// Receptive direction. The client only calls this AFTER its local gate has passed
// (FR-008), so an ordinary utterance never reaches here and costs nothing.
//
// The prompt lives in worker/prompts/simplify.txt and is inlined at deploy time; it names
// every element that must survive and states that meaning outranks brevity, because
// over-reduction is the failure a fluent short output hides.
const SIMPLIFY_SCHEMA = {
  type: 'OBJECT',
  properties: {
    meaning: { type: 'STRING' },
    structure: { type: 'ARRAY', items: { type: 'STRING' } },
    options: { type: 'ARRAY', items: { type: 'STRING' }, maxItems: 3 },
  },
  required: ['meaning'],
};

async function handleSimplify(body, env, headers) {
  const text = String(body?.text || '').trim().slice(0, 1000);
  if (!text) return json({ error: 'text is required' }, 400, headers);
  const level = ['short', 'standard', 'detailed'].includes(body?.level) ? body.level : 'standard';

  const prompt = SIMPLIFY_PROMPT.replace('{{TEXT}}', text).replace('{{LEVEL}}', level);
  const model = env.SIMPLIFY_MODEL || env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

  const result = await callGemini({ model, prompt, schema: SIMPLIFY_SCHEMA, env });
  if (result.error) return json({ error: result.error }, 502, headers);

  return json({
    op: 'simplify',
    meaning: String(result.data.meaning || ''),
    structure: Array.isArray(result.data.structure) ? result.data.structure.map(String) : [],
    options: Array.isArray(result.data.options) ? result.data.options.slice(0, 3).map(String) : [],
  }, 200, headers);
}

/** Shared model call with the same transient-error retry the legacy path uses. */
async function callGemini({ model, prompt, schema, env }) {
  const attempts = [0, 600, 1800];
  let lastError = null;
  for (const delay of attempts) {
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json', responseSchema: schema },
          }),
        },
      );
      if (!res.ok) {
        let detail = `HTTP ${res.status}`;
        try {
          const errBody = await res.json();
          if (errBody?.error?.message) detail += `: ${errBody.error.message}`;
        } catch (_) {}
        lastError = detail;
        if (res.status === 503 || res.status === 429) continue;
        return { error: detail };
      }
      const payload = await res.json();
      const raw = payload.candidates?.[0]?.content?.parts?.[0]?.text;
      return { data: JSON.parse(raw) };
    } catch (err) {
      lastError = err.message || String(err);
    }
  }
  return { error: lastError || '不明なエラー' };
}


// ---------------------------------------------------------------- 002: op=hypotheses

const HYPOTHESES_SCHEMA = {
  type: 'OBJECT',
  properties: {
    result: { type: 'STRING', enum: ['ok', 'unknown'] },
    hypotheses: {
      type: 'ARRAY',
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
};

function hypothesesPrompt(body) {
  const show = (value) => value === undefined ? '(渡されていません)' : JSON.stringify(value, null, 2);
  return HYPOTHESES_PROMPT
    .replace('{{FRAGMENT}}', show(body.fragment))
    .replace('{{SHORT_TERM}}', show(body.shortTerm))
    .replace('{{CONFIRMED}}', show(body.confirmed))
    .replace('{{PERSONAL_CONTEXT}}', show(body.personalContext));
}

async function handleHypotheses(body, env, headers) {
  const fragment = body && body.fragment;
  const id = String(fragment && fragment.id || '').trim();
  const text = String(fragment && fragment.text || '').trim().slice(0, 500);
  if (!id || !text) return json({ error: 'fragment {id,text} is required' }, 400, headers);

  const clean = {
    fragment: { id, text },
  };
  if (Array.isArray(body.shortTerm)) clean.shortTerm = body.shortTerm.slice(-6);
  if (Array.isArray(body.confirmed)) clean.confirmed = body.confirmed;
  if (body.personalContext && typeof body.personalContext === 'object') {
    clean.personalContext = body.personalContext;
  }

  const model = env.HYPOTHESES_MODEL || env.GEMINI_MODEL || 'gemini-3.6-flash';
  const result = await callGemini({
    model,
    prompt: hypothesesPrompt(clean),
    schema: HYPOTHESES_SCHEMA,
    env,
  });
  if (result.error) return json({ error: result.error }, 502, headers);

  const hypotheses = Array.isArray(result.data.hypotheses)
    ? result.data.hypotheses.slice(0, 3)
    : [];
  const outcome = result.data.result === 'ok' && hypotheses.length ? 'ok' : 'unknown';

  return json({
    op: 'hypotheses',
    result: outcome,
    hypotheses: outcome === 'ok' ? hypotheses : [],
  }, 200, headers);
}
