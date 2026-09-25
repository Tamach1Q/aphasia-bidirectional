// Phase 6 / T098 — A0 is genuinely assistance-free.
import * as asr from '../../app/capture/asr.js';
import * as session from '../../app/core/session.js';
import * as person from '../../app/views/person.js';
import * as receptive from '../../app/pipelines/receptive.js';
import * as expressive from '../../app/pipelines/expressive.js';
import * as hints from '../../app/core/hint-store.js';
import { assertEqual } from './runner.js';

function mount() {
  const host = document.createElement('section');
  host.innerHTML = '<div id="settled"></div><p id="strip" hidden></p><div id="support" hidden></div>';
  document.body.appendChild(host);
  const config = session.parseConfig('?ai=off');
  session.__resetForTests();
  hints.__resetForTests();
  session.startSession(config);
  person.reset();
  person.mount({
    settledEl: host.querySelector('#settled'),
    transcriptEl: host.querySelector('#strip'),
    supportEl: host.querySelector('#support'),
    config,
  });
  return {
    host,
    config,
    strip: host.querySelector('#strip'),
    settled: host.querySelector('#settled'),
  };
}

export function register(test, inject) {
  test('?ai=off makes zero Worker calls and renders no transcript or AI output (FR-039)', async () => {
    const ui = mount();
    let calls = 0;
    receptive.setTransport(async () => {
      calls += 1;
      return { meaning: 'should never happen' };
    });
    expressive.setTransport(async () => {
      calls += 1;
      return { result: 'ok', hypotheses: [{ text: 'never', evidence: [] }] };
    });

    inject.interim('途中の音声');
    assertEqual(ui.strip.hidden, true);
    assertEqual(ui.strip.textContent, '');

    await person.handlePartnerTurn({
      id: 't1',
      text: 'もし熱が出たら、すぐ電話してください。',
    });
    const fragment = session.appendTurn({ speaker: 'person', text: '10' });
    await expressive.handleFragment(fragment, { config: ui.config });

    assertEqual(calls, 0, 'A0 must make no Worker request');
    assertEqual(ui.strip.hidden, true, 'A0 never renders a transcript');
    assertEqual(ui.strip.textContent, '');
    assertEqual(
      ui.settled.querySelectorAll('.settled-chunk,.partner-hint-view,.confirmation-view').length,
      0,
      'A0 renders no AI output',
    );
    assertEqual(hints.getHintSnapshot().state, 'empty');
    ui.host.remove();
  });

  test('?ai=off constructs no SpeechRecognition object in either mode (FR-039)', () => {
    asr.__resetForTests();
    let made = 0;
    class FakeRecognition {
      constructor() { made += 1; }
    }
    asr.__setRecognitionForTests(FakeRecognition);

    assertEqual(asr.startPartner({ enabled: false }).reason, 'ai-off');
    assertEqual(asr.startExpressive({ enabled: false }).reason, 'ai-off');
    assertEqual(made, 0);
    asr.__resetForTests();
  });
}
