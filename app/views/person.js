// The person's view — the receptive surface (§9.1, §A3.2, FR-008, FR-009, FR-010).
//
// Two display surfaces with different rules, and the whole point of this module is that
// they never mix:
//
//   transcript strip   raw ASR, interim included    MAY rewrite   (secondary, small)
//   settled region     settled semantic chunks      NEVER rewrites (primary, large)
//
// "Never rewrites" is implemented literally: a settled entry's text is written once and is
// never edited again. A revision does not replace it — the earlier entry stays where the
// person left off reading and gains a marker, and the corrected wording arrives as a new
// entry marked as a correction (FR-010). Swapping the text under someone mid-read is the
// specific cost §11.3 exists to avoid, and "mark the change" is unimplementable if the
// thing being changed is gone.
//
// The view keeps its own `entries` list and can rebuild from it. That is not gold-plating:
// the superseded expressive flow in app.js still calls `setMain()` and will wipe this
// region out from under us until Stage 6/7 removes it (plan.md "Migration approach").
// Rebuilding from data means a settled chunk survives that, which is the FR-010 promise.
//
// No `innerHTML` anywhere below — nodes are built with the DOM API, so partner speech and
// model output are inserted as text and cannot be markup.

import * as receptive from '../pipelines/receptive.js';
import * as intake from '../capture/intake.js';
import * as session from '../core/session.js';
import * as partner from './partner.js';

/** @type {{settled: HTMLElement, transcript: HTMLElement, support: HTMLElement}|null} */
let els = null;

/** Settled entries, oldest first. Append-only; an entry's text is never rewritten. */
let entries = [];

/** The most recent partner turn, so `[短く]` has something to act on (FR-009). */
let lastPartnerTurn = null;

/** Last settled person fragment. Used only to make the explicit hint action reachable. */
let lastPersonTurn = null;

let counter = 0;
let hooks = {};
let runtime = { aiEnabled: true, receptiveEnabled: true };

/** Disposers for the intake subscriptions, so a re-mount does not double-subscribe. */
let unsubscribe = [];

/** entryId → the element that has settled for it. Written once, never re-created. */
const nodes = new Map();

/**
 * @param {Object}      o
 * @param {HTMLElement} o.settledEl     the large main area
 * @param {HTMLElement} o.transcriptEl  the small secondary strip
 * @param {HTMLElement} o.supportEl     the support-request row (§14)
 * @param {Object}      [o.config]      parsed research config (data-model.md §6)
 * @param {Function}    [o.onStatus]    status-line text, for the shell to display
 * @param {Function}    [o.onOption]    a response option was tapped
 * @param {Function}    [o.onLatency]   latency logger (FR-041)
 */
export function mount({ settledEl, transcriptEl, supportEl, config = {}, onStatus, onOption, onLatency }) {
  els = { settled: settledEl, transcript: transcriptEl, support: supportEl };
  hooks = { onStatus, onOption, onLatency };
  runtime = {
    aiEnabled: config.ai !== 'off',
    receptiveEnabled: config.receptive !== 'off',
  };
  // Captured text arrives from capture/intake.js — the one door both ASR and the injected
  // path use — and the view decides which SURFACE each kind reaches. Subscribing here
  // rather than in app.js is what makes the interim/settled split verifiable in a document:
  // a browser test plays a turn through app/capture/inject.js and asserts where it landed
  // (tests/browser/receptive.test.js). Wired through app.js, that half was untestable and
  // the suite would have been asserting against its own wiring.
  for (const dispose of unsubscribe) dispose();
  unsubscribe = [
    intake.onInterim((text) => setTranscript(text)),
    intake.onTurn((turn) => {
      if (turn.speaker === 'partner') handlePartnerTurn(turn);
      if (turn.speaker === 'person') {
        lastPersonTurn = turn;
        renderSupport();
      }
    }),
  ];

  renderSupport();
  render();
}

// ---------------------------------------------------------------- transcript strip

/**
 * Raw recognition output, interim included. This is the ONLY function that writes the
 * strip, and it is the only surface interim text may reach (FR-002, FR-010).
 */
