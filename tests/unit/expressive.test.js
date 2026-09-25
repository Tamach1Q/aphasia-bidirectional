// Phase 4 — T077 acceptance and OQ-11 regression tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as session from '../../app/core/session.js';
import * as personalContext from '../../app/core/personal-context.js';
import * as hints from '../../app/core/hint-store.js';
import * as expressive from '../../app/pipelines/expressive.js';

function fresh(search = '?ctx=personal') {
  session.__resetForTests();
  personalContext.clearPersonalContext();
  hints.__resetForTests();
  const config = session.parseConfig(search);
  session.startSession(config);
  return config;
}

test('request construction obeys ctx exactly', () => {
  let config = fresh('?ctx=none');
  session.appendTurn({ speaker: 'partner', text: '明日の病院、何時？' });
  let fragment = session.appendTurn({ speaker: 'person', text: '10' });
  assert.deepEqual(Object.keys(expressive.buildRequest(fragment, config)).sort(), ['fragment', 'op']);

  config = fresh('?ctx=session');
  const partner = session.appendTurn({ speaker: 'partner', text: '明日の病院、何時？' });
  fragment = session.appendTurn({ speaker: 'person', text: '10' });
  const body = expressive.buildRequest(fragment, config);
  assert.deepEqual(Object.keys(body).sort(), ['confirmed', 'fragment', 'op', 'shortTerm']);
  assert.deepEqual(body.shortTerm, [{ id: partner.id, speaker: 'partner', text: partner.text }]);

  config = fresh('?ctx=personal');
  personalContext.loadFromObject({ places: [{ name: 'さくら台病院' }] });
  fragment = session.appendTurn({ speaker: 'person', text: 'さくら' });
  assert.equal('personalContext' in expressive.buildRequest(fragment, config), true);
});

test('OQ-11 grounding includes only semantic values actually sent', () => {
  const request = {
    op: 'hypotheses',
    fragment: { id: 't12', text: 'それ' },
    confirmed: [{ id: 'c99', text: '今日は薬を飲まない' }],
    personalContext: { topics: ['病院'] },
  };
  const source = expressive.groundingText(request);
  assert.match(source, /それ/);
  assert.match(source, /今日は薬を飲まない/);
  assert.match(source, /病院/);
  assert.equal(source.includes('t12'), false, 'turn ids are schema, not grounding text');
  assert.equal(source.includes('c99'), false, 'confirmed ids are schema, not grounding text');
  assert.equal(source.includes('topics'), false, 'object keys must not trigger lexical checks');
});

test('confirmed context can ground polarity without weakening the rule (OQ-11)', async () => {
  const config = fresh('?ctx=session');
  const basis = session.appendTurn({ speaker: 'partner', text: '薬のこと？' });
  session.selectForConfirmation({
    hypothesisId: 'seed',
    text: '今日は薬を飲まない',
    basis: [basis.id],
  });
  const confirmed = session.confirmSelected();
  const fragment = session.appendTurn({ speaker: 'person', text: 'それ' });

  expressive.setTransport(async () => ({
    result: 'ok',
    hypotheses: [{
      text: '今日は薬を飲まない',
      evidence: [{ source: 'confirmed', id: confirmed.id, excerpt: '薬を飲まない' }],
    }],
  }));

  const result = await expressive.handleFragment(fragment, { config });
  assert.equal(result.state, 'ready');
  assert.equal(hints.getHintSnapshot().hypotheses[0].text, '今日は薬を飲まない');
});

test('bad evidence is dropped but a safety-passed hypothesis survives', async () => {
  const config = fresh('?ctx=session');
  session.appendTurn({ speaker: 'partner', text: '明日の病院、何時だった？' });
  const fragment = session.appendTurn({ speaker: 'person', text: '10' });

  expressive.setTransport(async () => ({
    result: 'ok',
    hypotheses: [{
      text: '10時',
      evidence: [{ source: 'turn', id: 't999', excerpt: '10' }],
    }],
  }));

  const result = await expressive.handleFragment(fragment, { config });
  assert.equal(result.state, 'ready');
  assert.equal(result.evidenceFailures.length, 1);
  assert.deepEqual(hints.getHintSnapshot().hypotheses[0].evidence, []);
});

test('all safety-suppressed candidates become unknown, never repaired', async () => {
  const config = fresh('?ctx=none');
  const fragment = session.appendTurn({ speaker: 'person', text: 'それ' });

  expressive.setTransport(async () => ({
    result: 'ok',
    hypotheses: [{ text: 'はい、お願いします', evidence: [] }],
  }));

  const result = await expressive.handleFragment(fragment, { config });
  assert.equal(result.state, 'unknown');
  assert.equal(result.allSuppressed, true);
  assert.equal(hints.getHintSnapshot().state, 'unknown');
});

test('model unknown / zero hypotheses is a normal unknown state', async () => {
  const config = fresh('?ctx=none');
  const fragment = session.appendTurn({ speaker: 'person', text: 'あれ' });
  expressive.setTransport(async () => ({ result: 'unknown', hypotheses: [] }));

  const result = await expressive.handleFragment(fragment, { config });
  assert.equal(result.state, 'unknown');
  assert.equal(hints.getHintSnapshot().state, 'unknown');
});

test('a stale response cannot overwrite a newer fragment', async () => {
  const config = fresh('?ctx=none');
  const first = session.appendTurn({ speaker: 'person', text: 'ひとつめ' });
  let release;
  expressive.setTransport(() => new Promise((resolve) => { release = resolve; }));
  const oldPromise = expressive.handleFragment(first, { config });

  const second = session.appendTurn({ speaker: 'person', text: 'ふたつめ' });
  expressive.setTransport(async () => ({
    result: 'ok',
    hypotheses: [{ text: '新しい候補', evidence: [{ source: 'turn', id: second.id, excerpt: 'ふたつめ' }] }],
  }));
  const newer = await expressive.handleFragment(second, { config });
  assert.equal(newer.state, 'ready');

  release({
    result: 'ok',
    hypotheses: [{ text: '古い候補', evidence: [{ source: 'turn', id: first.id, excerpt: 'ひとつめ' }] }],
  });
  const old = await oldPromise;
  assert.equal(old.state, 'stale');
  assert.equal(hints.getHintSnapshot().hypotheses[0].text, '新しい候補');
});
