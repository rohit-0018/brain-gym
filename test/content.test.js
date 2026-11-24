const test = require('node:test'), assert = require('node:assert/strict');
const { TECH, SCEN, CONF, FAIR, shortName } = require('../public/manip.js'); const L = require('../public/logic.js');

test('every technique is complete', () => {
  const ids = new Set();
  for (const t of TECH) {
    assert.ok(!ids.has(t.id), 'dup ' + t.id); ids.add(t.id);
    assert.ok(t.name && t.def && t.src && t.counter && t.signs.length >= 3, t.id);
    assert.ok(['A', 'B', 'C'].includes(t.g), t.id);
  }
});
test('scenario ids unique, technique valid, enough per technique, both difficulty levels', () => {
  const ids = new Set(), per = {};
  for (const s of SCEN) {
    assert.ok(!ids.has(s.id), 'dup ' + s.id); ids.add(s.id);
    assert.ok(s.t === 'fair' || TECH.some(t => t.id === s.t), s.id);
    per[s.t] = (per[s.t] || 0) + 1; assert.ok(s.text.length > 40 && s.why.length > 30, s.id);
  }
  for (const t of TECH) { assert.ok(per[t.id] >= 4, t.id + ' has ' + per[t.id]); assert.ok(SCEN.some(s => s.t === t.id && s.lvl === 2), t.id + ' lacks a hard one'); }
  assert.ok(per.fair >= 5, 'need negative controls');
});
test('confusables reference real techniques and never themselves', () => {
  for (const t of TECH) { assert.ok(CONF[t.id] && CONF[t.id].length >= 2, t.id); for (const c of CONF[t.id]) { assert.ok(TECH.some(x => x.id === c) && c !== t.id, t.id + '->' + c); } }
});
test('option labels are similar in length (no giveaway)', () => {
  const lens = TECH.map(t => shortName(t).length); assert.ok(Math.max(...lens) - Math.min(...lens) <= 24, lens.join());
});
test('model answer + situation text must be able to earn full marks (keys reachable)', () => {
  for (const s of SCEN) {
    const r = L.scoreReasoning(s.why + ' ' + s.text, s.keys, true);
    assert.ok(r.hits.length >= 3, `${s.id}: only ${r.hits.length} key hits: ${r.hits}`);
    assert.ok(s.keys.length >= 5, `${s.id} has ${s.keys.length} keys`);
  }
});
test('keys are not satisfied by generic filler or by the wrong technique\'s model answer', () => {
  const filler = 'I think this is manipulation because the person wants something from me and is being sneaky about it, for more than one reason, right now';
  for (const s of SCEN) assert.ok(L.scoreReasoning(filler, s.keys, false).hits.length < 2, s.id + ' keys too generic');
});
test('each technique has same-group distractors available', () => {
  for (const t of TECH) assert.ok(TECH.filter(x => x.g === t.g && x.id !== t.id).length >= 2, t.id);
});
