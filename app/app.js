import * as sessionStore from './core/session.js';
import * as personalContext from './core/personal-context.js';
import * as inject from './capture/inject.js';
import * as intake from './capture/intake.js';
import * as asr from './capture/asr.js';
import * as receptive from './pipelines/receptive.js';
import * as expressive from './pipelines/expressive.js';
import * as person from './views/person.js';

(() => {
  const $ = (id) => document.getElementById(id);
  const modeA = new URLSearchParams(location.search).get('mode') === 'a';

  // --- 002 Stage 1: the new context store runs ALONGSIDE the old `state` object. ---
  // The superseded expressive flow below still reads `state.*` in ~100 places and is not
  // removed until T086/T087, so deleting it here would break the running app and violate
  // plan.md's "Stages 1-4 add modules without removing behaviour". Turns are mirrored into
  // the new store so Stage 2 onward has real data to work with; nothing reads back yet.
  const config002 = sessionStore.parseConfig(location.search);
  if (config002.configId) {
    personalContext.loadFixture(config002.configId)
      .catch((err) => console.warn('[002] personal context fixture not loaded', err));
  }
  // ALL captured text — ASR and injected alike — enters through capture/intake.js.
  // app.js must never call sessionStore.appendTurn directly; a test enforces that only
  // the capture layer does (tests/unit/single-intake.test.js).
  function recordTurn(speaker, text, source = 'asr') {
    if (!sessionStore.isActive()) return null;
    return intake.submitTurn({ speaker, text, source });
  }
  // T034: injection is reachable only behind ?inject=1, never in a participant session.
  // Exposed on window so a researcher (or the browser test page) can drive it from the
  // console without a microphone.
  if (config002.inject) {
    inject.enable(true);
    window.__inject = inject;
    console.info('[002] injected transcript path enabled (?inject=1)');
  }
  const state = { partnerSessionActive:false, partnerMicActive:false, listening:false, expressive:false, round:0, ambiguityIndex:0, noneCounts:{}, known:[], answers:{}, clarificationHistory:[], fragment:'', confirmed:false, message:'' };
  const ambiguities = [
    { key:'time', test:/今日|きょう|明日|あした|昨日|きのう|今週|来週|朝|午後|夜|金曜|月曜/, question:'いつのことですか？', choices:['今日のこと','明日のこと','別の日のこと'], alternatives:['今週のこと','来週のこと','日にちは関係ない'] },
    { key:'topic', test:/病院|医者|診察|学校|仕事|電車|家族|娘|息子|予約|薬/, question:'何についてですか？', choices:['病院・診察のこと','家族のこと','予定や予約のこと'], alternatives:['仕事のこと','移動のこと','別のこと'] },
    { key:'content', test:null, question:'何を伝えたいですか？' }
  ];

  // ---- shared UI helpers ----
  function icon(name) { const paths = { mic:'<path d="M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z"></path><path d="M19 10v1a7 7 0 0 1-14 0v-1"></path><path d="M12 18v3M8 21h8"></path>', keyboard:'<rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="M6 9h.01M9 9h.01M12 9h.01M15 9h.01M18 9h.01M6 13h12M8 16h8"></path>', volume:'<path d="M4 10v4h3l4 3V7l-4 3H4Z"></path><path d="M15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12"></path>', reset:'<path d="M3 12a9 9 0 1 0 3-6.7"></path><path d="M3 4v6h6"></path>' }; return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg>`; }
  function setStatus(text, active = false) { $('statusText').textContent = text; $('statusDot').classList.toggle('active', active); }
  function logLatency(kind, started, detail) { const ms = Math.round(performance.now() - started); const label = `${kind}: ${ms}ms`; console.info(`[latency] ${label}`, detail || ''); return ms; }
  function setSession(sessionActive = state.partnerSessionActive, micActive = state.partnerMicActive) { state.partnerSessionActive = sessionActive; state.partnerMicActive = micActive; state.listening = micActive; $('listenButton').hidden = sessionActive; $('stopListenButton').hidden = !sessionActive; $('sessionState').textContent = !sessionActive ? '停止中' : micActive ? '聞いています' : '一時停止中'; $('sessionState').classList.toggle('live', sessionActive && micActive); }
  function friendlyRecognitionError(error) { return ({ 'not-allowed':'マイクが使えないようです。文字でも入力できます。', 'no-speech':'声を聞き取れませんでした。もう一度試せます。', network:'音声を処理できませんでした。もう一度試してください。' })[error] || '音声を使えませんでした。文字でも入力できます。'; }
  function pausePartnerListening() { if (!state.partnerSessionActive) return; state.partnerMicActive = false; state.listening = false; stopPartnerRecognition(); setSession(true, false); }
  function resumePartnerListening() { if (state.partnerSessionActive && !state.partnerMicActive) beginListening(); }
  function setBottomBar(visible) { $('bottomBar').hidden = !visible; }
  function setMain(html) { $('mainArea').innerHTML = html; }
  // `showChoices` is gone with its only caller (T067). views/person.js renders options
  // with the DOM API instead of an innerHTML string, because it also has to mark the
  // chosen one and must never inject model output as markup.
  function addAction(parent, text, className, callback) { const button = document.createElement('button'); button.type = 'button'; button.className = className; button.innerHTML = text; button.addEventListener('click', callback); parent.appendChild(button); }
  function escapeHtml(text) { return text.replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char])); }
  // The transcript strip has exactly one writer, views/person.js — see its header for why
  // the interim/settled split is enforced there rather than here.

  // ---- IDLE ----
  // Returning to the main area hands it back to views/person.js, which repaints whatever
  // has settled rather than clearing it — leaving the expressive flow must not destroy
  // settled receptive content (FR-010).
  function renderIdle() { person.repaint(); setBottomBar(true); }

  // ---- receptive direction: transport + view wiring (Stage 5) ----
  // The regex classifier, the separate open-question candidate call, and the main-area
  // rewrite they drove are gone (T067, T068). What replaced them:
  //
  //   intake.onTurn → views/person.js → pipelines/receptive.js → gate → op=simplify → safety
  //
  // The gate is local and runs first, so an ordinary utterance makes no request at all
  // (FR-008), and tappable replies now arrive as `op=simplify`'s optional `options` rather
  // than from a second endpoint (§A3.3).
  //
  // The Worker holds the model key server-side, so this static frontend never embeds one.
  // See worker/README.md — demo-scoped infrastructure, replaceable without touching the
  // contract in contracts/worker-api.md.
  const WORKER_URL = 'https://aphasia-ai-proxy.tamach1q.workers.dev';
  async function callWorker(body) {
    const res = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: data.error || ('HTTP ' + res.status) };
    return data;
  }
  receptive.setTransport(callWorker);
  expressive.setTransport(callWorker);

  // A person turn starts generation, but the result is held as data only.
  intake.onTurn((turn) => {
    if (turn.speaker !== 'person') return;
    const started = performance.now();
    expressive.handleFragment(turn, { config: config002 })
      .then(() => logLatency('llm: expressive hypotheses', started, turn.text))
      .catch((err) => console.warn('[002] expressive pipeline failed', err));
  });

  person.mount({
    settledEl: $('mainArea'),
    transcriptEl: $('partnerTranscript'),
    supportEl: $('supportRow'),
    config: config002,
    onStatus: (text) => setStatus(text),
    onOption: () => setStatus('返事を選びました。必要なら自分のことばを作れます。'),
    onLatency: logLatency,
  });

  // `person.mount` subscribes to capture/intake.js itself: interim text to the transcript
  // strip, settled partner turns to the receptive pipeline (FR-002, FR-010). The view owns
  // both surfaces, so the split is asserted where it is visible — see its header.

  // TODO(T097): unreachable since T067 removed its only caller; deleted with the rest of
  // the 「わかりません」 control in Phase 5 (FR-032).
  function showDontUnderstand() {
    setMain(`<div class="dont-understand-view"><p class="eyebrow">わかりません</p><h2>もう一度、聞いてみましょう。</h2><div class="flow-actions"><button class="choice long-choice" id="reListenButton" type="button">${icon('mic')} 相手にもう一度話してもらう</button><button class="choice" id="goExpressiveButton" type="button">${icon('mic')} 自分から伝える</button></div></div>`);
    $('reListenButton').addEventListener('click', beginListening);
    $('goExpressiveButton').addEventListener('click', startExpressive);
    setStatus('相手にもう一度話してもらうか、自分から伝えられます。');
    setBottomBar(true);
  }

  // ---- conversation listening (background, always reachable) ----
  // Recognition itself lives in capture/asr.js; this is wiring only.
  function stopPartnerRecognition() { asr.stopPartner(); }
  function beginListening() {
    if (asr.isPartnerRunning()) return;
    if (!sessionStore.isActive()) sessionStore.startSession(config002);
    setSession(true, true); setStatus('相手の話を聞いています', true); person.setTranscript('聞いています…');
    const { started, reason } = asr.startPartner({
      enabled: config002.ai !== 'off',
      onError: (message) => setStatus(message),
      onLatency: logLatency,
    });
    if (started) return;
    // Never fabricate a partner utterance. Inventing one would put words nobody said
    // into the context store, where they would go on to feed hypothesis generation.
    setSession(true, false);
    person.setTranscript('');
    setStatus(reason === 'ai-off'
      ? '音声は使いません。文字で入力できます。'
      : 'この端末では音声を聞き取れません。文字で入力できます。');
  }
  function stopListening() { expressive.reset(); sessionStore.stopSession(); state.partnerSessionActive = false; state.partnerMicActive = false; state.listening = false; stopPartnerRecognition(); setSession(false, false); person.setTranscript(''); setStatus('聞くのを止めました。'); }

  // ---- CAPTURING_USER ----
  function renderCapturing() { setMain('<div class="capturing-view"><span class="rec-dot" aria-hidden="true"></span><p>あなたのことばを聞いています…</p><p class="small-note" id="capturingPartial"></p><p class="small-note">話し終わったら、下のボタンを押してください。</p></div>'); setBottomBar(true); }

  function stopExpressiveRecognition() { asr.stopExpressiveRecognition(); }
  function showExpressiveRecovery(message) {
    state.expressive = false;
    $('speakButton').classList.remove('recording'); $('speakLabel').textContent = '話す';
    renderFragmentForm('', true, true);
    setStatus(message);
  }
  function startExpressive() {
    pausePartnerListening();
    state.expressive = true;
    $('speakButton').classList.add('recording'); $('speakLabel').textContent = '終わる';
    setStatus('あなたのことばを聞いています', true);
    renderCapturing();
    const { started, reason } = asr.startExpressive({
      enabled: config002.ai !== 'off',
      onPartial: (text) => { const el = $('capturingPartial'); if (el) el.textContent = text; },
      onFinal: (fragment) => {
        state.expressive = false;
        state.fragment = fragment;
        $('speakButton').classList.remove('recording'); $('speakLabel').textContent = '話す';
        renderIdle();
        setStatus('ことばを受け取りました。会話を続けられます。');
        resumePartnerListening();
      },
      onError: (message) => showExpressiveRecovery(`${message} 文字で入力するか、もう一度話してください。`),
      onLatency: logLatency,
    });
    if (!started) {
      showExpressiveRecovery(reason === 'ai-off'
        ? '音声は使いません。文字で入力してください。'
        : 'この端末では音声を聞き取れません。文字で入力してください。');
    }
  }
  function finishExpressive(text) {
    if (!state.expressive) return;
    state.expressive = false;
    $('speakButton').classList.remove('recording'); $('speakLabel').textContent = '話す';
    const turn = asr.finishExpressive(text ?? asr.getExpressivePartial());
    state.fragment = turn ? turn.text : (text || '');
    renderIdle();
    setStatus('ことばを受け取りました。会話を続けられます。');
    resumePartnerListening();
  }

  // ---- USER_FRAGMENT_READY ----
  function renderFragmentForm(prefill, autofocus, allowRetry = false) {
    setMain(`<form class="typed-form" id="typedForm"><label for="fragmentInput">短いことばで大丈夫です</label><textarea id="fragmentInput" rows="3" placeholder="例：娘　明日　病院">${escapeHtml(prefill || '')}</textarea><button class="button button-primary" type="submit">このことばで進む</button>${allowRetry ? '<button class="choice retry-speech" id="retrySpeechButton" type="button">もう一度話す</button>' : ''}<button class="text-button" id="fragmentBackButton" type="button">やめる</button></form>`);
    $('typedForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const text = $('fragmentInput').value.trim();
      if (!text) return;
      if (!sessionStore.isActive()) sessionStore.startSession(config002);
      state.fragment = text;
      recordTurn('person', text, 'typed');
      renderIdle();
      setStatus('ことばを受け取りました。会話を続けられます。');
      resumePartnerListening();
    });
    if (allowRetry) $('retrySpeechButton').addEventListener('click', startExpressive);
    $('fragmentBackButton').addEventListener('click', () => { renderIdle(); setStatus('準備できています'); resumePartnerListening(); });
    if (autofocus) $('fragmentInput').focus();
    setBottomBar(false);
  }

  // ---- CLARIFYING / CONFIRMING / FALLBACK (main-area "flow" states) ----
  function renderFlowView(heading, items, onClick, addNone = false, extraClass = '') {
    setMain(`<div class="flow-view ${extraClass}">${heading}<div class="flow-actions" id="flowActions"></div></div>`);
    const actions = $('flowActions');
    items.forEach((item) => { const button = document.createElement('button'); button.type = 'button'; button.className = 'choice'; button.textContent = item; button.addEventListener('click', () => onClick(item)); actions.appendChild(button); });
    if (addNone) { const none = document.createElement('button'); none.type = 'button'; none.className = 'text-button'; none.textContent = 'どれも違います'; none.addEventListener('click', () => onClick('どれも違います')); actions.appendChild(none); }
    setBottomBar(false);
    return actions;
  }
  function beginFragment(fragment) { if (!fragment) return showFallback(); state.fragment = fragment; state.round = 0; state.noneCounts = {}; state.ambiguityIndex = 0; state.known = []; state.answers = {}; state.clarificationHistory = []; if (modeA) return showDirectCandidates(); nextClarification(); }
  function showDirectCandidates() { const started = performance.now(); state.message = ''; setStatus('近いことばを選んでください。'); logLatency('llm: direct candidates', started, state.fragment); renderFlowView(`<p class="eyebrow">候補から選ぶ</p><h2>伝えたいことに近いものはどれですか？</h2><span class="fragment-chip">${escapeHtml(state.fragment)}</span>`, directCandidates(), (item) => { state.message = item; showConfirm(); }); }
  function nextClarification() { const item = ambiguities.slice(state.ambiguityIndex).find((candidate) => !state.known.includes(candidate.key) && (!candidate.test || !candidate.test.test(state.fragment))); if (!item || state.round >= 2) return showConfirm(); state.activeAmbiguity = item; showClarification(item, choicesFor(item, false)); }
  function showClarification(item, choices, countsAsRound = true) { const started = performance.now(); if (countsAsRound) state.round += 1; setStatus('答えを選んでください。'); logLatency('llm: clarification choices', started, item.key); renderFlowView(`<p class="eyebrow">確認</p><h2>${item.question}</h2><span class="fragment-chip">${escapeHtml(state.fragment)}</span>`, choices, (choice) => { if (choice === 'どれも違います') return noneOfThese(); state.clarificationHistory.push({ item, answers: { ...state.answers }, known: [...state.known], round: state.round, ambiguityIndex: state.ambiguityIndex }); if (state.clarificationHistory.length > 2) state.clarificationHistory.shift(); state.known.push(item.key); state.answers[item.key] = choice; state.ambiguityIndex = ambiguities.indexOf(item) + 1; if (state.round >= 2 || item.key === 'content') { state.message = buildMessage(); showConfirm(); } else nextClarification(); }, true); }
  function noneOfThese() { const key = state.activeAmbiguity.key; if (!state.noneCounts[key]) { state.noneCounts[key] = 1; showClarification(state.activeAmbiguity, choicesFor(state.activeAmbiguity, true), false); } else showFallback(); }
  function choicesFor(item, regenerate) { if (item.key === 'content') return contentChoicesFor(regenerate); return regenerate ? item.alternatives : item.choices; }
  function timeWord() { const answer = state.answers.time; if (answer) return ({'今日のこと':'今日','明日のこと':'明日','別の日のこと':'別の日','今週のこと':'今週','来週のこと':'来週','日にちは関係ない':''})[answer] ?? ''; if (/今日|きょう/.test(state.fragment)) return '今日'; if (/明日|あした/.test(state.fragment)) return '明日'; if (/昨日|きのう/.test(state.fragment)) return '昨日'; if (/来週/.test(state.fragment)) return '来週'; if (/今週/.test(state.fragment)) return '今週'; return ''; }
  function topicWord() { const answer = state.answers.topic; if (answer) return ({'病院・診察のこと':'病院','家族のこと':'家族','予定や予約のこと':'予定','仕事のこと':'仕事','移動のこと':'移動','別のこと':''})[answer] ?? ''; if (/病院|医者|診察/.test(state.fragment)) return '病院'; if (/学校/.test(state.fragment)) return '学校'; if (/仕事/.test(state.fragment)) return '仕事'; if (/電車/.test(state.fragment)) return '移動'; if (/家族|娘|息子/.test(state.fragment)) return '家族'; if (/予約|薬/.test(state.fragment)) return '予定'; return ''; }
  // A person word appearing in the fragment is only a *mention*, not automatically the subject.
  // "娘に" (dative-marked) names a target/recipient, not a doer; a bare mention ("娘") is ambiguous
  // and must be confirmed via contentChoicesFor() rather than assumed.
  function personMention() {
    const match = state.fragment.match(/(娘|息子|家族|母|父|妻|夫|友達|先生|私|自分)(に)?/);
    if (!match) return null;
    if (match[1] === '私' || match[1] === '自分') return { word: '私', isSelf: true, isTarget: false };
    return { word: match[1], isSelf: false, isTarget: !!match[2] };
  }
  function contentChoicesFor(regenerate) {
    const topic = topicWord();
    const mention = personMention();
    if (mention && !mention.isSelf && !mention.isTarget) {
      const dest = topic ? `${topic}に` : '';
      return regenerate
        ? [`私が${dest}行きたいです`, `${mention.word}が${dest}行きたいです`, '別のことを伝えたいです']
        : [`私が${dest}行きます`, `${mention.word}が${dest}行きます`, '確認したいです'];
    }
    return regenerate
      ? ['断りたいです', '手伝ってほしいです', '別のことを伝えたいです']
      : ['行きます', '行きたいです', '確認したいです'];
  }
  function contentClause(topic) {
    const answer = state.answers.content;
    if (!answer) return topic ? `${topic}のことを伝えたいです` : '伝えたいことがあります';
    if (/が/.test(answer)) return answer; // already a full "who does what" clause from contentChoicesFor
    if (answer === '行きます') return topic ? `${topic}に行きます` : '行きます';
    if (answer === '行きたいです') return topic ? `${topic}に行きたいです` : '行きたいです';
    if (answer === '確認したいです') return topic ? `${topic}のことを確認したいです` : '確認したいです';
    if (answer === '断りたいです') return topic ? `${topic}のことを断りたいです` : '断りたいです';
    if (answer === '手伝ってほしいです') return topic ? `${topic}のことで手伝ってほしいです` : '手伝ってほしいです';
    return topic ? `${topic}のことを伝えたいです` : '伝えたいことがあります';
  }
  function buildMessage() {
    const time = timeWord(); const topic = topicWord(); const mention = personMention();
    const clause = contentClause(topic);
    const clauseHasSubject = /が/.test(state.answers.content || '');
    const subjectPrefix = (!clauseHasSubject && mention && mention.isSelf) ? `${mention.word}は` : '';
    return `${time ? `${time}、` : ''}${subjectPrefix}${clause}。`;
  }
  function directCandidates() {
    const time = timeWord(); const topic = topicWord(); const mention = personMention();
    const timePrefix = time ? `${time}、` : '';
    let goClause;
    if (mention && !mention.isSelf && !mention.isTarget) goClause = `${mention.word}が${topic ? `${topic}へ` : ''}行きます`;
    else if (mention && mention.isTarget) goClause = `${mention.word}に${topic ? `${topic}のことを` : ''}伝えます`;
    else goClause = topic ? `${topic}へ行きます` : '伝えたいことがあります';
    const confirmClause = topic ? `${topic}の予定を確認したいです` : '確認したいです';
    const tellClause = topic ? `${topic}のことを伝えたいです` : '伝えたいことがあります';
    return [`${timePrefix}${goClause}。`, `${timePrefix}${confirmClause}。`, `${timePrefix}${tellClause}。`];
  }
  function showConfirm() { state.confirmed = false; setStatus('伝えることばを確認してください。'); renderFlowView('<p class="eyebrow">確認してください</p><h2>このことばで合っていますか？</h2>', [], () => {}); const actions = $('flowActions'); actions.innerHTML = `<div class="confirm-message">${escapeHtml(state.message || buildMessage())}</div>`; addAction(actions, 'これで伝える', 'button-primary', () => { state.confirmed = true; showOutput(); }); addAction(actions, 'もどる', 'text-button', () => { if (modeA) return showDirectCandidates(); const snapshot = state.clarificationHistory.pop(); if (!snapshot) return showConfirm(); state.answers = { ...snapshot.answers }; state.known = [...snapshot.known]; state.round = snapshot.round; state.ambiguityIndex = snapshot.ambiguityIndex; state.message = buildMessage(); showClarification(snapshot.item, choicesFor(snapshot.item, false)); }); addAction(actions, `${icon('reset')} 最初から`, 'text-button', reset); }
  function showFallback() { setStatus('ことばをもう一度選んでください。'); renderFlowView('<p class="eyebrow">もう少し教えてください</p><h2>うまく絞り込めませんでした。</h2><p class="flow-note">あなたのことばをもう一度選んでください。</p>', [], () => {}, false, 'fallback'); const actions = $('flowActions'); addAction(actions, `${icon('mic')} もう少し話す`, 'choice long-choice', startExpressive); addAction(actions, `${icon('keyboard')} 文字を足す`, 'choice', () => renderFragmentForm(state.fragment, true)); addAction(actions, `${icon('reset')} 最初から`, 'text-button', reset); }

  // ---- PARTNER_OUTPUT (full-viewport overlay, not part of the main-area swap) ----
  function showOutput() { if (!state.confirmed) return; const overlay = $('outputOverlay'); overlay.hidden = false; overlay.innerHTML = `<div class="partner-message">${escapeHtml(state.message)}</div><div class="output-controls"></div>`; const controls = overlay.querySelector('.output-controls'); addAction(controls, `${icon('volume')} 声で伝える`, 'button button-primary', speakConfirmed); addAction(controls, '自分の画面にもどる', 'text-button', closeOutput); }
  function closeOutput() { $('outputOverlay').hidden = true; $('outputOverlay').innerHTML = ''; setStatus('確認したことばだけが、相手に伝えられます。'); resumePartnerListening(); }
  function speakConfirmed() { if (!state.confirmed) return; if (!window.speechSynthesis) return setStatus('この端末では読み上げを使えません。'); window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(state.message); utterance.lang = 'ja-JP'; window.speechSynthesis.speak(utterance); setStatus('確認したことばを読み上げています。'); }

  function reset() {
    // Clears the settled region and the chunker with it: 最初から means the conversation
    // starts over, so nothing may carry a revision link to a chunk that no longer exists.
    person.reset();
    expressive.reset();
    state.listening = false;
    stopPartnerRecognition();
    stopExpressiveRecognition();
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    state.partnerSessionActive = false; state.partnerMicActive = false; state.expressive = false; state.round = 0; state.noneCounts = {}; state.known = []; state.answers = {}; state.clarificationHistory = []; state.confirmed = false; state.fragment = ''; state.message = '';
    $('outputOverlay').hidden = true; $('outputOverlay').innerHTML = '';
    $('speakButton').classList.remove('recording'); $('speakLabel').textContent = '話す';
    person.setTranscript('');
    setSession(false, false);
    renderIdle();
    setStatus('準備できています');
  }

  $('listenButton').addEventListener('click', beginListening);
  $('stopListenButton').addEventListener('click', stopListening);
  // `expressivePartial` was a local of the pre-Stage-3 handler and no longer exists; reading
  // it threw a ReferenceError on every 終わる tap that happened without the typed form open.
  // Recognition state moved into capture/asr.js, which is where the partial now comes from.
  $('speakButton').addEventListener('click', () => (state.expressive
    ? finishExpressive($('fragmentInput') ? $('fragmentInput').value : asr.getExpressivePartial())
    : startExpressive()));
  $('typeButton').addEventListener('click', () => renderFragmentForm(state.fragment, true));
  $('resetButton').addEventListener('click', reset);

  renderIdle();
})();
