'use strict';
/* Pure logic shared by the browser app, the local server and the tests. No DOM access here. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.Logic = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const pad = n => String(n).padStart(2, '0');
  const isoOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return isoOf(d); };
  const avg = a => a.reduce((x, y) => x + y, 0) / a.length;

  /* Reasoning score for "spot the technique".
     Right technique: 60 + up to 40 for the signals you caught. Wrong technique: at most 15 (a good read is not nothing, but it must not
     outscore the right answer). Keys match on word boundaries so 'or' can never match 'for'. */
  function norm(t) { return String(t).toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim(); }
  const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function hasKey(normText, key) {
    const k = norm(key); if (!k) return false;
    const short = !k.includes(' ') && k.length <= 4; // short words must match whole; longer ones match as a prefix (agree -> agrees)
    return new RegExp('(^| )' + reEsc(k) + (short ? '( |$)' : ''), 'i').test(normText);
  }
  function scoreReasoning(text, keys, correct) {
    const n = norm(text);
    const hits = [...new Set(keys.filter(k => hasKey(n, k)))];
    const frac = Math.min(hits.length, 3) / 3;
    return { pts: correct ? 60 + Math.round(frac * 40) : Math.round(frac * 15), hits };
  }

  /* Skill index used for trends: levels are folded in so levelling up never looks like "slipping". */
  function skillOf(r) {
    let d = {}; try { d = JSON.parse(r.detail); } catch { }
    const s = +r.score;
    if (r.activity === 'nback') return (d.n || 1) + (s - 50) / 100;   // s is balanced accuracy, 50 = chance
    if (r.activity === 'math') return (d.level || 1) + Math.min(s, 25) / 25;
    return s;
  }
  /* One value per day (the best), oldest first. Retries on the same day cannot inflate a trend. */
  function dailySeries(records, activity) {
    const best = {};
    records.filter(r => r.activity === activity).forEach(r => { const v = skillOf(r); if (!(r.date in best) || v > best[r.date]) best[r.date] = v; });
    return Object.keys(best).sort().map(d => best[d]);
  }

  /* Trend: needs >= minRuns scores; compares first 3 vs latest 3 averages, +/-5% counts as steady. */
  function trendOf(scores, minRuns = 4) {
    if (scores.length < minRuns) return { trend: null, pct: 0 };
    const f = avg(scores.slice(0, 3)), l = avg(scores.slice(-3));
    const pct = f ? (l - f) / f * 100 : 0;
    return { trend: pct >= 5 ? 'up' : pct <= -5 ? 'down' : 'flat', pct };
  }

  /* Streak: consecutive days (ending today, or yesterday if today is not yet qualifying) with >= minActs distinct activities. */
  function streakOf(records, todayIso, minActs = 3) {
    const by = {}; records.forEach(r => { (by[r.date] ||= new Set()).add(r.activity); });
    const ok = d => (by[d] ? by[d].size : 0) >= minActs;
    let d = todayIso; if (!ok(d)) d = addDays(d, -1);
    let s = 0; while (ok(d)) { s++; d = addDays(d, -1); }
    return s;
  }

  /* Flashcard scheduling (SM-2 flavoured). q: 0 again, 1 good, 2 easy. Returns a new card; requeue=true if it should be shown again today. */
  function sm2(card, q, todayIso) {
    const c = { ...card };
    if (q === 0) { c.reps = 0; c.interval = 0; c.ease = Math.max(1.3, +(c.ease - 0.2).toFixed(2)); c.due = todayIso; return { card: c, requeue: true }; }
    c.reps++;
    c.interval = c.reps === 1 ? (q === 2 ? 3 : 1) : c.reps === 2 ? (q === 2 ? 8 : 4) : Math.max(1, Math.round(c.interval * c.ease * (q === 2 ? 1.3 : 1)));
    if (q === 2) c.ease = +(c.ease + 0.1).toFixed(2);
    c.due = addDays(todayIso, c.interval);
    return { card: c, requeue: false };
  }

  /* CSV: RFC-4180 style, with spreadsheet-formula guard (leading = + - @ gets a ' prefix, removed again on read). */
  function csvCell(v) {
    let s = v == null ? '' : String(v);
    if (/^[=+\-@]/.test(s)) s = "'" + s;
    return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  const csvLine = (headers, o) => headers.map(k => csvCell(o[k])).join(',') + '\n';
  function parseCsv(text) {
    const rows = []; let row = [], f = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
      else if (c === '"') q = true;
      else if (c === ',') { row.push(f); f = ''; }
      else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
      else if (c !== '\r') f += c;
    }
    if (f || row.length) { row.push(f); rows.push(row); }
    if (!rows.length) return [];
    const head = rows.shift();
    return rows.filter(r => r.length > 1).map(r => Object.fromEntries(head.map((k, i) => [k, (r[i] || '').replace(/^'([=+\-@])/, '$1')])));
  }
  return { addDays, isoOf, avg, norm, hasKey, skillOf, dailySeries, scoreReasoning, trendOf, streakOf, sm2, csvCell, csvLine, parseCsv };
});
