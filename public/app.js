'use strict';
/* Brain Gym — data lives in localStorage AND (when run via `npm start`) data/*.csv */
const $ = (s, r = document) => r.querySelector(s);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rnd = n => Math.floor(Math.random() * n);
const pick = a => a[rnd(a.length)];
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1);[a[i], a[j]] = [a[j], a[i]]; } return a; };
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toLocaleDateString('sv'); };
const h = (html) => { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- storage ---------- */
const K = { rec: 'braingym.records.v1', cards: 'braingym.cards.v1', lvl: 'braingym.levels.v1' };
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
let records = load(K.rec, []), cards = load(K.cards, []), levels = load(K.lvl, {});
let serverUp = false;
const setSync = () => $('#sync').textContent = serverUp ? '💾 saving to localStorage + data/*.csv' : '💾 localStorage only (run `npm start` for CSV)';
const post = (url, body) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const level = (k, d) => levels[k] ?? d;
const setLevel = (k, v) => { levels[k] = v; save(K.lvl, levels); };

function addRecord(activity, score, detail = {}) {
  const r = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), timestamp: new Date().toISOString(), date: today(), activity, score, detail: JSON.stringify(detail) };
  records.push(r); save(K.rec, records);
  if (serverUp) post('/api/records', [r]).catch(() => { serverUp = false; setSync(); });
  return r;
}
const saveCards = () => { save(K.cards, cards); if (serverUp) post('/api/cards', cards).catch(() => { }); };

async function boot() {
  try {
    const [sr, sc] = await Promise.all([fetch('/api/records').then(r => r.json()), fetch('/api/cards').then(r => r.json())]);
    serverUp = true;
    const ids = new Set(records.map(r => r.id));
    sr.forEach(r => { if (!ids.has(r.id)) records.push({ ...r, score: Number(r.score) }); });
    records.sort((a, b) => a.timestamp.localeCompare(b.timestamp)); save(K.rec, records);
    await post('/api/records', records); // push anything only the browser has
    if (!cards.length && sc.length) cards = sc.map(c => ({ ...c, interval: +c.interval, ease: +c.ease, reps: +c.reps }));
    saveCards();
  } catch { serverUp = false; }
  setSync(); show('today');
}

/* ---------- activities ---------- */
const ACTS = [
  { id: 'breathe', icon: '🌬️', name: 'Box breathing', min: 1, tag: 'Calm · Focus', desc: '60s of 4-4-4-4 breathing lowers stress so the rest of the session works better.', run: gBreathe, unit: 's' },
  { id: 'nback', icon: '🧩', name: 'Dual N-Back', min: 3, tag: 'Working memory', desc: 'Track a position AND a letter from N steps ago. Levels adapt to you.', run: gNback, unit: '%' },
  { id: 'stroop', icon: '🎨', name: 'Stroop Focus', min: 1, tag: 'Attention · Inhibition', desc: 'Tap the INK colour, not the word. Trains your brain to ignore distractions.', run: gStroop, unit: '%' },
  { id: 'seq', icon: '🔷', name: 'Sequence Memory', min: 2, tag: 'Visual-spatial memory', desc: 'Watch the pattern, repeat it. It grows by one each round.', run: gSeq, unit: ' len' },
  { id: 'digits', icon: '🔢', name: 'Digit Span', min: 2, tag: 'Short-term memory', desc: 'Remember digits forward (or backward on odd days).', run: gDigits, unit: ' digits' },
  { id: 'math', icon: '➗', name: 'Mental Math Sprint', min: 1, tag: 'Processing speed', desc: '60 seconds of arithmetic. Difficulty rises as you improve.', run: gMath, unit: ' solved' },
  { id: 'recall', icon: '🏛️', name: 'Memory Palace', min: 3, tag: 'Method of loci', desc: 'Memorise 10 words by placing them along a familiar route, then recall.', run: gRecall, unit: '%' },
  { id: 'feynman', icon: '📝', name: 'Feynman Journal', min: 3, tag: 'Deep understanding', desc: 'Explain one thing you learned today in plain words, as if teaching a kid.', run: gFeynman, unit: ' words' },
  { id: 'cards', icon: '🗂️', name: 'Flashcards', min: 3, tag: 'Spaced repetition', desc: 'Review the cards due today (add your own in the Flashcards tab).', run: null, unit: ' cards' },
  { id: 'habits', icon: '✅', name: 'Brain habits', min: 1, tag: 'Sleep · Exercise · Reading', desc: 'Log the daily basics that matter more than any game.', run: gHabits, unit: '/6' },
];
const actById = id => ACTS.find(a => a.id === id);
const doneToday = id => records.some(r => r.activity === id && r.date === today());
const lastScore = id => { const r = [...records].reverse().find(r => r.activity === id); return r ? r.score : null; };

