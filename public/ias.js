'use strict';
/* Answer-writing logic (pure, tested). Questions come from ias-bank.js; the /rotate-questions skill swaps in a new batch. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.IAS = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const words = t => { t = String(t || '').trim(); return t ? t.split(/\s+/).length : 0; };

  /* Today's questions: only the active batch, never the same paper twice in a row, unanswered first,
     then the longest-ago answered. Stable for the whole day (seeded by dayNo), so a refresh shows the same ones. */
  function pickToday(bank, active, answered, dayNo, n = 2) {
    let pool = bank.filter(q => q.batch === active);
    if (!pool.length) pool = bank.slice();                      // never show an empty screen
    const last = {}; (answered || []).forEach(a => { if (a && a.id) last[a.id] = Math.max(last[a.id] || 0, a.day || 0); });
    const rank = q => (q.id in last ? 1e6 + last[q.id] : 0) + ((hash(q.id) + dayNo) % 97) / 100;
    const sorted = pool.slice().sort((a, b) => rank(a) - rank(b));
    const out = [];
    for (const q of sorted) { if (out.length >= n) break; if (!out.some(o => o.paper === q.paper) || sorted.length <= n) out.push(q); }
    for (const q of sorted) { if (out.length >= n) break; if (!out.includes(q)) out.push(q); }
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
  return { words, pickToday, selfScore, limitState };
});
