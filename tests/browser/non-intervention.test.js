// Phase 4 / T073 — storing generated hypotheses must be visually silent (FR-019).
import * as hints from '../../app/core/hint-store.js';
import { assert, assertEqual } from './runner.js';

export function register(test) {
  test('writing generated hypotheses causes zero DOM mutation', async () => {
    hints.__resetForTests();
    const marker = document.createElement('div');
    marker.id = 'nonInterventionMarker';
    document.body.appendChild(marker);

    const records = [];
    const observer = new MutationObserver((items) => records.push(...items));
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });

    const generation = hints.clearHints();
    hints.setHypotheses('t2', [{
      text: '10時',
      evidence: [{ source: 'turn', id: 't2', excerpt: '10' }],
    }], generation);
    await Promise.resolve();

    observer.disconnect();
    marker.remove();
    assertEqual(records.length, 0, 'hint-store writes must not touch the document');
  });

  test('no availability indicator, badge or banner exists after generation', () => {
    hints.__resetForTests();
    const generation = hints.clearHints();
    hints.setHypotheses('t2', [{ text: '10時', evidence: [] }], generation);

    const indicator = document.querySelector(
      '[data-hint-available], .hint-badge, .hint-banner, #hintIndicator, #hintAvailable',
    );
    assert(!indicator, 'generation must not announce that hints are available');
  });
}