/* ---------- views ---------- */
let cleanup = () => { };
function show(tab) {
  cleanup(); cleanup = () => { };
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  const app = $('#app'); app.innerHTML = '';
  ({ today: vToday, cards: vCards, progress: vProgress, library: vLibrary })[tab](app);
}
$('#nav').onclick = e => { if (e.target.dataset.tab) show(e.target.dataset.tab); };

function streak() {
  const counts = {}; records.forEach(r => { counts[r.date] = (counts[r.date] || new Set()).add(r.activity); });
  let s = 0, d = today(); if ((counts[d]?.size || 0) < 3) d = addDays(d, -1);
  while ((counts[d]?.size || 0) >= 3) { s++; d = addDays(d, -1); }
  return s;
}

function vToday(app) {
  const done = ACTS.filter(a => doneToday(a.id)).length, mins = ACTS.filter(a => !doneToday(a.id)).reduce((s, a) => s + a.min, 0);
  const hr = new Date().getHours();
  app.append(h(`<div>
    <h1>${hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening'} 👋</h1>
    <p class="sub">${done === ACTS.length ? 'Full session complete — your brain is warm. Come back tomorrow.' : `About ${mins} minutes left. Do at least 3 activities to keep your streak.`}</p>
    <div class="stats">
      <div class="stat"><b>🔥 ${streak()}</b><span>day streak (≥3 activities)</span></div>
      <div class="stat"><b>${done}/${ACTS.length}</b><span>done today</span></div>
      <div class="stat"><b>${records.length}</b><span>total sessions logged</span></div>
      <div class="stat"><b>${new Set(records.map(r => r.date)).size}</b><span>days trained</span></div>
    </div>
    <div class="bar"><i style="width:${done / ACTS.length * 100}%"></i></div>
    <div class="grid" id="grid"></div>
    <h2>🔭 Curiosity challenge of the day</h2>
    <div class="lib"><p style="margin:0">${esc(dailyChallenge())}</p></div>
  </div>`));
  const grid = $('#grid');
  ACTS.forEach(a => {
    const last = lastScore(a.id);
    const c = h(`<div class="card ${doneToday(a.id) ? 'done' : ''}">
      <span class="tag">${a.tag}</span><h3>${a.icon} ${a.name}</h3><p>${a.desc}</p>
      <div class="row"><span class="chips"><span class="chip">${a.min} min</span>${last != null ? `<span class="chip">last ${last}${a.unit}</span>` : ''}</span>
      <button class="btn ${doneToday(a.id) ? '' : 'primary'}">${doneToday(a.id) ? '✓ Again' : 'Start'}</button></div></div>`);
    c.querySelector('button').onclick = () => a.run ? launch(a) : show('cards');
    grid.append(c);
  });
}

function launch(a) {
  const app = $('#app'); app.innerHTML = ''; cleanup();
  const stage = h(`<div class="stage"><div class="top"><span>${a.icon} ${a.name}</span><button class="btn ghost" id="quit">✕ Quit</button></div><div id="body"></div></div>`);
  app.append(stage);
  let alive = true; cleanup = () => { alive = false; };
  $('#quit').onclick = () => show('today');
  const finish = (score, detail, extra = '') => {
    alive = false; addRecord(a.id, score, detail);
    $('#body').innerHTML = `<div class="result">${score}${a.unit}</div><p class="msg">${extra}</p><div class="row-btns"><button class="btn primary" id="back">Back to plan</button><button class="btn" id="again">Play again</button></div>`;
    $('#back').onclick = () => show('today'); $('#again').onclick = () => launch(a);
  };
  a.run($('#body'), finish, () => alive);
}

