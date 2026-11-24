const test = require('node:test'), assert = require('node:assert/strict');
const { spawn } = require('node:child_process'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
let proc, base, dir;
test.before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bg-')); const port = 4100 + Math.floor(Math.random() * 500); base = `http://127.0.0.1:${port}`;
  proc = spawn('node', [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT: port, DATA_DIR: dir } });
  for (let i = 0; i < 40; i++) { try { await fetch(base + '/api/records'); return; } catch { await new Promise(r => setTimeout(r, 100)); } }
  throw new Error('server did not start');
});
test.after(() => { proc.kill(); fs.rmSync(dir, { recursive: true, force: true }); });
const post = (u, b) => fetch(base + u, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b) });

test('records append, dedupe by id, and survive weird text', async () => {
  const rec = { id: 'a1', timestamp: 't', date: '2026-11-24', activity: 'manip', score: 80, detail: '{"x":"=1+1, \\"q\\"\\nz"}' };
  assert.equal((await (await post('/api/records', [rec])).json()).added, 1);
  assert.equal((await (await post('/api/records', [rec, { ...rec, id: 'a2' }])).json()).added, 1);
  const back = await (await fetch(base + '/api/records')).json();
  assert.equal(back.length, 2); assert.equal(back[0].detail, rec.detail);
});
test('cards overwrite wholesale', async () => {
  await post('/api/cards', [{ id: 'c1', front: 'f', back: 'b', due: 'd', interval: 1, ease: 2.5, reps: 1 }]);
  await post('/api/cards', []);
  assert.deepEqual(await (await fetch(base + '/api/cards')).json(), []);
});
test('rejects bad bodies and path traversal; serves static files', async () => {
  assert.equal((await post('/api/records', { not: 'array' })).status, 400);
  const bad = await fetch(base + '/api/records', { method: 'POST', body: '{nope' }); assert.equal(bad.status, 400);
  assert.equal((await fetch(base + '/%2e%2e/server.js')).status, 404);
  assert.equal((await fetch(base + '/')).status, 200);
  assert.equal((await fetch(base + '/app.js')).headers.get('content-type'), 'text/javascript');
});
