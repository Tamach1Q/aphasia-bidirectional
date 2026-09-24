// Stage 3 acceptance — specs/002-context-aware-dyadic-support/tasks.md T043
//
// asr.js is DOM-free precisely so its state machine can be exercised here. A fake
// recognition constructor stands in for the browser's, which lets the two rules that
// matter be asserted directly: nothing is constructed when ai is off, and a stale
// generation cannot resurrect a stopped session.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as asr from '../../app/capture/asr.js';
import * as intake from '../../app/capture/intake.js';
import * as session from '../../app/core/session.js';

/** Records construction and lets a test drive the callbacks a real engine would. */
function fakeEngine() {
  const made = [];
  class Fake {
    constructor() {
      this.started = 0;
      this.stopped = 0;
      made.push(this);
    }
    start() { this.started += 1; }
    stop() { this.stopped += 1; }
    /** Simulate a result event. */
    emit(parts) {
      const results = parts.map(([transcript, isFinal]) => {
        const r = [{ transcript }];
        r.isFinal = isFinal;
        return r;
      });
      results.resultIndex = 0;
      this.onresult?.({ resultIndex: 0, results });
    }
  }
  return { Fake, made };
}

const fresh = () => {
  asr.__resetForTests();
  intake.__resetForTests();
  session.__resetForTests();
  session.startSession({ ai: 'on', receptive: 'on', ctx: 'personal' });
};

// --- FR-039: the A0 baseline must not touch recognition at all -------------------

test('ai=off constructs NO recognition object — partner (FR-039)', () => {
  fresh();
  const { Fake, made } = fakeEngine();
  asr.__setRecognitionForTests(Fake);

  const r = asr.startPartner({ enabled: false });
  assert.deepEqual(r, { started: false, reason: 'ai-off' });
  assert.equal(made.length, 0, 'a recognition object was constructed under ai=off');
});

test('ai=off constructs NO recognition object — expressive (FR-039)', () => {
  fresh();
  const { Fake, made } = fakeEngine();
  asr.__setRecognitionForTests(Fake);

  const r = asr.startExpressive({ enabled: false });
  assert.deepEqual(r, { started: false, reason: 'ai-off' });
  assert.equal(made.length, 0);
});

test('the ai-off check precedes the availability check', () => {
  // Order matters: if availability were checked first, a browser WITH recognition would
  // still construct one before noticing the condition.
  fresh();
  const { Fake, made } = fakeEngine();
  asr.__setRecognitionForTests(Fake);
  asr.startPartner({ enabled: false });
  asr.startExpressive({ enabled: false });
  assert.equal(made.length, 0);
});

// --- unavailable: report, never fabricate ---------------------------------------

test('unavailable recognition reports a reason and invents no text', () => {
  fresh();
  asr.__setRecognitionForTests(null);

  assert.deepEqual(asr.startPartner({ enabled: true }), { started: false, reason: 'unavailable' });
  assert.deepEqual(asr.startExpressive({ enabled: true }), { started: false, reason: 'unavailable' });
  assert.equal(session.getTurns().length, 0, 'no turn may be fabricated when ASR is missing');
});

// --- partner mode ----------------------------------------------------------------

test('partner: a final result becomes a Turn, an interim one does not', () => {
  fresh();
  const { Fake, made } = fakeEngine();
  asr.__setRecognitionForTests(Fake);
  const interims = [];
  intake.onInterim((t) => interims.push(t));

  asr.startPartner({ enabled: true });
  const engine = made[0];
  assert.equal(engine.started, 1);
  assert.equal(engine.continuous, true);
  assert.equal(engine.lang, 'ja-JP');

  engine.emit([['とちゅう', false]]);
  assert.deepEqual(interims, ['とちゅう']);
  assert.equal(session.getTurns().length, 0, 'interim must not create a Turn');

  engine.emit([['明日の病院、何時？', true]]);
  assert.equal(session.getTurns().length, 1);
  assert.equal(session.getTurns()[0].text, '明日の病院、何時？');
  assert.equal(session.getTurns()[0].source, 'asr');
});

