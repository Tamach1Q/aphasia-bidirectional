(() => {
  const $ = (id) => document.getElementById(id);
  const modeA = new URLSearchParams(location.search).get('mode') === 'a';
  const state = { listening:false, expressive:false, round:0, ambiguityIndex:0, noneCounts:{}, known:[], fragment:'', confirmed:false, message:'' };
  const ambiguities = [
    { key:'time', test:/今日|きょう|明日|あした|昨日|きのう|今週|来週|朝|午後|夜|金曜|月曜/, question:'いつのことですか？', choices:['今日のこと','明日のこと','別の日のこと'], alternatives:['今週のこと','来週のこと','日にちは関係ない'] },
    { key:'topic', test:/病院|医者|診察|学校|仕事|電車|家族|娘|息子|予約|薬/, question:'何についてですか？', choices:['病院・診察のこと','家族のこと','予定や予約のこと'], alternatives:['仕事のこと','移動のこと','別のこと'] },
    { key:'content', test:null, question:'何を伝えたいですか？', choices:['行きたい・行きます','確認したいです','断りたいです'], alternatives:['手伝ってほしいです','変更したいです','別のことを伝えたいです'] }
  ];

  function setStatus(text, active = false, latency = '') { $('statusText').textContent = text; $('statusDot').classList.toggle('active', active); $('latencyText').textContent = latency; }
  function logLatency(kind, started, detail) { const ms = Math.round(performance.now() - started); const label = `${kind}: ${ms}ms`; $('latencyText').textContent = label; console.info(`[latency] ${label}`, detail || ''); return ms; }
  function setSession(active) { state.listening = active; $('listenButton').hidden = active; $('stopListenButton').hidden = !active; $('sessionState').textContent = active ? '聞いています' : '停止中'; $('sessionState').classList.toggle('live', active); }
  function showChoices(items, onClick) { const box = $('partnerChoices'); box.innerHTML = ''; items.forEach((item) => { const button = document.createElement('button'); button.className = 'choice'; button.type = 'button'; button.textContent = item; button.addEventListener('click', () => onClick(item)); box.appendChild(button); }); }

  function simplifyPartner(text) {
    const clean = text.trim();
    if (!clean) return { meaning:'聞き取れませんでした。もう一度お願いします。', choices:[] };
    if (/金曜|月曜|いつ|何時|午後|午前/.test(clean)) return { meaning:'いつがいいですか？', choices:['金曜日の午後','月曜日の午前','どちらでもいい'] };
    if (/来る|行く|できますか|大丈夫|いいですか/.test(clean)) return { meaning:'できますか？', choices:['はい、できます','いいえ、できません','わかりません'] };
    if (/病院|医者|診察|学校|仕事|電車|家族|娘|息子|予約|薬|確認|変更|連絡/.test(clean)) return { meaning:'相手の話について、返事を選びますか？', choices:['はい','いいえ','もう一度聞く'] };
    return { meaning:'うまく処理できませんでした。もう一度お願いします。', choices:[] };
  }

  function showPartnerResult(text) {
    const started = performance.now();
    const result = simplifyPartner(text); $('partnerTranscript').textContent = text || 'ここに相手のことばが出ます。'; $('partnerMeaning').textContent = result.meaning; showChoices(result.choices, (choice) => { if (choice === 'もう一度聞く' || choice === 'わかりません') return showDontUnderstand(); setStatus('返事を選びました。必要なら自分のことばを作れます。'); }); logLatency('llm: receptive simplification', started, text); }
  function showDontUnderstand() { $('partnerMeaning').textContent = 'わかりません。'; $('partnerChoices').innerHTML = ''; setStatus('相手にもう一度話してもらってください。'); }

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

  let expressiveRecognition;
  function startExpressive() {
    state.expressive = true; $('speakButton').classList.add('recording'); $('speakLabel').textContent = '話し終わったら押してください'; setStatus('あなたのことばを聞いています', true); if (state.listening) stopListening();
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) { state.expressive = false; $('speakButton').classList.remove('recording'); $('speakLabel').textContent = '話して伝える'; $('fragmentInput').value = '娘　明日　病院'; $('typedForm').hidden = false; setStatus('音声認識がないため、文字で入力してください。'); return; }
    expressiveRecognition = new Recognition(); expressiveRecognition.lang = 'ja-JP'; expressiveRecognition.continuous = false; expressiveRecognition.interimResults = true;
    const asrStarted = performance.now(); expressiveRecognition.onresult = (event) => { const text = event.results[0][0].transcript; $('fragmentInput').value = text; if (event.results[0].isFinal) { logLatency('asr: expressive fragment', asrStarted, text); finishExpressive(text); } };
    expressiveRecognition.onerror = () => { finishExpressive('娘 明日 病院'); setStatus('音声を確認できないため、デモのことばを表示しました。'); };
    try { expressiveRecognition.start(); } catch (_) { finishExpressive('娘 明日 病院'); }
  }
  function finishExpressive(text) { if (!state.expressive) return; state.expressive = false; if (expressiveRecognition) expressiveRecognition.stop(); $('speakButton').classList.remove('recording'); $('speakLabel').textContent = '話して伝える'; const fragment = (text || $('fragmentInput').value || '').trim(); $('fragmentInput').value = fragment; $('typedForm').hidden = false; $('fragmentInput').focus(); setStatus('ことばを確認して、進んでください。'); }

  function beginFragment(fragment) {
    if (!fragment) return showFallback(); state.fragment = fragment; state.round = 0; state.noneCounts = {}; state.ambiguityIndex = 0; state.known = []; $('flowPanel').hidden = false; if (modeA) return showDirectCandidates(); nextClarification();
  }
  function showDirectCandidates() { const started = performance.now(); state.message = '娘は明日、病院へ行きます。'; logLatency('llm: direct candidates', started, state.fragment); renderFlow(`<p class="eyebrow">候補から選ぶ</p><h2>伝えたいことに近いものはどれですか？</h2><p class="flow-note">ことば：${escapeHtml(state.fragment)}</p>`, ['娘は明日、病院へ行きます。','娘の病院の予定を確認したいです。','明日の病院のことを伝えたいです。'], (item) => { state.message = item; showConfirm(); }); }
  function nextClarification() { const item = ambiguities.slice(state.ambiguityIndex).find((candidate) => !state.known.includes(candidate.key) && (!candidate.test || !candidate.test.test(state.fragment))); if (!item || state.round >= 2) return showConfirm(); state.activeAmbiguity = item; showClarification(item, item.choices); }
  function showClarification(item, choices, countsAsRound = true) { const started = performance.now(); if (countsAsRound) state.round += 1; logLatency('llm: clarification choices', started, item.key); renderFlow(`<p class="eyebrow">${state.round} / 2 回目</p><h2>${item.question}</h2><p class="flow-note">短く選んでください。ことば：${escapeHtml(state.fragment)}</p>`, choices, (choice) => { if (choice === 'どれも違います') return noneOfThese(); state.known.push(item.key); state.ambiguityIndex = ambiguities.indexOf(item) + 1; if (state.round >= 2 || item.key === 'content') { state.message = buildMessage(); showConfirm(); } else nextClarification(); }, true); }
  function noneOfThese() { const key = state.activeAmbiguity.key; if (!state.noneCounts[key]) { state.noneCounts[key] = 1; showClarification(state.activeAmbiguity, state.activeAmbiguity.alternatives, false); } else showFallback(); }
  function buildMessage() { const hasTomorrow = /明日|あした/.test(state.fragment) || state.known.includes('time'); const hasHospital = /病院|診察|医者/.test(state.fragment) || state.known.includes('topic'); return hasHospital ? `明日、病院のことを${state.known.includes('content') ? '伝えたいです' : '確認したいです'}。` : `${hasTomorrow ? '明日の' : ''}予定について伝えたいです。`; }
  function renderFlow(heading, items, onClick, addNone = false) { const panel = $('flowPanel'); panel.className = 'flow-panel'; panel.innerHTML = `${heading}<div class="flow-actions"></div>`; const actions = panel.querySelector('.flow-actions'); items.forEach((item) => { const button = document.createElement('button'); button.type = 'button'; button.className = 'choice'; button.textContent = item; button.addEventListener('click', () => onClick(item)); actions.appendChild(button); }); if (addNone) { const none = document.createElement('button'); none.type = 'button'; none.className = 'text-button'; none.textContent = 'どれも違います'; none.addEventListener('click', () => onClick('どれも違います')); actions.appendChild(none); } }
  function showConfirm() { state.confirmed = false; $('flowPanel').className = 'flow-panel'; renderFlow('<p class="eyebrow">確認してください</p><h2>このことばで合っていますか？</h2>', [], () => {}); const actions = $('flowPanel').querySelector('.flow-actions'); actions.innerHTML = `<div class="confirm-message">${escapeHtml(state.message || buildMessage())}</div>`; addAction(actions, '✓ これで合っています', 'choice', () => { state.confirmed = true; showOutput(); }); addAction(actions, '← もどる', 'text-button', () => nextClarification()); addAction(actions, '↺ 最初から', 'text-button', reset); }
  function showFallback() { $('flowPanel').hidden = false; $('flowPanel').className = 'flow-panel fallback'; renderFlow('<p class="eyebrow">もう少し教えてください</p><h2>うまく絞り込めませんでした。</h2><p class="flow-note">あなたのことばをもう一度選んでください。</p>', [], () => {}); const actions = $('flowPanel').querySelector('.flow-actions'); addAction(actions, '🎙 もう少し話す', 'choice', startExpressive); addAction(actions, '⌨ 文字を足す', 'choice', () => { $('typedForm').hidden = false; $('fragmentInput').focus(); }); addAction(actions, '↺ 最初から', 'text-button', reset); }
  function showOutput() { if (!state.confirmed) return; const panel = $('flowPanel'); panel.className = 'flow-panel output-panel'; panel.innerHTML = `<p class="eyebrow">相手に伝える</p><div class="partner-message">${escapeHtml(state.message)}</div>`; addAction(panel, '↻ 相手に見せる（180°）', 'button button-primary', () => panel.classList.toggle('partner-facing')); addAction(panel, '🔊 声で伝える', 'button button-primary', speakConfirmed); addAction(panel, '自分の画面にもどる', 'text-button', () => { panel.classList.remove('partner-facing'); setStatus('確認したことばだけが、相手に伝えられます。'); }); }
  function speakConfirmed() { if (!state.confirmed) return; if (!window.speechSynthesis) return setStatus('この端末では読み上げを使えません。'); window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(state.message); utterance.lang = 'ja-JP'; window.speechSynthesis.speak(utterance); setStatus('確認したことばを読み上げています。'); }
  function addAction(parent, text, className, callback) { const button = document.createElement('button'); button.type = 'button'; button.className = className; button.textContent = text; button.addEventListener('click', callback); parent.appendChild(button); }
  function escapeHtml(text) { return text.replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char])); }
  function reset() { if (partnerRecognition) { state.listening = false; try { partnerRecognition.stop(); } catch (_) {} } state.expressive = false; state.round = 0; state.noneCounts = {}; state.known = []; state.confirmed = false; $('flowPanel').hidden = true; $('typedForm').hidden = true; $('fragmentInput').value = ''; $('partnerMeaning').textContent = '相手が話すと、ここに短く表示します。'; $('partnerChoices').innerHTML = ''; $('partnerTranscript').textContent = 'ここに相手のことばが出ます。'; setSession(false); setStatus('準備できています'); }

  $('listenButton').addEventListener('click', beginListening); $('stopListenButton').addEventListener('click', stopListening); $('speakButton').addEventListener('click', () => state.expressive ? finishExpressive($('fragmentInput').value) : startExpressive()); $('typeButton').addEventListener('click', () => { $('typedForm').hidden = !$('typedForm').hidden; if (!$('typedForm').hidden) $('fragmentInput').focus(); }); $('typedForm').addEventListener('submit', (event) => { event.preventDefault(); beginFragment($('fragmentInput').value.trim()); }); $('dontUnderstandButton').addEventListener('click', showDontUnderstand); $('resetButton').addEventListener('click', reset);
})();