/* ---------- games ---------- */
function gBreathe(root, finish, alive) {
  root.innerHTML = `<p class="msg" id="ph">Get comfortable. Starting…</p><div class="circle" id="c"></div><div class="big" id="t">60</div>`;
  const phases = ['Breathe in', 'Hold', 'Breathe out', 'Hold']; (async () => {
    const c = $('#c'); await sleep(1200);
    for (let s = 0; s < 60 && alive(); s++) {
      const k = s % 16, ph = Math.floor(k / 4);
      if (k % 4 === 0) { $('#ph').textContent = phases[ph]; c.style.transform = ph === 0 ? 'scale(1.8)' : ph === 2 ? 'scale(1)' : c.style.transform; c.style.opacity = ph <= 1 ? 1 : .6; }
      $('#t').textContent = 60 - s; await sleep(1000);
    }
    if (alive()) finish(60, { pattern: '4-4-4-4' }, 'Nice. Calm brain, ready to work.');
  })();
}

function gNback(root, finish, alive) {
  const n = level('nback', 2), total = 20 + n, L = 'CHKLQRST'.split('');
  root.innerHTML = `<p class="msg">Level <b>${n}-back</b>. Press <b>A</b> if the position matches ${n} step${n > 1 ? 's' : ''} ago, <b>L</b> if the letter matches. (${total} rounds)</p>
  <div class="tiles" id="g"></div><div class="row-btns"><button class="btn" id="bp">A · Position match</button><button class="btn" id="bl">L · Letter match</button></div><p class="msg" id="st">Get ready…</p>`;
  const cells = []; for (let i = 0; i < 9; i++) { const t = h('<div class="tile"></div>'); $('#g').append(t); cells.push(t); }
  let pp = false, pl = false; const press = k => { if (k === 'p') pp = true; else pl = true; (k === 'p' ? $('#bp') : $('#bl')).style.outline = '2px solid var(--acc)'; };
  $('#bp').onclick = () => press('p'); $('#bl').onclick = () => press('l');
  const key = e => { const k = e.key.toLowerCase(); if (k === 'a') press('p'); if (k === 'l') press('l'); };
  document.addEventListener('keydown', key);
  const prev = cleanup; cleanup = () => { document.removeEventListener('keydown', key); prev(); };
  (async () => {
    await sleep(1500); const seq = []; let correct = 0, dec = 0, hits = 0, misses = 0, fa = 0;
    for (let i = 0; i < total && alive(); i++) {
      let pos = rnd(9), let_ = pick(L);
      if (i >= n) { if (Math.random() < .3) pos = seq[i - n].pos; if (Math.random() < .3) let_ = seq[i - n].let; }
      seq.push({ pos, let: let_ }); pp = pl = false; $('#bp').style.outline = $('#bl').style.outline = '';
      cells[pos].classList.add('lit'); cells[pos].textContent = let_; $('#st').textContent = `Round ${i + 1}/${total}`;
      await sleep(600); cells[pos].classList.remove('lit'); cells[pos].textContent = ''; await sleep(1900);
      if (i >= n) {
        const mp = seq[i].pos === seq[i - n].pos, ml = seq[i].let === seq[i - n].let;
        [[mp, pp], [ml, pl]].forEach(([m, p]) => { dec++; if (m === p) correct++; if (m && p) hits++; if (m && !p) misses++; if (!m && p) fa++; });
      }
    }
    if (!alive()) return;
    const acc = Math.round(correct / dec * 100); const next = acc >= 85 ? n + 1 : acc < 65 ? Math.max(1, n - 1) : n; setLevel('nback', next);
    finish(acc, { n, hits, misses, falseAlarms: fa }, `${n}-back · hits ${hits}, misses ${misses}, false alarms ${fa}. ${next > n ? '⬆️ Level up next time!' : next < n ? '⬇️ Easing down a level.' : 'Staying at this level.'}`);
  })();
}

