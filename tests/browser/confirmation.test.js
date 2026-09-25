// Phase 4 / T074 — red-first acceptance for the person-side confirmation surface.
//
// This suite is registered when T084/T085 land. It is written now so the implementation
// has an exact target: one hypothesis, yes/no, and only yes may write Confirmed.
import * as session from '../../app/core/session.js';
import * as person from '../../app/views/person.js';
import { assert, assertEqual } from './runner.js';

function mountFresh() {
  const host = document.createElement('section');
  host.innerHTML = '<div id="settled"></div><p id="strip" hidden></p><div id="support"></div>';
  document.body.appendChild(host);

  session.__resetForTests();
  session.startSession(session.parseConfig(''));
  person.reset();
  person.mount({
    settledEl: host.querySelector('#settled'),
    transcriptEl: host.querySelector('#strip'),
    supportEl: host.querySelector('#support'),
    config: session.parseConfig(''),
  });
  return { host, settled: host.querySelector('#settled') };
}

export function register(test) {
  test('person sees exactly one hypothesis with はい / ちがう and never a list (FR-023)', () => {
    const ui = mountFresh();
    session.selectForConfirmation({ hypothesisId: 'h1', text: '10時', basis: [] });
    person.showConfirmation();

    assertEqual(ui.settled.querySelectorAll('.confirmation-meaning').length, 1);
    assertEqual(ui.settled.querySelector('.confirmation-meaning').textContent, '10時');
    assertEqual([...ui.settled.querySelectorAll('.confirmation-action')].map((b) => b.textContent), ['はい', 'ちがう']);
    assertEqual(ui.settled.querySelectorAll('.choice-list').length, 0, 'candidate lists never cross to person view');
    ui.host.remove();
  });

  test('only はい writes to session.confirmed (FR-024)', () => {
    let ui = mountFresh();
    session.selectForConfirmation({ hypothesisId: 'h1', text: '10時', basis: ['t1'] });
    person.showConfirmation();
    ui.settled.querySelector('#confirmNo').click();
    assertEqual(session.getConfirmed().length, 0, 'ちがう stores nothing');
    ui.host.remove();

    ui = mountFresh();
    session.selectForConfirmation({ hypothesisId: 'h2', text: '10時', basis: ['t1'] });
    person.showConfirmation();
    ui.settled.querySelector('#confirmYes').click();
    assertEqual(session.getConfirmed().length, 1, 'はい is the one write path');
    assert(session.getConfirmed()[0].text === '10時');
    ui.host.remove();
  });
}
