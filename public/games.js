'use strict';
/* Exercises. Each takes (root, finish, alive). `$` is scoped to root so a game you quit can never touch another game's DOM. */

function gBreathe(root, finish, alive) {
  const $ = s => root.querySelector(s);
  root.innerHTML = `<p class="msg" id="ph" aria-live="polite">Get comfortable. Starting…</p><div class="circle" id="c"></div><div class="big" id="t">60</div><div class="row-btns"><button class="btn ghost" id="skip">End early</button></div>`;
  const phases = ['Breathe in', 'Hold', 'Breathe out', 'Hold']; let done = 0;
  $('#skip').onclick = () => { if (alive()) finish(done, { pattern: '4-4-4-4', early: true }, 'Stopped early. Any amount counts.'); };
  (async () => {
    const c = $('#c'); await sleep(1200);
    for (let s = 0; s < 60 && alive(); s++) {
      const k = s % 16, ph = Math.floor(k / 4);
      if (k % 4 === 0) { $('#ph').textContent = phases[ph]; c.style.transform = ph === 0 ? 'scale(1.8)' : ph === 2 ? 'scale(1)' : c.style.transform; c.style.opacity = ph <= 1 ? 1 : .6; }
      $('#t').textContent = 60 - s; await sleep(1000); done = s + 1;
    }
    if (alive()) finish(60, { pattern: '4-4-4-4' }, 'Done.');
  })();
}

function gNback(root, finish, alive) {
  const $ = s => root.querySelector(s);
  const n = level('nback', 2), total = 20 + n, L = 'CHKLQRST'.split('');
  root.innerHTML = `<p class="msg">Level <b>${n}-back</b>. Press <b>A</b> if the position matches ${n} step${n > 1 ? 's' : ''} ago, <b>L</b> if the letter does. ${total} rounds. Score is chance-corrected, so pressing nothing earns 50.</p>
  <div class="tiles" id="g" aria-hidden="true"></div><div class="row-btns"><button class="btn" id="bp">A · Position match</button><button class="btn" id="bl">L · Letter match</button></div><p class="msg" id="st" aria-live="polite">Get ready…</p>`;
  const cells = []; for (let i = 0; i < 9; i++) { const t = h('<div class="tile"></div>'); $('#g').append(t); cells.push(t); }
  let pp = false, pl = false; const press = k => { if (k === 'p') pp = true; else pl = true; (k === 'p' ? $('#bp') : $('#bl')).classList.add('pressed'); };
  $('#bp').onclick = () => press('p'); $('#bl').onclick = () => press('l');
  const key = e => { if (e.ctrlKey || e.metaKey || e.altKey) return; const k = e.key.toLowerCase(); if (k === 'a') press('p'); if (k === 'l') press('l'); };
  document.addEventListener('keydown', key);
  const prev = cleanup; cleanup = () => { document.removeEventListener('keydown', key); prev(); };
  (async () => {
    await sleep(1500); const seq = []; let hits = 0, misses = 0, fa = 0, cr = 0;
    for (let i = 0; i < total && alive(); i++) {
      let pos = rnd(9), let_ = pick(L);
      if (i >= n) { if (Math.random() < .3) pos = seq[i - n].pos; if (Math.random() < .3) let_ = seq[i - n].let; }
      seq.push({ pos, let: let_ }); pp = pl = false; $('#bp').classList.remove('pressed'); $('#bl').classList.remove('pressed');
      cells[pos].classList.add('lit'); cells[pos].textContent = let_; $('#st').textContent = `Round ${i + 1} of ${total}`;
      await sleep(600); if (!alive()) return; cells[pos].classList.remove('lit'); cells[pos].textContent = ''; await sleep(1900);
      if (i >= n) {
        const mp = seq[i].pos === seq[i - n].pos, ml = seq[i].let === seq[i - n].let;
        [[mp, pp], [ml, pl]].forEach(([m, p]) => { if (m && p) hits++; else if (m) misses++; else if (p) fa++; else cr++; });
      }
    }
    if (!alive()) return;
    const hr = hits + misses ? hits / (hits + misses) : 1, crr = cr + fa ? cr / (cr + fa) : 1, acc = Math.round((hr + crr) / 2 * 100);
    const next = acc >= 80 ? n + 1 : acc < 60 ? Math.max(1, n - 1) : n; setLevel('nback', next);
    finish(acc, { n, hits, misses, falseAlarms: fa }, `${n}-back: caught ${hits} of ${hits + misses} matches, ${fa} false alarm${fa === 1 ? '' : 's'}. ${next > n ? 'Moving up a level.' : next < n ? 'Dropping a level for next time.' : 'Same level next time.'}`);
  })();
}