function gStroop(root, finish, alive) {
  const C = [['RED', '#f87171'], ['GREEN', '#4ade80'], ['BLUE', '#60a5fa'], ['YELLOW', '#fbbf24']], total = 20;
  root.innerHTML = `<p class="msg">Tap the colour of the INK (or press 1-4). ${total} rounds.</p><div class="big" id="w"></div><div class="row-btns" id="o"></div><p class="msg" id="st"></p>`;
  let i = 0, ok = 0, rts = [], t0, cur, lock = true;
  C.forEach((c, k) => { const b = h(`<button class="btn" style="border-bottom:4px solid ${c[1]}">${k + 1} · ${c[0]}</button>`); b.onclick = () => ans(k); $('#o').append(b); });
  const key = e => { if (/^[1-4]$/.test(e.key)) ans(+e.key - 1); }; document.addEventListener('keydown', key);
  const prev = cleanup; cleanup = () => { document.removeEventListener('keydown', key); prev(); };
  function next() {
    if (!alive()) return; if (i >= total) { const acc = Math.round(ok / total * 100), avg = Math.round(rts.reduce((a, b) => a + b, 0) / rts.length); return finish(acc, { avgRtMs: avg }, `Average reaction ${avg} ms`); }
    const w = rnd(4), ink = Math.random() < .5 ? w : (w + 1 + rnd(3)) % 4; cur = ink;
    $('#w').textContent = C[w][0]; $('#w').style.color = C[ink][1]; $('#st').textContent = `${i + 1}/${total}`; t0 = performance.now(); lock = false;
  }
  function ans(k) { if (lock) return; lock = true; rts.push(performance.now() - t0); if (k === cur) ok++; i++; $('#st').textContent = k === cur ? '✓' : '✗'; setTimeout(next, 250); }
  setTimeout(next, 800);
}

function gSeq(root, finish, alive) {
  root.innerHTML = `<p class="msg" id="m">Watch closely…</p><div class="tiles" id="g"></div>`;
  const cells = []; for (let i = 0; i < 9; i++) { const t = h('<button class="tile"></button>'); t.onclick = () => tap(i); $('#g').append(t); cells.push(t); }
  let seq = [], idx = 0, accepting = false;
  const flash = async (i, cls = 'lit', ms = 400) => { cells[i].classList.add(cls); await sleep(ms); cells[i].classList.remove(cls); await sleep(150); };
  async function round() {
    seq.push(rnd(9)); idx = 0; accepting = false; $('#m').textContent = `Length ${seq.length} — watch…`; await sleep(700);
    for (const s of seq) { if (!alive()) return; await flash(s); }
    accepting = true; $('#m').textContent = 'Your turn!';
  }
  async function tap(i) {
    if (!accepting || !alive()) return;
    if (i === seq[idx]) { flash(i, 'ok', 200); idx++; if (idx === seq.length) { accepting = false; await sleep(500); round(); } }
    else { accepting = false; await flash(i, 'no', 500); finish(seq.length - 1, {}, `You remembered ${seq.length - 1} in a row.`); }
  }
  round();
}

function gDigits(root, finish, alive) {
  const back = new Date().getDate() % 2 === 1; let len = 3, fails = 0, best = 0;
  root.innerHTML = `<p class="msg">${back ? 'BACKWARD day: type the digits in reverse order.' : 'Type the digits in the same order.'}</p><div class="big" id="d">&nbsp;</div>
  <div class="field"><input type="text" id="in" inputmode="numeric" autocomplete="off" disabled placeholder="Type here and press Enter"></div><p class="msg" id="m"></p>`;
  const inp = $('#in'); let expected = '', ready = false;
  async function round() {
    ready = false; inp.value = ''; inp.disabled = true; $('#m').textContent = `${len} digits`; await sleep(900);
    const ds = Array.from({ length: len }, () => rnd(10)); expected = (back ? [...ds].reverse() : ds).join('');
    for (const d of ds) { if (!alive()) return; $('#d').textContent = d; await sleep(750); $('#d').innerHTML = '&nbsp;'; await sleep(250); }
    inp.disabled = false; inp.focus(); ready = true; $('#m').textContent = 'Now recall →';
  }
  inp.onkeydown = e => {
    if (e.key !== 'Enter' || !ready) return; ready = false;
    if (inp.value.trim() === expected) { best = len; len++; fails = 0; $('#m').textContent = '✓ Correct'; } else { fails++; $('#m').textContent = `✗ It was ${expected}`; }
    if (fails >= 2) return setTimeout(() => finish(best, { mode: back ? 'backward' : 'forward' }, `Longest span: ${best}`), 1200);
    setTimeout(round, 1200);
  };
  round();
}