export function setTranscript(text) {
  if (!els) return;
  const el = els.transcript;
  if (text) {
    el.textContent = text;
    el.hidden = false;
  } else {
    el.textContent = '';
    el.hidden = true;
  }
}

// ---------------------------------------------------------------- receptive turns

/**
 * One settled partner turn. Runs the receptive pipeline and renders only what comes back
 * past the gate and the safety layer.
 *
 * A gated-out turn renders NOTHING in the settled region — the person keeps the raw strip,
 * and the largest element on screen is left alone (FR-008).
 *
 * @param {{id?: string, text: string}} turn
 * @param {{force?: boolean}} [options] `force` is `[短く]` (FR-009)
 */
export async function handlePartnerTurn(turn, options = {}) {
  lastPartnerTurn = turn;
  renderSupport();
  setTranscript(turn?.text || '');

  const started = typeof performance !== 'undefined' ? performance.now() : 0;
  const result = await receptive.handleTurn(turn, {
    force: !!options.force,
    aiEnabled: runtime.aiEnabled,
    receptiveEnabled: runtime.receptiveEnabled,
  });
  if (hooks.onLatency && result.skipped !== 'gated-out' && result.skipped !== 'ai-off') {
    hooks.onLatency('llm: receptive simplification', started, turn?.text);
  }

  if (result.simplified) {
    settle(result.simplified, result.chunk);
  } else if (options.force) {
    // The person ASKED for a shorter version. Silence would read as the request having
    // done nothing, so say plainly that it did not work — without implying the difficulty
    // was theirs (FR-032, §2.5).
    note(result.skipped === 'suppressed'
      ? '短くしたことばを出せませんでした。上のことばがそのままの内容です。'
      : '短くできませんでした。もう一度押せます。');
  }
  return result;
}

/** `[短く]` — force simplification of the most recent partner turn (FR-009). */
export async function forceSimplifyLast() {
  if (!lastPartnerTurn) return null;
  if (hooks.onStatus) hooks.onStatus('短くしています…');
  return handlePartnerTurn(lastPartnerTurn, { force: true });
}

// ---------------------------------------------------------------- settled region

/**
 * Append a simplification as a settled entry.
 *
 * When it revises an earlier chunk, the earlier ENTRY is not touched beyond gaining
 * `supersededBy`; nothing it already showed is removed or rewritten.
 */
function settle(simplified, chunk) {
  const id = `e${++counter}`;
  // `simplified.revises` names the CHUNK this one supersedes (chunker.js), so the entry
  // carries its chunk id in order to be findable when a later chunk revises it.
  const revisesChunk = simplified.revises || null;
  const previous = revisesChunk
    ? entries.find((e) => e.chunkId === revisesChunk && !e.supersededBy)
    : null;
  if (previous) previous.supersededBy = id;

  entries.push({
    id,
    chunkId: chunk ? chunk.id : null,
    meaning: simplified.meaning,
    structure: simplified.structure || [],
    options: simplified.options || [],
    chosen: null,
    revises: previous ? previous.id : null,
    supersededBy: null,
  });
  render();
}

/** A transient line that is NOT settled content — it carries no meaning to preserve. */
function note(text) {
  if (!els) return;
  const existing = els.settled.querySelector('.settled-note');
  if (existing) existing.remove();
  const el = document.createElement('p');
  el.className = 'small-note settled-note';
  el.textContent = text;
  els.settled.appendChild(el);
}

/**
 * Paint the settled region INCREMENTALLY.
 *
 * A new chunk appends a node; it never rebuilds the ones already there. Rebuilding would
 * satisfy FR-010 only on paper: the text would come back identical, while the person's
 * scroll position, the focus ring, and any option they had already tapped would all be
 * discarded under them. A settled block's element is therefore created once and afterwards
 * only ever GAINS a marker (`tests/browser/receptive.test.js` asserts node identity).
 *
 * The full rebuild survives for one case: the superseded expressive flow replaces the whole
 * main area, so when our nodes are gone the region is reconstructed from `entries`.
 */