function gStroop(root, finish, alive) {
  const $ = s => root.querySelector(s), dark = matchMedia('(prefers-color-scheme: dark)').matches;
  const C = [['RED', '#c4361b', '#f2705a'], ['GREEN', '#2c7a4b', '#5fcf8e'], ['BLUE', '#2559b7', '#7aa6f5'], ['YELLOW', '#a87400', '#f0c64a']].map(c => [c[0], dark ? c[2] : c[1]]), total = 20;
  root.innerHTML = `<p class="msg">Tap the colour of the INK, not the word (or press 1-4). ${total} rounds.</p><div class="big" id="w" aria-live="off"></div><div class="row-btns" id="o"></div><p class="msg" id="st" aria-live="polite"></p>`;
  let i = 0, ok = 0, rts = [], t0, cur, lock = true;
  C.forEach((c, k) => { const b = h(`<button class="btn" style="border-bottom:4px solid ${c[1]}">${k + 1} · ${c[0]}</button>`); b.onclick = () => ans(k); $('#o').append(b); });
  const key = e => { if (e.ctrlKey || e.metaKey || e.altKey) return; if (/^[1-4]$/.test(e.key)) ans(+e.key - 1); }; document.addEventListener('keydown', key);
  const prev = cleanup; cleanup = () => { document.removeEventListener('keydown', key); prev(); };
  function next() {
    if (!alive()) return; if (i >= total) { const acc = Math.round(ok / total * 100), avgRt = Math.round(avg(rts)); return finish(acc, { avgRtMs: avgRt }, `Average reaction ${avgRt} ms.`); }
    const w = rnd(4), ink = Math.random() < .5 ? w : (w + 1 + rnd(3)) % 4; cur = ink;
    $('#w').textContent = C[w][0]; $('#w').style.color = C[ink][1]; $('#st').textContent = `${i + 1} of ${total}`; t0 = performance.now(); lock = false;
  }
  function ans(k) { if (lock || !alive()) return; lock = true; rts.push(performance.now() - t0); if (k === cur) ok++; i++; $('#st').textContent = k === cur ? '✓' : '✗'; setTimeout(next, 250); }
  setTimeout(next, 800);
}

function gSeq(root, finish, alive) {
  const $ = s => root.querySelector(s);
  root.innerHTML = `<p class="msg" id="m" aria-live="polite">Watch closely…</p><div class="tiles" id="g"></div>`;
  const cells = []; for (let i = 0; i < 9; i++) { const t = h(`<button class="tile" aria-label="Tile ${i + 1}"></button>`); t.onclick = () => tap(i); $('#g').append(t); cells.push(t); }
  let seq = [], idx = 0, accepting = false;
  const flash = async (i, cls = 'lit', ms = 400) => { cells[i].classList.add(cls); await sleep(ms); cells[i].classList.remove(cls); await sleep(150); };
  async function round() {
    if (!alive()) return; seq.push(rnd(9)); idx = 0; accepting = false; $('#m').textContent = `Length ${seq.length}. Watch…`; await sleep(700);
    for (const s of seq) { if (!alive()) return; await flash(s); }
    accepting = true; $('#m').textContent = 'Your turn.';
  }
  async function tap(i) {
    if (!accepting || !alive()) return;
    if (i === seq[idx]) { flash(i, 'ok', 200); idx++; if (idx === seq.length) { accepting = false; await sleep(500); round(); } }
    else { accepting = false; await flash(i, 'no', 500); if (alive()) finish(seq.length - 1, {}, `You repeated ${seq.length - 1} in a row.`); }
  }
  round();
}

