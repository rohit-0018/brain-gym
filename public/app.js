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

async function probe() { // optional local server: short timeout, must answer JSON, never blocks first paint
  const get = async u => { const c = new AbortController(), t = setTimeout(() => c.abort(), 1500); try { const r = await fetch(u, { signal: c.signal }); if (!r.ok || !(r.headers.get('content-type') || '').includes('json')) throw 0; return await r.json(); } finally { clearTimeout(t); } };
  try {
    const [sr, sc] = await Promise.all([get('api/records'), get('api/cards')]);
    serverUp = true; const ids = new Set(records.map(r => r.id)); let added = 0;
    sr.forEach(r => { if (!ids.has(r.id)) { records.push({ ...r, score: Number(r.score) }); added++; } });
    records.sort((a, b) => a.timestamp.localeCompare(b.timestamp)); save(K.rec, records);
    await post('api/records', records);
    if (!cards.length && sc.length) cards = sc.map(c => ({ ...c, interval: +c.interval, ease: +c.ease, reps: +c.reps }));
    saveCards(); setSync();
    if (added && !inGame) show(currentTab);
  } catch { serverUp = false; setSync(); }
}

/* ---------- activities ---------- */
const ACTS = [
  { id: 'breathe', cat: 'Calm', track: false, name: 'Box breathing', min: 1, tag: 'Calm and focus', desc: 'Sixty seconds of 4-4-4-4 breathing to settle before you work.', run: gBreathe, unit: 's' },
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
const DAILY = ['breathe', 'lesson', 'manip', 'nback', 'stroop', 'math'];
const CATS = ['Influence', 'Memory', 'Focus', 'Speed', 'Learning', 'Habits', 'Calm'];
const actById = id => ACTS.find(a => a.id === id);
const doneToday = id => records.some(r => r.activity === id && r.date === today());
const streak = () => Logic.streakOf(records, today());

/* ---------- views ---------- */
let cleanup = () => { }, currentTab = 'today', inGame = false;
function show(tab) {
  cleanup(); cleanup = () => { }; inGame = false; currentTab = tab;
  document.querySelectorAll('#nav button').forEach(b => { const on = b.dataset.tab === tab; b.classList.toggle('on', on); on ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'); });
  const app = $('#app'); app.innerHTML = '';
  ({ today: vToday, practice: vPractice, report: vReport, cards: vCards, library: vLibrary })[tab](app);
  window.scrollTo(0, 0);
}
$('#nav').onclick = e => { if (e.target.dataset.tab) show(e.target.dataset.tab); };

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
    <ol class="sheet">${list.map((a, i) => `<li class="row ${doneToday(a.id) ? 'done' : ''}"><span class="no">${String(i + 1).padStart(2, '0')}</span><div class="what"><h3>${a.name}</h3><span class="meta">${a.tag} · ${a.min} min</span></div><span class="meta">${doneToday(a.id) ? 'done' : ''}</span></li>`).join('')}</ol>
    ${due ? `<p class="meta" style="margin-top:18px">${due} flashcard${due > 1 ? 's' : ''} due. <a href="#" id="cl">Review them</a></p>` : ''}
  </div>`));
  $('#go').onclick = () => { const ids = left.length ? left.map(a => a.id) : DAILY; launch(actById(ids[0]), { list: ids, i: 0 }); };
  const cl = $('#cl'); if (cl) cl.onclick = e => { e.preventDefault(); show('cards'); };
}

let pickedCats = load(K.cats, ['Influence']);
function vPractice(app) {
  const games = () => ACTS.filter(a => a.run && pickedCats.includes(a.cat)), mins = () => games().reduce((x, a) => x + a.min, 0);
  app.append(h(`<div><p class="eyebrow">Extra reps</p><h1>Practice</h1><p class="sub">Pick one or more categories. Every exercise in them runs back to back.</p>
    <div class="row-btns" id="cats" role="group" aria-label="Categories" style="justify-content:flex-start"></div><div id="plan"></div></div>`));
  const draw = () => {
    $('#cats').innerHTML = ''; CATS.forEach(c => { const n = ACTS.filter(a => a.cat === c && a.run).length, on = pickedCats.includes(c); const b = h(`<button class="btn ${on ? 'primary' : ''}" aria-pressed="${on}">${c} <span class="meta" style="color:inherit;opacity:.7">${n}</span></button>`); b.onclick = () => { pickedCats = on ? pickedCats.filter(x => x !== c) : [...pickedCats, c]; save(K.cats, pickedCats); draw(); }; $('#cats').append(b); });
    const g = games(); $('#plan').innerHTML = g.length ? `<ol class="sheet">${g.map((a, i) => `<li class="row"><span class="no">${String(i + 1).padStart(2, '0')}</span><div class="what"><h3>${a.name}</h3><p>${a.desc}</p><span class="meta">${a.cat} · ${a.min} min</span></div></li>`).join('')}</ol>
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
function techReport() {
  const st = manipStats(), by = {}; Object.values(st).forEach(e => { const x = by[e.t] ||= { n: 0, ok: 0 }; x.n += e.n; x.ok += e.ok; });
  const rows = TECH.filter(t => by[t.id]).map(t => ({ t, n: by[t.id].n, acc: Math.round(by[t.id].ok / by[t.id].n * 100) })).sort((a, b) => a.acc - b.acc);
  const missed = Object.entries(st).filter(([, e]) => e.last === false).map(([id, e]) => ({ s: SCEN.find(x => x.id === id), e })).filter(x => x.s).sort((a, b) => b.e.date.localeCompare(a.e.date)).slice(0, 5);
  if (!rows.length) return '<h2>Spotting manipulation</h2><p class="sub">No attempts yet. Finish a daily session to start tracking which techniques you recognise.</p>';
  return `<h2>Spotting manipulation</h2><p class="sub">${rows.length} of ${TECH.length} techniques seen. Weakest first. These come up more often in your sessions.</p><div class="tscroll"><table><tr><th>Technique</th><th>Seen</th><th>Correct</th></tr>${rows.map(r => `<tr><td>${esc(r.t.name)}</td><td>${r.n}</td><td style="color:${r.acc >= 70 ? 'var(--good)' : r.acc < 50 ? 'var(--acc)' : 'var(--mute)'}">${r.acc}%</td></tr>`).join('')}</table></div>
  ${missed.length ? `<h2>Situations to revisit</h2>${missed.map(({ s, e }) => `<details class="lib"><summary>${esc(s.text.slice(0, 90))}…</summary><p>${esc(s.text)}</p><p class="meta">You said: ${esc(e.chosen ? labelFor(e.chosen) : 'unknown')} · Correct: ${esc(labelFor(s.t))}</p><p>${esc(s.why)}</p></details>`).join('')}` : ''}`;
}
function ics() {
  const d = today().replace(/-/g, ''), url = location.href.split('#')[0];
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Brain Gym//EN', 'BEGIN:VEVENT', `UID:braingym-${d}@local`, `DTSTAMP:${d}T000000Z`, `DTSTART:${d}T090000`, 'DTEND:' + d + 'T091500', 'RRULE:FREQ=DAILY', 'SUMMARY:Brain Gym session (10 min)', `DESCRIPTION:${url}`, `URL:${url}`, 'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Brain Gym', 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
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
  <h2 style="margin-top:44px">Your data</h2><div class="row-btns" style="justify-content:flex-start"><button class="btn" id="ex">Download CSV</button><button class="btn ghost" id="imp">Import CSV</button><button class="btn ghost" id="rem">Daily reminder (.ics)</button><input type="file" id="fi" accept=".csv" hidden></div>
  <p class="sub" id="dmsg">${serverUp ? 'Also saved automatically in <code>data/records.csv</code>.' : isLocal ? 'Server offline: data is in this browser only. Run <code>npm start</code> to also write CSV files.' : 'Your data lives only in this browser. Download a CSV now and then as a backup.'}</p></div>`));
  $('#ex').onclick = () => download(`brain-gym-${today()}.csv`, REC_H.join(',') + '\n' + records.map(r => Logic.csvLine(REC_H, r)).join(''));
  $('#rem').onclick = () => download('brain-gym-reminder.ics', ics(), 'text/calendar');
  $('#imp').onclick = () => $('#fi').click();
  $('#fi').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    const ids = new Set(records.map(r => r.id)), known = new Set(ACTS.map(a => a.id)); let added = 0, bad = 0;
    Logic.parseCsv(await f.text()).forEach(r => {
      if (!r.id || !/^\d{4}-\d\d-\d\d$/.test(r.date) || !known.has(r.activity) || !isFinite(+r.score)) { bad++; return; }
      if (!ids.has(r.id)) { records.push({ id: r.id, timestamp: r.timestamp || r.date + 'T00:00:00Z', date: r.date, activity: r.activity, score: +r.score, detail: r.detail || '{}' }); ids.add(r.id); added++; }
    });
    records.sort((a, b) => a.timestamp.localeCompare(b.timestamp)); save(K.rec, records); if (serverUp) post('api/records', records);
    e.target.value = ''; show('report'); $('#dmsg').textContent = `Imported ${added} new row${added === 1 ? '' : 's'}${bad ? `, skipped ${bad} invalid` : ''}.`;
  };
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
