const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const JFF_PATH = path.join(__dirname, 'dfa', 'password_validator_clean_8_state_Final_1245.jff');

function loadDFA(filePath) {
  const xml = fs.readFileSync(filePath, 'utf8').replace(/&#13;/g, '');

  const stateNames = {};
  const finalStates = new Set();
  const transitions = new Map();

  const stateRegex = /<state\s+id="([^"]+)"\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/state>/g;
  let match;

  while ((match = stateRegex.exec(xml))) {
    const [, id, name, body] = match;
    stateNames[id] = name;
    if (body.includes('<final')) finalStates.add(name);
  }

  const transitionRegex =
    /<transition>\s*<from>([^<]+)<\/from>\s*<to>([^<]+)<\/to>\s*<read>([^<]*)<\/read>\s*<\/transition>/g;

  while ((match = transitionRegex.exec(xml))) {
    const [, fromId, toId, read] = match;
    // The JFLAP file may group labels such as "U,L".
    for (const symbol of read.split(',').map(s => s.trim()).filter(Boolean)) {
      transitions.set(`${fromId}:${symbol}`, toId);
    }
  }

  return { stateNames, finalStates, transitions };
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
  const trace = [];

  for (let i = 0; i < password.length; i++) {
    const ch = password[i];
    const symbol = classify(ch);
    const from = dfa.stateNames[stateId] || `state${stateId}`;

    if (symbol === 'X') {
      trace.push({ position: i + 1, character: ch, symbol, from, to: 'qDead' });
      return {
        accepted: false,
        finalState: 'qDead',
        trace,
        reason: 'Only letters and digits are allowed.'
      };
    }

    const nextId = dfa.transitions.get(`${stateId}:${symbol}`);

    if (nextId === undefined) {
      trace.push({ position: i + 1, character: ch, symbol, from, to: 'qDead' });
      return {
        accepted: false,
        finalState: 'qDead',
        trace,
        reason: 'No DFA transition exists for this input.'
      };
    }

    const to = dfa.stateNames[nextId] || `state${nextId}`;
    trace.push({ position: i + 1, character: ch, symbol, from, to });
    stateId = nextId;
  }

  const finalState = dfa.stateNames[stateId] || `state${stateId}`;
  const categoryAccepted = dfa.finalStates.has(finalState);
  const lengthAccepted = password.length >= 8;

  let reason = 'Password accepted.';
  if (!lengthAccepted) {
    reason = 'Password must contain at least 8 characters.';
  } else if (!categoryAccepted) {
    reason = 'Password must contain at least 1 uppercase, 1 lowercase, and 1 digit.';
  }

  return {
    accepted: lengthAccepted && categoryAccepted,
    finalState,
    trace,
    length: password.length,
    lengthAccepted,
    categoryAccepted,
    reason
  };
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

  if (!filePath.startsWith(PUBLIC_DIR)) {
    return sendJson(res, 403, { error: 'Forbidden' });
  }

  fs.readFile(filePath, (err, data) => {
    if (err) return sendJson(res, 404, { error: 'Not found' });

    const types = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8'
    };

    res.writeHead(200, {
      'Content-Type': types[path.extname(filePath).toLowerCase()] ||
        'application/octet-stream'
    });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  if (req.method === 'GET' && req.url === '/api/dfa') {
    return sendJson(res, 200, {
      states: Object.values(dfa.stateNames),
      startState: dfa.stateNames['0'],
      acceptingStates: [...dfa.finalStates],
      alphabet: ['U', 'L', 'D'],
      policy: 'Minimum 8 characters; at least 1 uppercase, 1 lowercase, and 1 digit; letters and digits only.'
    });
  }

  if (req.method === 'POST' && req.url === '/api/validate') {
    let body = '';

    req.on('data', chunk => {
      body += chunk;
      if (body.length > 10000) req.destroy();
    });

    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');

        if (typeof payload.password !== 'string') {
          return sendJson(res, 400, { error: 'password must be a string' });
        }

        return sendJson(res, 200, runDFA(payload.password));
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