function gDigits(root, finish, alive) {
  const $ = s => root.querySelector(s), back = new Date().getDate() % 2 === 1; let len = 3, fails = 0, best = 0;
  root.innerHTML = `<p class="msg">${back ? 'Backward day: type the digits in reverse order.' : 'Type the digits in the same order.'}</p><div class="big" id="d" aria-live="off">&nbsp;</div>
  <div class="field"><label for="in">Your answer</label><input type="text" id="in" inputmode="numeric" autocomplete="off" disabled placeholder="Type, then press Enter"></div><div class="row-btns"><button class="btn" id="subm" disabled>Submit</button></div><p class="msg" id="m" aria-live="polite"></p>`;
  const inp = $('#in'); let expected = '', ready = false;
  async function round() {
    if (!alive()) return; ready = false; inp.value = ''; inp.disabled = true; $('#subm').disabled = true; $('#m').textContent = `${len} digits`; await sleep(900);
    const ds = Array.from({ length: len }, () => rnd(10)); expected = (back ? [...ds].reverse() : ds).join('');
    for (const d of ds) { if (!alive()) return; $('#d').textContent = d; await sleep(750); $('#d').innerHTML = '&nbsp;'; await sleep(250); }
    if (!alive()) return; inp.disabled = false; $('#subm').disabled = false; inp.focus(); ready = true; $('#m').textContent = 'Now recall.';
  }
  const submitD = () => {
    if (!ready || !alive()) return; ready = false; $('#subm').disabled = true;
    if (inp.value.trim() === expected) { best = len; len++; fails = 0; $('#m').textContent = '✓ Correct'; } else { fails++; $('#m').textContent = `✗ It was ${expected}`; }
    if (fails >= 2) return setTimeout(() => finish(best, { mode: back ? 'backward' : 'forward' }, `Longest span: ${best}`), 1200);
    setTimeout(round, 1200);
  };
  inp.onkeydown = e => { if (e.key === 'Enter') submitD(); }; $('#subm').onclick = submitD;
  round();
}

function gMath(root, finish, alive) {
  const $ = s => root.querySelector(s), lv = level('math', 1); let solved = 0, tried = 0, left = 60, a = 0;
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
  root.innerHTML = `<p class="msg">Level ${lv}. Type the answer, press Enter. <b id="tm">60</b>s left</p><div class="big" id="q"></div><div class="field"><label for="in">Answer</label><input type="number" id="in" inputmode="numeric"></div><div class="row-btns"><button class="btn" id="subm">Submit</button></div><p class="msg" id="m" aria-live="polite">Solved: 0</p>`;
  const inp = $('#in'); $('#q').textContent = gen(); inp.focus();
  const submitM = () => { if (inp.value === '') return; tried++; if (+inp.value === a) solved++; inp.value = ''; $('#q').textContent = gen(); $('#m').textContent = `Solved: ${solved}`; inp.focus(); };
  inp.onkeydown = e => { if (e.key === 'Enter') submitM(); }; $('#subm').onclick = submitM;
  const iv = setInterval(() => {
    if (!alive()) return clearInterval(iv); left--; $('#tm').textContent = left;
    if (left <= 0) { clearInterval(iv); const nl = solved >= 14 ? Math.min(5, lv + 1) : solved < 6 ? Math.max(1, lv - 1) : lv; setLevel('math', nl); finish(solved, { level: lv, tried }, `${solved} of ${tried} correct at level ${lv}. ${nl > lv ? 'Moving up a level.' : nl < lv ? 'Dropping a level for next time.' : ''}`); }
  }, 1000);
}

const WORDS = 'anchor piano rocket candle forest mirror violin lantern castle river dragon pencil bridge garden ticket window planet hammer pillow camera island saddle velvet marble thunder orchid compass jungle whistle blanket cactus engine feather magnet puzzle ribbon shadow turtle volcano wallet zipper bottle cookie diamond eagle fountain guitar helmet jacket kettle ladder monkey needle ocean parrot quilt rabbit spoon tunnel umbrella'.split(' ');
function gRecall(root, finish, alive) {
  const $ = s => root.querySelector(s), words = shuffle(WORDS).slice(0, 10); let t = 45;
  root.innerHTML = `<p class="msg">Picture walking through your home (door, hall, kitchen…). <b>Place one word in each spot</b>, making each image vivid, odd or funny. <b id="tm">45</b>s</p>
  <div class="chips" style="justify-content:center">${words.map((w, i) => `<span class="chip" style="font-size:18px;color:var(--ink)">${i + 1}. ${w}</span>`).join('')}</div>
  <div class="row-btns"><button class="btn primary" id="go">I am ready, recall</button></div>`;
  const go = () => {
    clearInterval(iv); if (!alive()) return;
    root.innerHTML = `<p class="msg">Walk your route again. Type every word you remember, in any order.</p><div class="field"><label for="ans">Words you remember</label><textarea id="ans"></textarea></div><div class="row-btns"><button class="btn primary" id="sub">Check</button></div>`;
    $('#ans').focus();
    $('#sub').onclick = () => {
      const got = new Set($('#ans').value.toLowerCase().split(/[^a-z]+/)); const hit = words.filter(w => got.has(w)), miss = words.filter(w => !got.has(w));
      finish(hit.length * 10, { hit: hit.length, missed: miss }, `${hit.length} of 10 recalled.${miss.length ? ' Missed: ' + miss.join(', ') + '.' : ''}`);
    };
  };
  $('#go').onclick = go;
  const iv = setInterval(() => { if (!alive()) return clearInterval(iv); t--; $('#tm').textContent = t; if (t <= 0) go(); }, 1000);
}

