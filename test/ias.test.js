const test = require('node:test'), assert = require('node:assert/strict');
const { IAS_BANK, IAS_ACTIVE } = require('../public/ias-bank.js'); const IAS = require('../public/ias.js');

test('bank is well-formed and ids are unique', () => {
  const ids = new Set();
  for (const q of IAS_BANK) {
    assert.ok(!ids.has(q.id), 'dup ' + q.id); ids.add(q.id);
    assert.ok(Number.isInteger(q.batch) && q.paper && q.topic && [10, 15, 20].includes(q.marks) && q.words >= 150, q.id);
    assert.ok(q.q.length > 60, q.id + ' question too short');
    assert.ok(q.dims.length >= 3 && q.pts.length >= 5 && q.pts.length <= 8, q.id + ' needs 3+ dims and 5-8 points');
  }
});
test('active batch has enough questions and a mix of papers', () => {
  const act = IAS_BANK.filter(q => q.batch === IAS_ACTIVE);
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
