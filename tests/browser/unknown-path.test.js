// Phase 5 / T090-T091 — unknown is a normal, explicit partner path.
import * as session from '../../app/core/session.js';
import * as hints from '../../app/core/hint-store.js';
import * as expressive from '../../app/pipelines/expressive.js';
import * as partner from '../../app/views/partner.js';
import { assert, assertEqual } from './runner.js';

const fixtureFetch = (path) => fetch('../../app/' + path);

function host() {
  const node = document.createElement('section');
  document.body.appendChild(node);
  return node;
}

export function register(test, inject) {
  test('f06 zero hypotheses becomes ordinary unknown and offers a partner action (FR-015, FR-033)', async () => {
    session.__resetForTests();
    hints.__resetForTests();
    inject.reset();
    session.startSession(session.parseConfig('?ctx=session'));

    const data = await inject.fixture('f06-fragment-unanswerable', { fetchImpl: fixtureFetch, play: false });
    const turns = inject.playFixture(data);
    const fragment = turns.find((turn) => turn.speaker === 'person');

    expressive.setTransport(async () => ({ result: 'unknown', hypotheses: [] }));
    const result = await expressive.handleFragment(fragment, { config: session.getConfig() });
    assertEqual(result.state, 'unknown');
    assertEqual(hints.getHintSnapshot().state, 'unknown');

    const el = host();
    let partnerAction = null;
    partner.show({ hostEl: el, onPartnerAction: (kind) => { partnerAction = kind; } });
    assert(el.textContent.includes('まだ意味を絞れていません'));
    assert(el.querySelector('.partner-rephrase'), 'partner-side repair must exist');
    el.querySelector('.partner-rephrase').click();
    assertEqual(partnerAction, 'rephrase');
    assert(el.querySelector('.partner-question-tip'), 'changing the question gives a concrete prompt');
    el.remove();
  });

  test('all safety-suppressed candidates become the same unknown path, never blank (FR-028)', async () => {
    session.__resetForTests();
    hints.__resetForTests();
    session.startSession(session.parseConfig('?ctx=none'));
    const fragment = session.appendTurn({ speaker: 'person', text: 'それ' });

    expressive.setTransport(async () => ({
      result: 'ok',
      hypotheses: [{ text: 'はい、お願いします', evidence: [] }],
    }));
    const result = await expressive.handleFragment(fragment, { config: session.getConfig() });
    assertEqual(result.state, 'unknown');
    assertEqual(result.allSuppressed, true);

    const el = host();
    partner.show({ hostEl: el });
    assert(el.textContent.includes('まだ意味を絞れていません'));
    assert(el.textContent.trim().length > 0, 'fallback is never a blank screen');
    el.remove();
  });
}
