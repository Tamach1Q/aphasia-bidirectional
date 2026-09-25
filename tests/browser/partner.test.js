// Phase 4 — explicit partner view acceptance (T081–T083).
import * as session from '../../app/core/session.js';
import * as hints from '../../app/core/hint-store.js';
import * as partner from '../../app/views/partner.js';
import { assert, assertEqual } from './runner.js';

export function register(test) {
  test('held hints render only after explicit partner.show()', () => {
    session.__resetForTests();
    hints.__resetForTests();
    session.startSession(session.parseConfig(''));
    const turn = session.appendTurn({ speaker: 'person', text: '10' });
    const generation = hints.clearHints();
    hints.setHypotheses(turn.id, [{
      text: '10時',
      evidence: [{ source: 'turn', id: turn.id, excerpt: '10' }],
    }], generation);

    const host = document.createElement('section');
    document.body.appendChild(host);
    assertEqual(host.childElementCount, 0);

    partner.show({ hostEl: host });
    assertEqual(host.querySelectorAll('.hypothesis-card').length, 1);
    assertEqual(host.querySelector('.hypothesis-text').textContent, '10時');
    assertEqual(host.querySelector('.evidence-quote').textContent, '「10」');
    assert(host.textContent.includes('確認前のAI推測'));
    host.remove();
  });

  test('partner selection passes one minimal confirmation request with verified basis', () => {
    session.__resetForTests();
    hints.__resetForTests();
    session.startSession(session.parseConfig(''));
    const turn = session.appendTurn({ speaker: 'person', text: '10' });
    const generation = hints.clearHints();
    hints.setHypotheses(turn.id, [{
      text: '10時',
      evidence: [{ source: 'turn', id: turn.id, excerpt: '10' }],
    }], generation);

    const host = document.createElement('section');
    document.body.appendChild(host);
    let request = null;
    partner.show({ hostEl: host, onConfirm: (value) => { request = value; } });
    host.querySelector('.hypothesis-check').click();

    assertEqual(request.text, '10時');
    assertEqual(Object.keys(request).sort(), ['hypothesisId', 'text']);
    assertEqual(partner.getSelectedConfirmation().basis, [turn.id]);
    host.remove();
  });
}
