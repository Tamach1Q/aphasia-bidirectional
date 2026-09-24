// Stage 2 acceptance — specs/002-context-aware-dyadic-support/tasks.md T036
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as inject from '../../app/capture/inject.js';
import * as intake from '../../app/capture/intake.js';
import * as session from '../../app/core/session.js';
import * as pc from '../../app/core/personal-context.js';

const fresh = () => {
  session.__resetForTests();
  intake.__resetForTests();
  inject.enable(true);
  session.startSession({ ai: 'on', receptive: 'on', ctx: 'personal' });
};

test('injection is gated — disabled by default (contracts §Availability)', () => {
  session.__resetForTests();
  inject.enable(false);
  assert.equal(inject.isEnabled(), false);
  assert.throws(() => inject.turn({ speaker: 'partner', text: 'あ' }), /not enabled/);
  assert.throws(() => inject.interim('あ'), /not enabled/);
  assert.throws(() => inject.playFixture({ turns: [] }), /not enabled/);
});

test('an injected turn is indistinguishable from an ASR turn downstream (FR-043)', () => {
  fresh();
  const viaAsr = intake.submitTurn({ speaker: 'partner', text: '何時？', source: 'asr' });
  const viaInject = inject.turn({ speaker: 'partner', text: '10時' });

  assert.deepEqual(Object.keys(viaAsr).sort(), Object.keys(viaInject).sort());
  // Both land in the same store, in order, with sequential ids.
  const turns = session.getTurns();
  assert.deepEqual(turns.map((t) => t.text), ['何時？', '10時']);
});

test('both sources go through the SAME intake door', () => {
  fresh();
  const seen = [];
  intake.onTurn((t) => seen.push(t.source));
  intake.submitTurn({ speaker: 'partner', text: 'a', source: 'asr' });
  inject.turn({ speaker: 'person', text: 'b' });
  assert.deepEqual(seen, ['asr', 'injected'], 'one listener observes both paths');
});

test('interim never creates a Turn (FR-002, FR-010)', () => {
  fresh();
  let received = null;
  intake.onInterim((text) => { received = text; });
  inject.interim('とちゅう…');
  assert.equal(received, 'とちゅう…', 'interim reaches its listeners');
  assert.equal(session.getTurns().length, 0, 'but creates no Turn');
});

test('no pipeline may branch on source — it is research metadata only', () => {
  // Guard: if a consumer ever inspects `source`, injected turns stop being
  // indistinguishable and this test path stops proving anything.
  const consumers = ['app/capture/intake.js', 'app/core/session.js'];
  for (const rel of consumers) {
    const src = readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8');
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.equal(
      /['"]injected['"]\s*(===|!==|==|!=)/.test(code), false,
      `${rel} compares against 'injected'`,
    );
  }
});

test('playFixture plays turns in order and skips empty ones', () => {
  fresh();
  const made = inject.playFixture({
    turns: [
      { speaker: 'partner', text: '明日の病院、何時？' },
      { speaker: 'person', text: '   ' },
      { speaker: 'person', text: '…10…' },
    ],
  });
  assert.equal(made.length, 2, 'the whitespace-only turn is discarded');
  assert.deepEqual(session.getTurns().map((t) => t.speaker), ['partner', 'person']);
});

test('fixture() loads personal context from the fixture and reads only app/fixtures/', async () => {
  fresh();
  let requested = null;
  const fakeFetch = async (url) => {
    requested = url;
    return {
      ok: true,
      json: async () => ({
        name: 'f-test',
        turns: [{ speaker: 'partner', text: '何時？' }],
        personalContext: { people: [{ name: 'みどり', relation: '娘' }] },
        expect: { gate: 'skip' },
      }),
    };
  };
  const data = await inject.fixture('f-test', { fetchImpl: fakeFetch });
  assert.equal(requested, 'fixtures/f-test.json');
  assert.equal(data.expect.gate, 'skip', 'the expect annotation is returned to the caller');
  assert.equal(pc.getPersonalContext().people[0].relation, '娘');
  assert.equal(session.getTurns().length, 1);
});

test('fixture() rejects names that could escape app/fixtures/', async () => {
  fresh();
  const never = () => { throw new Error('fetch must not be called'); };
  for (const bad of ['../secret', 'a/b', '/etc/passwd', '']) {
    await assert.rejects(() => inject.fixture(bad, { fetchImpl: never }), /invalid fixture name/);
  }
});

test('reset clears session and personal context', () => {
  fresh();
  inject.turn({ speaker: 'partner', text: 'あ' });
  pc.loadFromObject({ people: [{ name: 'x', relation: 'y' }] });
  inject.reset();
  assert.equal(session.isActive(), false);
  assert.equal(pc.getPersonalContext(), null);
});

test('the shipped fixtures README documents the no-real-data rule (FR-005)', () => {
  const readme = readFileSync(new URL('../../app/fixtures/README.md', import.meta.url), 'utf8');
  assert.match(readme, /SYNTHETIC/i);
  assert.match(readme, /review-blocking/i);
});
