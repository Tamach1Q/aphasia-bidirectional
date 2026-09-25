// Partner view — the only production reader of hintStore (§9.2, FR-018–FR-022).
//
// This view is never rendered automatically. views/person.js invokes show() only after a
// human taps [ことばのヒント]. Evidence shown here is verified input text, never AI-authored
// reasoning.

import { getHintSnapshot } from '../core/hint-store.js';
import * as session from '../core/session.js';

let selectedConfirmation = null;

function basisFrom(evidence) {
  const ids = [];
  for (const ref of evidence || []) {
    if (ref.source === 'turn' && ref.id) ids.push(ref.id);
    if (ref.source === 'confirmed' && ref.id) {
      const confirmed = session.findConfirmed(ref.id);
      for (const id of confirmed?.basis || []) ids.push(id);
    }
  }
  return [...new Set(ids)];
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function show({ hostEl, onConfirm = () => {}, onClose = () => {} }) {
  if (!hostEl) return null;
  const snapshot = getHintSnapshot();

  const panel = el('section', 'partner-hint-view');
  panel.appendChild(el('p', 'eyebrow', 'ことばのヒント'));
  panel.appendChild(el('p', 'partner-hint-disclaimer', 'AIが考えた、まだ本人に確認していない候補です。'));

  if (snapshot.state === 'ready') {
    for (const hypothesis of snapshot.hypotheses) {
      const card = el('article', 'hypothesis-card');
      card.appendChild(el('p', 'hypothesis-label', '確認前のAI推測'));
      card.appendChild(el('p', 'hypothesis-text', hypothesis.text));

      if (hypothesis.evidence?.length) {
        const evidence = el('div', 'hypothesis-evidence');
        evidence.appendChild(el('p', 'eyebrow', '会話の中の手がかり'));
        for (const ref of hypothesis.evidence) {
          evidence.appendChild(el('blockquote', 'evidence-quote', '「' + ref.excerpt + '」'));
        }
        card.appendChild(evidence);
      }

      const ask = el('button', 'choice hypothesis-check', '本人にたずねる');
      ask.type = 'button';
      ask.addEventListener('click', () => {
        selectedConfirmation = Object.freeze({
          hypothesisId: hypothesis.id,
          text: hypothesis.text,
          basis: Object.freeze(basisFrom(hypothesis.evidence)),
        });
        const request = session.selectForConfirmation(selectedConfirmation);
        onConfirm(request);
      });
      card.appendChild(ask);
      panel.appendChild(card);
    }
  } else {
    panel.appendChild(el('p', 'partner-hint-empty', '今は、確認できる候補がありません。'));
  }

  const close = el('button', 'text-button partner-hint-close', 'もどる');
  close.type = 'button';
  close.addEventListener('click', onClose);
  panel.appendChild(close);

  hostEl.replaceChildren(panel);
  return panel;
}

export function getSelectedConfirmation() {
  return selectedConfirmation;
}

export function clearSelection() {
  selectedConfirmation = null;
}
