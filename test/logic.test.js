const test = require('node:test'), assert = require('node:assert/strict');
const L = require('../public/logic.js');

test('addDays crosses month/year/DST boundaries', () => {
  assert.equal(L.addDays('2026-12-31', 1), '2027-01-01');
  assert.equal(L.addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(L.addDays('2026-03-08', 1), '2026-03-09'); // US DST start
  assert.equal(L.addDays('2026-11-01', 1), '2026-11-02'); // US DST end
});
test('trend needs 4 runs and uses +/-5% band', () => {
  assert.equal(L.trendOf([1, 2, 3]).trend, null);
  assert.equal(L.trendOf([10, 10, 10, 12, 12, 12]).trend, 'up');
  assert.equal(L.trendOf([10, 10, 10, 10]).trend, 'flat');
  assert.equal(L.trendOf([10, 10, 10, 8, 8, 8]).trend, 'down');
  assert.equal(L.trendOf([0, 0, 0, 0]).trend, 'flat'); // no NaN on zero baseline
});
test('streak counts days with >=3 distinct activities; today may be pending', () => {
  const day = (d, acts) => acts.map(a => ({ date: d, activity: a }));
  const recs = [...day('2026-11-22', ['a', 'b', 'c']), ...day('2026-11-23', ['a', 'b', 'c', 'd']), ...day('2026-11-24', ['a'])];
  assert.equal(L.streakOf(recs, '2026-11-24'), 2); // today not yet qualifying, yesterday chain still counts
  recs.push(...day('2026-11-24', ['b', 'c']));
  assert.equal(L.streakOf(recs, '2026-11-24'), 3);
  assert.equal(L.streakOf([], '2026-11-24'), 0);
  assert.equal(L.streakOf(day('2026-11-24', ['a', 'a', 'a']), '2026-11-24'), 0); // same activity thrice != 3
});
test('SM-2: again requeues, good/easy grow intervals, ease floor', () => {
  let c = { reps: 0, interval: 0, ease: 2.5, due: '2026-11-24' };
  let r = L.sm2(c, 1, '2026-11-24'); assert.equal(r.card.interval, 1); assert.equal(r.card.due, '2026-11-25');
  r = L.sm2(r.card, 1, '2026-11-25'); assert.equal(r.card.interval, 4);
  r = L.sm2(r.card, 2, '2026-11-29'); assert.ok(r.card.interval >= 10);
  const lapsed = L.sm2(r.card, 0, '2026-12-10'); assert.equal(lapsed.requeue, true); assert.equal(lapsed.card.reps, 0);
  let low = { reps: 3, interval: 5, ease: 1.35, due: 'x' }; assert.equal(L.sm2(low, 0, '2026-11-24').card.ease, 1.3);
  assert.equal(L.sm2({ reps: 5, interval: 0, ease: 1.3, due: 'x' }, 1, '2026-11-24').card.interval >= 1, true); // never 0-day on pass
});
test('reasoning score: right technique 50 + up to 50, wrong technique capped at 15', () => {
  const keys = ['gift', 'owe', 'free', 'return'];
  assert.equal(L.scoreReasoning('Nothing relevant here at all really', keys, true).pts, 50);
  assert.equal(L.scoreReasoning('A FREE gift, so I owe them!', keys, true).pts, 100);
  assert.equal(L.scoreReasoning('A free gift', keys, false).pts, 10);
  assert.equal(L.scoreReasoning('free gift owe return', keys, false).pts, 15);
  assert.equal(L.scoreReasoning('x', keys, false).pts, 0);
  assert.equal(L.scoreReasoning("they didn’t say it", ["didn't"], false).hits.length, 1); // curly apostrophe
  assert.equal(L.scoreReasoning('they dont worry', ["don't worry"], false).hits.length, 1);   // missing apostrophe
  assert.equal(L.hasKey(L.norm('lend me $2,000 now'), '2000'), true);                            // digit-group commas
});
test('keys match on word boundaries: no substring gaming', () => {
  assert.equal(L.hasKey(L.norm('this is for more words'), 'or'), false);
  assert.equal(L.hasKey(L.norm('I know it'), 'now'), false);
  assert.equal(L.hasKey(L.norm('a gift came first'), 'gift'), true);
  assert.equal(L.hasKey(L.norm('he agrees with everything'), 'agree'), true);   // prefix for longer words
  assert.equal(L.hasKey(L.norm('they disagree'), 'agree'), false);             // but not mid-word
  assert.equal(L.hasKey(L.norm('my ex said so'), 'ex'), true);
  assert.equal(L.hasKey(L.norm('example text'), 'ex'), false);
  assert.equal(L.scoreReasoning('free free free gift', ['free', 'gift', 'owe'], true).hits.length, 2); // dupes count once
});
test('skill index: levelling up never reads as slipping; daily best only', () => {
  const nb = (date, n, s) => ({ date, activity: 'nback', score: s, detail: JSON.stringify({ n }) });
  assert.ok(L.skillOf(nb('d', 3, 55)) > L.skillOf(nb('d', 2, 100)));
  assert.ok(L.skillOf(nb('d', 2, 50)) < L.skillOf(nb('d', 2, 80)));
  const m = (date, level, s) => ({ date, activity: 'math', score: s, detail: JSON.stringify({ level }) });
  assert.ok(L.skillOf(m('d', 3, 6)) > L.skillOf(m('d', 2, 20)));
  const series = L.dailySeries([nb('2026-11-02', 2, 60), nb('2026-11-01', 2, 70), nb('2026-11-01', 2, 90)], 'nback');
  assert.equal(series.length, 2); assert.equal(series[0], 2.4); // sorted by date, best of the day
  assert.deepEqual(L.dailySeries([], 'nback'), []);
  const sp = (acc, rt) => ({ date: 'd', activity: 'stroop', score: acc, detail: JSON.stringify({ avgRtMs: rt }) });
  assert.ok(L.skillOf(sp(95, 700)) > L.skillOf(sp(95, 900)));  // faster at same accuracy = better
});
test('CSV round trip with quotes, commas, newlines, formula guard', () => {
  const H = ['id', 'detail']; const rows = [{ id: '1', detail: 'a,"b"\nc' }, { id: '2', detail: '=HYPERLINK("x")' }, { id: '3', detail: '' }];
  const csv = H.join(',') + '\n' + rows.map(r => L.csvLine(H, r)).join('');
  assert.ok(csv.includes("'=HYPERLINK"));
  assert.deepEqual(L.parseCsv(csv), rows);
  assert.deepEqual(L.parseCsv(''), []);
  assert.deepEqual(L.parseCsv('id,detail\r\n1,x\r\n'), [{ id: '1', detail: 'x' }]);
});
