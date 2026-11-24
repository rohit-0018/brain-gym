// Brain Gym — zero-dependency local server. Saves your data to ./data/*.csv
const http = require('http'), fs = require('fs'), path = require('path');
const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, 'public'), DATA = path.join(__dirname, 'data');
const RF = path.join(DATA, 'records.csv'), CF = path.join(DATA, 'cards.csv');
const RH = ['id', 'timestamp', 'date', 'activity', 'score', 'detail'];
const CH = ['id', 'front', 'back', 'due', 'interval', 'ease', 'reps'];
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };

// CSV helpers (quotes/newlines safe; guards against spreadsheet formula injection)
const esc = v => {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const line = (h, o) => h.map(k => esc(o[k])).join(',') + '\n';
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
const read = (file) => fs.existsSync(file) ? parseCsv(fs.readFileSync(file, 'utf8')) : [];
fs.mkdirSync(DATA, { recursive: true });

function body(req) {
  return new Promise((res, rej) => {
    let b = ''; req.on('data', d => { b += d; if (b.length > 2e6) { rej(new Error('too large')); req.destroy(); } });
    req.on('end', () => { try { res(JSON.parse(b || 'null')); } catch (e) { rej(e); } });
  });
}
const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (url.pathname === '/api/records') {
      if (req.method === 'GET') return json(res, 200, read(RF));
      if (req.method === 'POST') {
        const list = await body(req); if (!Array.isArray(list)) return json(res, 400, { error: 'array expected' });
        const have = new Set(read(RF).map(r => r.id));
        const fresh = list.filter(r => r && r.id && !have.has(String(r.id)));
        if (!fs.existsSync(RF)) fs.writeFileSync(RF, RH.join(',') + '\n');
        fs.appendFileSync(RF, fresh.map(r => line(RH, r)).join(''));
        return json(res, 200, { added: fresh.length });
      }
    }
    if (url.pathname === '/api/cards') {
      if (req.method === 'GET') return json(res, 200, read(CF));
      if (req.method === 'POST') {
        const list = await body(req); if (!Array.isArray(list)) return json(res, 400, { error: 'array expected' });
        fs.writeFileSync(CF, CH.join(',') + '\n' + list.map(r => line(CH, r)).join(''));
        return json(res, 200, { saved: list.length });
      }
    }
    if (req.method !== 'GET') return json(res, 405, { error: 'method' });
    let p = path.normalize(decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  } catch (e) { json(res, 500, { error: String(e.message || e) }); }
}).listen(PORT, '127.0.0.1', () => console.log(`🧠 Brain Gym running → http://localhost:${PORT}\n   Data saved to ${DATA}`));