test('partner: a stale generation cannot resurrect a stopped session', () => {
  fresh();
  const { Fake, made } = fakeEngine();
  asr.__setRecognitionForTests(Fake);

  asr.startPartner({ enabled: true });
  const engine = made[0];
  asr.stopPartner();

  // A late result arriving after stop must be discarded, not appended.
  engine.onresult?.({ resultIndex: 0, results: [] });
  engine.emit?.([['遅れて来た', true]]);
  assert.equal(session.getTurns().length, 0);
});

test('partner: starting twice does not stack engines', () => {
  fresh();
  const { Fake, made } = fakeEngine();
  asr.__setRecognitionForTests(Fake);
  asr.startPartner({ enabled: true });
  asr.startPartner({ enabled: true });
  assert.equal(made.length, 1, 'a second start while running must be a no-op');
});

test('partner: pause stops the engine and reports whether it had been running', () => {
  fresh();
  const { Fake, made } = fakeEngine();
  asr.__setRecognitionForTests(Fake);
  asr.startPartner({ enabled: true });
  assert.equal(asr.isPartnerRunning(), true);
  assert.equal(asr.pausePartner(), true);
  assert.equal(asr.isPartnerRunning(), false);
  assert.equal(made[0].stopped, 1);
  assert.equal(asr.pausePartner(), false, 'pausing again reports it was not running');
});

// --- expressive mode -------------------------------------------------------------

test('expressive: one-shot config, and a final result settles a person Turn', () => {
  fresh();
  const { Fake, made } = fakeEngine();
  asr.__setRecognitionForTests(Fake);
  let finalSeen = null;

  asr.startExpressive({ enabled: true, onFinal: (t) => { finalSeen = t; } });
  const engine = made[0];
  assert.equal(engine.continuous, false, 'expressive capture is one utterance');

  engine.emit([['…10…', true]]);
  assert.equal(finalSeen, '…10…');
  assert.equal(session.getTurns().length, 1);
  assert.equal(session.getTurns()[0].speaker, 'person');
});

test('expressive: finishing does not demand a review step first (FR-013)', () => {
  fresh();
  const { Fake, made } = fakeEngine();
  asr.__setRecognitionForTests(Fake);
  asr.startExpressive({ enabled: true });
  made[0].emit([['娘 明日 病院', false]]);

  // The person taps 終わる. The fragment settles immediately — no confirm, no edit gate.
  const turn = asr.finishExpressive();
  assert.equal(turn.text, '娘 明日 病院');
  assert.equal(session.getTurns().length, 1);
});

test('expressive: an empty fragment settles nothing', () => {
  fresh();
  const { Fake, made } = fakeEngine();
  asr.__setRecognitionForTests(Fake);
  asr.startExpressive({ enabled: true });
  assert.equal(asr.finishExpressive('   '), null);
  assert.equal(session.getTurns().length, 0);
});

test('expressive: finishing twice settles once', () => {
  fresh();
  const { Fake, made } = fakeEngine();
  asr.__setRecognitionForTests(Fake);
  asr.startExpressive({ enabled: true });
  made[0].emit([['あ', false]]);
  asr.finishExpressive();
  asr.finishExpressive();
  assert.equal(session.getTurns().length, 1);
});

// --- error reporting --------------------------------------------------------------

test('error wording stays non-blaming and offers the typed path (FR-032)', () => {
  for (const code of ['not-allowed', 'no-speech', 'network', 'something-else']) {
    const msg = asr.friendlyError(code);
    assert.ok(msg.length > 0);
    assert.equal(/失敗|エラー|不正|無効/.test(msg), false, `blaming wording for ${code}: ${msg}`);
  }
  assert.match(asr.friendlyError('not-allowed'), /文字でも入力できます/);
});
