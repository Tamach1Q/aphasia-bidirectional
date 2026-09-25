// T059a — the RENDERED half of FR-010, in a real document.
//
// `tests/unit/receptive.test.js` already proves the pipeline half: the gate runs before any
// fetch, and a call COUNT of zero for a gated-out utterance. What could not be asserted
// there is what the person actually sees, which is where FR-010 lives:
//
//   - settled content in the main area is never silently replaced
//   - a revision is VISIBLY marked
//   - interim text reaches the transcript strip and nothing else
//
// **Departure from tasks.md, which names `tests/browser/receptive.test.html`.** The harness
// that landed in T037 drives suites as ES modules listed in `runner.js` (`register(test,
// inject)`) from the single page `tests/browser/index.html`. A standalone `.test.html` would
// be a second harness with its own runner and its own way to fail. The file extension was
// not the requirement; running in a document was.
//
// Every turn enters through `app/capture/inject.js`, so none of this needs a microphone.

import * as session from '../../app/core/session.js';
import * as receptive from '../../app/pipelines/receptive.js';
import * as person from '../../app/views/person.js';
import { assert, assertEqual } from './runner.js';

/** Records requests so a COUNT can be asserted, not merely the absence of output. */
function stubTransport(reply) {
  const calls = [];
  receptive.setTransport(async (body) => {
    calls.push(body);
    return typeof reply === 'function' ? reply(body) : reply;
  });
  return calls;
}

/**
 * A fresh host element and a fresh view for each case.
 *
 * The suite builds its own surfaces rather than loading `app/index.html`: what is under
 * test is the view's contract with the elements it is handed, and every assertion below is
 * scoped to this case's host so one case cannot see another's nodes.
 */
function mountFresh(config = {}) {
  const host = document.createElement('div');
  host.innerHTML = '<div id="settled" class="main-area"></div>'
    + '<p id="strip" class="transcript" hidden></p>'
    + '<div id="support" class="support-row" hidden></div>';
  document.body.appendChild(host);

  person.reset();
  session.stopSession();
  session.startSession(session.parseConfig(''));
  person.mount({
    settledEl: host.querySelector('#settled'),
    transcriptEl: host.querySelector('#strip'),
    supportEl: host.querySelector('#support'),
    config,
  });
  return {
    host,
    settled: host.querySelector('#settled'),
    strip: host.querySelector('#strip'),
    support: host.querySelector('#support'),
    chunks: () => [...host.querySelectorAll('.settled-chunk')],
    texts: () => [...host.querySelectorAll('.settled-chunk .meaning')].map((el) => el.textContent),
  };
}

/** Fixtures live under app/, and the test page is served from tests/browser/. */
const fixtureFetch = (path) => fetch(`../../app/${path}`);
const partnerText = (data) => data.turns.find((t) => t.speaker === 'partner').text;