function gMath(root, finish, alive) {
  const lv = level('math', 1); let solved = 0, tried = 0, left = 60, a = 0;
  const gen = () => {
    const r = (lo, hi) => lo + rnd(hi - lo + 1); let x, y, op;
    switch (lv) {
      case 1: x = r(2, 19); y = r(2, 19); op = Math.random() < .5 ? '+' : '−'; if (op === '−' && y > x) [x, y] = [y, x]; break;
      case 2: x = r(10, 99); y = r(10, 99); op = Math.random() < .5 ? '+' : '−'; if (op === '−' && y > x) [x, y] = [y, x]; break;
      case 3: x = r(3, 12); y = r(3, 12); op = '×'; break;
      case 4: x = r(11, 99); y = r(3, 9); op = '×'; break;
      default: x = r(11, 25); y = r(11, 25); op = '×';
    }
    a = op === '+' ? x + y : op === '−' ? x - y : x * y; return `${x} ${op} ${y}`;
  };
  root.innerHTML = `<p class="msg">Level ${lv}. Type the answer, press Enter. <b id="tm">60</b>s left</p><div class="big" id="q"></div><div class="field"><input type="number" id="in" autofocus></div><p class="msg" id="m">Solved: 0</p>`;
  const inp = $('#in'); $('#q').textContent = gen(); inp.focus();
  inp.onkeydown = e => { if (e.key !== 'Enter' || inp.value === '') return; tried++; if (+inp.value === a) solved++; inp.value = ''; $('#q').textContent = gen(); $('#m').textContent = `Solved: ${solved}`; };
  const iv = setInterval(() => {
    if (!alive()) return clearInterval(iv); left--; $('#tm').textContent = left;
    if (left <= 0) { clearInterval(iv); const nl = solved >= 14 ? Math.min(5, lv + 1) : solved < 6 ? Math.max(1, lv - 1) : lv; setLevel('math', nl); finish(solved, { level: lv, tried }, `${solved}/${tried} correct at level ${lv}. ${nl > lv ? '⬆️ Level up!' : nl < lv ? '⬇️ Easing down.' : ''}`); }
  }, 1000);
}

const WORDS = 'anchor piano rocket candle forest mirror violin lantern castle river dragon pencil bridge garden ticket window planet hammer pillow camera island saddle velvet marble thunder orchid compass jungle whistle blanket cactus engine feather magnet puzzle ribbon shadow turtle volcano wallet zipper bottle cookie diamond eagle fountain guitar helmet jacket kettle ladder monkey needle ocean parrot quilt rabbit spoon tunnel umbrella'.split(' ');
function gRecall(root, finish, alive) {
  const words = shuffle(WORDS).slice(0, 10); let t = 45;
  root.innerHTML = `<p class="msg">Picture walking through your home (door → hall → kitchen → …). <b>Place one word in each spot</b>, making each image vivid, weird or funny. <b id="tm">45</b>s</p>
  <div class="chips" style="justify-content:center;font-size:20px">${words.map((w, i) => `<span class="chip" style="font-size:18px;color:var(--text)">${i + 1}. ${w}</span>`).join('')}</div>
  <div class="row-btns"><button class="btn primary" id="go">I'm ready → recall</button></div>`;
  const go = () => {
    clearInterval(iv); if (!alive()) return;
    root.innerHTML = `<p class="msg">Walk your route again. Type every word you remember (any order, separated by spaces or commas).</p><div class="field"><textarea id="ans" autofocus></textarea></div><div class="row-btns"><button class="btn primary" id="sub">Check</button></div>`;
    $('#sub').onclick = () => {
      const got = new Set($('#ans').value.toLowerCase().split(/[^a-z]+/)); const hit = words.filter(w => got.has(w)), miss = words.filter(w => !got.has(w));
      finish(Math.round(hit.length / 10 * 100), { hit: hit.length, missed: miss }, `${hit.length}/10 recalled.${miss.length ? ' Missed: ' + miss.join(', ') : ' Perfect! 🏆'}`);
    };
  };
  $('#go').onclick = go;
  const iv = setInterval(() => { if (!alive()) return clearInterval(iv); t--; $('#tm').textContent = t; if (t <= 0) go(); }, 1000);
}

