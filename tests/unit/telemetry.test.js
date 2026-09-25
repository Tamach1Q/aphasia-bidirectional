// Phase 6 / T104-T105 — telemetry is useful without retaining participant language.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as telemetry from '../../app/core/telemetry.js';
import * as safety from '../../app/safety/index.js';
import * as session from '../../app/core/session.js';
import { verifyHypotheses } from '../../app/evidence/verify.js';

test('safety suppression logs categories/count but not candidate/source text', () => {
  const events = [];
  telemetry.__setSinkForTests((kind, data) => events.push({ kind, data }));
  safety.filter(
    [{ text: '今日は薬を飲んでください。' }],
    '今日は薬を飲まないでください。',
  );

  assert.equal(events.length, 1);
  assert.equal(events[0].kind, 'safety-suppression');
  assert.equal(events[0].data.count, 1);
  assert.ok(events[0].data.checks.includes('polarity'));
  assert.equal(JSON.stringify(events).includes('薬を'), false);
});

test('evidence failures log reasons/count but not excerpts', () => {
  const events = [];
  telemetry.__setSinkForTests((kind, data) => events.push({ kind, data }));
  session.__resetForTests();
  session.startSession(session.parseConfig('?ctx=none'));

  verifyHypotheses([{
    text: '候補',
    evidence: [{ source: 'turn', id: 'missing', excerpt: '秘密の発話' }],
  }]);

  assert.equal(events.length, 1);
  assert.equal(events[0].kind, 'evidence-verification');
  assert.equal(events[0].data.count, 1);
  assert.ok(events[0].data.reasons.includes('turn-not-found'));
  assert.equal(JSON.stringify(events).includes('秘密の発話'), false);
});

test('latency log contains duration and operation name only', () => {
  const events = [];
  telemetry.__setSinkForTests((kind, data) => events.push({ kind, data }));
  const ms = telemetry.logLatency('worker:hypotheses', telemetry.now());

  assert.equal(events[0].kind, 'latency');
  assert.equal(events[0].data.kind, 'worker:hypotheses');
  assert.equal(typeof ms, 'number');
});
