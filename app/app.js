(() => {
  const $ = (id) => document.getElementById(id);
  const modeA = new URLSearchParams(location.search).get('mode') === 'a';
  const state = { partnerSessionActive:false, partnerMicActive:false, listening:false, expressive:false, round:0, ambiguityIndex:0, noneCounts:{}, known:[], answers:{}, clarificationHistory:[], fragment:'', confirmed:false, message:'' };
  const ambiguities = [
    { key:'time', test:/今日|きょう|明日|あした|昨日|きのう|今週|来週|朝|午後|夜|金曜|月曜/, question:'いつのことですか？', choices:['今日のこと','明日のこと','別の日のこと'], alternatives:['今週のこと','来週のこと','日にちは関係ない'] },
    { key:'topic', test:/病院|医者|診察|学校|仕事|電車|家族|娘|息子|予約|薬/, question:'何についてですか？', choices:['病院・診察のこと','家族のこと','予定や予約のこと'], alternatives:['仕事のこと','移動のこと','別のこと'] },
    { key:'content', test:null, question:'何を伝えたいですか？', choices:['行きたい・行きます','確認したいです','断りたいです'], alternatives:['手伝ってほしいです','変更したいです','別のことを伝えたいです'] }
  ];

  // ---- shared UI helpers ----
  function icon(name) { const paths = { mic:'<path d="M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z"></path><path d="M19 10v1a7 7 0 0 1-14 0v-1"></path><path d="M12 18v3M8 21h8"></path>', keyboard:'<rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="M6 9h.01M9 9h.01M12 9h.01M15 9h.01M18 9h.01M6 13h12M8 16h8"></path>', volume:'<path d="M4 10v4h3l4 3V7l-4 3H4Z"></path><path d="M15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12"></path>', reset:'<path d="M3 12a9 9 0 1 0 3-6.7"></path><path d="M3 4v6h6"></path>' }; return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name]}</svg>`; }
  function setStatus(text, active = false) { $('statusText').textContent = text; $('statusDot').classList.toggle('active', active); }
  function logLatency(kind, started, detail) { const ms = Math.round(performance.now() - started); const label = `${kind}: ${ms}ms`; console.info(`[latency] ${label}`, detail || ''); return ms; }
  function setSession(sessionActive = state.partnerSessionActive, micActive = state.partnerMicActive) { state.partnerSessionActive = sessionActive; state.partnerMicActive = micActive; state.listening = micActive; $('listenButton').hidden = sessionActive; $('stopListenButton').hidden = !sessionActive; $('sessionState').textContent = !sessionActive ? '停止中' : micActive ? '聞いています' : '一時停止中'; $('sessionState').classList.toggle('live', sessionActive && micActive); }
  function friendlyRecognitionError(error) { return ({ 'not-allowed':'マイクが使えないようです。文字でも入力できます。', 'no-speech':'声を聞き取れませんでした。もう一度試せます。', network:'音声を処理できませんでした。もう一度試してください。' })[error] || '音声を使えませんでした。文字でも入力できます。'; }
  function pausePartnerListening() { if (!state.partnerSessionActive) return; state.partnerMicActive = false; state.listening = false; if (partnerRecognition) { partnerRecognition.onend = null; try { partnerRecognition.stop(); } catch (_) {} } setSession(true, false); $('partnerTranscript').textContent = '一時停止中'; }
  function resumePartnerListening() { if (state.partnerSessionActive && !state.partnerMicActive) beginListening(); }
  function setBottomBar(visible) { $('bottomBar').hidden = !visible; }
  function setMain(html) { $('mainArea').innerHTML = html; }
  function showChoices(box, items, onClick) { box.innerHTML = ''; items.forEach((item) => { const button = document.createElement('button'); button.className = `choice${item.length > 15 ? ' long-choice' : ''}`; button.type = 'button'; button.textContent = item; button.addEventListener('click', () => onClick(item)); box.appendChild(button); }); }
  function addAction(parent, text, className, callback) { const button = document.createElement('button'); button.type = 'button'; button.className = className; button.innerHTML = text; button.addEventListener('click', callback); parent.appendChild(button); }
  function escapeHtml(text) { return text.replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char])); }

  // ---- IDLE ----
  function renderIdle() { setMain('<div class="idle-state"><p>上で相手の話を聞くか、下から伝えることばを作れます。</p></div>'); setBottomBar(true); }

  // ---- PARTNER_MEANING_READY ----
  function simplifyPartner(text) {
    const clean = text.trim();
    if (!clean) return { meaning:'聞き取れませんでした。もう一度お願いします。', choices:[] };
    if (/金曜|月曜|いつ|何時|午後|午前/.test(clean)) return { meaning:'いつがいいですか？', choices:['金曜日の午後','月曜日の午前','どちらでもいい'] };
    if (/来る|行く|できますか|大丈夫|いいですか/.test(clean)) return { meaning:'できますか？', choices:['はい、できます','いいえ、できません','わかりません'] };
    if (/病院|医者|診察|学校|仕事|電車|家族|娘|息子|予約|薬|確認|変更|連絡/.test(clean)) return { meaning:'相手の話について、返事を選びますか？', choices:['はい','いいえ','もう一度聞く'] };
    return { meaning:'うまく処理できませんでした。もう一度お願いします。', choices:[] };
  }
  function renderPartnerMeaning(text) {
    const result = simplifyPartner(text);
    setMain(`<div class="meaning-view"><p class="eyebrow">相手は何を聞いていますか？</p><p class="meaning" id="partnerMeaning">${escapeHtml(result.meaning)}</p><div class="choice-list" id="partnerChoices"></div><button class="text-button" id="dontUnderstandButton" type="button">わかりません</button></div>`);
    showChoices($('partnerChoices'), result.choices, (choice) => { if (choice === 'もう一度聞く' || choice === 'わかりません') return showDontUnderstand(); setStatus('返事を選びました。必要なら自分のことばを作れます。'); });
    $('dontUnderstandButton').addEventListener('click', showDontUnderstand);
    setBottomBar(true);
  }
  function showPartnerResult(text) { const started = performance.now(); $('partnerTranscript').textContent = text || 'ここに相手のことばが出ます。'; renderPartnerMeaning(text); logLatency('llm: receptive simplification', started, text); }
  function showDontUnderstand() {
    setMain(`<div class="dont-understand-view"><p class="eyebrow">わかりません</p><h2>もう一度、聞いてみましょう。</h2><div class="flow-actions"><button class="choice long-choice" id="reListenButton" type="button">${icon('mic')} 相手にもう一度話してもらう</button><button class="choice" id="goExpressiveButton" type="button">${icon('mic')} 自分から伝える</button></div></div>`);
    $('reListenButton').addEventListener('click', beginListening);
    $('goExpressiveButton').addEventListener('click', startExpressive);
    setStatus('相手にもう一度話してもらうか、自分から伝えられます。');
    setBottomBar(true);
  }

  // ---- conversation listening (background, always reachable) ----
  let partnerRecognition;
  function beginListening() {
    setSession(true, true); setStatus('相手の話を聞いています', true); $('partnerTranscript').textContent = '聞いています…';
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) { setStatus('音声認識がないため、デモの相手のことばを表示します。'); showPartnerResult('金曜日の午後か、月曜日の午前はどうですか？'); return; }
    partnerRecognition = new Recognition(); partnerRecognition.lang = 'ja-JP'; partnerRecognition.continuous = true; partnerRecognition.interimResults = true;
    let asrStarted = performance.now(); partnerRecognition.onresult = (event) => { let finalText = ''; let interim = ''; for (let i=event.resultIndex; i<event.results.length; i += 1) { const line = event.results[i][0].transcript; if (event.results[i].isFinal) finalText += line; else interim += line; } if (interim) $('partnerTranscript').textContent = interim; if (finalText) { logLatency('asr: partner transcription', asrStarted, finalText); showPartnerResult(finalText); asrStarted = performance.now(); } };
    partnerRecognition.onerror = (event) => { console.warn('partner recognition error', event.error); setStatus(friendlyRecognitionError(event.error)); };
    partnerRecognition.onend = () => { if (state.partnerSessionActive && state.partnerMicActive) { try { partnerRecognition.start(); } catch (_) {} } };
    try { partnerRecognition.start(); } catch (_) { setStatus('音声認識を開始できませんでした。'); }
  }
  function stopListening() { state.partnerSessionActive = false; state.partnerMicActive = false; state.listening = false; if (partnerRecognition) { partnerRecognition.onend = null; try { partnerRecognition.stop(); } catch (_) {} } setSession(false, false); $('partnerTranscript').textContent = 'ここに相手のことばが出ます。'; setStatus('聞くのを止めました。'); }

  // ---- CAPTURING_USER ----
  function renderCapturing() { setMain('<div class="capturing-view"><span class="rec-dot" aria-hidden="true"></span><p>あなたのことばを聞いています…</p><p class="small-note" id="capturingPartial"></p><p class="small-note">話し終わったら、下のボタンを押してください。</p></div>'); setBottomBar(true); }

  let expressiveRecognition; let expressivePartial = ''; let expressiveGeneration = 0;
  function stopExpressiveRecognition() {
    expressiveGeneration += 1;
    if (expressiveRecognition) {
      expressiveRecognition.onresult = null;
      expressiveRecognition.onerror = null;
      try { expressiveRecognition.stop(); } catch (_) {}
      expressiveRecognition = null;
    }
  }
  function showExpressiveRecovery(message) {
    state.expressive = false;
    $('speakButton').classList.remove('recording'); $('speakLabel').textContent = '話す';
    renderFragmentForm('', true, true);
    setStatus(message);
  }
  function startExpressive() {
    pausePartnerListening();
    state.expressive = true; expressivePartial = '';
    const generation = ++expressiveGeneration;
    $('speakButton').classList.add('recording'); $('speakLabel').textContent = '終わる';
    setStatus('あなたのことばを聞いています', true);
    renderCapturing();
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) { showExpressiveRecovery('音声認識が使えません。文字で入力するか、もう一度話してください。'); return; }
    expressiveRecognition = new Recognition(); expressiveRecognition.lang = 'ja-JP'; expressiveRecognition.continuous = false; expressiveRecognition.interimResults = true;
    const asrStarted = performance.now(); expressiveRecognition.onresult = (event) => { if (generation !== expressiveGeneration || !state.expressive) return; const text = event.results[0][0].transcript; expressivePartial = text; const partialEl = $('capturingPartial'); if (partialEl) partialEl.textContent = text; if (event.results[0].isFinal) { logLatency('asr: expressive fragment', asrStarted, text); finishExpressive(text, generation); } };
    expressiveRecognition.onerror = (event) => { if (generation !== expressiveGeneration) return; console.warn('expressive recognition error', event.error); stopExpressiveRecognition(); showExpressiveRecovery(`${friendlyRecognitionError(event.error)} 文字で入力するか、もう一度話してください。`); };
    try { expressiveRecognition.start(); } catch (_) { stopExpressiveRecognition(); showExpressiveRecovery('音声認識を開始できません。文字で入力するか、もう一度話してください。'); }
  }
  function finishExpressive(text, generation = expressiveGeneration) {
    if (!state.expressive || generation !== expressiveGeneration) return; state.expressive = false;
    stopExpressiveRecognition();
    $('speakButton').classList.remove('recording'); $('speakLabel').textContent = '話す';
    const fragment = (text || expressivePartial || '').trim();
    renderFragmentForm(fragment, false);
    setStatus('ことばを確認して、進んでください。');
  }

  // ---- USER_FRAGMENT_READY ----
  function renderFragmentForm(prefill, autofocus, allowRetry = false) {
    setMain(`<form class="typed-form" id="typedForm"><label for="fragmentInput">短いことばで大丈夫です</label><textarea id="fragmentInput" rows="3" placeholder="例：娘　明日　病院">${escapeHtml(prefill || '')}</textarea><button class="button button-primary" type="submit">このことばで進む</button>${allowRetry ? '<button class="choice retry-speech" id="retrySpeechButton" type="button">もう一度話す</button>' : ''}<button class="text-button" id="fragmentBackButton" type="button">やめる</button></form>`);
    $('typedForm').addEventListener('submit', (event) => { event.preventDefault(); beginFragment($('fragmentInput').value.trim()); });
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
  function showDirectCandidates() { const started = performance.now(); state.message = ''; setStatus('近いことばを選んでください。'); logLatency('llm: direct candidates', started, state.fragment); renderFlowView(`<p class="eyebrow">候補から選ぶ</p><h2>伝えたいことに近いものはどれですか？</h2><span class="fragment-chip">${escapeHtml(state.fragment)}</span>`, ['娘は明日、病院へ行きます。','娘の病院の予定を確認したいです。','明日の病院のことを伝えたいです。'], (item) => { state.message = item; showConfirm(); }); }
  function nextClarification() { const item = ambiguities.slice(state.ambiguityIndex).find((candidate) => !state.known.includes(candidate.key) && (!candidate.test || !candidate.test.test(state.fragment))); if (!item || state.round >= 2) return showConfirm(); state.activeAmbiguity = item; showClarification(item, item.choices); }
  function showClarification(item, choices, countsAsRound = true) { const started = performance.now(); if (countsAsRound) state.round += 1; setStatus('答えを選んでください。'); logLatency('llm: clarification choices', started, item.key); renderFlowView(`<p class="eyebrow">確認</p><h2>${item.question}</h2><span class="fragment-chip">${escapeHtml(state.fragment)}</span>`, choices, (choice) => { if (choice === 'どれも違います') return noneOfThese(); state.clarificationHistory.push({ item, answers: { ...state.answers }, known: [...state.known], round: state.round, ambiguityIndex: state.ambiguityIndex }); if (state.clarificationHistory.length > 2) state.clarificationHistory.shift(); state.known.push(item.key); state.answers[item.key] = choice; state.ambiguityIndex = ambiguities.indexOf(item) + 1; if (state.round >= 2 || item.key === 'content') { state.message = buildMessage(); showConfirm(); } else nextClarification(); }, true); }
  function noneOfThese() { const key = state.activeAmbiguity.key; if (!state.noneCounts[key]) { state.noneCounts[key] = 1; showClarification(state.activeAmbiguity, state.activeAmbiguity.alternatives, false); } else showFallback(); }
  function timeWord() { const answer = state.answers.time; if (answer) return ({'今日のこと':'今日','明日のこと':'明日','別の日のこと':'別の日','今週のこと':'今週','来週のこと':'来週','日にちは関係ない':''})[answer] ?? ''; if (/今日|きょう/.test(state.fragment)) return '今日'; if (/明日|あした/.test(state.fragment)) return '明日'; if (/昨日|きのう/.test(state.fragment)) return '昨日'; if (/来週/.test(state.fragment)) return '来週'; if (/今週/.test(state.fragment)) return '今週'; return ''; }
  function topicWord() { const answer = state.answers.topic; if (answer) return ({'病院・診察のこと':'病院','家族のこと':'家族','予定や予約のこと':'予定','仕事のこと':'仕事','移動のこと':'移動','別のこと':''})[answer] ?? ''; if (/病院|医者|診察/.test(state.fragment)) return '病院'; if (/学校/.test(state.fragment)) return '学校'; if (/仕事/.test(state.fragment)) return '仕事'; if (/電車/.test(state.fragment)) return '移動'; if (/家族|娘|息子/.test(state.fragment)) return '家族'; if (/予約|薬/.test(state.fragment)) return '予定'; return ''; }
  function personWord() { if (/娘|息子|家族|母|父|妻|夫|友達|先生/.test(state.fragment)) return state.fragment.match(/娘|息子|家族|母|父|妻|夫|友達|先生/)[0]; if (/私|自分/.test(state.fragment)) return '私'; return ''; }
  function contentClause(topic) { const answer = state.answers.content; if (answer === '行きたい・行きます') return topic ? `${topic}に行きたいです` : '行きたいです'; if (answer === '断りたいです') return topic ? `${topic}のことを断りたいです` : '断りたいです'; if (answer === '手伝ってほしいです') return topic ? `${topic}のことで手伝ってほしいです` : '手伝ってほしいです'; if (answer === '変更したいです') return topic ? `${topic}のことを変更したいです` : '変更したいです'; if (answer === '確認したいです' || !topic) return topic ? `${topic}のことを確認したいです` : '予定について伝えたいです'; return `${topic}のことを伝えたいです`; }
  function buildMessage() { const time = timeWord(); const topic = topicWord(); const person = personWord(); const clause = contentClause(topic); return `${time ? `${time}、` : ''}${person ? `${person}は` : ''}${clause}。`; }
  function showConfirm() { state.confirmed = false; setStatus('伝えることばを確認してください。'); renderFlowView('<p class="eyebrow">確認してください</p><h2>このことばで合っていますか？</h2>', [], () => {}); const actions = $('flowActions'); actions.innerHTML = `<div class="confirm-message">${escapeHtml(state.message || buildMessage())}</div>`; addAction(actions, 'これで伝える', 'button-primary', () => { state.confirmed = true; showOutput(); }); addAction(actions, 'もどる', 'text-button', () => { if (modeA) return showDirectCandidates(); const snapshot = state.clarificationHistory.pop(); if (!snapshot) return showConfirm(); state.answers = { ...snapshot.answers }; state.known = [...snapshot.known]; state.round = snapshot.round; state.ambiguityIndex = snapshot.ambiguityIndex; state.message = buildMessage(); showClarification(snapshot.item, snapshot.item.choices); }); addAction(actions, `${icon('reset')} 最初から`, 'text-button', reset); }
  function showFallback() { setStatus('ことばをもう一度選んでください。'); renderFlowView('<p class="eyebrow">もう少し教えてください</p><h2>うまく絞り込めませんでした。</h2><p class="flow-note">あなたのことばをもう一度選んでください。</p>', [], () => {}, false, 'fallback'); const actions = $('flowActions'); addAction(actions, `${icon('mic')} もう少し話す`, 'choice long-choice', startExpressive); addAction(actions, `${icon('keyboard')} 文字を足す`, 'choice', () => renderFragmentForm(state.fragment, true)); addAction(actions, `${icon('reset')} 最初から`, 'text-button', reset); }

  // ---- PARTNER_OUTPUT (full-viewport overlay, not part of the main-area swap) ----
  function showOutput() { if (!state.confirmed) return; const overlay = $('outputOverlay'); overlay.hidden = false; overlay.innerHTML = `<div class="partner-message">${escapeHtml(state.message)}</div><div class="output-controls"></div>`; const controls = overlay.querySelector('.output-controls'); addAction(controls, `${icon('volume')} 声で伝える`, 'button button-primary', speakConfirmed); addAction(controls, '自分の画面にもどる', 'text-button', closeOutput); }
  function closeOutput() { $('outputOverlay').hidden = true; $('outputOverlay').innerHTML = ''; setStatus('確認したことばだけが、相手に伝えられます。'); resumePartnerListening(); }
  function speakConfirmed() { if (!state.confirmed) return; if (!window.speechSynthesis) return setStatus('この端末では読み上げを使えません。'); window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(state.message); utterance.lang = 'ja-JP'; window.speechSynthesis.speak(utterance); setStatus('確認したことばを読み上げています。'); }

  function reset() {
    if (partnerRecognition) { state.listening = false; try { partnerRecognition.stop(); } catch (_) {} }
    stopExpressiveRecognition();
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    state.partnerSessionActive = false; state.partnerMicActive = false; state.expressive = false; state.round = 0; state.noneCounts = {}; state.known = []; state.answers = {}; state.clarificationHistory = []; state.confirmed = false; state.fragment = ''; state.message = '';
    $('outputOverlay').hidden = true; $('outputOverlay').innerHTML = '';
    $('speakButton').classList.remove('recording'); $('speakLabel').textContent = '話す';
    $('partnerTranscript').textContent = 'ここに相手のことばが出ます。';
    setSession(false, false);
    renderIdle();
    setStatus('準備できています');
  }

  $('listenButton').addEventListener('click', beginListening);
  $('stopListenButton').addEventListener('click', stopListening);
  $('speakButton').addEventListener('click', () => state.expressive ? finishExpressive($('fragmentInput') ? $('fragmentInput').value : expressivePartial) : startExpressive());
  $('typeButton').addEventListener('click', () => renderFragmentForm(state.fragment, true));
  $('resetButton').addEventListener('click', reset);

  renderIdle();
})();
