// The Worker is the one piece node cannot execute (it needs the Workers runtime), so its
// contract is pinned by inspection instead. These are the properties whose breakage would
// only show up in a deployed session.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripComments } from './_source.js';

const SRC = readFileSync(new URL('../../worker/index.js', import.meta.url), 'utf8');
const TOML = readFileSync(new URL('../../worker/wrangler.toml', import.meta.url), 'utf8');
const code = stripComments(SRC, 'worker/index.js');

test('the legacy compatibility contract still works alongside both current op contracts', () => {
  // A body WITHOUT `op` still reaches the old { text } -> { choices } handler.
  // The current app no longer calls it; this assertion only pins the intentionally retained
  // compatibility surface while simplify and hypotheses remain the active app contract.
  assert.match(code, /body\?\.op === 'simplify'/, 'simplify dispatch must be explicit');
  assert.match(code, /body\?\.op === 'hypotheses'/, 'hypotheses dispatch must be explicit');
  assert.match(code, /choices/, 'the legacy response shape must still be produced');
  assert.match(code, /String\(body\?\.text \|\| ''\)/, 'the legacy text path must survive');
});

test('prompts are imported, not pasted — one source of truth', () => {
  // Inlining would let the deployed prompt drift from the file the tests pin and the
  // Stage 0 evaluation measured.
  assert.match(code, /import SIMPLIFY_PROMPT from '\.\/prompts\/simplify\.txt'/);
  assert.match(code, /import HYPOTHESES_PROMPT from '\.\/prompts\/hypotheses\.txt'/);
  assert.match(TOML, /type = "Text"/, 'wrangler must be configured for Text modules');
  assert.match(TOML, /globs = \["prompts\/\*\.txt"\]/);
});

test('each operation reads its OWN model from configuration', () => {
  // research.md §2b resolved the two operations differently. Collapsing them back to one
  // constant would silently undo that.
  assert.match(code, /env\.SIMPLIFY_MODEL/);
  assert.match(TOML, /SIMPLIFY_MODEL\s*=\s*"gemini-3\.5-flash-lite"/);
  assert.match(TOML, /HYPOTHESES_MODEL\s*=/);
});

test('model ids are stable — never a preview id or a moving alias', () => {
  // An alias keeps working while changing meaning underneath, which is the last thing a
  // prototype used in participant sessions should sit on.
  const ids = [...TOML.matchAll(/MODEL\s*=\s*"([^"]+)"/g)].map((m) => m[1]);
  assert.ok(ids.length >= 2);
  for (const id of ids) {
    assert.equal(/preview|latest|exp/.test(id), false, `unstable model id in config: ${id}`);
  }
});

test('simplify enforces a schema with `meaning` required', () => {
  assert.match(code, /SIMPLIFY_SCHEMA/);
  assert.match(code, /required:\s*\['meaning'\]/);
  assert.match(code, /maxItems:\s*3/, 'options are capped at 3 (§5.2)');
});

test('transient capacity errors are retried, other failures are not', () => {
  assert.match(code, /res\.status === 503 \|\| res\.status === 429/);
  assert.match(code, /attempts = \[0, 600, 1800\]|\[0, 600, 1800\]/);
});

test('the API key is read from the environment and never logged', () => {
  assert.match(code, /env\.GEMINI_API_KEY/);
  assert.equal(/console\.(log|info|warn|error)\([^)]*GEMINI_API_KEY/.test(code), false,
    'the key must never reach a log line');
});

test('CORS stays restricted to an allowlist and exact localhost hostname', () => {
  assert.match(code, /ALLOWED_ORIGINS/);
  assert.match(code, /new URL\(origin\)/, 'localhost development origins must be parsed as URLs');
  assert.match(code, /url\.protocol === 'http:'\s*&&\s*url\.hostname === 'localhost'/);
  assert.doesNotMatch(
    code,
    /origin\.startsWith\(['"]http:\/\/localhost/,
    'prefix matching would also allow hosts such as localhost.attacker.example',
  );
  assert.match(code, /'Access-Control-Allow-Origin'/);
  assert.match(code, /Origin not allowed/);
});


test('hypotheses permits zero through three candidates and unknown', () => {
  assert.match(code, /HYPOTHESES_SCHEMA/);
  assert.match(code, /minItems:\s*0/);
  assert.match(code, /maxItems:\s*3/);
  assert.match(code, /enum:\s*\['ok',\s*'unknown'\]/);
  assert.match(code, /env\.HYPOTHESES_MODEL/);
});
