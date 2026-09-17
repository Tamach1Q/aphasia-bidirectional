(() => {
  const $ = (id) => document.getElementById(id);
  const modeA = new URLSearchParams(location.search).get('mode') === 'a';
  const state = { listening:false, expressive:false, round:0, ambiguityIndex:0, noneCounts:{}, known:[], answers:{}, fragment:'', confirmed:false, message:'' };
  const ambiguities = [
    { key:'time', test:/今日|きょう|明日|あした|昨日|きのう|今週|来週|朝|午後|夜|金曜|月曜/, question:'いつのことですか？', choices:['今日のこと','明日のこと','別の日のこと'], alternatives:['今週のこと','来週のこと','日にちは関係ない'] },
    { key:'topic', test:/病院|医者|診察|学校|仕事|電車|家族|娘|息子|予約|薬/, question:'何についてですか？', choices:['病院・診察のこと','家族のこと','予定や予約のこと'], alternatives:['仕事のこと','移動のこと','別のこと'] },
    { key:'content', test:null, question:'何を伝えたいですか？', choices:['行きたい・行きます','確認したいです','断りたいです'], alternatives:['手伝ってほしいです','変更したいです','別のことを伝えたいです'] }
  ];

  // ---- shared UI helpers ----
  function setStatus(text, active = false) { $('statusText').textContent = text; $('statusDot').classList.toggle('active', active); }
  function logLatency(kind, started, detail) { const ms = Math.round(performance.now() - started); const label = `${kind}: ${ms}ms`; console.info(`[latency] ${label}`, detail || ''); return ms; }
  function setSession(active) { state.listening = active; $('listenButton').hidden = active; $('stopListenButton').hidden = !active; $('sessionState').textContent = active ? '聞いています' : '停止中'; $('sessionState').classList.toggle('live', active); }
  function setBottomBar(visible) { $('bottomBar').hidden = !visible; }
  function setMain(html) { $('mainArea').innerHTML = html; }
  function showChoices(box, items, onClick) { box.innerHTML = ''; items.forEach((item) => { const button = document.createElement('button'); button.className = 'choice'; button.type = 'button'; button.textContent = item; button.addEventListener('click', () => onClick(item)); box.appendChild(button); }); }
  function addAction(parent, text, className, callback) { const button = document.createElement('button'); button.type = 'button'; button.className = className; button.textContent = text; button.addEventListener('click', callback); parent.appendChild(button); }
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
    setMain('<div class="dont-understand-view"><p class="eyebrow">わかりません</p><h2>もう一度、聞いてみましょう。</h2><div class="flow-actions"><button class="choice" id="reListenButton" type="button">🎙 相手にもう一度話してもらう</button><button class="choice" id="goExpressiveButton" type="button">✍ 自分から伝える</button></div></div>');
    $('reListenButton').addEventListener('click', beginListening);
    $('goExpressiveButton').addEventListener('click', startExpressive);
    setStatus('相手にもう一度話してもらうか、自分から伝えられます。');
    setBottomBar(true);
  }

  // ---- conversation listening (background, always reachable) ----
  let partnerRecognition;
  function beginListening() {
    setSession(true); setStatus('相手の話を聞いています', true); $('partnerTranscript').textContent = '聞いています…';
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) { setStatus('音声認識がないため、デモの相手のことばを表示します。'); showPartnerResult('金曜日の午後か、月曜日の午前はどうですか？'); return; }
    partnerRecognition = new Recognition(); partnerRecognition.lang = 'ja-JP'; partnerRecognition.continuous = true; partnerRecognition.interimResults = true;
    let asrStarted = performance.now(); partnerRecognition.onresult = (event) => { let finalText = ''; let interim = ''; for (let i=event.resultIndex; i<event.results.length; i += 1) { const line = event.results[i][0].transcript; if (event.results[i].isFinal) finalText += line; else interim += line; } if (interim) $('partnerTranscript').textContent = interim; if (finalText) { logLatency('asr: partner transcription', asrStarted, finalText); showPartnerResult(finalText); asrStarted = performance.now(); } };
    partnerRecognition.onerror = (event) => setStatus(`音声認識を使えません（${event.error}）。文字入力も使えます。`);
    partnerRecognition.onend = () => { if (state.listening) { try { partnerRecognition.start(); } catch (_) {} } };
    try { partnerRecognition.start(); } catch (_) { setStatus('音声認識を開始できませんでした。'); }
  }
  function stopListening() { state.listening = false; if (partnerRecognition) { partnerRecognition.onend = null; partnerRecognition.stop(); } setSession(false); setStatus('聞くのを止めました。'); }

  // ---- CAPTURING_USER ----
  function renderCapturing() { setMain('<div class="capturing-view"><span class="rec-dot" aria-hidden="true"></span><p>あなたのことばを聞いています…</p><p class="small-note" id="capturingPartial"></p><p class="small-note">話し終わったら、下のボタンを押してください。</p></div>'); setBottomBar(true); }

  let expressiveRecognition; let expressivePartial = '';
  function startExpressive() {
    if (state.listening) stopListening();
    state.expressive = true; expressivePartial = '';
    $('speakButton').classList.add('recording'); $('speakLabel').textContent = '話し終わったら押してください';
    setStatus('あなたのことばを聞いています', true);
    renderCapturing();
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) { state.expressive = false; $('speakButton').classList.remove('recording'); $('speakLabel').textContent = '話して伝える'; setStatus('音声認識がないため、文字で入力してください。'); renderFragmentForm('娘　明日　病院', false); return; }
    expressiveRecognition = new Recognition(); expressiveRecognition.lang = 'ja-JP'; expressiveRecognition.continuous = false; expressiveRecognition.interimResults = true;
    const asrStarted = performance.now(); expressiveRecognition.onresult = (event) => { const text = event.results[0][0].transcript; expressivePartial = text; const partialEl = $('capturingPartial'); if (partialEl) partialEl.textContent = text; if (event.results[0].isFinal) { logLatency('asr: expressive fragment', asrStarted, text); finishExpressive(text); } };
    expressiveRecognition.onerror = () => { finishExpressive('娘 明日 病院'); setStatus('音声を確認できないため、デモのことばを表示しました。'); };
    try { expressiveRecognition.start(); } catch (_) { finishExpressive('娘 明日 病院'); }
  }
  function finishExpressive(text) {
    if (!state.expressive) return; state.expressive = false;
    if (expressiveRecognition) expressiveRecognition.stop();
    $('speakButton').classList.remove('recording'); $('speakLabel').textContent = '話して伝える';
    const fragment = (text || expressivePartial || '').trim();
    renderFragmentForm(fragment, false);
    setStatus('ことばを確認して、進んでください。');
  }

  // ---- USER_FRAGMENT_READY ----
  function renderFragmentForm(prefill, autofocus) {
    setMain(`<form class="typed-form" id="typedForm"><label for="fragmentInput">短いことばで大丈夫です</label><textarea id="fragmentInput" rows="3" placeholder="例：娘　明日　病院">${escapeHtml(prefill || '')}</textarea><button class="button button-primary" type="submit">このことばで進む</button><button class="text-button" id="fragmentBackButton" type="button">やめる</button></form>`);
    $('typedForm').addEventListener('submit', (event) => { event.preventDefault(); beginFragment($('fragmentInput').value.trim()); });
    $('fragmentBackButton').addEventListener('click', () => { renderIdle(); setStatus('準備できています'); });
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
  function beginFragment(fragment) { if (!fragment) return showFallback(); state.fragment = fragment; state.round = 0; state.noneCounts = {}; state.ambiguityIndex = 0; state.known = []; state.answers = {}; if (modeA) return showDirectCandidates(); nextClarification(); }
  function showDirectCandidates() { const started = performance.now(); state.message = '娘は明日、病院へ行きます。'; logLatency('llm: direct candidates', started, state.fragment); renderFlowView(`<p class="eyebrow">候補から選ぶ</p><h2>伝えたいことに近いものはどれですか？</h2><p class="flow-note">ことば：${escapeHtml(state.fragment)}</p>`, ['娘は明日、病院へ行きます。','娘の病院の予定を確認したいです。','明日の病院のことを伝えたいです。'], (item) => { state.message = item; showConfirm(); }); }
  function nextClarification() { const item = ambiguities.slice(state.ambiguityIndex).find((candidate) => !state.known.includes(candidate.key) && (!candidate.test || !candidate.test.test(state.fragment))); if (!item || state.round >= 2) return showConfirm(); state.activeAmbiguity = item; showClarification(item, item.choices); }
  function showClarification(item, choices, countsAsRound = true) { const started = performance.now(); if (countsAsRound) state.round += 1; logLatency('llm: clarification choices', started, item.key); renderFlowView(`<p class="eyebrow">${state.round} / 2 回目</p><h2>${item.question}</h2><p class="flow-note">短く選んでください。ことば：${escapeHtml(state.fragment)}</p>`, choices, (choice) => { if (choice === 'どれも違います') return noneOfThese(); state.known.push(item.key); state.answers[item.key] = choice; state.ambiguityIndex = ambiguities.indexOf(item) + 1; if (state.round >= 2 || item.key === 'content') { state.message = buildMessage(); showConfirm(); } else nextClarification(); }, true); }
  function noneOfThese() { const key = state.activeAmbiguity.key; if (!state.noneCounts[key]) { state.noneCounts[key] = 1; showClarification(state.activeAmbiguity, state.activeAmbiguity.alternatives, false); } else showFallback(); }
  function timeWord() { const answer = state.answers.time; if (answer) return ({'今日のこと':'今日','明日のこと':'明日','別の日のこと':'別の日','今週のこと':'今週','来週のこと':'来週','日にちは関係ない':''})[answer] ?? ''; if (/今日|きょう/.test(state.fragment)) return '今日'; if (/明日|あした/.test(state.fragment)) return '明日'; if (/昨日|きのう/.test(state.fragment)) return '昨日'; if (/来週/.test(state.fragment)) return '来週'; if (/今週/.test(state.fragment)) return '今週'; return ''; }
  function topicWord() { const answer = state.answers.topic; if (answer) return ({'病院・診察のこと':'病院','家族のこと':'家族','予定や予約のこと':'予定','仕事のこと':'仕事','移動のこと':'移動','別のこと':''})[answer] ?? ''; if (/病院|医者|診察/.test(state.fragment)) return '病院'; if (/学校/.test(state.fragment)) return '学校'; if (/仕事/.test(state.fragment)) return '仕事'; if (/電車/.test(state.fragment)) return '移動'; if (/家族|娘|息子/.test(state.fragment)) return '家族'; if (/予約|薬/.test(state.fragment)) return '予定'; return ''; }
  function contentClause(topic) { const answer = state.answers.content; if (answer === '行きたい・行きます') return topic ? `${topic}に行きたいです` : '行きたいです'; if (answer === '断りたいです') return topic ? `${topic}のことを断りたいです` : '断りたいです'; if (answer === '手伝ってほしいです') return topic ? `${topic}のことで手伝ってほしいです` : '手伝ってほしいです'; if (answer === '変更したいです') return topic ? `${topic}のことを変更したいです` : '変更したいです'; if (answer === '確認したいです' || !topic) return topic ? `${topic}のことを確認したいです` : '予定について伝えたいです'; return `${topic}のことを伝えたいです`; }
  function buildMessage() { const time = timeWord(); const topic = topicWord(); return `${time ? `${time}、` : ''}${contentClause(topic)}。`; }
  function showConfirm() { state.confirmed = false; renderFlowView('<p class="eyebrow">確認してください</p><h2>このことばで合っていますか？</h2>', [], () => {}); const actions = $('flowActions'); actions.innerHTML = `<div class="confirm-message">${escapeHtml(state.message || buildMessage())}</div>`; addAction(actions, '✓ これで合っています', 'choice', () => { state.confirmed = true; showOutput(); }); addAction(actions, '← もどる', 'text-button', () => nextClarification()); addAction(actions, '↺ 最初から', 'text-button', reset); }
  function showFallback() { renderFlowView('<p class="eyebrow">もう少し教えてください</p><h2>うまく絞り込めませんでした。</h2><p class="flow-note">あなたのことばをもう一度選んでください。</p>', [], () => {}, false, 'fallback'); const actions = $('flowActions'); addAction(actions, '🎙 もう少し話す', 'choice', startExpressive); addAction(actions, '⌨ 文字を足す', 'choice', () => renderFragmentForm(state.fragment, true)); addAction(actions, '↺ 最初から', 'text-button', reset); }

  // ---- PARTNER_OUTPUT (full-viewport overlay, not part of the main-area swap) ----
  function showOutput() { if (!state.confirmed) return; const overlay = $('outputOverlay'); overlay.hidden = false; overlay.innerHTML = `<div class="partner-message">${escapeHtml(state.message)}</div><div class="output-controls"></div>`; const controls = overlay.querySelector('.output-controls'); addAction(controls, '🔊 声で伝える', 'button button-primary', speakConfirmed); addAction(controls, '自分の画面にもどる', 'text-button', closeOutput); }
  function closeOutput() { $('outputOverlay').hidden = true; $('outputOverlay').innerHTML = ''; setStatus('確認したことばだけが、相手に伝えられます。'); }
  function speakConfirmed() { if (!state.confirmed) return; if (!window.speechSynthesis) return setStatus('この端末では読み上げを使えません。'); window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(state.message); utterance.lang = 'ja-JP'; window.speechSynthesis.speak(utterance); setStatus('確認したことばを読み上げています。'); }

  function reset() {
    if (partnerRecognition) { state.listening = false; try { partnerRecognition.stop(); } catch (_) {} }
    state.expressive = false; state.round = 0; state.noneCounts = {}; state.known = []; state.answers = {}; state.confirmed = false; state.fragment = ''; state.message = '';
    $('outputOverlay').hidden = true; $('outputOverlay').innerHTML = '';
    $('appShell').classList.remove('rotated');
    $('speakButton').classList.remove('recording'); $('speakLabel').textContent = '話して伝える';
    $('partnerTranscript').textContent = 'ここに相手のことばが出ます。';
    setSession(false);
    renderIdle();
    setStatus('準備できています');
  }

  $('listenButton').addEventListener('click', beginListening);
  $('stopListenButton').addEventListener('click', stopListening);
  $('speakButton').addEventListener('click', () => state.expressive ? finishExpressive($('fragmentInput') ? $('fragmentInput').value : expressivePartial) : startExpressive());
  $('typeButton').addEventListener('click', () => renderFragmentForm(state.fragment, true));
  $('resetButton').addEventListener('click', reset);
  $('rotateButton').addEventListener('click', () => $('appShell').classList.toggle('rotated'));

  renderIdle();
})();