function render() {
  if (!els) return;

  const ours = [...nodes.values()];
  const detached = ours.length && ours.some((el) => el.parentNode !== els.settled);
  if (detached) {
    nodes.clear();
    els.settled.replaceChildren();
  }

  if (!entries.length) {
    if (!els.settled.querySelector('.idle-state')) {
      els.settled.replaceChildren();
      const idle = document.createElement('div');
      idle.className = 'idle-state';
      els.settled.appendChild(idle);
    }
    return;
  }

  const idle = els.settled.querySelector('.idle-state');
  if (idle) idle.remove();

  for (const entry of entries) {
    const existing = nodes.get(entry.id);
    if (existing) {
      markSuperseded(existing, entry);
      continue;
    }
    const block = renderEntry(entry);
    nodes.set(entry.id, block);
    els.settled.appendChild(block);
  }
  // The person reads the newest chunk; older settled content stays above it, reachable.
  els.settled.scrollTop = els.settled.scrollHeight;
}

/**
 * The one change an already-settled block may undergo: it is marked as revised.
 *
 * Its wording is untouched. Its options are disabled rather than removed — tapping a reply
 * to superseded wording would be acting on something the partner has since changed, but
 * deleting the controls would shift everything below them while the person is reading.
 */
function markSuperseded(block, entry) {
  if (!entry.supersededBy || block.classList.contains('superseded')) return;
  block.classList.add('superseded');
  block.prepend(label('あとで なおしました', 'revision-mark'));
  for (const button of block.querySelectorAll('.choice')) button.disabled = true;
}

function renderEntry(entry) {
  const block = document.createElement('article');
  block.className = 'settled-chunk';
  block.dataset.entryId = entry.id;

  if (entry.supersededBy) {
    block.classList.add('superseded');
    block.appendChild(label('あとで なおしました', 'revision-mark'));
  }
  if (entry.revises) {
    block.classList.add('revision');
    block.appendChild(label('なおしたことば', 'revision-mark'));
  }

  const meaning = document.createElement('p');
  meaning.className = 'meaning';
  meaning.textContent = entry.meaning;
  block.appendChild(meaning);

  if (entry.structure.length) {
    const list = document.createElement('ul');
    list.className = 'structure-list';
    for (const line of entry.structure) {
      const li = document.createElement('li');
      li.textContent = line;
      list.appendChild(li);
    }
    block.appendChild(list);
  }

  // Tappable replies (§A3.3). These replace the separate open-question candidate path the
  // old app.js held; the response TYPE behind them stays internal and is never labelled
  // (§11.5). Tapping marks the choice — Phase 1 neither sends nor speaks it (§16.3).
  if (entry.options.length) {
    const box = document.createElement('div');
    box.className = 'choice-list';
    for (const option of entry.options) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `choice${option.length > 15 ? ' long-choice' : ''}`;
      button.textContent = option;
      // The choice is kept on the ENTRY, not only in the class list, so a rebuild of the
      // region (see `render`) does not quietly un-choose what the person already tapped.
      if (entry.chosen === option) button.classList.add('chosen');
      if (entry.supersededBy) button.disabled = true;
      button.addEventListener('click', () => {
        entry.chosen = option;
        for (const other of box.querySelectorAll('.choice')) other.classList.remove('chosen');
        button.classList.add('chosen');
        if (hooks.onOption) hooks.onOption(option, entry.id);
      });
      box.appendChild(button);
    }
    block.appendChild(box);
  }

  return block;
}

function label(text, className) {
  const el = document.createElement('p');
  el.className = `eyebrow ${className}`;
  el.textContent = text;
  return el;
}

// ---------------------------------------------------------------- support requests

/**
 * §14's support-request row. Only `[短く]` exists at this stage; もう一回 / ゆっくり /
 * ちがう land in T095 and MUST stay four distinguishable controls, never one generic
 * "help" button (FR-031).
 */