const PROMPTS = ['What is one new thing you learned today?', 'Explain a concept from your work as if to a 10-year-old.', 'Why does something you use every day actually work?', 'What mistake did you make recently and what is the real lesson?', 'Teach me one idea from the last thing you read or watched.'];
function gFeynman(root, finish) {
  root.innerHTML = `<p class="msg">${esc(pick(PROMPTS))}<br>Use simple words. No jargon. Where you get stuck = what to study next.</p>
  <div class="field"><label>Topic</label><input type="text" id="tp" placeholder="e.g. How compound interest works"></div>
  <div class="field"><label>Your plain-language explanation</label><textarea id="ex"></textarea></div>
  <div class="field"><label>Where did you get stuck? (optional)</label><input type="text" id="gap"></div>
  <div class="row-btns"><button class="btn primary" id="sv">Save entry</button></div>`;
  $('#sv').onclick = () => { const ex = $('#ex').value.trim(); if (ex.split(/\s+/).length < 15) return alert('Write at least ~15 words — explaining is the exercise.'); finish(ex.split(/\s+/).length, { topic: $('#tp').value, text: ex, gap: $('#gap').value }, 'Saved to your journal (see data/records.csv).'); };
}

function gHabits(root, finish) {
  const items = ['😴 Slept 7+ hours', '🏃 20+ min exercise / brisk walk', '📖 Read 20+ min', '🎯 One 45-min deep-work block, phone away', '💧 Drank enough water', '🌳 Learned or tried something new'];
  root.innerHTML = `<p class="msg">Tick what you did (or will do) today. Sleep and exercise have the strongest evidence for brain health.</p>${items.map((t, i) => `<label class="check"><input type="checkbox" data-i="${i}"> ${t}</label>`).join('')}<div class="row-btns"><button class="btn primary" id="sv">Save</button></div>`;
  $('#sv').onclick = () => { const on = [...root.querySelectorAll('input:checked')].map(c => items[c.dataset.i]); finish(on.length, { done: on }, on.length >= 5 ? 'Brain-friendly day! 🌟' : 'Every tick counts.'); };
}

/* ---------- flashcards (SM-2 lite) ---------- */
function vCards(app) {
  const due = () => cards.filter(c => c.due <= today());
  app.append(h(`<div><h1>🗂️ Flashcards</h1><p class="sub">Spaced repetition: recalling a card right before you'd forget it is the most efficient way to build long-term memory.</p>
  <div class="stats"><div class="stat"><b>${cards.length}</b><span>total cards</span></div><div class="stat"><b>${due().length}</b><span>due today</span></div></div>
  <div class="row-btns" style="justify-content:flex-start"><button class="btn primary" id="rev" ${due().length ? '' : 'disabled'}>Review ${due().length} due</button></div>
  <div class="lib" id="rv" hidden></div>
  <h2>Add a card</h2><div class="lib"><div class="field"><label>Front (question / word / concept)</label><input type="text" id="f"></div><div class="field"><label>Back (answer)</label><input type="text" id="b"></div><button class="btn primary" id="add">Add card</button></div>
  <h2>All cards</h2><table><tr><th>Front</th><th>Back</th><th>Next due</th><th></th></tr>${cards.map(c => `<tr><td>${esc(c.front)}</td><td>${esc(c.back)}</td><td>${c.due}</td><td><button class="btn ghost" data-del="${c.id}">✕</button></td></tr>`).join('') || '<tr><td colspan="4" class="sub">No cards yet — add things you want to remember: vocabulary, formulas, facts from books.</td></tr>'}</table></div>`));
  $('#add').onclick = () => { const f = $('#f').value.trim(), b = $('#b').value.trim(); if (!f || !b) return; cards.push({ id: Date.now().toString(36), front: f, back: b, due: today(), interval: 0, ease: 2.5, reps: 0 }); saveCards(); show('cards'); };
  app.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { cards = cards.filter(c => c.id !== b.dataset.del); saveCards(); show('cards'); });
  $('#rev').onclick = () => {
    const queue = shuffle(due()); let n = 0; const rv = $('#rv'); rv.hidden = false;
    const step = () => {
      if (!queue.length) { if (n) addRecord('cards', n, {}); rv.innerHTML = `<div class="result">${n} reviewed</div><button class="btn primary" id="ok">Done</button>`; $('#ok').onclick = () => show('cards'); return; }
      const c = queue[0]; rv.innerHTML = `<p class="msg">${queue.length} left — try to recall BEFORE flipping.</p><div class="big" style="font-size:30px">${esc(c.front)}</div><div class="row-btns"><button class="btn" id="fl">Show answer</button></div>`;
      $('#fl').onclick = () => {
        rv.innerHTML = `<p class="msg">${esc(c.front)}</p><div class="big" style="font-size:30px;color:var(--good)">${esc(c.back)}</div><div class="row-btns"><button class="btn" data-q="0">Again</button><button class="btn" data-q="1">Good</button><button class="btn primary" data-q="2">Easy</button></div>`;
        rv.querySelectorAll('[data-q]').forEach(b => b.onclick = () => {
          const q = +b.dataset.q; queue.shift();
          if (q === 0) { c.reps = 0; c.interval = 0; c.ease = Math.max(1.3, c.ease - .2); c.due = today(); queue.push(c); }
          else { c.reps++; c.interval = c.reps === 1 ? (q === 2 ? 3 : 1) : c.reps === 2 ? (q === 2 ? 8 : 4) : Math.round(c.interval * c.ease * (q === 2 ? 1.3 : 1)); if (q === 2) c.ease += .1; c.due = addDays(today(), c.interval); n++; }
          saveCards(); step();
        });
      };
    }; step();
  };
}

