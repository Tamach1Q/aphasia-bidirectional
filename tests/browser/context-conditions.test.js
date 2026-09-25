// Phase 6 / T099 — ctx changes the ACTUAL request body, not downstream interpretation.
import * as session from '../../app/core/session.js';
import * as personalContext from '../../app/core/personal-context.js';
import * as expressive from '../../app/pipelines/expressive.js';
import { assertEqual } from './runner.js';

function start(search) {
  session.__resetForTests();
  personalContext.clearPersonalContext();
  const config = session.parseConfig(search);
  session.startSession(config);
  return config;
}

export function register(test) {
  test('ctx=none sends fragment and nothing else (C0)', () => {
    const config = start('?ctx=none');
    session.appendTurn({ speaker: 'partner', text: '明日は何時？' });
    const fragment = session.appendTurn({ speaker: 'person', text: '10' });

    assertEqual(expressive.buildRequest(fragment, config), {
      op: 'hypotheses',
      fragment: { id: fragment.id, text: '10' },
    });
  });

  test('ctx=session sends fragment + shortTerm + confirmed, not personalContext (C1)', () => {
    const config = start('?ctx=session');
    const partner = session.appendTurn({ speaker: 'partner', text: '明日は何時？' });
    const fragment = session.appendTurn({ speaker: 'person', text: '10' });
    const body = expressive.buildRequest(fragment, config);

    assertEqual(Object.keys(body).sort(), ['confirmed', 'fragment', 'op', 'shortTerm']);
    assertEqual(body.shortTerm, [{ id: partner.id, speaker: 'partner', text: partner.text }]);
    assertEqual(body.confirmed, []);
  });

  test('ctx=personal adds personalContext to the sent body (C2)', () => {
    const config = start('?ctx=personal');
    personalContext.loadFromObject({ places: [{ name: 'さくら台病院' }] });
    session.appendTurn({ speaker: 'partner', text: 'どこ？' });
    const fragment = session.appendTurn({ speaker: 'person', text: 'さくら' });
    const body = expressive.buildRequest(fragment, config);

    assertEqual(Object.keys(body).sort(), [
      'confirmed', 'fragment', 'op', 'personalContext', 'shortTerm',
    ]);
    assertEqual(body.personalContext.places[0].name, 'さくら台病院');
  });
}
