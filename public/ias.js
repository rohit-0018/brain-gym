'use strict';
/* Answer-writing logic (pure, tested). Questions come from ias-bank.js; the /rotate-questions skill swaps in a new batch. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.IAS = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const words = t => { t = String(t || '').trim(); return t ? t.split(/\s+/).length : 0; };

  /* Today's questions: only the active batch, never the same paper twice in a row, unanswered first,
     then the longest-ago answered. Stable for the whole day (seeded by dayNo), so a refresh shows the same ones. */
  function pickToday(bank, active, answered, dayNo, n = 2) {
    let pool = bank.filter(q => q.batch === active && (q.type || 'mains') === 'mains');
    if (!pool.length) pool = bank.slice();                      // never show an empty screen
    const last = {}; (answered || []).forEach(a => { if (a && a.id) last[a.id] = Math.max(last[a.id] || 0, a.day || 0); });
    const rank = q => (q.id in last ? 1e6 + last[q.id] : 0) + ((hash(q.id) + dayNo) % 97) / 100;
    const sorted = pool.slice().sort((a, b) => rank(a) - rank(b));
    const out = [];
    for (const q of sorted) { if (out.length >= n) break; if (!out.some(o => o.paper === q.paper) || sorted.length <= n) out.push(q); }
    for (const q of sorted) { if (out.length >= n) break; if (!out.includes(q)) out.push(q); }
    return out;
  }
  /* Daily session picker. Rules, in order of importance:
     1. Only the active batch (the /rotate-questions skill swaps it).
     2. Spaced repetition: a question you MISSED comes back the next day; one you got right waits 7+ days.
     3. Never-seen questions beat questions that are not yet due.
     4. Balance: each extra question from a subject already chosen today loses 1.2 points, so the session spans subjects.
     5. Difficulty adapts: accuracy under 55% favours easy, over 75% favours hard.
     6. Nothing answered today repeats unless the pool is exhausted. A small seeded jitter keeps it stable all day. */
  function pickSession(bank, active, hist, dayNo, counts) {
    counts = counts || { mcq: 6, case: 2 };
    const all = Object.values(hist || {}), att = all.reduce((x, e) => x + e.n, 0), ok = all.reduce((x, e) => x + e.ok, 0);
    const acc = att >= 6 ? ok / att : .65, target = acc < .55 ? 1.5 : acc > .75 ? 2.5 : 2;
    const out = [];
    for (const type of ['mcq', 'case']) {
      let pool = bank.filter(q => q.batch === active && q.type === type); if (!pool.length) pool = bank.filter(q => q.type === type);
      const chosen = [], subj = {};
      const weigh = q => {
        const e = hist && hist[q.id], age = e ? dayNo - e.last : 0; let w, reason;
        if (!e) { w = 3; reason = 'New'; }
        else if (age < 1) { w = -50; reason = 'Seen today'; }
        else if (!e.lastOk) { w = 5 + Math.min(age, 10) * .3; reason = 'You missed this last time'; }
        else if (age >= 7) { w = 1 + (age - 7) * .05; reason = 'Revisit: it is due'; }
        else { w = -2; reason = 'Revisit'; }
        w -= Math.abs((q.diff || 2) - target) * .6; w += ((hash(q.id) + dayNo * 7) % 100) / 100 * .9;
        return { w, reason };
      };
      while (chosen.length < Math.min(counts[type] || 0, pool.length)) {
        let best = null;
        for (const q of pool) { if (chosen.some(c => c.q === q)) continue; const r = weigh(q), w = r.w - 1.2 * (subj[q.subject] || 0); if (!best || w > best.w) best = { q, w, reason: r.reason }; }
        chosen.push(best); subj[best.q.subject] = (subj[best.q.subject] || 0) + 1;
      }
      out.push(...chosen.map(c => ({ q: c.q, reason: c.reason })));
    }
    return out;
  }
  function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }

  /* Self-marking: you tick the model points your answer actually covered. Score is the share ticked, nudged down if far over the limit. */
  function selfScore(ticked, total, wordCount, limit) {
    if (!total) return 0;
    let s = (ticked / total) * 100;
    if (limit && wordCount > limit * 1.4) s -= 10;               // UPSC penalises overshoot; so do we, gently
    return Math.max(0, Math.round(s));
  }
  function limitState(wordCount, limit) {
    if (wordCount === 0) return { cls: '', msg: `Aim for about ${limit} words.` };
    if (wordCount < limit * .6) return { cls: '', msg: `${wordCount} words. Keep going, aim for about ${limit}.` };
    if (wordCount <= limit * 1.15) return { cls: 'ok', msg: `${wordCount} words. Right on target.` };
    return { cls: 'over', msg: `${wordCount} words. Over the limit of ${limit}, so tighten it.` };
  }
  /* Per-subject accuracy from stored session results (pts >= 60 counts as on target). Weakest first. */
  function subjectStats(results) {
    const by = {};
    (results || []).forEach(x => { if (!x || !x.subject) return; const e = by[x.subject] ||= { subject: x.subject, n: 0, ok: 0 }; e.n++; e.ok += x.pts >= 60 ? 1 : 0; });
    return Object.values(by).map(e => ({ ...e, pct: Math.round(e.ok / e.n * 100) })).sort((a, b) => a.pct - b.pct || b.n - a.n);
  }
  return { subjectStats, words, pickToday, pickSession, selfScore, limitState };
});
