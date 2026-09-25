// Phase 3 — the receptive pipeline end to end, without a network or a document.
//
// The assertion that matters most is a COUNT: a gated-out utterance must produce zero
// calls. Asserting "no output appeared" would pass even if the request had been sent and
// the answer discarded.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as receptive from '../../app/pipelines/receptive.js';
import * as chunker from '../../app/pipelines/chunker.js';

const fixture = (n) => JSON.parse(
  readFileSync(new URL(`../../app/fixtures/${n}.json`, import.meta.url), 'utf8'),
);
const partnerText = (f) => f.turns.find((t) => t.speaker === 'partner').text;

/** Records every request so call COUNT can be asserted, not just absence of output. */
function spy(reply) {
  const calls = [];
  const fn = async (body) => { calls.push(body); return typeof reply === 'function' ? reply(body) : reply; };
  return { fn, calls };
}

const fresh = (transport) => {
  chunker.reset();
  receptive.setTransport(transport);
};

test('f01 produces ZERO network calls — the gate runs first (FR-008)', async () => {
  const t = spy({ meaning: 'should never be requested' });
  fresh(t.fn);

  const r = await receptive.handleTurn({ id: 't1', text: partnerText(fixture('f01-simple-question')) });
  assert.equal(t.calls.length, 0, 'an ordinary utterance must not reach the network');
  assert.equal(r.skipped, 'gated-out');
  assert.equal(r.simplified, null);
  assert.ok(r.chunk, 'the turn is still recorded — only the simplification is skipped');
});

test('f02 reaches the model and returns a simplification', async () => {
  const t = spy({ meaning: '朝：薬を飲む', structure: ['ふらついたら やめる', '電話する'] });
  fresh(t.fn);

  const r = await receptive.handleTurn({ id: 't1', text: partnerText(fixture('f02-conditional-instruction')) });
  assert.equal(t.calls.length, 1);
  assert.equal(t.calls[0].op, 'simplify');
  assert.equal(t.calls[0].level, 'standard');
  assert.equal(r.simplified.meaning, '朝：薬を飲む');
  assert.equal(r.skipped, null);
});

test('[短く] forces simplification of a gated-out utterance (FR-009)', async () => {
  const t = spy({ meaning: '明日、病院に行くか' });
  fresh(t.fn);
  const text = partnerText(fixture('f01-simple-question'));

  await receptive.handleTurn({ id: 't1', text });
  assert.equal(t.calls.length, 0);

  const forced = await receptive.handleTurn({ id: 't1', text }, { force: true });
  assert.equal(t.calls.length, 1, 'force must bypass the gate');
  assert.equal(forced.simplified.meaning, '明日、病院に行くか');
});

test('?ai=off makes no call at all, even for an utterance that would gate in', async () => {
  const t = spy({ meaning: 'x' });
  fresh(t.fn);
  const r = await receptive.handleTurn(
    { id: 't1', text: partnerText(fixture('f02-conditional-instruction')) },
    { aiEnabled: false },
  );
  assert.equal(t.calls.length, 0);
  assert.equal(r.skipped, 'ai-off');
});

test('?receptive=off records the turn but produces no simplification', async () => {
  const t = spy({ meaning: 'x' });
  fresh(t.fn);
  const r = await receptive.handleTurn(
    { id: 't1', text: partnerText(fixture('f02-conditional-instruction')) },
    { receptiveEnabled: false },
  );
  assert.equal(t.calls.length, 0);
  assert.equal(r.skipped, 'receptive-off');
  assert.ok(r.chunk);
});

test('a polarity-reversed simplification is SUPPRESSED, not shown (FR-028)', async () => {
  // The f04 disaster case: the source prohibits the medicine, the model says to take it.
  const t = spy({ meaning: 'お風呂は入って大丈夫です。今日は薬を飲んでください。' });
  fresh(t.fn);

  const r = await receptive.handleTurn({ id: 't1', text: partnerText(fixture('f04-negation')) });
  assert.equal(r.simplified, null, 'a reversed simplification must never reach the person');
  assert.equal(r.skipped, 'suppressed');
  assert.ok(r.violations.some((v) => v.check === 'polarity'));
});

test('the correct f04 simplification passes', async () => {
  // Observed from the Stage 0 run. Safety must not suppress real correct output.
  const t = spy({
    meaning: 'お風呂は入れますが、今日は薬を飲まないでください。',
    structure: ['お風呂：入って大丈夫', '薬：今日は飲まない'],
  });
  fresh(t.fn);

  const r = await receptive.handleTurn({ id: 't1', text: partnerText(fixture('f04-negation')) });
  assert.equal(r.skipped, null, JSON.stringify(r.violations));
  assert.ok(r.simplified);
});

test('safety judges the whole block, not line by line', async () => {
  // 「お風呂：入って大丈夫」 alone looks like it dropped the negation sitting in the next
  // line. Judged as a block it is correct — and the block is what the person sees.
  const t = spy({ meaning: 'まとめ', structure: ['お風呂：入って大丈夫', '薬：今日は飲まない'] });
  fresh(t.fn);
  const r = await receptive.handleTurn({ id: 't1', text: partnerText(fixture('f04-negation')) });
  assert.equal(r.skipped, null, JSON.stringify(r.violations));
});

test('a failed request leaves the transcript rather than fabricating', async () => {
  fresh(async () => { throw new Error('network down'); });
  const r = await receptive.handleTurn({ id: 't1', text: partnerText(fixture('f02-conditional-instruction')) });
  assert.equal(r.simplified, null);
  assert.equal(r.skipped, 'request-failed');
  assert.ok(r.chunk, 'the raw turn survives — that is the honest fallback');
});

test('an empty response is not treated as a simplification', async () => {
  fresh(spy({ error: 'upstream failed' }).fn);
  const r = await receptive.handleTurn({ id: 't1', text: partnerText(fixture('f02-conditional-instruction')) });
  assert.equal(r.simplified, null);
  assert.equal(r.skipped, 'no-result');
});

test('a re-emitted growing turn is marked as revising the previous chunk (FR-010)', async () => {
  const t = spy({ meaning: 'まとめ' });
  fresh(t.fn);
  await receptive.handleTurn({ id: 't1', text: '朝ごはんのあとに薬を飲んでください。もしふらついたら' });
  const second = await receptive.handleTurn({
    id: 't2', text: '朝ごはんのあとに薬を飲んでください。もしふらついたら電話してください。',
  });
  assert.ok(second.simplified.revises, 'the continuation must be marked, not silently swapped');
});
