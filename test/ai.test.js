const test = require('node:test'), assert = require('node:assert/strict');
const AI = require('../public/ai.js'), L = require('../public/logic.js');

test('anthropic request: right endpoint, headers, body; key only in header', () => {
  const r = AI.buildRequest({ provider: 'anthropic', key: 'sk-ant-SECRET', model: 'm1' }, 'sys', [{ role: 'user', content: 'hi' }], 300);
  assert.equal(r.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(r.init.headers['x-api-key'], 'sk-ant-SECRET'); assert.equal(r.init.headers['anthropic-dangerous-direct-browser-access'], 'true'); assert.ok(r.init.headers['anthropic-version']);
  const b = JSON.parse(r.init.body); assert.equal(b.model, 'm1'); assert.equal(b.max_tokens, 300); assert.equal(b.system, 'sys'); assert.ok(!r.init.body.includes('SECRET') && !r.url.includes('SECRET'));
});
test('openai request: bearer auth, system message first', () => {
  const r = AI.buildRequest({ provider: 'openai', key: 'sk-SECRET', model: 'm2' }, 'sys', [{ role: 'user', content: 'hi' }]);
  assert.equal(r.url, 'https://api.openai.com/v1/chat/completions'); assert.equal(r.init.headers.Authorization, 'Bearer sk-SECRET');
  const b = JSON.parse(r.init.body); assert.deepEqual(b.messages[0], { role: 'system', content: 'sys' }); assert.ok(!r.init.body.includes('SECRET'));
});
test('response parsing for both providers; empty answers are errors', () => {
  assert.equal(AI.parseResponse('anthropic', { content: [{ type: 'text', text: ' hello ' }, { type: 'tool_use' }] }), 'hello');
  assert.equal(AI.parseResponse('openai', { choices: [{ message: { content: 'yo' } }] }), 'yo');
  assert.throws(() => AI.parseResponse('anthropic', { content: [] })); assert.throws(() => AI.parseResponse('openai', {})); assert.throws(() => AI.parseResponse('openai', null));
});
test('error messages are friendly and never echo secrets', () => {
  assert.match(AI.friendly(401), /rejected the key/); assert.match(AI.friendly(429), /Rate limit/); assert.match(AI.friendly(404), /Model not found/);
  assert.ok(AI.friendly(500, 'x'.repeat(1000)).length < 300);
});
test('markdown renderer escapes HTML first (no injection from model or user text)', () => {
  const h = AI.mdToHtml('<img src=x onerror=alert(1)> **bold**\n- one\n- <script>x</script>\n\nplain "q"');
  assert.ok(!/<img|<script/i.test(h)); assert.ok(h.includes('&lt;img')); assert.ok(h.includes('<b>bold</b>')); assert.equal((h.match(/<li>/g) || []).length, 2); assert.ok(h.includes('<ul>'));
});
test('config storage: nothing without a key, validation, remove clears', () => {
  const mem = () => { const m = {}; return { getItem: k => m[k] ?? null, setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; } }; };
  global.sessionStorage = mem(); global.localStorage = mem();
  assert.equal(AI.getCfg(), null); assert.equal(AI.configured(), false);
  assert.throws(() => AI.setCfg({ provider: 'nope', key: 'k' })); assert.throws(() => AI.setCfg({ provider: 'openai', key: '  ' }));
  AI.setCfg({ provider: 'openai', key: ' sk-1 ', model: '' }); const c = AI.getCfg(); assert.equal(c.key, 'sk-1'); assert.equal(c.model, 'gpt-4o-mini'); assert.equal(c.remember, false);
  assert.equal(localStorage.getItem('braingym.ai.v1'), null);           // session-only by default
  AI.setCfg({ provider: 'anthropic', key: 'k2', remember: true }); assert.equal(AI.getCfg().remember, true); assert.equal(sessionStorage.getItem('braingym.ai.v1'), null);
  AI.clearCfg(); assert.equal(AI.configured(), false);
});
test('ask(): sends the request and returns text; maps HTTP errors', async () => {
  global.sessionStorage = { getItem: () => JSON.stringify({ provider: 'anthropic', key: 'k', model: 'm' }), setItem() { }, removeItem() { } }; global.localStorage = { getItem: () => null, setItem() { }, removeItem() { } };
  let seen; global.fetch = async (u, init) => { seen = { u, init }; return { ok: true, json: async () => ({ content: [{ type: 'text', text: 'advice' }] }) }; };
  assert.equal(await AI.ask('s', [{ role: 'user', content: 'q' }]), 'advice'); assert.equal(seen.u, 'https://api.anthropic.com/v1/messages');
  global.fetch = async () => ({ ok: false, status: 401, json: async () => ({ error: { message: 'bad' } }) });
  await assert.rejects(AI.ask('s', []), /rejected the key/);
  global.fetch = async () => { throw new Error('offline'); }; await assert.rejects(AI.ask('s', []), /Network error/);
});
test('prompts carry the data as fenced JSON and the system prompt guards against misuse', () => {
  assert.ok(AI.reviewPrompt({ a: 1 }, [], 'Q?').includes('```json')); assert.match(AI.SYSTEM, /untrusted/); assert.match(AI.SYSTEM, /not how to manipulate/);
});

test('coachFacts: confusions, over-trusting/suspicious, reasoning length, consistency', () => {
  const nm = id => id; const res = (date, hr, arr) => ({ activity: 'manip', date, timestamp: `${date}T${String(hr).padStart(2, '0')}:00:00`, detail: JSON.stringify({ results: arr }) });
  const x = (id, tid, chosen, reason = 'a b c d e f g h') => ({ id, tid, correct: tid === chosen, chosen, reason });
  const recs = [res('2026-11-20', 9, [x('a', 'reciprocity', 'guilt'), x('b', 'reciprocity', 'guilt'), x('c', 'darvo', 'fair', 'short')]), res('2026-11-24', 20, [x('d', 'fair', 'scarcity'), x('e', 'proof', 'proof', 'one two three four five six seven eight nine ten')]), { activity: 'nback', date: '2026-11-22', timestamp: '2026-11-22T10:00:00', detail: '{}' }];
  const f = L.coachFacts(recs, nm, '2026-11-24');
  assert.equal(f.answers, 5); assert.equal(f.accuracyPct, 20); assert.deepEqual(f.topConfusions[0], { actual: 'reciprocity', chosen: 'guilt', times: 2 });
  assert.equal(f.overTrusting, 1); assert.equal(f.overSuspicious, 1);
  assert.ok(f.avgWordsWhenCorrect > f.avgWordsWhenWrong - 1); assert.equal(f.totalDays, 3); assert.equal(f.longestGapDays, 1); assert.equal(f.daysTrainedLast14, 3);
  const empty = L.coachFacts([], nm, '2026-11-24'); assert.equal(empty.answers, 0); assert.equal(empty.accuracyPct, null);
  assert.doesNotThrow(() => L.coachFacts([{ activity: 'manip', date: 'x', timestamp: 'bad', detail: '{"results":"nope"}' }, { activity: 'manip', date: 'y', timestamp: 'bad', detail: 'zzz' }], nm, '2026-11-24'));
});
