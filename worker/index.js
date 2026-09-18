// Cloudflare Worker: proxies the one LLM-assisted step (open-ended partner-question answer
// candidates) so the Gemini API key never has to live in the public static app.
//
// This is deliberately minimal, demo-scoped infrastructure. It exists so app/app.js never
// needs a secret client-side. Whoever takes this over for production should feel free to
// replace this Worker entirely with their own backend/model choice -- app/app.js only depends
// on the small { text } -> { choices } | { error } contract below, not on this being a
// Cloudflare Worker or on Gemini specifically.

const ALLOWED_ORIGINS = new Set([
  'https://tamach1q.github.io',
]);

const GEMINI_MODEL = 'gemini-3.6-flash';

function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowed = ALLOWED_ORIGINS.has(origin) || origin.startsWith('http://localhost');
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
    const text = String(body?.text || '').trim().slice(0, 500);
    if (!text) return json({ error: 'text is required' }, 400, headers);

    const prompt = `あなたは失語症の人が会話するのを助けるアシスタントです。
会話の相手が次のように話しかけました:「${text}」
これははい/いいえでは答えられない、開かれた質問です。
失語症の人がタップするだけで答えられるように、質問の内容から自然に推測できる、具体的で互いに意味が異なる答えの候補を2〜3個、短い日本語の言葉で提案してください。
出力は候補の配列だけのJSONにしてください。他の文章は含めないでください。`;

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
        return json({ error: detail }, 502, headers);
      }

      const data = await res.json();
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text;
      const choices = JSON.parse(raw);
      if (!Array.isArray(choices) || !choices.length) return json({ error: '候補が空でした' }, 502, headers);
      return json({ choices: choices.slice(0, 3).map(String) }, 200, headers);
    } catch (err) {
      return json({ error: err.message || String(err) }, 500, headers);
    }
  },
};