export function register(test, inject) {
  test('interim text reaches the transcript strip and NEVER the settled area (FR-010)', () => {
    const ui = mountFresh();
    stubTransport({ meaning: 'must not be requested' });

    inject.interim('あしたの びょういん');
    assertEqual(ui.strip.textContent, 'あしたの びょういん', 'the strip shows interim text');
    assertEqual(ui.strip.hidden, false);
    assertEqual(ui.chunks().length, 0, 'interim text must not settle anything');
    assertEqual(session.getSession().turns.length, 0, 'interim text must not create a Turn');
  });

  test('a gated-out utterance settles nothing and makes no request (FR-008)', async () => {
    const ui = mountFresh();
    const calls = stubTransport({ meaning: 'must not be requested' });
    const data = await inject.fixture('f01-simple-question', { fetchImpl: fixtureFetch, play: false });

    await person.handlePartnerTurn({ id: 't1', text: partnerText(data) });
    assertEqual(calls.length, 0, 'the gate runs before the network');
    assertEqual(ui.chunks().length, 0, 'the largest element on screen is left alone');
    assert(ui.strip.textContent.length > 0, 'the person still has the raw transcript');
  });

  test('a gated-in utterance renders a settled chunk with its structure', async () => {
    const ui = mountFresh();
    stubTransport({ meaning: '朝：薬を飲む', structure: ['ふらついたら やめる', '電話する'] });
    const data = await inject.fixture('f02-conditional-instruction', { fetchImpl: fixtureFetch, play: false });

    await person.handlePartnerTurn({ id: 't1', text: partnerText(data) });
    assertEqual(ui.chunks().length, 1);
    assertEqual(ui.texts(), ['朝：薬を飲む']);
    assertEqual(
      [...ui.settled.querySelectorAll('.structure-list li')].map((li) => li.textContent),
      ['ふらついたら やめる', '電話する'],
    );
  });

  test('settled content is never silently replaced by a later chunk', async () => {
    const ui = mountFresh();
    // Stub wording carries no digit on purpose: a numeral absent from the source is a real
    // safety violation, and a suppressed candidate would make this case pass for the wrong
    // reason — nothing on screen either way.
    const wording = ['ねつが でたら でんわ', 'あめなら タクシー'];
    let n = 0;
    stubTransport(() => ({ meaning: wording[n++] }));

    await person.handlePartnerTurn({ id: 't1', text: 'もし熱が出たら、すぐに電話をしてください。' });
    const first = ui.chunks()[0];
    const firstText = first.querySelector('.meaning').textContent;

    await person.handlePartnerTurn({ id: 't2', text: 'もし雨が降ったら、タクシーを使ってください。' });
    assertEqual(ui.chunks().length, 2, 'the second chunk is appended, not swapped in');
    assert(ui.chunks()[0] === first, 'the first chunk element must be the same node');
    assertEqual(ui.chunks()[0].querySelector('.meaning').textContent, firstText, 'its text is unchanged');
  });

  test('settled content survives the expressive flow replacing the main area (FR-010)', async () => {
    const ui = mountFresh();
    stubTransport({ meaning: 'ねつが でたら でんわ', options: ['わかりました'] });

    await person.handlePartnerTurn({ id: 't1', text: 'もし熱が出たら、すぐに電話をしてください。' });
    ui.settled.querySelector('.choice').click();

    // What `app.js`'s superseded expressive flow does to this element, verbatim: setMain().
    ui.settled.innerHTML = '<form id="typedForm"></form>';
    assertEqual(ui.chunks().length, 0, 'precondition: the flow really did wipe the region');

    person.repaint();
    assertEqual(ui.texts(), ['ねつが でたら でんわ'], 'the settled chunk comes back');
    assert(
      ui.settled.querySelector('.choice').classList.contains('chosen'),
      'and so does the option the person had already tapped',
    );
  });

  test('a revision is VISIBLY marked, and the revised chunk survives (FR-010)', async () => {
    const ui = mountFresh();
    const wording = ['ねつが でたら でんわ', 'ねつが でたら でんわ、そのあと 水'];
    let n = 0;
    stubTransport(() => ({ meaning: wording[n++] }));

    const grown = 'もし熱が出たら、すぐに電話をしてください。';
    await person.handlePartnerTurn({ id: 't1', text: grown });
    const firstText = ui.texts()[0];

    // Recognition re-emitting a growing string as a second final — the case chunker.js
    // marks as a revision rather than leaving a truncated chunk above its continuation.
    await person.handlePartnerTurn({ id: 't2', text: `${grown}それから水を飲んでください。` });

    const chunks = ui.chunks();
    assertEqual(chunks.length, 2, 'the revised chunk is still on screen');
    assert(chunks[0].classList.contains('superseded'), 'the revised chunk is marked');
    assert(chunks[1].classList.contains('revision'), 'the correction is marked as a correction');
    assertEqual(chunks[0].querySelector('.meaning').textContent, firstText, 'its text was not rewritten');

    const marks = [...ui.settled.querySelectorAll('.revision-mark')].map((el) => el.textContent.trim());
    assertEqual(marks.length, 2, 'both sides of the change carry a visible label');
    assert(marks.every((m) => m.length > 0), 'the marking is text, not colour alone');
  });

  test('[短く] forces simplification of a gated-out turn and renders it (FR-009)', async () => {
    const ui = mountFresh();
    const calls = stubTransport({ meaning: '明日、病院に行くか' });
    const data = await inject.fixture('f01-simple-question', { fetchImpl: fixtureFetch, play: false });

    await person.handlePartnerTurn({ id: 't1', text: partnerText(data) });
    assertEqual(calls.length, 0);
    assertEqual(ui.support.hidden, false, '短く becomes available once a partner turn exists');

    const button = ui.support.querySelector('#shortenButton');
    assert(button, 'the 短く control is rendered');
    assertEqual(button.textContent, '短く');

    await person.forceSimplifyLast();
    assertEqual(calls.length, 1, 'force bypasses the gate');
    assertEqual(ui.texts(), ['明日、病院に行くか']);
  });

  test('a suppressed simplification renders nothing and says so only when asked (FR-028)', async () => {
    const ui = mountFresh();
    // The f04 disaster case: the source prohibits the medicine, the model permits it.
    stubTransport({ meaning: 'お風呂は入って大丈夫です。今日は薬を飲んでください。' });
    const data = await inject.fixture('f04-negation', { fetchImpl: fixtureFetch, play: false });
    const text = partnerText(data);

    await person.handlePartnerTurn({ id: 't1', text });
    assertEqual(ui.chunks().length, 0, 'a reversed simplification must never settle');
    assertEqual(ui.settled.querySelectorAll('.settled-note').length, 0, 'unasked-for failure is not announced');

    await person.forceSimplifyLast();
    assertEqual(ui.chunks().length, 0);
    assertEqual(ui.settled.querySelectorAll('.settled-note').length, 1, 'an explicit request gets an honest answer');
  });

  test('response options are tappable and the choice is marked (§A3.3)', async () => {
    const ui = mountFresh();
    stubTransport({ meaning: 'いつがいいですか', options: ['金曜の午後', '月曜の午前'] });

    await person.handlePartnerTurn({ id: 't1', text: '金曜の午後か月曜の午前、どちらがご都合よろしいですか。' });
    const buttons = [...ui.settled.querySelectorAll('.choice')];
    assertEqual(buttons.map((b) => b.textContent), ['金曜の午後', '月曜の午前']);

    buttons[1].click();
    assert(buttons[1].classList.contains('chosen'), 'the tapped option is marked');
    assert(!buttons[0].classList.contains('chosen'), 'only one option is marked');
  });

  test('?receptive=off keeps the transcript and produces no simplification (B0)', async () => {
    const ui = mountFresh({ receptive: 'off' });
    const calls = stubTransport({ meaning: 'must not be requested' });

    await person.handlePartnerTurn({ id: 't1', text: 'もし熱が出たら、すぐに電話をしてください。' });
    assertEqual(calls.length, 0);
    assertEqual(ui.chunks().length, 0);
    assert(ui.strip.textContent.length > 0, 'the transcript is still shown');
  });

  test('?ai=off produces no request even for an utterance that would gate in (A0)', async () => {
    const ui = mountFresh({ ai: 'off' });
    const calls = stubTransport({ meaning: 'must not be requested' });

    await person.handlePartnerTurn({ id: 't1', text: 'もし熱が出たら、すぐに電話をしてください。' });
    assertEqual(calls.length, 0);
    assertEqual(ui.chunks().length, 0);
  });
}
