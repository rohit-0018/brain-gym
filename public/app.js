'use strict';
/* Brain Gym core. Data lives in localStorage, and also in data/*.csv when run locally with `npm start`. */
const $ = (s, r = document) => r.querySelector(s);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rnd = n => Math.floor(Math.random() * n);
const pick = a => a[rnd(a.length)];
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1);[a[i], a[j]] = [a[j], a[i]]; } return a; };
const today = () => Logic.isoOf(new Date());
const addDays = Logic.addDays, avg = Logic.avg;
const h = html => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const isLocal = ['localhost', '127.0.0.1', ''].includes(location.hostname);

/* ---------- storage ---------- */
const K = { rec: 'braingym.records.v1', cards: 'braingym.cards.v1', lvl: 'braingym.levels.v1', cats: 'braingym.cats.v1' };
let storageOK = true;
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { storageOK = false; setSync(); } };
let records = load(K.rec, []), cards = load(K.cards, []), levels = load(K.lvl, {});
if (!Array.isArray(records)) records = []; if (!Array.isArray(cards)) cards = []; if (!levels || typeof levels !== 'object' || Array.isArray(levels)) levels = {};
records = records.filter(r => r && typeof r === 'object' && r.id && r.date && r.activity);
let serverUp = false;
function setSync() {
  const el = $('#sync'); if (!el) return;
  el.style.color = storageOK ? '' : 'var(--acc)';
  el.textContent = !storageOK ? 'Browser storage is blocked: progress will not be kept' : serverUp ? 'Saving to this browser and data/*.csv' : isLocal ? 'Saved in this browser (server offline)' : 'Saved in this browser · export from Report to back up';
}
const post = (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const level = (k, d) => levels[k] ?? d;
const setLevel = (k, v) => { levels[k] = v; save(K.lvl, levels); };

function addRecord(activity, score, detail = {}) {
  const r = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), timestamp: new Date().toISOString(), date: today(), activity, score, detail: JSON.stringify(detail) };
  records.push(r); save(K.rec, records);
  if (serverUp) post('api/records', [r]).catch(() => { serverUp = false; setSync(); });
  return r;
}
const saveCards = () => { save(K.cards, cards); if (serverUp) post('api/cards', cards).catch(() => { }); };

async function probe() { // optional local server (npm start): short timeout, must answer JSON, never blocks first paint
  if (!isLocal) return;
  const get = async u => { const c = new AbortController(), t = setTimeout(() => c.abort(), 1500); try { const r = await fetch(u, { signal: c.signal }); if (!r.ok || !(r.headers.get('content-type') || '').includes('json')) throw 0; return await r.json(); } finally { clearTimeout(t); } };
  try {
    const [sr, sc] = await Promise.all([get('api/records'), get('api/cards')]);
    serverUp = true; const ids = new Set(records.map(r => r.id)); let added = 0;
    sr.forEach(r => { if (!ids.has(r.id)) { records.push({ ...r, score: Number(r.score) }); added++; } });
    records.sort((a, b) => a.timestamp.localeCompare(b.timestamp)); save(K.rec, records);
    await post('api/records', records);
    const have = new Set(cards.map(c => c.id)); sc.forEach(c => { if (!have.has(c.id)) cards.push({ ...c, interval: +c.interval, ease: +c.ease, reps: +c.reps }); });
    saveCards(); setSync();
    if (added && !inGame && (currentTab === 'today' || currentTab === 'report')) show(currentTab);
  } catch { serverUp = false; setSync(); }
}