/* ---------- progress ---------- */
function vProgress(app) {
  const days = Array.from({ length: 14 }, (_, i) => addDays(today(), i - 13));
  const cnt = d => new Set(records.filter(r => r.date === d).map(r => r.activity)).size, max = Math.max(1, ...days.map(cnt));
  app.append(h(`<div><h1>📈 Progress</h1><p class="sub">Activities completed per day (last 14 days)</p>
  <div class="chart" style="margin-bottom:30px">${days.map(d => `<div style="height:${cnt(d) / max * 100}%" title="${d}: ${cnt(d)}"><span>${d.slice(8)}</span></div>`).join('')}</div>
  <h2>Per activity</h2><table><tr><th>Activity</th><th>Sessions</th><th>Last</th><th>Best</th><th>Avg (last 7)</th></tr>
  ${ACTS.map(a => { const rs = records.filter(r => r.activity === a.id), sc = rs.map(r => +r.score), l7 = sc.slice(-7); return `<tr><td>${a.icon} ${a.name}</td><td>${rs.length}</td><td>${sc.length ? sc.at(-1) : '–'}</td><td>${sc.length ? Math.max(...sc) : '–'}</td><td>${l7.length ? (l7.reduce((x, y) => x + y, 0) / l7.length).toFixed(1) : '–'}</td></tr>`; }).join('')}</table>
  <h2>Your data</h2><div class="row-btns" style="justify-content:flex-start"><button class="btn" id="ex">⬇️ Download CSV</button><button class="btn ghost" id="imp">⬆️ Import CSV</button><input type="file" id="fi" accept=".csv" hidden></div>
  <p class="sub">${serverUp ? 'Also saved automatically in <code>data/records.csv</code> in the project folder.' : 'Server not running — data is in this browser only. Run <code>npm start</code> to also write CSV files.'}</p></div>`));
  $('#ex').onclick = () => {
    const q = v => { let s = String(v ?? ''); if (/^[=+\-@]/.test(s)) s = "'" + s; return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const csv = 'id,timestamp,date,activity,score,detail\n' + records.map(r => [r.id, r.timestamp, r.date, r.activity, r.score, r.detail].map(q).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = `brain-gym-${today()}.csv`; a.click();
  };
  $('#imp').onclick = () => $('#fi').click();
  $('#fi').onchange = async e => {
    const lines = (await e.target.files[0].text()).split('\n').slice(1).filter(Boolean); let added = 0; const ids = new Set(records.map(r => r.id));
    lines.forEach(l => { const m = l.match(/("([^"]|"")*"|[^,]*)(,|$)/g)?.map(x => x.replace(/,$/, '').replace(/^"|"$/g, '').replace(/""/g, '"')); if (m && m.length >= 5 && !ids.has(m[0])) { records.push({ id: m[0], timestamp: m[1], date: m[2], activity: m[3], score: +m[4], detail: m[5] || '{}' }); added++; } });
    save(K.rec, records); if (serverUp) post('/api/records', records); alert(`Imported ${added} new rows`); show('progress');
  };
}

/* ---------- library ---------- */
const CHALLENGES = ['Take a different route today and notice 5 new things.', 'Learn 5 words in a language you are curious about.', 'Draw (badly!) a diagram of something you understand.', 'Play one game of chess or solve a puzzle you have never tried.', 'Write with your non-dominant hand for 2 minutes.', 'Cook a recipe you have never made without looking at your phone mid-way.', 'Ask someone an interesting question and listen for 10 minutes.', 'Read 10 pages of a book outside your usual topics.', 'Memorise a short poem or a 20-digit number using a memory palace.', 'Teach someone a concept you learned this week.', 'Go for a 30-minute walk with no podcast or music — let your mind wander.', 'Learn a card trick or a simple instrument riff.', 'Estimate the answers to 5 everyday numbers before googling them.'];
const dailyChallenge = () => CHALLENGES[[...today()].reduce((s, c) => s + c.charCodeAt(0), 0) % CHALLENGES.length];
const LIB = [
  ['Retrieval practice & spaced repetition', 'Make It Stick — Brown, Roediger & McDaniel · Ebbinghaus forgetting curve', 'Testing yourself beats re-reading. Spacing reviews over days multiplies retention.', 'Flashcards'],
  ['Method of Loci (Memory Palace)', 'Moonwalking with Einstein — Joshua Foer · Ancient Greek orators', 'Anchor items to places on a familiar route using vivid, absurd images. Memory champions use it.', 'Memory Palace'],
  ['Feynman Technique', 'Surely You\'re Joking, Mr. Feynman! · A Mind for Numbers — Barbara Oakley', 'Explain it simply, find the gaps, go back and learn them. Reveals the illusion of understanding.', 'Feynman Journal'],
  ['Working-memory training (Dual N-Back)', 'Jaeggi et al., 2008, PNAS', 'Trains holding & updating information. Evidence for transfer to general intelligence is mixed, but it reliably improves working-memory task skill and focus.', 'Dual N-Back'],
  ['Inhibition & attention (Stroop)', 'Thinking, Fast and Slow — Daniel Kahneman · Stroop, 1935', 'Practises overriding automatic responses — the "System 2" effort.', 'Stroop Focus'],
  ['Deliberate practice', 'Peak — Anders Ericsson', 'Work at the edge of your ability, get feedback, repeat. Why the games adapt their difficulty.', 'All adaptive games'],
  ['Deep Work', 'Deep Work — Cal Newport', 'Protected, distraction-free blocks build focus like a muscle.', 'Brain habits'],
  ['Habit design', 'Atomic Habits — James Clear', 'Make it obvious, easy, satisfying. Same time + same place + streak tracking.', 'Streak & daily plan'],
  ['Exercise for the brain', 'Spark — John J. Ratey', 'Aerobic exercise raises BDNF and is among the best-supported ways to protect cognition.', 'Brain habits'],
  ['Sleep', 'Why We Sleep — Matthew Walker (some claims debated; core point stands)', 'Sleep consolidates memories. No game compensates for chronic sleep loss.', 'Brain habits'],
  ['Neuroplasticity & growth mindset', 'The Brain That Changes Itself — Norman Doidge · Mindset — Carol Dweck', 'Abilities change with effort; "not yet" beats "I can\'t".', 'Level-ups'],
  ['Learning how to learn', 'Learning How to Learn — Oakley & Sejnowski · Limitless — Jim Kwik', 'Alternate focused and diffuse thinking; chunk ideas; sleep on it.', 'Curiosity challenge'],
  ['Mindfulness & box breathing', 'Mindfulness-based stress reduction research (Kabat-Zinn)', 'Short breath practice reduces stress and improves attention control.', 'Box breathing'],
];
function vLibrary(app) {
  app.append(h(`<div><h1>📚 Library</h1><p class="sub">The research and books behind each exercise.</p>
  <div class="note"><b>Honest take:</b> "brain training" games mostly make you better at the games themselves; far transfer is modest. What's best evidenced for sharper thinking is <b>exercise, sleep, retrieval practice, learning genuinely new hard things</b>, and social engagement. That's why this app mixes games with study techniques and habits — and adds a daily curiosity challenge.</div>
  ${LIB.map(l => `<div class="lib"><h3>${esc(l[0])}</h3><p class="sub" style="margin:0 0 6px">📖 ${esc(l[1])}</p><p style="margin:0 0 6px">${esc(l[2])}</p><span class="chip">In app: ${esc(l[3])}</span></div>`).join('')}</div>`));
}

boot();