const PROMPTS = ['What is one new thing you learned today?', 'Explain a concept from your work as if to a 10-year-old.', 'Why does something you use every day actually work?', 'What mistake did you make recently, and what is the real lesson?', 'Teach one idea from the last thing you read or watched.'];
function gFeynman(root, finish) {
  const $ = s => root.querySelector(s);
  root.innerHTML = `<p class="msg">${esc(pick(PROMPTS))}<br>Plain words, no jargon. Where you get stuck is what to study next.</p>
  <div class="field"><label for="tp">Topic</label><input type="text" id="tp" placeholder="e.g. How compound interest works"></div>
  <div class="field"><label for="ex">Your explanation</label><textarea id="ex"></textarea></div>
  <div class="field"><label for="gap">Where did you get stuck? (optional)</label><input type="text" id="gap"></div>
  <p class="err" role="alert"></p><div class="row-btns"><button class="btn primary" id="sv">Save entry</button></div>`;
  $('#sv').onclick = () => { const ex = $('#ex').value.trim(), n = ex ? ex.split(/\s+/).length : 0; if (n < 15) { $('.err').textContent = 'Write at least about 15 words. The explaining is the exercise.'; return; } finish(n, { topic: $('#tp').value, text: ex, gap: $('#gap').value }, 'Saved. You can re-read it in the Library.'); };
}

function gHabits(root, finish) {
  const $ = s => root.querySelector(s), items = ['Slept 7+ hours', '20+ minutes of exercise or a brisk walk', 'Read for 20+ minutes', 'One 45-minute deep-work block with the phone away', 'Drank enough water', 'Learned or tried something new'];
  root.innerHTML = `<p class="msg">Tick what you did (or will do) today. Sleep and exercise have the strongest evidence for brain health.</p>${items.map((t, i) => `<label class="check"><input type="checkbox" data-i="${i}"> ${t}</label>`).join('')}<div class="row-btns"><button class="btn primary" id="sv">Save</button></div>`;
  $('#sv').onclick = () => { const on = [...root.querySelectorAll('input:checked')].map(c => items[c.dataset.i]); finish(on.length, { done: on }, on.length >= 5 ? 'A strong day for your brain.' : 'Every tick counts.'); };
}

/* ---------- influence & manipulation ---------- */
const dayNo = () => Math.floor(new Date(today() + 'T12:00:00') / 864e5);
const techOfDay = () => TECH[dayNo() % TECH.length];
const techById = id => TECH.find(t => t.id === id);
const labelFor = id => id === 'fair' ? FAIR.short : techById(id) ? shortName(techById(id)) : 'unknown';

function manipStats() {
  const st = {};
  records.filter(r => r.activity === 'manip').forEach(r => {
    let d = {}; try { d = JSON.parse(r.detail); } catch { }
    (Array.isArray(d.results) ? d.results : []).forEach(x => { if (!x || !SCEN.some(s => s.id === x.id)) return; const e = st[x.id] ||= { n: 0, ok: 0, last: null, t: x.tid }; e.n++; e.ok += x.correct ? 1 : 0; e.last = x.correct; e.chosen = x.chosen; e.reason = x.reason; e.date = r.date; });
  });
  return st;
}
/* Pick 3 situations: yesterday's technique first (a delayed recall, not a giveaway), then whatever you miss most, sometimes a fair request.
   Harder situations unlock after 9+ answers at 65%+ accuracy. */