/* ---------- activities ---------- */
const ACTS = [
  { id: 'breathe', cat: 'Calm', track: false, name: 'Box breathing', min: 1, tag: 'Calm and focus', desc: 'Sixty seconds of 4-4-4-4 breathing to settle before you work.', run: gBreathe, unit: 's' },
  { id: 'ias', cat: 'UPSC', track: true, name: 'UPSC practice', min: 8, tag: 'Prelims MCQs · Ethics cases', desc: 'Eight tap-to-answer questions: statement-based Prelims MCQs and Ethics case choices. Missed ones come back tomorrow.', run: gIas, unit: '/100' },
  { id: 'mains', cat: 'UPSC', track: true, name: 'Mains answer writing', min: 8, tag: 'Written · self-marked', desc: 'Two Mains-style questions. Write the answer, then tick the model points you covered.', run: gMains, unit: '/100' },
  { id: 'lesson', cat: 'Influence', track: false, name: 'Technique of the day', min: 1, tag: 'Influence · Learn', desc: 'One manipulation or persuasion technique: how it works, how to spot it, how to counter it.', run: gLesson, unit: ' words' },
  { id: 'manip', cat: 'Influence', track: true, name: 'Spot the technique', min: 3, tag: 'Influence · Reasoning', desc: 'Read a real-life situation, name the technique (or call it fair), and explain your reasoning.', run: gManip, unit: '/100' },
  { id: 'nback', cat: 'Memory', track: true, name: 'Dual N-Back', min: 3, tag: 'Working memory', desc: 'Track a position and a letter from N steps ago. The level adapts to you.', run: gNback, unit: '/100' },
  { id: 'stroop', cat: 'Focus', track: true, name: 'Stroop Focus', min: 1, tag: 'Attention · Inhibition', desc: 'Tap the ink colour, not the word. Practice at ignoring the automatic answer.', run: gStroop, unit: '%' },
  { id: 'seq', cat: 'Memory', track: true, name: 'Sequence Memory', min: 2, tag: 'Visual-spatial memory', desc: 'Watch the pattern, repeat it. It grows by one each round.', run: gSeq, unit: ' long' },
  { id: 'digits', cat: 'Memory', track: true, name: 'Digit Span', min: 2, tag: 'Short-term memory', desc: 'Remember digits forward, or backward on odd dates.', run: gDigits, unit: ' digits' },
  { id: 'math', cat: 'Speed', track: true, name: 'Mental Math Sprint', min: 1, tag: 'Processing speed', desc: 'Sixty seconds of arithmetic. Difficulty rises as you improve.', run: gMath, unit: ' solved' },
  { id: 'recall', cat: 'Memory', track: true, name: 'Memory Palace', min: 3, tag: 'Method of loci', desc: 'Memorise 10 words by placing them along a familiar route, then recall them.', run: gRecall, unit: '%' },
  { id: 'feynman', cat: 'Learning', track: false, name: 'Feynman Journal', min: 3, tag: 'Deep understanding', desc: 'Explain something you learned in plain words, as if teaching a kid.', run: gFeynman, unit: ' words' },
  { id: 'cards', cat: 'Learning', track: false, name: 'Flashcards', min: 3, tag: 'Spaced repetition', desc: 'Review the cards due today.', run: null, unit: ' cards' },
  { id: 'habits', cat: 'Habits', track: false, name: 'Brain habits', min: 1, tag: 'Sleep · Exercise · Reading', desc: 'Log the daily basics that matter more than any game.', run: gHabits, unit: '/6' },
];
const DAILY = ['breathe', 'ias', 'nback', 'stroop'];
const CATS = ['UPSC', 'Influence', 'Memory', 'Focus', 'Speed', 'Learning', 'Habits', 'Calm'];
const actById = id => ACTS.find(a => a.id === id);
const doneToday = id => records.some(r => r.activity === id && r.date === today() && !String(r.detail).includes('"partial":true'));
const streak = () => Logic.streakOf(records, today());

