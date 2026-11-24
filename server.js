// Brain Gym — zero-dependency local server. Saves your data to ./data/*.csv
const http = require('http'), fs = require('fs'), path = require('path');
const PORT = process.env.PORT || 3000;
const ROOT = path.join(__dirname, 'public'), DATA = process.env.DATA_DIR || path.join(__dirname, 'data');
const RF = path.join(DATA, 'records.csv'), CF = path.join(DATA, 'cards.csv');
const RH = ['id', 'timestamp', 'date', 'activity', 'score', 'detail'];
const CH = ['id', 'front', 'back', 'due', 'interval', 'ease', 'reps'];
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };

const { csvLine: line, parseCsv } = require('./public/logic.js');
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
    let p; try { p = path.normalize(decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)); } catch { res.writeHead(400); return res.end('Bad request'); }
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  } catch (e) { json(res, e instanceof SyntaxError ? 400 : 500, { error: String(e.message || e) }); }
}).listen(PORT, '127.0.0.1', () => console.log(`🧠 Brain Gym running → http://localhost:${PORT}\n   Data saved to ${DATA}`));
