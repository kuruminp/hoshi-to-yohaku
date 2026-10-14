/* 星と余白：すべてブラウザー上で動く，依存ライブラリ不要のアプリ． */
(() => {
  "use strict";
  const root = document.getElementById("site-data");
  if (!root) return;
  const payload = JSON.parse(root.textContent);
  const content = payload.content;
  const signs = content.signs;
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];
  let activeDate = "";
  let dayFortunes = [];
  let selectedSignId = "aries";
  let activeQuiz = null;
  let answers = [];
  let toastTimer = null;
  let tarotForDay = null;

  function esc(input) {
    return String(input).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
  }
  function tokyoParts(now = new Date()) {
    const items = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
    const map = Object.fromEntries(items.filter((x) => x.type !== "literal").map((x) => [x.type, x.value]));
    return { year: map.year, month: map.month, day: map.day };
  }
  function jstDayKey() {
    const d = tokyoParts();
    return `${d.year}-${d.month}-${d.day}`;
  }
  function formatDate(key, long) {
    const [year, month, day] = key.split("-").map(Number);
    if (!long) return `${year}.${String(month).padStart(2, "0")}.${String(day).padStart(2, "0")}`;
    const date = new Date(`${key}T12:00:00+09:00`);
    const weekday = new Intl.DateTimeFormat("ja-JP", { weekday: "long", timeZone: "Asia/Tokyo" }).format(date);
    return `${year}年${month}月${day}日 ${weekday}`;
  }
  // date/id/salt are ASCII strings. Keep this identical to scripts/build.py.
  function fnv(value) {
    let h = 2166136261;
    for (let i = 0; i < value.length; i++) {
      h ^= value.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }
  function pick(arr, key) { return arr[fnv(key) % arr.length]; }
  function makeFortune(day, sign, index) {
    return {
      id: sign.id,
      name: sign.name,
      symbol: sign.symbol,
      en: sign.en,
      date: sign.date,
      score: 64 + fnv(`${day}|${sign.id}|score`) % 35,
      overall: content.overall[(fnv(`${day}|overall`) + index * 11) % content.overall.length],
      action: pick(content.actions, `${day}|${sign.id}|action`),
      love: pick(content.love, `${day}|${sign.id}|love`),
      work: pick(content.work, `${day}|${sign.id}|work`),
      money: pick(content.money, `${day}|${sign.id}|money`),
      color: pick(content.colors, `${day}|${sign.id}|color`),
      item: pick(content.items, `${day}|${sign.id}|item`)
    };
  }
  function makeDayFortunes(day) { return signs.map((sign, i) => makeFortune(day, sign, i)); }

  function renderSignGrid() {
    $("#sign-grid").innerHTML = signs.map((sign) => `<button type="button" class="sign-option" data-sign="${esc(sign.id)}" aria-pressed="${String(sign.id === selectedSignId)}" aria-label="${esc(sign.name)}の今日の運勢を読む"><span class="sign-symbol" aria-hidden="true">${esc(sign.symbol)}</span><span class="sign-name">${esc(sign.name)}</span><span class="sign-birth">${esc(sign.date)}</span></button>`).join("");
  }
  function renderFortune(signId) {
    const f = dayFortunes.find((item) => item.id === signId) || dayFortunes[0];
    if (!f) return;
    selectedSignId = f.id;
    $("#fortune-panel").innerHTML = `
      <div class="fortune-left">
        <div class="fortune-topline"><div class="fortune-emblem" aria-hidden="true">${esc(f.symbol)}</div><div class="fortune-headings"><span class="micro">${esc(f.en)} · TODAY</span><h3>${esc(f.name)}の運勢</h3></div><div class="fortune-rating"><strong>${f.score}</strong><span>/ 100</span></div></div>
        <p class="fortune-message">${esc(f.overall)}</p>
        <div class="fortune-mini-head">TODAY'S LITTLE STEP</div>
        <p class="fortune-action">${esc(f.action)}</p>
        <div class="fortune-buttons"><button type="button" class="plain-action" id="fortune-share">この運勢をシェアする ↗</button><a class="plain-action" href="./signs/${encodeURIComponent(f.id)}/#top">${esc(f.name)}のページを見る →</a></div>
      </div>
      <div class="fortune-right">
        <div class="reading-row"><span class="reading-label"><span aria-hidden="true">♡</span> 恋愛運</span><p>${esc(f.love)}</p></div>
        <div class="reading-row"><span class="reading-label"><span aria-hidden="true">✎</span> 仕事運</span><p>${esc(f.work)}</p></div>
        <div class="reading-row"><span class="reading-label"><span aria-hidden="true">✧</span> 金運</span><p>${esc(f.money)}</p></div>
        <div class="lucky-box"><span class="lucky-tag"><b>LUCKY COLOR</b>${esc(f.color)}</span><span class="lucky-tag"><b>LUCKY ITEM</b>${esc(f.item)}</span></div>
      </div>`;
    $$(".sign-option").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.sign === f.id)));
    $("#fortune-share").addEventListener("click", () => {
      const url = new URL(window.location.href);
      url.search = `?sign=${encodeURIComponent(f.id)}`;
      url.hash = "horoscope";
      share(`今日の${f.name}の運勢 | 星と余白`, `【${formatDate(activeDate, true)}】${f.name}の運勢 ✦\n${f.overall}\n`, url.href);
    });
  }
  function setDate(day) {
    activeDate = day;
    dayFortunes = payload.build_date === day ? payload.fortunes : makeDayFortunes(day);
    $("#hero-date").innerHTML = `${esc(formatDate(day, true))} <span>JST</span>`;
    $("#section-date").textContent = formatDate(day, false);
    $("#hero-quote").textContent = pick(content.quotes, `${day}|quote`);
    renderSignGrid();
    renderFortune(selectedSignId);
    hydrateTarot();
  }
  $("#sign-grid").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-sign]");
    if (!button) return;
    renderFortune(button.dataset.sign);
    try {
      const url = new URL(location.href);
      url.searchParams.set("sign", button.dataset.sign);
      url.searchParams.delete("quiz");
      url.searchParams.delete("result");
      history.replaceState(null, "", url.href);
    } catch { /* file:// preview and restrictive browsers */ }
  });

  function toast(msg) {
    const bar = $("#toast");
    bar.textContent = msg;
    bar.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => bar.classList.remove("visible"), 2900);
  }
  async function share(title, text, url) {
    if (navigator.share) {
      try { await navigator.share({ title, text, url }); return; }
      catch (err) { if (err.name === "AbortError") return; }
    }
    const message = `${text}\n${url}`;
    if (navigator.clipboard && window.isSecureContext) {
      try { await navigator.clipboard.writeText(message); toast("シェア用の文章をコピーしました ✦"); return; }
      catch { /* use fallback */ }
    }
    const input = document.createElement("textarea");
    input.value = message;
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.select();
    try {
      if (document.execCommand("copy")) toast("シェア用の文章をコピーしました ✦");
      else window.prompt("コピーしてお使いください", message);
    } catch { window.prompt("コピーしてお使いください", message); }
    input.remove();
  }

  // Tarot: saved locally for one JST day; no choices are sent to a server.
  const TAROT_STORAGE_KEY = "hoshi_tarot_v1";
  function storedTarot() {
    try {
      const item = JSON.parse(localStorage.getItem(TAROT_STORAGE_KEY) || "null");
      return item && item.date === activeDate && content.tarot.some((card) => card.id === item.card) ? item : null;
    } catch { return null; }
  }
  function hydrateTarot() {
    tarotForDay = storedTarot();
    if (tarotForDay) {
      const card = content.tarot.find((c) => c.id === tarotForDay.card);
      showTarot(card);
    } else {
      $("#tarot-deck").hidden = false;
      $("#tarot-result").hidden = true;
    }
  }
  function randomInt(max) {
    if (window.crypto && window.crypto.getRandomValues) {
      const buffer = new Uint32Array(1);
      const limit = Math.floor(4294967296 / max) * max;
      do { window.crypto.getRandomValues(buffer); } while (buffer[0] >= limit);
      return buffer[0] % max;
    }
    return Math.floor(Math.random() * max);
  }
  function showTarot(card) {
    $("#tarot-deck").hidden = true;
    $("#tarot-result").hidden = false;
    $("#tarot-result-icon").textContent = card.symbol;
    $("#tarot-result-number").textContent = `ARCANUM ${card.number}`;
    $("#tarot-result-name").textContent = card.name;
    $("#tarot-result-keyword").textContent = card.keyword;
    $("#tarot-result-message").textContent = card.message;
    $("#tarot-result-action").textContent = card.action;
  }
  $("#tarot-deck").addEventListener("click", (event) => {
    if (!event.target.closest("button[data-card-position]") || tarotForDay) return;
    const card = content.tarot[randomInt(content.tarot.length)];
    tarotForDay = { date: activeDate, card: card.id };
    try { localStorage.setItem(TAROT_STORAGE_KEY, JSON.stringify(tarotForDay)); } catch { /* optional */ }
    showTarot(card);
  });
  $("#tarot-share").addEventListener("click", () => {
    if (!tarotForDay) return;
    const card = content.tarot.find((c) => c.id === tarotForDay.card);
    share(`今日のタロット「${card.name}」 | 星と余白`, `今日のカードは「${card.name}」 ✧\n${card.message}\n`, new URL("#tarot", location.href).href);
  });

  // Quizzes: all scoring runs locally; tie is broken by earliest selected answer.
  const dialog = $("#quiz-dialog");
  const dialogBody = $("#quiz-dialog-body");
  function closeDialog() { if (typeof dialog.close === "function") dialog.close(); else dialog.removeAttribute("open"); }
  $("#quiz-close").addEventListener("click", closeDialog);
  dialog.addEventListener("close", () => { activeQuiz = null; answers = []; });
  function openQuiz(quiz, resultKey = null) {
    activeQuiz = quiz;
    answers = [];
    $("#quiz-dialog-eyebrow").textContent = quiz.eyebrow;
    $("#quiz-dialog-title").textContent = quiz.title;
    if (!dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    }
    if (resultKey && quiz.results[resultKey]) showQuizResult(resultKey);
    else showQuestion();
  }
  function showQuestion() {
    if (!activeQuiz) return;
    const i = answers.length;
    if (i >= activeQuiz.questions.length) {
      const freq = {};
      answers.forEach((type) => { freq[type] = (freq[type] || 0) + 1; });
      const max = Math.max(...Object.values(freq));
      const chosen = answers.find((key) => freq[key] === max);
      showQuizResult(chosen);
      return;
    }
    const question = activeQuiz.questions[i];
    dialogBody.innerHTML = `<div class="quiz-progress"><span style="width:${(i / activeQuiz.questions.length) * 100}%"></span></div><p class="question-index">QUESTION ${String(i + 1).padStart(2, "0")} / ${String(activeQuiz.questions.length).padStart(2, "0")}</p><h3 class="question-text">${esc(question.text)}</h3><div class="quiz-choice-list">${question.choices.map((answer, idx) => `<button type="button" class="quiz-choice" data-answer="${idx}">${esc(answer.text)} <i aria-hidden="true">→</i></button>`).join("")}</div>`;
    dialogBody.querySelectorAll("[data-answer]").forEach((button) => button.addEventListener("click", () => {
      const answer = question.choices[Number(button.dataset.answer)];
      answers.push(answer.type);
      showQuestion();
    }));
  }
  function showQuizResult(resultKey) {
    const result = activeQuiz.results[resultKey];
    if (!result) return;
    dialogBody.innerHTML = `<div class="quiz-result"><div class="quiz-result-symbol" aria-hidden="true">${esc(result.symbol)}</div><span class="quiz-result-caption">YOUR LITTLE STORY</span><h3>${esc(result.title)}</h3><strong>${esc(result.subtitle)}</strong><p class="quiz-result-description">${esc(result.description)}</p><p class="quiz-result-tip">✧ ${esc(result.tip)}</p><div class="quiz-result-actions"><button type="button" id="quiz-result-share">診断結果をシェア ↗</button><button type="button" class="secondary" id="quiz-result-retry">もう一度診断する</button></div></div>`;
    $("#quiz-result-share").addEventListener("click", () => {
      const url = new URL(location.href);
      url.search = `?quiz=${encodeURIComponent(activeQuiz.id)}&result=${encodeURIComponent(resultKey)}`;
      url.hash = "diagnosis";
      share(`「${result.title}」| 星と余白`, `診断結果は「${result.title}」✦\n${result.subtitle}\n`, url.href);
    });
    $("#quiz-result-retry").addEventListener("click", () => { answers = []; showQuestion(); });
  }
  $("#quiz-cards").addEventListener("click", (event) => {
    const button = event.target.closest("[data-quiz]");
    if (!button) return;
    const quiz = content.quizzes.find((q) => q.id === button.dataset.quiz);
    if (quiz) openQuiz(quiz);
  });

  const params = new URLSearchParams(location.search);
  const paramSign = params.get("sign");
  if (signs.some((s) => s.id === paramSign)) selectedSignId = paramSign;
  setDate(jstDayKey());
  const quizId = params.get("quiz");
  const resultKey = params.get("result");
  if (quizId && resultKey) {
    const quiz = content.quizzes.find((q) => q.id === quizId);
    if (quiz && quiz.results[resultKey]) openQuiz(quiz, resultKey);
  }
  // Always show the new JST date, even if a scheduled GitHub build is delayed.
  setInterval(() => { const current = jstDayKey(); if (current !== activeDate) setDate(current); }, 60000);
})();
