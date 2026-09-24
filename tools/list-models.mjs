// T017 — enumerate candidate models for Stage 0.
//
// Candidates are discovered from the API rather than written down here, because a model
// list in a document goes stale silently. This repo has already been broken once by a
// retirement (8571c30, gemini-2.0-flash), so the filter excludes anything that is not a
// stable, currently-served id.
//
// Reads GEMINI_API_KEY from the environment only. Never writes it anywhere.
//
//   env -u NODE_OPTIONS node tools/list-models.mjs
//   env -u NODE_OPTIONS node tools/list-models.mjs --all     # skip the filter, show everything

const KEY = process.env.GEMINI_API_KEY;
if (!KEY) {
  console.error('GEMINI_API_KEY is not set. Export it in your shell profile; never commit it.');
  process.exit(1);
}

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

/** Ids we will not put in front of a participant, whatever they score. */
const UNSTABLE = /preview|exp(erimental)?|-exp-|latest|dev\b|tuning|thinking-exp/i;

/** The tier this product needs: a fast, general model for two short-turnaround tasks. */
const FLASH_TIER = /flash/i;

/**
 * Modality-specialised variants. Both operations are text-in / JSON-out, so a
 * speech-synthesis or image-generation build is not a candidate however stable it is.
 */
const WRONG_MODALITY = /-tts$|-tts-|-image$|-image-/i;

async function listModels() {
  const out = [];
  let pageToken = '';
  do {
    const url = `${BASE}/models?pageSize=200${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const res = await fetch(url, { headers: { 'x-goog-api-key': KEY } });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`ListModels failed: HTTP ${res.status} ${body.slice(0, 300)}`);
    }
    const data = await res.json();
    out.push(...(data.models || []));
    pageToken = data.nextPageToken || '';
  } while (pageToken);
  return out;
}

function shortId(name) {
  return String(name || '').replace(/^models\//, '');
}

const models = await listModels();
const all = process.argv.includes('--all');

const usable = models.filter((m) =>
  (m.supportedGenerationMethods || []).includes('generateContent'));

const candidates = usable.filter((m) => {
  const id = shortId(m.name);
  if (all) return true;
  if (!FLASH_TIER.test(id)) return false;
  if (UNSTABLE.test(id)) return false;
  if (WRONG_MODALITY.test(id)) return false;
  return true;
});

// Prefer the most recent-looking stable ids, but do not guess at ordering beyond that:
// the operator picks from this list, the script does not decide.
candidates.sort((a, b) => shortId(b.name).localeCompare(shortId(a.name)));

console.log(`total models visible to this key: ${models.length}`);
console.log(`supporting generateContent:       ${usable.length}`);
console.log(`stable Flash-tier candidates:     ${candidates.length}`);
console.log('');

for (const m of candidates) {
  const id = shortId(m.name);
  const inTok = m.inputTokenLimit ?? '?';
  const outTok = m.outputTokenLimit ?? '?';
  console.log(`${id.padEnd(42)} in:${String(inTok).padStart(8)}  out:${String(outTok).padStart(6)}`);
}

if (!all) {
  const report = (label, pred) => {
    const ids = usable.map((m) => shortId(m.name))
      .filter((id) => FLASH_TIER.test(id) && pred(id));
    if (!ids.length) return;
    console.log('');
    console.log(`excluded — ${label} (${ids.length}):`);
    for (const id of ids) console.log(`  ${id}`);
  };
  report('preview / experimental / moving alias', (id) => UNSTABLE.test(id));
  report('wrong modality for a text task', (id) => !UNSTABLE.test(id) && WRONG_MODALITY.test(id));
}