/* ---------- views ---------- */
let cleanup = () => { }, currentTab = 'today', inGame = false;
function show(tab) {
  cleanup(); cleanup = () => { }; inGame = false; currentTab = tab;
  document.querySelectorAll('#nav button').forEach(b => { const on = b.dataset.tab === tab; b.classList.toggle('on', on); on ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'); });
  const app = $('#app'); app.innerHTML = '';
  ({ today: vToday, practice: vPractice, report: vReport, coach: vCoach, cards: vCards, library: vLibrary })[tab](app);
  window.scrollTo(0, 0); const hd = app.querySelector('h1'); if (hd) { hd.tabIndex = -1; hd.focus({ preventScroll: true }); }
}
$('#nav').onclick = e => { const t = e.target.dataset.tab; if (!t) return; if (inGame && !confirm('Leave this exercise? Anything you already finished is saved.')) return; show(t); };

function vToday(app) {
  const list = DAILY.map(actById), left = list.filter(a => !doneToday(a.id)), mins = left.reduce((x, a) => x + a.min, 0);
  const date = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  const due = cards.filter(c => c.due <= today()).length, doneN = list.length - left.length;
  app.append(h(`<div>
    <p class="eyebrow">${date}</p>
    <h1 class="hero">${left.length ? 'Today\'s session.' : 'All done today.'}</h1>
    <p class="lede">${left.length ? `${list.length} exercises, about ${mins} minutes. The same set every day, nothing to choose. Any 3 keep your streak.` : 'Come back tomorrow, or open Practice for extra reps.'}</p>
    <div class="row-btns" style="justify-content:flex-start;margin:0 0 28px"><button class="btn primary big-btn" id="go">${left.length ? (doneN ? 'Continue session' : 'Start session') : 'Run it again'}</button></div>
    <div class="figs">
      <div><b>${streak()}</b><span>day streak</span></div>
      <div><b>${doneN}/${list.length}</b><span>done today</span></div>
      <div class="seg" aria-hidden="true">${list.map(a => `<i class="${doneToday(a.id) ? 'on' : ''}"></i>`).join('')}</div>
    </div>
    <ol class="sheet">${list.map((a, i) => `<li class="row ${doneToday(a.id) ? 'done' : ''}"><span class="no">${String(i + 1).padStart(2, '0')}</span><div class="what"><h2 class="item">${a.name}</h2><span class="meta">${a.tag} · ${a.min} min</span></div><span class="meta">${doneToday(a.id) ? 'done' : ''}</span></li>`).join('')}</ol>
    ${due ? `<p class="meta" style="margin-top:18px">${due} flashcard${due > 1 ? 's' : ''} due. <a href="#" id="cl">Review them</a></p>` : ''}
  </div>`));
  $('#go').onclick = () => { const ids = left.length ? left.map(a => a.id) : DAILY; launch(actById(ids[0]), { list: ids, i: 0 }); };
  const cl = $('#cl'); if (cl) cl.onclick = e => { e.preventDefault(); show('cards'); };
}

let pickedCats = load(K.cats, ['UPSC']).filter(c => CATS.includes(c)); if (!pickedCats.length) pickedCats = ['UPSC'];
function vPractice(app) {
  const games = () => ACTS.filter(a => a.run && pickedCats.includes(a.cat)), mins = () => games().reduce((x, a) => x + a.min, 0);
  app.append(h(`<div><p class="eyebrow">Extra reps</p><h1>Practice</h1><p class="sub">Pick one or more categories. Every exercise in them runs back to back.</p>
    <div class="row-btns" id="cats" role="group" aria-label="Categories" style="justify-content:flex-start"></div><div id="plan"></div></div>`));
  const draw = (focusIdx) => {
    $('#cats').innerHTML = ''; CATS.forEach(c => { const n = ACTS.filter(a => a.cat === c && a.run).length, on = pickedCats.includes(c); const b = h(`<button class="btn ${on ? 'primary' : ''}" aria-pressed="${on}">${c} <span class="meta" style="color:inherit;opacity:.7">${n}</span></button>`); b.onclick = () => { pickedCats = on ? pickedCats.filter(x => x !== c) : [...pickedCats, c]; save(K.cats, pickedCats); draw(CATS.indexOf(c)); }; $('#cats').append(b); });
    if (focusIdx != null) $('#cats').children[focusIdx].focus();
    const g = games(); $('#plan').innerHTML = g.length ? `<ol class="sheet">${g.map((a, i) => `<li class="row"><span class="no">${String(i + 1).padStart(2, '0')}</span><div class="what"><h2 class="item">${a.name}</h2><p>${a.desc}</p><span class="meta">${a.cat} · ${a.min} min</span></div></li>`).join('')}</ol>
      <div class="row-btns" style="justify-content:flex-start;margin-top:22px"><button class="btn primary big-btn" id="st">Start ${g.length} exercise${g.length > 1 ? 's' : ''} · about ${mins()} min</button></div>` : '<p class="sub">Select at least one category.</p>';
    if (g.length) $('#st').onclick = () => { const ids = g.map(a => a.id); launch(g[0], { list: ids, i: 0, practice: true }); };
    if (pickedCats.includes('Learning')) { $('#plan').insertAdjacentHTML('beforeend', '<p class="meta" style="margin-top:12px">Flashcards have their own tab. <a href="#" id="fc">Open</a></p>'); $('#fc').onclick = e => { e.preventDefault(); show('cards'); }; }
  }; draw();
}

function launch(a, q) {
  const app = $('#app'); cleanup(); app.innerHTML = ''; inGame = true;
  app.append(h(`<div class="stage"><div class="top"><span>${a.name}</span><span class="meta">${q ? `${q.i + 1} of ${q.list.length}` : ''}</span><button class="btn ghost" id="quit">Quit</button></div><div id="body"></div></div>`));
  let alive = true; cleanup = () => { alive = false; };
  $('#quit').onclick = () => { if (confirm('Quit? Anything you already finished is saved.')) show(q && !q.practice ? 'today' : 'practice'); };
  const finish = (score, detail, extra = '') => {
    if (!alive) return; cleanup(); alive = false; addRecord(a.id, score, detail);
    const nxt = q && q.list[q.i + 1] && actById(q.list[q.i + 1]);
    $('#body').innerHTML = `<div class="result">${score}${a.unit}</div><p class="msg">${esc(extra)}</p><div class="row-btns">${nxt ? `<button class="btn primary" id="next">Next: ${nxt.name} →</button>` : `<button class="btn primary" id="rep">${q ? 'See report' : 'Back'}</button>`}<button class="btn" id="again">Retry</button></div>`;
    (nxt ? $('#next') : $('#rep')).focus();
    if (nxt) $('#next').onclick = () => launch(nxt, { ...q, i: q.i + 1 }); else $('#rep').onclick = () => show(q ? 'report' : 'today');
    $('#again').onclick = () => launch(a, q);
  };
  a.run($('#body'), finish, () => alive);
  const bd = $('#body'); if (document.activeElement === document.body || !bd.contains(document.activeElement)) { bd.tabIndex = -1; bd.focus({ preventScroll: true }); }
}

/* ---------- flashcards ---------- */
const CARD_H = ['id', 'front', 'back', 'due', 'interval', 'ease', 'reps'];
function download(name, text, type = 'text/csv') { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); }
function vCards(app) {
  const due = () => cards.filter(c => c.due <= today());
  app.append(h(`<div><p class="eyebrow">Spaced repetition</p><h1>Flashcards</h1><p class="sub">Recalling a card just before you would forget it is the most efficient way to build long-term memory. Add things you actually want to keep.</p>
  <div class="figs"><div><b>${cards.length}</b><span>cards</span></div><div><b>${due().length}</b><span>due today</span></div></div>
  <div class="row-btns" style="justify-content:flex-start"><button class="btn primary" id="rev" ${due().length ? '' : 'disabled'}>Review ${due().length} due</button></div>
  <div id="rv" hidden></div>
  <h2>Add a card</h2><form id="addf"><div class="field"><label for="f">Front (question, word, concept)</label><input type="text" id="f" autocomplete="off"></div><div class="field"><label for="b">Back (answer)</label><input type="text" id="b" autocomplete="off"></div><button class="btn primary" type="submit">Add card</button></form>
  <h2>All cards</h2><div class="tscroll"><table><tr><th>Front</th><th>Back</th><th>Next due</th><th></th></tr>${cards.map(c => `<tr><td>${esc(c.front)}</td><td>${esc(c.back)}</td><td>${esc(c.due)}</td><td><button class="btn ghost" data-del="${esc(c.id)}" aria-label="Delete card ${esc(c.front)}">Delete</button></td></tr>`).join('') || '<tr><td colspan="4" class="sub">No cards yet.</td></tr>'}</table></div>
  <div class="row-btns" style="justify-content:flex-start"><button class="btn" id="cx" ${cards.length ? '' : 'disabled'}>Export cards CSV</button><button class="btn ghost" id="ci">Import cards CSV</button><input type="file" id="cf" accept=".csv" hidden></div></div>`));
  $('#addf').onsubmit = e => { e.preventDefault(); const f = $('#f').value.trim(), b = $('#b').value.trim(); if (!f || !b) return; cards.push({ id: Date.now().toString(36) + rnd(999), front: f, back: b, due: today(), interval: 0, ease: 2.5, reps: 0 }); saveCards(); show('cards'); $('#f').focus(); };
  app.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { if (confirm('Delete this card?')) { cards = cards.filter(c => c.id !== b.dataset.del); saveCards(); show('cards'); } });
  $('#cx').onclick = () => download(`brain-gym-cards-${today()}.csv`, CARD_H.join(',') + '\n' + cards.map(c => Logic.csvLine(CARD_H, c)).join(''));
  $('#ci').onclick = () => $('#cf').click();
  $('#cf').onchange = async e => { const f = e.target.files[0]; if (!f) return; const have = new Set(cards.map(c => c.id)); let n = 0; Logic.parseCsv(await f.text()).forEach(c => { if (c.id && c.front && c.back && !have.has(c.id)) { cards.push({ id: c.id, front: c.front, back: c.back, due: /^\d{4}-\d\d-\d\d$/.test(c.due) ? c.due : today(), interval: +c.interval || 0, ease: +c.ease || 2.5, reps: +c.reps || 0 }); n++; } }); saveCards(); e.target.value = ''; show('cards'); };
  $('#rev').onclick = () => {
    const queue = shuffle(due()); let n = 0; const rv = $('#rv'); rv.hidden = false; rv.className = 'revbox';
    const step = () => {
      if (!queue.length) { if (n) addRecord('cards', n, {}); rv.innerHTML = `<div class="result">${n} reviewed</div><button class="btn primary" id="ok">Done</button>`; $('#ok').focus(); $('#ok').onclick = () => show('cards'); return; }
      const c = queue[0]; rv.innerHTML = `<p class="msg">${queue.length} left. Try to recall before you flip it.</p><div class="big" style="font-size:30px">${esc(c.front)}</div><div class="row-btns"><button class="btn" id="fl">Show answer</button></div>`; $('#fl').focus();
      $('#fl').onclick = () => {
        rv.innerHTML = `<p class="msg">${esc(c.front)}</p><div class="big" style="font-size:30px;color:var(--good)">${esc(c.back)}</div><div class="row-btns"><button class="btn" data-q="0">Again</button><button class="btn" data-q="1">Good</button><button class="btn primary" data-q="2">Easy</button></div>`;
        rv.querySelector('[data-q="1"]').focus();
        rv.querySelectorAll('[data-q]').forEach(b => b.onclick = () => {
          const q = +b.dataset.q; queue.shift(); const r = Logic.sm2(c, q, today()); Object.assign(c, r.card);
          if (r.requeue) queue.push(c); else n++;
          saveCards(); step();
        });
      };
    }; step();
  };
}

