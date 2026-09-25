import * as sessionStore from './core/session.js';
import * as personalContext from './core/personal-context.js';
import * as inject from './capture/inject.js';
import * as intake from './capture/intake.js';
import * as asr from './capture/asr.js';
import * as receptive from './pipelines/receptive.js';
import * as expressive from './pipelines/expressive.js';
import * as person from './views/person.js';
import * as dom from './views/dom.js';
import * as telemetry from './core/telemetry.js';

export function boot() {
  const $ = dom.byId;
  const config = sessionStore.parseConfig(location.search);

  let partnerSessionActive = false;
  let partnerMicActive = false;
  let expressiveActive = false;
  let lastFragment = '';

  if (config.configId) {
    personalContext.loadFixture(config.configId)
      .catch((err) => console.warn('[002] personal context fixture not loaded', err));
  }

  function setupResearchContextLoader() {
    const research = new URLSearchParams(location.search).get('research') === '1';
    if (!research) return;

    const wrap = document.createElement('span');
    wrap.className = 'research-context-loader';
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'icon-button';
    button.setAttribute('aria-label', '研究者用文脈JSONを読み込む');
    button.textContent = '文脈';
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.hidden = true;
    button.addEventListener('click', () => input.click());
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        await personalContext.loadFromFile(file);
        dom.setStatus('研究者用の文脈をこの端末のメモリに読み込みました。');
      } catch (err) {
        dom.setStatus('文脈JSONを読み込めませんでした。');
        console.warn('[002] researcher context load failed', err);
      } finally {
        input.value = '';
      }
    });
    wrap.append(button, input);
    document.querySelector('.topbar-buttons')?.prepend(wrap);
  }

  setupResearchContextLoader();

  if (config.inject) {
    inject.enable(true);
    window.__inject = inject;
    console.info('[002] injected transcript path enabled (?inject=1)');
  }

  function setSession(sessionActive = partnerSessionActive, micActive = partnerMicActive) {
    partnerSessionActive = sessionActive;
    partnerMicActive = micActive;
    $('listenButton').hidden = sessionActive;
    $('stopListenButton').hidden = !sessionActive;
    $('sessionState').textContent = !sessionActive ? '停止中' : micActive ? '聞いています' : '一時停止中';
    $('sessionState').classList.toggle('live', sessionActive && micActive);
  }

  function renderIdle() {
    person.repaint();
    dom.setBottomBar(true);
  }

  const WORKER_URL = 'https://aphasia-ai-proxy.tamach1q.workers.dev';

  async function callWorker(body) {
    const started = telemetry.now();
    try {
      const res = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { error: data.error || ('HTTP ' + res.status) };
      return data;
    } finally {
      telemetry.logLatency('worker:' + String(body?.op || 'legacy'), started);
    }
  }

  receptive.setTransport(callWorker);
  expressive.setTransport(callWorker);

  // Hypotheses are generated silently on a settled person turn. The pipeline writes data
  // only; views/person.js requires an explicit [ことばのヒント] tap before partner.js renders.
  intake.onTurn((turn) => {
    if (turn.speaker !== 'person') return;
    expressive.handleFragment(turn, { config })
      .catch((err) => console.warn('[002] expressive pipeline failed', err));
  });

  person.mount({
    settledEl: $('mainArea'),
    transcriptEl: $('partnerTranscript'),
    supportEl: $('supportRow'),
    config,
    onStatus: dom.setStatus,
    onOption: () => dom.setStatus('返事を選びました。必要なら自分のことばを作れます。'),
    onLatency: telemetry.logLatency,
  });

  function stopPartnerRecognition() {
    asr.stopPartner();
  }

  function beginListening() {
    if (asr.isPartnerRunning()) return;
    if (!sessionStore.isActive()) sessionStore.startSession(config);

    if (config.ai === 'off') {
      setSession(true, false);
      person.setTranscript('');
      dom.setStatus('音声支援は使いません。文字で入力できます。');
      return;
    }

    setSession(true, true);
    dom.setStatus('相手の話を聞いています', true);
    person.setTranscript('聞いています…');

    const { started, reason } = asr.startPartner({
      enabled: config.ai !== 'off',
      onError: (message) => dom.setStatus(message),
      onLatency: telemetry.logLatency,
    });
    if (started) return;

    setSession(true, false);
    person.setTranscript('');
    dom.setStatus(reason === 'ai-off'
      ? '音声は使いません。文字で入力できます。'
      : 'この端末では音声を聞き取れません。文字で入力できます。');
  }

  function stopListening() {
    expressive.reset();
    sessionStore.stopSession();
    personalContext.clearPersonalContext();
    partnerSessionActive = false;
    partnerMicActive = false;
    stopPartnerRecognition();
    setSession(false, false);
    person.setTranscript('');
    dom.setStatus('聞くのを止めました。');
  }

  function pausePartnerListening() {
    if (!partnerSessionActive) return;
    partnerMicActive = false;
    stopPartnerRecognition();
    setSession(true, false);
  }

  function resumePartnerListening() {
    if (partnerSessionActive && !partnerMicActive) beginListening();
  }

  function renderCapturing() {
    dom.setMain('<div class="capturing-view"><span class="rec-dot" aria-hidden="true"></span><p>あなたのことばを聞いています…</p><p class="small-note" id="capturingPartial"></p><p class="small-note">話し終わったら、下のボタンを押してください。</p></div>');
    dom.setBottomBar(true);
  }

  function showExpressiveRecovery(message) {
    expressiveActive = false;
    $('speakButton').classList.remove('recording');
    $('speakLabel').textContent = '話す';
    renderFragmentForm('', true, true);
    dom.setStatus(message);
  }

  function settlePersonCapture(fragment) {
    expressiveActive = false;
    lastFragment = fragment || '';
    $('speakButton').classList.remove('recording');
    $('speakLabel').textContent = '話す';
    renderIdle();
    dom.setStatus('ことばを受け取りました。会話を続けられます。');
    resumePartnerListening();
  }

  function startExpressive() {
    pausePartnerListening();
    if (config.ai === 'off') {
      expressiveActive = false;
      renderFragmentForm('', true);
      dom.setStatus('音声支援は使いません。文字で入力してください。');
      return;
    }
    expressiveActive = true;
    $('speakButton').classList.add('recording');
    $('speakLabel').textContent = '終わる';
    dom.setStatus('あなたのことばを聞いています', true);
    renderCapturing();

    const { started, reason } = asr.startExpressive({
      enabled: config.ai !== 'off',
      onPartial: (text) => {
        const partial = $('capturingPartial');
        if (partial) partial.textContent = text;
      },
      onFinal: (fragment) => settlePersonCapture(fragment),
      onError: (message) => showExpressiveRecovery(message + ' 文字で入力するか、もう一度話してください。'),
      onLatency: telemetry.logLatency,
    });

    if (!started) {
      showExpressiveRecovery(reason === 'ai-off'
        ? '音声は使いません。文字で入力してください。'
        : 'この端末では音声を聞き取れません。文字で入力してください。');
    }
  }

  function finishExpressive(text) {
    if (!expressiveActive) return;
    const turn = asr.finishExpressive(text ?? asr.getExpressivePartial());
    settlePersonCapture(turn ? turn.text : (text || ''));
  }

  // Typing is the explicit edit/recovery path. It is reachable on demand and is never
  // forced after speech capture (FR-013).
  function renderFragmentForm(prefill, autofocus, allowRetry = false) {
    dom.setMain(
      '<form class="typed-form" id="typedForm">'
      + '<label for="fragmentInput">短いことばで大丈夫です</label>'
      + '<textarea id="fragmentInput" rows="3" placeholder="例：娘　明日　病院">'
      + dom.escapeHtml(prefill || '') + '</textarea>'
      + '<button class="button button-primary" type="submit">このことばで進む</button>'
      + (allowRetry ? '<button class="choice retry-speech" id="retrySpeechButton" type="button">もう一度話す</button>' : '')
      + '<button class="text-button" id="fragmentBackButton" type="button">やめる</button></form>',
    );

    $('typedForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const text = $('fragmentInput').value.trim();
      if (!text) return;
      if (!sessionStore.isActive()) sessionStore.startSession(config);
      lastFragment = text;
      intake.submitTurn({ speaker: 'person', text, source: 'typed' });
      renderIdle();
      dom.setStatus('ことばを受け取りました。会話を続けられます。');
      resumePartnerListening();
    });
    if (allowRetry) $('retrySpeechButton').addEventListener('click', startExpressive);
    $('fragmentBackButton').addEventListener('click', () => {
      renderIdle();
      dom.setStatus('準備できています');
      resumePartnerListening();
    });
    if (autofocus) $('fragmentInput').focus();
    dom.setBottomBar(false);
  }

  function reset() {
    person.reset();
    expressive.reset();
    stopPartnerRecognition();
    asr.stopExpressiveRecognition();
    sessionStore.stopSession();
    personalContext.clearPersonalContext();

    partnerSessionActive = false;
    partnerMicActive = false;
    expressiveActive = false;
    lastFragment = '';

    $('speakButton').classList.remove('recording');
    $('speakLabel').textContent = '話す';
    person.setTranscript('');
    setSession(false, false);
    renderIdle();
    dom.setStatus('準備できています');
  }

  $('listenButton').addEventListener('click', beginListening);
  $('stopListenButton').addEventListener('click', stopListening);
  $('speakButton').addEventListener('click', () => (expressiveActive
    ? finishExpressive(asr.getExpressivePartial())
    : startExpressive()));
  $('typeButton').addEventListener('click', () => renderFragmentForm(lastFragment, true));
  $('resetButton').addEventListener('click', reset);

  renderIdle();
}