export const SUPPORT_REQUESTS = Object.freeze([
  Object.freeze({ kind: 'repeat', label: 'もう一回', message: 'もう一回お願いします。' }),
  Object.freeze({ kind: 'slow', label: 'ゆっくり', message: 'ゆっくりお願いします。' }),
  Object.freeze({ kind: 'short', label: '短く', message: '短くお願いします。' }),
  Object.freeze({ kind: 'different', label: 'ちがう', message: 'ちがう意味です。' }),
]);

export function dispatchSupportRequest(kind) {
  const request = SUPPORT_REQUESTS.find((item) => item.kind === kind);
  if (!request) return null;

  if (hooks.onSupport) hooks.onSupport({ ...request });

  if (kind === 'short') {
    void forceSimplifyLast();
  } else if (kind === 'different' && session.getConfirmationRequest()) {
    session.rejectSelected();
    partner.clearSelection();
    repaint();
  } else {
    note(request.message);
  }
  return request;
}

function renderSupport() {
  if (!els || !els.support) return;
  els.support.replaceChildren();
  const hasConversation = !!lastPartnerTurn || !!lastPersonTurn;
  els.support.hidden = !hasConversation;
  if (!hasConversation) return;

  for (const request of SUPPORT_REQUESTS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'support-request';
    button.id = 'support-' + request.kind;
    button.textContent = request.label;
    button.addEventListener('click', () => dispatchSupportRequest(request.kind));
    els.support.appendChild(button);
  }

  // This neutral action appears after a person turn regardless of generation outcome,
  // so it does not reveal whether hidden hypotheses exist (FR-019).
  if (lastPersonTurn) {
    const hint = document.createElement('button');
    hint.type = 'button';
    hint.className = 'support-request';
    hint.id = 'hintButton';
    hint.textContent = 'ことばのヒント';
    hint.addEventListener('click', showHints);
    els.support.appendChild(hint);
  }
}

export function showHints() {
  if (!els || !lastPersonTurn) return null;
  return partner.show({
    hostEl: els.settled,
    onConfirm: () => showConfirmation(),
    onClose: () => repaint(),
  });
}

export function showConfirmation() {
  if (!els) return null;
  const request = session.getConfirmationRequest();
  if (!request) return null;

  const panel = document.createElement('section');
  panel.className = 'confirmation-view';

  const heading = document.createElement('p');
  heading.className = 'eyebrow';
  heading.textContent = 'この意味で合っていますか？';
  panel.appendChild(heading);

  const meaning = document.createElement('p');
  meaning.className = 'confirmation-meaning';
  meaning.textContent = request.text;
  panel.appendChild(meaning);

  const actions = document.createElement('div');
  actions.className = 'confirmation-actions';

  const yes = document.createElement('button');
  yes.type = 'button';
  yes.id = 'confirmYes';
  yes.className = 'button button-primary confirmation-action';
  yes.textContent = 'はい';
  yes.addEventListener('click', () => {
    session.confirmSelected();
    partner.clearSelection();
    repaint();
  });

  const no = document.createElement('button');
  no.type = 'button';
  no.id = 'confirmNo';
  no.className = 'choice confirmation-action';
  no.textContent = 'ちがう';
  no.addEventListener('click', () => {
    session.rejectSelected();
    partner.clearSelection();
    repaint();
  });

  actions.append(yes, no);
  panel.appendChild(actions);
  els.settled.replaceChildren(panel);
  return panel;
}

// ---------------------------------------------------------------- lifecycle

export function reset() {
  entries = [];
  nodes.clear();
  if (els) els.settled.replaceChildren();
  counter = 0;
  lastPartnerTurn = null;
  lastPersonTurn = null;
  partner.clearSelection();
  receptive.reset();
  setTranscript('');
  renderSupport();
  render();
}

/**
 * Repaint from `entries` without discarding them.
 *
 * Needed because the superseded expressive flow still writes the same main area with
 * `setMain()`. Settled chunks live in data, so leaving that flow and coming back restores
 * them instead of losing them (FR-010).
 */
export function repaint() {
  renderSupport();
  render();
}

/** Test-only inspection of settled state. */
export function __entries() {
  return entries.map((e) => ({ ...e }));
}
