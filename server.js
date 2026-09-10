const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const JFF_PATH = path.join(__dirname, 'dfa', 'password_validator_9_state_Final.jff');

function loadDFA(filePath) {
  const xml = fs.readFileSync(filePath, 'utf8');
  const cleanXml = xml.replace(/&#13;/g, '');
  const finalStates = new Set();
  const transitions = new Map();

  const stateRegex = /<state\s+id="([^"]+)"\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/state>/g;
  let match;
  while ((match = stateRegex.exec(cleanXml))) { 
    const [, id, name, body] = match;
    if (body.includes('<final')) finalStates.add(name);
  }

  const transitionRegex = /<transition>\s*<from>([^<]+)<\/from>\s*<to>([^<]+)<\/to>\s*<read>([^<]*)<\/read>\s*<\/transition>/g;
    while ((match = transitionRegex.exec(cleanXml))) {
    const [, fromId, toId, symbol] = match;
    const key = `${fromId}:${symbol}`;
    transitions.set(key, toId);
  }

  const stateNames = {};
  const nameRegex = /<state\s+id="([^"]+)"\s+name="([^"]+)"/g;
  while ((match = nameRegex.exec(xml))) stateNames[match[1]] = match[2];

  return { transitions, finalStates, stateNames };
}

const dfa = loadDFA(JFF_PATH);

function classify(ch) {
  if (/^[A-Z]$/.test(ch)) return 'U';
  if (/^[a-z]$/.test(ch)) return 'L';
  if (/^[0-9]$/.test(ch)) return 'D';
  return 'X';
}

function runDFA(password) {
  let stateId = '0';
  const trace = [{ character: '', symbol: 'START', from: '', to: dfa.stateNames[stateId] || 'q0' }];

  for (const ch of password) {
    const symbol = classify(ch);
    const fromName = dfa.stateNames[stateId] || `state${stateId}`;

    if (symbol === 'X') {
      trace.push({ character: ch, symbol, from: fromName, to: 'qDead' });
      return { accepted: false, finalState: 'qDead', trace };
    }

    const nextId = dfa.transitions.get(`${stateId}:${symbol}`);
    if (nextId === undefined) {
      trace.push({ character: ch, symbol, from: fromName, to: 'qDead' });
      return { accepted: false, finalState: 'qDead', trace };
    }

    const toName = dfa.stateNames[nextId] || `state${nextId}`;
    trace.push({ character: ch, symbol, from: fromName, to: toName });
    stateId = nextId;
  }

  const finalState = dfa.stateNames[stateId] || `state${stateId}`;
  return { accepted: dfa.finalStates.has(finalState), finalState, trace };
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*'
  });
  res.end(body);
}

function serveStatic(req, res) {
  let requested = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  requested = decodeURIComponent(requested);
  const filePath = path.normalize(path.join(PUBLIC_DIR, requested));
  if (!filePath.startsWith(PUBLIC_DIR)) return sendJson(res, 403, { error: 'Forbidden' });

  fs.readFile(filePath, (err, data) => {
    if (err) return sendJson(res, 404, { error: 'Not found' });
    const ext = path.extname(filePath).toLowerCase();
    const types = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, GET, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
    return res.end();
  }

  if (req.method === 'GET' && req.url === '/api/dfa') {
    return sendJson(res, 200, {
      states: Object.values(dfa.stateNames),
      startState: dfa.stateNames['0'],
      acceptingStates: [...dfa.finalStates],
      alphabet: ['U', 'L', 'D'],
      policy: 'Minimum 8 characters; letters and digits only.'
    });
  }

  if (req.method === 'POST' && req.url === '/api/validate') {
    let body = '';
    req.on('data', chunk => { body += chunk; if (body.length > 10000) req.destroy(); });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        if (typeof payload.password !== 'string') return sendJson(res, 400, { error: 'password must be a string' });
        const result = runDFA(payload.password);
        return sendJson(res, 200, result);
      } catch {
        return sendJson(res, 400, { error: 'Invalid JSON' });
      }
    });
    return;
  }

  if (req.method === 'GET') return serveStatic(req, res);
  return sendJson(res, 405, { error: 'Method not allowed' });
});

server.listen(PORT, () => {
  console.log(`Secure Password Validator running at http://localhost:${PORT}`);
});