/* ---------- report ---------- */
function spark(v) {
  if (v.length < 2) return '';
  const lo = Math.min(...v), hi = Math.max(...v), w = 110, ht = 28, rng = hi - lo || 1;
  const pts = v.map((y, i) => `${(i / (v.length - 1) * w).toFixed(1)},${(ht - 3 - (y - lo) / rng * (ht - 6)).toFixed(1)}`).join(' '), last = pts.split(' ').pop().split(',');
  return `<svg width="${w}" height="${ht}" viewBox="0 0 ${w} ${ht}" role="img" aria-label="Trend over time"><polyline points="${pts}" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="${last[0]}" cy="${last[1]}" r="2.6" fill="var(--acc)"/></svg>`;
}
function techReport() { try { return techReportInner(); } catch { return '<h2>Spotting manipulation</h2><p class="sub">Some saved data could not be read. Use Reset data below if this persists.</p>'; } }
function techReportInner() {
  const st = manipStats(), by = {}; Object.values(st).forEach(e => { const x = by[e.t] ||= { n: 0, ok: 0 }; x.n += e.n; x.ok += e.ok; });
  const rows = TECH.filter(t => by[t.id]).map(t => ({ t, n: by[t.id].n, acc: Math.round(by[t.id].ok / by[t.id].n * 100) })).sort((a, b) => a.acc - b.acc);
  const missed = Object.entries(st).filter(([, e]) => e.last === false).map(([id, e]) => ({ s: SCEN.find(x => x.id === id), e })).filter(x => x.s).sort((a, b) => b.e.date.localeCompare(a.e.date)).slice(0, 5);
  if (!rows.length) return '<h2>Spotting manipulation</h2><p class="sub">No attempts yet. Finish a daily session to start tracking which techniques you recognise.</p>';
  const att = Object.values(st).reduce((x, e) => x + e.n, 0), okN = Object.values(st).reduce((x, e) => x + e.ok, 0), hard = att >= 9 && okN / att >= .65;
  return `<h2>Spotting manipulation</h2><p class="sub">${rows.length} of ${TECH.length} techniques seen. Weakest first. These come up more often in your sessions.</p><p class="meta">Harder situations: ${hard ? 'unlocked' : `locked until you have answered 9 at 65% or better (you are at ${att} answers, ${att ? Math.round(okN / att * 100) : 0}%)`}.</p><div class="tscroll"><table><tr><th>Technique</th><th>Seen</th><th>Correct</th></tr>${rows.map(r => `<tr><td>${esc(r.t.name)}</td><td>${r.n}</td><td style="color:${r.acc >= 70 ? 'var(--good)' : r.acc < 50 ? 'var(--acc)' : 'var(--mute)'}">${r.acc}%</td></tr>`).join('')}</table></div>
  ${missed.length ? `<h2>Situations to revisit</h2>${missed.map(({ s, e }) => `<details class="lib"><summary>${esc(s.text.slice(0, 90))}…</summary><p>${esc(s.text)}</p><p class="meta">You said: ${esc(e.chosen ? labelFor(e.chosen) : 'unknown')} · Correct: ${esc(labelFor(s.t))}</p><p>${esc(s.why)}</p></details>`).join('')}` : ''}`;
}
function ics() {
  const d = today().replace(/-/g, ''), url = /^https?:/.test(location.href) ? location.href.split('#')[0] : 'Brain Gym';
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Brain Gym//EN', 'BEGIN:VEVENT', `UID:braingym-${d}@local`, `DTSTAMP:${d}T000000Z`, `DTSTART:${d}T090000`, 'DTEND:' + d + 'T091500', 'RRULE:FREQ=DAILY', 'SUMMARY:Brain Gym session (10 min)', `DESCRIPTION:${url}`, `URL:${url}`, 'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Brain Gym', 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR', ''].join('\r\n');
}
const REC_H = ['id', 'timestamp', 'date', 'activity', 'score', 'detail'];
function vReport(app) {
  const wk = off => { const days = Array.from({ length: 7 }, (_, i) => addDays(today(), -off * 7 - i)); return records.filter(r => days.includes(r.date)); };
  const tw = wk(0), lw = wk(1), label = { up: 'Improving', down: 'Slipping', flat: 'Steady' };
  const rows = ACTS.filter(a => a.run || a.id === 'cards').map(a => {
    const rs = records.filter(r => r.activity === a.id), sc = rs.map(r => +r.score), series = a.track ? Logic.dailySeries(records, a.id) : [];
    const { trend, pct } = a.track ? Logic.trendOf(series) : { trend: null, pct: 0 };
    let lvl = '', d = {}; try { d = rs.length ? JSON.parse(rs.at(-1).detail) : {}; } catch { }
    if (a.id === 'nback' && d.n) lvl = `${d.n}-back`; if (a.id === 'math' && d.level) lvl = `level ${d.level}`;
    return { a, rs, sc, series, trend, pct, lvl };
  }).filter(r => r.rs.length || r.a.track);
  const up = rows.filter(r => r.trend === 'up').map(r => r.a.name), down = rows.filter(r => r.trend === 'down').map(r => r.a.name), ready = rows.filter(r => r.trend).length;
  const days = Array.from({ length: 14 }, (_, i) => addDays(today(), i - 13)), cnt = d => new Set(records.filter(r => r.date === d).map(r => r.activity)).size, max = Math.max(1, ...days.map(cnt));
  app.append(h(`<div><p class="eyebrow">Report</p><h1>Are you improving?</h1>
  <p class="lede">${!records.length ? 'No data yet. Finish a session and come back.' : !ready ? 'Trends appear once an exercise has 4 days of data. Consistency comes first.' : `${up.length ? 'Improving: ' + up.join(', ') + '. ' : ''}${down.length ? 'Slipping: ' + down.join(', ') + '. ' : ''}${!up.length && !down.length ? 'Holding steady so far, which is normal early on.' : ''}`}</p>
  <div class="figs"><div><b>${streak()}</b><span>day streak</span></div><div><b>${new Set(tw.map(r => r.date)).size}/7</b><span>days trained this week</span></div><div><b>${tw.length}</b><span>exercises this week${lw.length ? `<br>last week ${lw.length}` : ''}</span></div><div><b>${new Set(records.map(r => r.date)).size}</b><span>days in total</span></div></div>
  <h2>Per exercise</h2>
  <div class="tscroll"><table><tr><th>Exercise</th><th>Runs</th><th>Best</th><th>Latest</th><th>Trend</th><th></th></tr>${rows.map(r => `<tr><td>${r.a.name}${r.lvl ? `<br><span class="meta">${r.lvl}</span>` : ''}</td><td>${r.rs.length}</td><td>${r.sc.length ? Math.max(...r.sc) : '–'}</td><td>${r.sc.length ? r.sc.at(-1) : '–'}</td>
    <td style="color:${r.trend === 'up' ? 'var(--good)' : r.trend === 'down' ? 'var(--acc)' : 'var(--mute)'}">${r.trend ? `${label[r.trend]} ${r.pct > 0 ? '+' : ''}${r.pct.toFixed(0)}%` : r.a.track ? `<span class="meta">needs ${Math.max(0, 4 - r.series.length)} more day${4 - r.series.length === 1 ? '' : 's'}</span>` : '<span class="meta">log only</span>'}</td><td style="color:var(--mute)">${spark(r.series.slice(-20))}</td></tr>`).join('')}</table></div>
  <p class="meta" style="margin-top:8px">Trend compares your best day in the first 3 days with your best in the latest 3. Levels are folded in, so moving up a level counts as progress. Within 5% is steady.</p>
  ${techReport()}
  <h2>Last 14 days</h2><div class="chart" role="img" aria-label="Exercises completed per day, last 14 days">${days.map(d => `<div style="height:${cnt(d) / max * 100}%" title="${d}: ${cnt(d)}"><span>${d.slice(8)}</span></div>`).join('')}</div>
  <h2 style="margin-top:44px">Your data</h2><div class="row-btns" style="justify-content:flex-start"><button class="btn" id="ex">Download CSV</button><button class="btn ghost" id="imp">Import CSV</button><button class="btn ghost" id="rem">Daily reminder (.ics)</button><button class="btn ghost" id="rst">Reset data</button><input type="file" id="fi" accept=".csv" hidden></div>
  <p class="sub" id="dmsg">${serverUp ? 'Also saved automatically in <code>data/records.csv</code>.' : isLocal ? 'Server offline: data is in this browser only. Run <code>npm start</code> to also write CSV files.' : 'Your data lives only in this browser. Download a CSV now and then as a backup.'}</p></div>`));
  $('#ex').onclick = () => download(`brain-gym-${today()}.csv`, REC_H.join(',') + '\n' + records.map(r => Logic.csvLine(REC_H, r)).join(''));
  $('#rst').onclick = () => { if (confirm('Delete ALL progress, levels and flashcards stored in this browser? Download a CSV first if you want a backup.') && confirm('Really delete everything?')) { [K.rec, K.cards, K.lvl, K.cats].forEach(k => { try { localStorage.removeItem(k); } catch { } }); records = []; cards = []; levels = {}; show('report'); $('#dmsg').textContent = 'Browser data cleared' + (serverUp ? '. CSV files in data/ were not touched.' : '.'); } };
  $('#rem').onclick = () => download('brain-gym-reminder.ics', ics(), 'text/calendar');
  $('#imp').onclick = () => $('#fi').click();
  $('#fi').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    const ids = new Set(records.map(r => r.id)), known = new Set(ACTS.map(a => a.id)); let added = 0, bad = 0;
    Logic.parseCsv(await f.text()).forEach(r => {
      if (!r.id || !/^\d{4}-\d\d-\d\d$/.test(r.date) || !known.has(r.activity) || r.score === '' || !isFinite(+r.score)) { bad++; return; }
      if (!ids.has(r.id)) { records.push({ id: r.id, timestamp: r.timestamp || r.date + 'T00:00:00Z', date: r.date, activity: r.activity, score: +r.score, detail: r.detail || '{}' }); ids.add(r.id); added++; }
    });
    records.sort((a, b) => a.timestamp.localeCompare(b.timestamp)); save(K.rec, records); if (serverUp) post('api/records', records);
    e.target.value = ''; show('report'); $('#dmsg').textContent = `Imported ${added} new row${added === 1 ? '' : 's'}${bad ? `, skipped ${bad} invalid` : ''}.`;
  };
}