function pickScenarios() {
  const st = manipStats(), vals = Object.values(st), att = vals.reduce((x, e) => x + e.n, 0), ok = vals.reduce((x, e) => x + e.ok, 0);
  const hard = att >= 9 && ok / att >= .65, pool = SCEN.filter(s => hard || s.lvl === 1);
  const w = s => { const e = st[s.id]; return (!e ? 3 : e.last === false ? 5 : 1) + Math.random() * 1.5 - (s.t === 'fair' ? 1.5 : 0); };
  const scored = pool.map(s => [w(s), s]).sort((a, b) => b[0] - a[0]).map(x => x[1]);
  const prev = TECH[((dayNo() - 1) % TECH.length + TECH.length) % TECH.length];
  const out = [scored.find(s => s.t === prev.id) || scored[0]];
  for (const s of scored) { if (out.length >= 3) break; if (!out.some(o => o.t === s.t)) out.push(s); }
  if (!out.some(o => o.t === 'fair') && Math.random() < .34) out[2] = pick(pool.filter(s => s.t === 'fair'));
  return out;
}

/* Answer options: the right one + two genuine confusables + one other technique, then a fixed "fair" option.
   For fair-request situations, four random techniques are shown and the correct answer is the fair option. */
function optionsFor(sc) {
  const pool = shuffle(TECH.filter(t => t.id !== sc.t)); let techs;
  if (sc.t === 'fair') techs = pool.slice(0, 4);
  else { const c = shuffle(CONF[sc.t]).slice(0, 2).map(techById); techs = [techById(sc.t), ...c, ...pool.filter(t => !c.includes(t)).slice(0, 1)]; }
  return [...shuffle(techs).map(t => ({ id: t.id, label: shortName(t) })), { id: 'fair', label: FAIR.short }];
}

function gLesson(root, finish) {
  const $ = s => root.querySelector(s), t = techOfDay();
  root.innerHTML = `<div style="text-align:left"><p class="eyebrow">Technique ${TECH.indexOf(t) + 1} of ${TECH.length} · ${esc(t.src)}</p><h1 style="font-size:36px">${esc(t.name)}</h1>
  <p class="serif">${esc(t.def)}</p>
  <h2 style="font-size:18px">How to spot it</h2><ul>${t.signs.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
  <h2 style="font-size:18px">How to counter it</h2><p>${esc(t.counter)}</p>
  <div class="field"><label for="ex">Where have you seen or felt this? Ads, work, family, media. A sentence or two.</label><textarea id="ex" style="min-height:90px"></textarea></div>
  <p class="err" role="alert"></p><div class="row-btns" style="justify-content:flex-start"><button class="btn primary" id="sv">Save and continue</button></div></div>`;
  $('#sv').onclick = () => { const x = $('#ex').value.trim(), n = x ? x.split(/\s+/).length : 0; if (n < 6) { $('.err').textContent = 'Write a short sentence. Linking it to real life is what makes it stick.'; return; } finish(n, { tech: t.id, text: x }, 'Saved. Tomorrow your first situation will test this technique, once you have had a night to forget it.'); };
  $('#ex').focus();
}

