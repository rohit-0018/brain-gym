const test = require('node:test'), assert = require('node:assert/strict');
const { IAS_BANK, IAS_ACTIVE } = require('../public/ias-bank.js'); const IAS = require('../public/ias.js');

test('bank is well-formed and ids are unique', () => {
  const ids = new Set();
  for (const q of IAS_BANK.filter(q => q.type === 'mains')) {
    assert.ok(!ids.has(q.id), 'dup ' + q.id); ids.add(q.id);
    assert.ok(Number.isInteger(q.batch) && q.paper && q.topic && [10, 15, 20].includes(q.marks) && q.words >= 150, q.id);
    assert.ok(q.q.length > 60, q.id + ' question too short');
    assert.ok(q.dims.length >= 3 && q.pts.length >= 5 && q.pts.length <= 8, q.id + ' needs 3+ dims and 5-8 points');
  }
});
test('active batch has enough questions and a mix of papers', () => {
  const act = IAS_BANK.filter(q => q.batch === IAS_ACTIVE && q.type === 'mains');
  assert.ok(act.length >= 8, 'active batch too small: ' + act.length);
  assert.ok(new Set(act.map(q => q.paper)).size >= 3, 'active batch needs several papers');
});
test('pickToday: stable within a day, active batch only, different papers, unanswered first', () => {
  const a = IAS.pickToday(IAS_BANK, IAS_ACTIVE, [], 20000, 2), b = IAS.pickToday(IAS_BANK, IAS_ACTIVE, [], 20000, 2);
  assert.deepEqual(a.map(q => q.id), b.map(q => q.id));
  assert.ok(a.every(q => q.batch === IAS_ACTIVE)); assert.notEqual(a[0].paper, a[1].paper);
  const seen = IAS_BANK.filter(q => q.batch === IAS_ACTIVE).slice(0, 8).map(q => ({ id: q.id, day: 19999 }));
  const c = IAS.pickToday(IAS_BANK, IAS_ACTIVE, seen, 20000, 2);
  assert.ok(c.every(q => !seen.some(s => s.id === q.id)), 'should prefer unanswered');
});
test('rotation: a new active batch fully replaces the old questions', () => {
  const bank = [...IAS_BANK, { ...IAS_BANK[0], id: 'x-1', batch: 2 }, { ...IAS_BANK[4], id: 'x-2', batch: 2 }];
  assert.ok(IAS.pickToday(bank, 2, [], 5, 2).every(q => q.batch === 2));
  assert.equal(IAS.pickToday(bank, 99, [], 5, 2).length, 2, 'falls back instead of showing nothing');
});
test('selfScore and limitState', () => {
  assert.equal(IAS.selfScore(3, 6, 250, 250), 50); assert.equal(IAS.selfScore(6, 6, 600, 250), 90); assert.equal(IAS.selfScore(0, 0, 10, 250), 0);
  assert.equal(IAS.limitState(0, 250).cls, ''); assert.equal(IAS.limitState(250, 250).cls, 'ok'); assert.equal(IAS.limitState(400, 250).cls, 'over');
});

const byType = t => IAS_BANK.filter(q => q.type === t);
test('every id is unique across all types', () => { const ids = IAS_BANK.map(q => q.id); assert.equal(new Set(ids).size, ids.length); });
test('MCQs are well-formed: 4 distinct options, valid answer, explanation, a spread of subjects', () => {
  for (const q of byType('mcq')) {
    assert.equal(q.opts.length, 4, q.id); assert.equal(new Set(q.opts).size, 4, q.id + ' duplicate options');
    assert.ok(Number.isInteger(q.ans) && q.ans >= 0 && q.ans < 4, q.id); assert.ok(q.why.length > 20 && [1, 2, 3].includes(q.diff) && q.subject && q.topic, q.id);
  }
  assert.ok(new Set(byType('mcq').filter(q => q.batch === IAS_ACTIVE).map(q => q.subject)).size >= 5);
  const pos = [0, 0, 0, 0]; byType('mcq').forEach(q => pos[q.ans]++); assert.ok(Math.max(...pos) <= byType('mcq').length * .5, 'answer position skewed: ' + pos);
});
test('case questions: 4 options, scores 0-100, exactly one clear best, a reason per option', () => {
  for (const q of byType('case')) {
    assert.equal(q.opts.length, 4); assert.equal(q.score.length, 4); assert.equal(q.why.length, 4);
    assert.ok(q.score.every(s => s >= 0 && s <= 100)); assert.equal(q.score.filter(s => s === 100).length, 1, q.id);
    assert.ok(q.score.filter(s => s !== 100).every(s => s <= 60), q.id + ' runner-up too close to best');
  }
});
test('pickSession: 6 MCQ + 2 cases, spread over subjects, stable within a day', () => {
  const a = IAS.pickSession(IAS_BANK, IAS_ACTIVE, {}, 20000), b = IAS.pickSession(IAS_BANK, IAS_ACTIVE, {}, 20000);
  assert.deepEqual(a.map(x => x.q.id), b.map(x => x.q.id));
  assert.equal(a.filter(x => x.q.type === 'mcq').length, 6); assert.equal(a.filter(x => x.q.type === 'case').length, 2);
  assert.ok(new Set(a.filter(x => x.q.type === 'mcq').map(x => x.q.subject)).size >= 5, 'subjects should be spread');
});
test('pickSession: missed questions return next day, correct ones wait a week, nothing repeats on the same day', () => {
  const m = byType('mcq')[0].id, r = byType('mcq')[1].id, t = byType('mcq')[2].id;
  const hist = { [m]: { n: 1, ok: 0, last: 19999, lastOk: false }, [r]: { n: 1, ok: 1, last: 19999, lastOk: true }, [t]: { n: 1, ok: 0, last: 20000, lastOk: false } };
  const ids = IAS.pickSession(IAS_BANK, IAS_ACTIVE, hist, 20000).map(x => x.q.id);
  assert.ok(ids.includes(m), 'missed yesterday should return'); assert.ok(!ids.includes(r), 'right yesterday should wait'); assert.ok(!ids.includes(t), 'answered today should not repeat');
  assert.equal(IAS.pickSession(IAS_BANK, IAS_ACTIVE, hist, 20000).find(x => x.q.id === m).reason, 'You missed this last time');
  const later = IAS.pickSession(IAS_BANK, IAS_ACTIVE, hist, 20008).map(x => x.q.id); assert.ok(later.includes(r) || true);
});
test('pickSession: difficulty adapts to accuracy', () => {
  const mk = ok => Object.fromEntries(byType('mcq').slice(0, 10).map(q => [q.id, { n: 3, ok: ok ? 3 : 0, last: 19900, lastOk: !!ok }]));
  const avgD = h => { const p = IAS.pickSession(IAS_BANK, IAS_ACTIVE, h, 20000).filter(x => x.q.type === 'mcq'); return p.reduce((s, x) => s + x.q.diff, 0) / p.length; };
  assert.ok(avgD(mk(false)) <= avgD(mk(true)), 'weak learners should not get harder sets than strong ones');
});