/* ---------- coach ---------- */
const nameOfId = id => id === 'fair' ? FAIR.short : techById(id) ? shortName(techById(id)) : String(id);
function insightLines(f) {
  if (f.answers < 6) return [`You have answered ${f.answers} situation${f.answers === 1 ? '' : 's'} so far. Patterns need about 6 or more, so keep going.`];
  const L = [`Overall you name the right technique ${f.accuracyPct}% of the time (${f.answers} answers).`];
  f.topConfusions.filter(c => c.actual !== FAIR.short && c.chosen !== FAIR.short).forEach(c => L.push(`You keep reading <b>${esc(c.actual)}</b> as <b>${esc(c.chosen)}</b> (${c.times}×). Look for the signal that separates them.`));
  if (f.overTrusting > f.overSuspicious && f.overTrusting >= 2) L.push(`You called manipulation "fair" ${f.overTrusting} times. You may be giving people too much benefit of the doubt.`);
  else if (f.overSuspicious > f.overTrusting && f.overSuspicious >= 2) L.push(`You saw manipulation in a fair request ${f.overSuspicious} times. Plain asks with a clear way out are not manipulation.`);
  if (f.avgWordsWhenWrong != null && f.avgWordsWhenCorrect != null && f.avgWordsWhenWrong + 3 < f.avgWordsWhenCorrect) L.push(`Your explanations are shorter when you get it wrong (${f.avgWordsWhenWrong} vs ${f.avgWordsWhenCorrect} words). Slow down and name two specific signals before choosing.`);
  const dp = Object.entries(f.accByDaypart).sort((a, b) => b[1] - a[1]); if (dp.length >= 2 && dp[0][1] - dp.at(-1)[1] >= 20) L.push(`You do best in the ${dp[0][0]} (${dp[0][1]}%) and worst at ${dp.at(-1)[0]} (${dp.at(-1)[1]}%).`);
  L.push(`You trained on ${f.daysTrainedLast14} of the last 14 days${f.longestGapDays >= 3 ? `, with a longest gap of ${f.longestGapDays} days` : ''}.${f.daysTrainedLast14 < 7 ? ' Short daily sessions beat long irregular ones.' : ''}`);
  return L;
}
let coachChat = [];
function missedForCoach() {
  const st = manipStats();
  return Object.entries(st).filter(([, e]) => e.last === false).map(([id, e]) => ({ s: SCEN.find(x => x.id === id), e })).filter(x => x.s).sort((a, b) => b.e.date.localeCompare(a.e.date)).slice(0, 6)
    .map(({ s, e }) => ({ situation: s.text, iChose: labelFor(e.chosen), correctAnswer: labelFor(s.t), myReasoning: e.reason || '', modelReasoning: s.why }));
}
function vCoach(app) {
  const f = Logic.coachFacts(records, nameOfId, today()), cfg = AI.getCfg();
  app.append(h(`<div><p class="eyebrow">Coach</p><h1>What is holding you back?</h1>
  <p class="sub">First, patterns found locally in your answers. Then, optionally, an AI coach that reads your actual mistakes and explains them.</p>
  <h2>Patterns in your answers</h2><ul class="plain">${insightLines(f).map(l => `<li>${l}</li>`).join('')}</ul>
  <h2>AI coach <span class="chip">optional</span></h2><div id="ai"></div></div>`));
  const box = $('#ai');
  const privacy = `<p class="meta" style="margin-top:14px">Your key goes straight from this browser to the provider you pick. There is no server of mine in between, and it is never saved to the repo or included in CSV exports. By default it is kept for this tab only. What gets sent when you ask: the summary and missed situations shown above, with your own explanations. Journal entries and flashcards are never sent. A strict content-security policy blocks the page from contacting anything else.</p>`;
  if (!cfg) {
    box.innerHTML = `<form id="kf" class="aiform"><p class="sub">Bring your own API key to get feedback like "you confused reciprocity with guilt-tripping because…" and a plan for what to fix. Usage is billed to your own account (a review costs a fraction of a cent to a few cents).</p>
    <div class="field"><label for="prov">Provider</label><select id="prov">${Object.entries(AI.PROVIDERS).map(([k, v]) => `<option value="${k}">${esc(v.name)}</option>`).join('')}</select></div>
    <div class="field"><label for="key">API key</label><input type="password" id="key" autocomplete="off" spellcheck="false" placeholder="sk-ant-…"></div>
    <div class="field"><label for="mdl">Model (editable)</label><input type="text" id="mdl" autocomplete="off" spellcheck="false"></div>
    <label class="check" style="font:15px var(--sans)"><input type="checkbox" id="rem2"> Remember on this device<span class="meta" style="margin-left:6px">(not on shared computers; other sites on the same github.io address could read it)</span></label>
    <p class="err" role="alert"></p><button class="btn primary" type="submit">Save key</button>${privacy}</form>`;
    const sync = () => { const p = AI.PROVIDERS[$('#prov').value]; $('#mdl').value = p.model; $('#key').placeholder = p.hint; }; $('#prov').onchange = sync; sync();
    $('#kf').onsubmit = e => { e.preventDefault(); try { AI.setCfg({ provider: $('#prov').value, key: $('#key').value, model: $('#mdl').value, remember: $('#rem2').checked }); coachChat = []; show('coach'); } catch (er) { $('.err', box).textContent = er.message; } };
    return;
  }
  box.innerHTML = `<p class="meta">Connected: ${esc(AI.PROVIDERS[cfg.provider].name)} · ${esc(cfg.model)} · ${cfg.remember ? 'remembered on this device' : 'this tab only'} <button class="btn ghost" id="rmk" style="margin-left:8px;padding:4px 10px">Remove key</button> <button class="btn ghost" id="tst" style="padding:4px 10px">Test key</button></p>
  <div class="row-btns" style="justify-content:flex-start"><button class="btn primary" id="a1">Review my week</button><button class="btn" id="a2">What is holding me back?</button><button class="btn ghost" id="a0" ${coachChat.length ? '' : 'hidden'}>Start over</button></div>
  <div id="log" class="chatlog" aria-live="polite"></div><p class="err" role="alert" id="aerr"></p>
  <form id="cf" class="chatform"><label for="cq" class="meta">Ask a follow-up</label><div style="display:flex;gap:8px"><input type="text" id="cq" autocomplete="off" placeholder="e.g. Why do I mix up guilt-tripping and reciprocity?"><button class="btn primary" type="submit">Send</button></div></form>${privacy}`;
  const log = $('#log', box), err = $('#aerr', box);
  const draw = (pending) => { log.innerHTML = coachChat.map(m => m.role === 'user' ? `<div class="bubble me">${esc(m.label || m.content).slice(0, 600)}</div>` : `<div class="bubble ai">${AI.mdToHtml(m.content)}</div>`).join('') + (pending ? '<div class="bubble ai meta">Thinking…</div>' : ''); };
  const busy = on => box.querySelectorAll('button').forEach(b => { if (b.id !== 'rmk') b.disabled = on; });
  async function send(content, label) {
    err.textContent = ''; coachChat.push({ role: 'user', content, label }); draw(true); busy(true);
    try { const text = await AI.ask(AI.SYSTEM, coachChat.slice(-12).map(m => ({ role: m.role, content: m.content })), 800); coachChat.push({ role: 'assistant', content: text }); }
    catch (e) { coachChat.pop(); err.textContent = e.message; }
    draw(false); busy(false); $('#a0', box).hidden = !coachChat.length;
  }
  const review = (q, label) => send(AI.reviewPrompt(f, missedForCoach(), q), label);
  $('#a1', box).onclick = () => review('Review my week: what am I doing well, what went wrong, and what should I do next week?', 'Review my week');
  $('#a2', box).onclick = () => review('What is holding me back from improving? Name the most important patterns and one small action for each.', 'What is holding me back?');
  $('#a0', box).onclick = () => { coachChat = []; draw(false); $('#a0', box).hidden = true; };
  $('#cf', box).onsubmit = e => { e.preventDefault(); const q = $('#cq', box).value.trim(); if (!q) return; $('#cq', box).value = ''; if (!coachChat.length) review(q, q); else send(q); };
  $('#rmk', box).onclick = () => { AI.clearCfg(); coachChat = []; show('coach'); };
  $('#tst', box).onclick = async () => { err.textContent = 'Testing…'; busy(true); try { await AI.ask('Reply with the single word OK.', [{ role: 'user', content: 'ping' }], 10); err.textContent = 'Key works.'; } catch (e) { err.textContent = e.message; } busy(false); };
  draw(false);
}