function gManip(root, finish, alive) {
  const $ = s => root.querySelector(s), picked = pickScenarios(); let i = 0; const results = [];
  let keyH = null; const prev = cleanup; cleanup = () => { if (keyH) document.removeEventListener('keydown', keyH); prev(); };
  const round = () => {
    if (!alive()) return;
    if (i >= picked.length) return finish(Math.round(avg(results.map(r => r.pts))), { results }, `${results.filter(r => r.correct).length} of ${results.length} named correctly.`);
    const sc = picked[i], opts = optionsFor(sc); let chosen = null;
    root.innerHTML = `<div style="text-align:left"><p class="eyebrow">Situation ${i + 1} of ${picked.length}${sc.lvl === 2 ? ' · harder' : ''}</p><p class="serif" id="sit" style="font-size:22px;margin-bottom:22px">${esc(sc.text)}</p>
    <p class="eyebrow" id="q1">1 · What is going on here? (keys 1-${opts.length}, or arrow keys)</p><div id="op" role="radiogroup" aria-labelledby="q1" aria-describedby="sit" class="opts"></div>
    <div class="field"><label for="rs">2 · Your reasoning: which signals in the situation tell you so?</label><textarea id="rs" placeholder="They did X first, which creates… then asked for Y…"></textarea></div>
    <p class="err" role="alert"></p><div class="row-btns" style="justify-content:flex-start"><button class="btn primary" id="sub">Submit</button></div></div>`;
    const choose = (o, b) => { chosen = o; root.querySelectorAll('#op .opt').forEach(x => { x.setAttribute('aria-checked', 'false'); x.classList.remove('sel'); }); b.setAttribute('aria-checked', 'true'); b.classList.add('sel'); };
    opts.forEach((o, k) => { const b = h(`<button class="opt" role="radio" aria-checked="false"><span class="k">${k + 1}</span>${esc(o.label)}</button>`); b.onclick = () => choose(o, b); $('#op').append(b); });
    if (keyH) document.removeEventListener('keydown', keyH);
    keyH = e => {
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT' || e.ctrlKey || e.metaKey || e.altKey) return;
      const btns = [...root.querySelectorAll('#op .opt')]; if (!btns.length) return;
      const k = +e.key; if (k >= 1 && k <= opts.length) return choose(opts[k - 1], btns[k - 1]);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const cur = btns.indexOf(document.activeElement), nx = (Math.max(cur, 0) + (e.key === 'ArrowDown' ? 1 : btns.length - 1) + (cur < 0 ? -1 : 0)) % btns.length; btns[nx].focus(); choose(opts[nx], btns[nx]); }
    };
    document.addEventListener('keydown', keyH);
    $('#sub').onclick = () => {
      const txt = $('#rs').value.trim(), err = $('.err');
      if (!chosen) { err.textContent = 'Pick an answer first.'; return; }
      if (txt.split(/\s+/).length < 8) { err.textContent = 'Explain your reasoning in a sentence or two (8+ words).'; return; }
      if (keyH) { document.removeEventListener('keydown', keyH); keyH = null; }
      const correct = chosen.id === sc.t, { pts, hits } = Logic.scoreReasoning(txt, sc.keys, correct), fair = sc.t === 'fair', t = fair ? null : techById(sc.t);
      results.push({ id: sc.id, tid: sc.t, correct, pts, chosen: chosen.id, reason: txt.slice(0, 200) });
      root.innerHTML = `<div style="text-align:left" id="rv" tabindex="-1"><p class="eyebrow" style="color:${correct ? 'var(--good)' : 'var(--acc)'}">${correct ? 'Correct' : 'Not quite'} · ${pts}/100</p>
      <h1 style="font-size:32px">${fair ? 'A fair request' : esc(t.name)}</h1>
      ${correct ? '' : `<p class="meta">You chose: ${esc(chosen.label)}</p>`}
      <h2 style="font-size:18px">Model reasoning</h2><p>${esc(sc.why)}</p>
      <p class="meta">${correct ? (hits.length ? `Signals you caught: ${esc(hits.slice(0, 4).join(', '))}.` : 'Compare your reasoning with the model answer above.') : 'Reasoning credit is small when the technique is wrong. Compare your reading with the model answer.'}</p>
      ${fair ? '<h2 style="font-size:18px">Test for a fair request</h2><p>Is it transparent, is the information honest, and can you say no without penalty? If all three, it is persuasion, not manipulation.</p>' : `<h2 style="font-size:18px">Tell-tale signs</h2><ul>${t.signs.map(x => `<li>${esc(x)}</li>`).join('')}</ul><h2 style="font-size:18px">Your counter-move</h2><p>${esc(t.counter)}</p>`}
      <div class="row-btns" style="justify-content:flex-start"><button class="btn primary" id="nx">${i + 1 < picked.length ? 'Next situation' : 'Finish'}</button>${AI.configured() ? '<button class="btn" id="ask">Get coach feedback on my reasoning</button>' : ''}</div>
      ${AI.configured() ? '' : '<p class="meta">Want AI feedback on your reasoning here? Add an API key in the Coach tab (optional).</p>'}<div id="aiout" class="aiout" aria-live="polite"></div></div>`;
      $('#rv').focus(); $('#nx').onclick = () => { i++; round(); };
      const ask = $('#ask'); if (ask) ask.onclick = async () => {
        ask.disabled = true; const out = $('#aiout'); out.innerHTML = '<p class="meta">Thinking…</p>';
        try { out.innerHTML = AI.mdToHtml(await AI.ask(AI.SYSTEM, [{ role: 'user', content: AI.critiquePrompt({ situation: sc.text, myAnswer: chosen.label, correctAnswer: fair ? FAIR.short : shortName(t), myReasoning: txt, modelReasoning: sc.why, wasCorrect: correct }) }], 500)); }
        catch (e) { out.innerHTML = '<p class="err">' + esc(e.message) + '</p>'; ask.disabled = false; }
      };
    };
    root.querySelector('.opt').focus();
  };
  round();
}