/* ---------- library ---------- */
const LIB = [
  ['Why influence and manipulation is in here', 'Roozenbeek et al. 2022, Science Advances · Cialdini, Influence · Stern, The Gaslight Effect · Forward, Emotional Blackmail', 'Short "prebunking" lessons that name a manipulation technique, warn you it is coming, and show a harmless sample measurably improve people\'s ability to recognise it afterwards (about +5% on average in a 22,000-person field study). This module copies that format: learn the pattern, see it in context, say what you spotted and why. Fair requests are included on purpose, so you also learn what is NOT manipulation.', 'Technique of the day, Spot the technique'],
  ['Retrieval practice and spaced repetition', 'Make It Stick, Brown, Roediger and McDaniel · Ebbinghaus forgetting curve', 'Testing yourself beats re-reading, and spreading reviews over days beats cramming. Meta-analyses find moderate-to-large benefits, with large variation between studies.', 'Flashcards, situation review'],
  ['Method of loci (memory palace)', 'Moonwalking with Einstein, Joshua Foer', 'Anchor items to places on a familiar route using vivid, odd images. Reliable for memorising lists, which is what memory competitors use it for.', 'Memory Palace'],
  ['Feynman technique', 'A Mind for Numbers, Barbara Oakley', 'Explain it simply, find the gaps, go back and fill them. Exposes the illusion of understanding.', 'Feynman Journal'],
  ['Working-memory training (dual n-back): what the evidence says', 'Jaeggi et al. 2008 · Soveri et al. 2017 meta-analysis · Melby-Lervåg and Hulme', 'Practice makes you better at n-back, but meta-analyses find that the gain is mostly task-specific, and transfer to everyday reasoning is small to none against active control groups. Treat it as a focus warm-up, not a way to raise IQ.', 'Dual N-Back'],
  ['Stroop and attention', 'Stroop, 1935', 'A classic measure of overriding an automatic response. Practice improves the task itself.', 'Stroop Focus'],
  ['Deliberate practice', 'Peak, Anders Ericsson', 'Work at the edge of your ability with quick feedback. The reason the games adapt their difficulty.', 'Adaptive games'],
  ['Deep work and habits', 'Deep Work, Cal Newport · Atomic Habits, James Clear', 'Protected, distraction-free blocks build focus. Same time, same place, low friction, visible streak.', 'Daily session, streak'],
  ['Exercise and sleep', 'Spark, John Ratey · sleep-consolidation research', 'Aerobic exercise shows modest, consistent cognitive benefits in meta-analyses (around 0.3 standard deviations in adults over 50), and sleep consolidates memory. No game makes up for chronic sleep loss.', 'Brain habits'],
  ['Slow breathing', 'Slow-breathing and stress research', 'Slow, paced breathing reliably lowers arousal, which helps attention afterwards.', 'Box breathing'],
];
function vLibrary(app) {
  const ex = records.filter(r => r.activity === 'lesson').map(r => { let d = {}; try { d = JSON.parse(r.detail); } catch { } return { r, d, t: techById(d.tech) }; }).filter(x => x.t && x.d.text).reverse();
  app.append(h(`<div><p class="eyebrow">Library</p><h1>Techniques and research</h1>
  <div class="note"><b>The honest summary.</b> Brain-training games mostly make you better at the games. What is best supported for sharper thinking is exercise, sleep, retrieval practice, and learning genuinely new, hard things. This app mixes all of those on purpose.</div>
  <h2>All ${TECH.length} techniques</h2><p class="sub">Tap one to read how to spot it and counter it.</p>
  ${TECH.map(t => `<details class="lib"><summary><b>${esc(t.name)}</b></summary><p class="meta">${esc(t.src)}</p><p>${esc(t.def)}</p><p><b>Spot it:</b> ${t.signs.map(esc).join(' · ')}</p><p><b>Counter:</b> ${esc(t.counter)}</p></details>`).join('')}
  ${ex.length ? `<h2>Your own examples</h2>${ex.map(x => `<div class="lib"><p class="meta">${x.r.date} · ${esc(x.t.name)}</p><p>${esc(x.d.text)}</p></div>`).join('')}` : ''}
  <h2>Research behind the exercises</h2>
  ${LIB.map(l => `<div class="lib"><h3>${esc(l[0])}</h3><p class="meta">${esc(l[1])}</p><p>${esc(l[2])}</p><span class="chip">In app: ${esc(l[3])}</span></div>`).join('')}</div>`));
}

setSync(); show('today');
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => { });
probe();
