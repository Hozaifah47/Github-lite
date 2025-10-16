// ...existing code...
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { connect, readFallback, writeFallback, config } = require('./db');
const jwt = require('jsonwebtoken');

// prefer global fetch (Node 18+) and safely fall back to node-fetch if available
let fetchFn = global.fetch;
if (!fetchFn) {
  try {
    const nf = require('node-fetch');
    fetchFn = nf && (nf.default || nf);
  } catch (e) {
    fetchFn = null;
  }
}

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const JWT_SECRET = (config && config.jwtSecret) || 'dev_secret_change_me';

// ---- helpers ----
function send404(res) { res.writeHead(404, {'Content-Type':'text/plain'}); res.end('Not Found'); }
function sendJSON(res, obj, status=200){ res.writeHead(status, {'Content-Type':'application/json'}); res.end(JSON.stringify(obj)); }

function parseBody(req, limit = 1_000_000){ // 1MB limit
  return new Promise((resolve,reject)=>{
    let received = 0;
    let b = '';
    req.on('data', chunk => {
      received += chunk.length;
      if (received > limit) {
        reject(new Error('request body too large'));
        req.destroy();
        return;
      }
      b += chunk;
    });
    req.on('end', ()=>{
      if (!b) return resolve({});
      const ct = (req.headers['content-type']||'').split(';')[0].trim();
      if (ct === 'application/json' || ct === 'application/vnd.api+json') {
        try { resolve(JSON.parse(b)); } catch(e) { resolve({}); }
      } else {
        // not JSON; return empty object for this app
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function staticFile(res, filepath) {
  const ext = path.extname(filepath).toLowerCase();
  const map = {'.html':'text/html','.css':'text/css','.js':'application/javascript','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon'};
  if (!fs.existsSync(filepath) || !fs.statSync(filepath).isFile()) return send404(res);
  res.writeHead(200, {'Content-Type': map[ext]||'application/octet-stream'});
  fs.createReadStream(filepath).pipe(res);
}

// ---- storage abstraction ----
async function getStorage() {
  const db = await connect();
  if (db) {
    const repos = db.collection('repos');
    return {
      async list() { return await repos.find({}).toArray(); },
      async get(id) { return await repos.findOne({ id }); },
      async insert(item) { await repos.insertOne(item); return item; },
      async update(id, updateObj) { await repos.updateOne({ id }, { $set: updateObj }); return await repos.findOne({ id }); },
      async replace(id, newObj) { await repos.replaceOne({ id }, newObj, { upsert: true }); return newObj; },
      async delete(id) { await repos.deleteOne({ id }); }
    };
  } else {
    return {
      list() { const d = readFallback(); return d.repos || []; },
      get(id) { const d = readFallback(); return (d.repos||[]).find(r=>r.id===id); },
      insert(item) { const d = readFallback(); d.repos = d.repos || []; d.repos.push(item); writeFallback(d); return item; },
      update(id, updateObj) { const d = readFallback(); d.repos = d.repos || []; let i = d.repos.findIndex(r=>r.id===id); if(i>=0){ d.repos[i] = {...d.repos[i], ...updateObj}; writeFallback(d); return d.repos[i]; } return null; },
      replace(id,newObj) { const d = readFallback(); d.repos = d.repos || []; let i = d.repos.findIndex(r=>r.id===id); if (i>=0) d.repos[i]=newObj; else d.repos.push(newObj); writeFallback(d); return newObj; },
      delete(id) { const d = readFallback(); d.repos = (d.repos||[]).filter(r=>r.id!==id); writeFallback(d); }
    };
  }
}

// ---- util generators ----
function genId(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,6); }
function now(){ return new Date().toISOString(); }

// ---- JWT auth ----
function sign(user){ return jwt.sign({ id: user.id, name: user.name, avatar: user.avatar }, JWT_SECRET, { expiresIn:'12h'}); }
function verifyToken(req){
  const h = (req.headers.authorization||'').split(' ');
  if (h[0]==='Bearer' && h[1]) {
    try { return jwt.verify(h[1], JWT_SECRET); } catch(e){ return null; }
  }
  return null;
}

// ---- API handler ----
async function handleApi(req, res) {
  const storage = await getStorage();
  const u = url.parse(req.url, true);
  const pathname = u.pathname || '';

  try {
    // --- GitHub OAuth redirect ---
    if (req.method === 'GET' && pathname === '/api/auth/github') {
      const clientId = config.githubClientId;
      const redirectUri = config.githubRedirectUri;
      const scope = 'read:user repo';
      const githubUrl = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}`;
      res.writeHead(302, { Location: githubUrl });
      return res.end();
    }

    // --- GitHub OAuth callback ---
    if (req.method === 'GET' && pathname === '/api/auth/github/callback') {
      if (!fetchFn) return sendJSON(res, { error: 'server missing fetch implementation' }, 500);
      const code = u.query.code;
      if (!code) return sendJSON(res, { error: 'No code provided' }, 400);

      // exchange code for access token
      const tokenRes = await fetchFn('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: config.githubClientId,
          client_secret: config.githubClientSecret,
          code
        })
      });
      const tokenData = await tokenRes.json();
      const accessToken = tokenData.access_token;
      if (!accessToken) return sendJSON(res, { error: 'Failed to get access token' }, 400);

      // fetch user info
      const userRes = await fetchFn('https://api.github.com/user', {
        headers: { Authorization: `token ${accessToken}`, 'User-Agent': 'github-lite' }
      });
      const githubUser = await userRes.json();

      // create JWT for app
      const user = { id: 'u_' + githubUser.id, name: githubUser.login, avatar: githubUser.avatar_url };
      const token = sign(user);

      return sendJSON(res, { token, user });
    }

    // --- LIST REPOS ---
    if (req.method === 'GET' && pathname === '/api/repos') {
      const q = u.query.q || '';
      let list = await storage.list();
      if (q) list = list.filter(r => (r.name + ' ' + (r.description||'')).toLowerCase().includes(q.toLowerCase()));
      return sendJSON(res, list);
    }

    // --- CREATE REPO ---
    if (req.method === 'POST' && pathname === '/api/repos') {
      const body = await parseBody(req);
      if (!body.name) return sendJSON(res, { error: 'name required' }, 400);
      const repo = {
        id: 'r_' + genId(),
        name: body.name,
        description: body.description || '',
        isPrivate: !!body.isPrivate,
        owner: body.owner || null,
        collaborators: body.collaborators || [],
        files: [],
        commits: [],
        createdAt: now(),
        stars: 0
      };
      await storage.insert(repo);
      return sendJSON(res, repo, 201);
    }

    // --- repo/:id actions ---
    const repoMatch = pathname.match(/^\/api\/repos\/([^\/]+)(\/?.*)$/);
    if (repoMatch) {
      const repoId = repoMatch[1];
      const tail = repoMatch[2] || '';
      const repo = await storage.get(repoId);
      if (!repo) return sendJSON(res, {error:'repo not found'},404);

      // GET repo detail
      if (req.method === 'GET' && (tail === '' || tail === '/')) return sendJSON(res, repo);

      // GET files
      if (req.method === 'GET' && tail === '/files') return sendJSON(res, repo.files || []);

      // CREATE file
      if (req.method === 'POST' && tail === '/files') {
        const body = await parseBody(req);
        if (!body.path) return sendJSON(res, { error: 'path required' }, 400);
        const file = { id: 'f_' + genId(), path: body.path, content: body.content || '' };
        repo.files.push(file);
        const commit = { id: 'c_' + genId(), message: `Added ${body.path}`, snapshot: JSON.parse(JSON.stringify(repo.files)), author: body.author||'anon', time: now() };
        repo.commits.push(commit);
        await storage.replace(repoId, repo);
        return sendJSON(res, {file, commit});
      }

      // UPDATE file
      if (req.method === 'PUT' && tail.startsWith('/files/')) {
        const fileId = tail.split('/')[2];
        const body = await parseBody(req);
        const fIndex = repo.files.findIndex(f=>f.id===fileId);
        if (fIndex===-1) return sendJSON(res,{error:'file not found'},404);
        repo.files[fIndex].content = body.content !== undefined ? body.content : repo.files[fIndex].content;
        repo.files[fIndex].path = body.path || repo.files[fIndex].path;
        const commit = { id: 'c_' + genId(), message: body.message || `Edited ${repo.files[fIndex].path}`, snapshot: JSON.parse(JSON.stringify(repo.files)), author: body.author||'anon', time: now() };
        repo.commits.push(commit);
        await storage.replace(repoId, repo);
        return sendJSON(res, {file:repo.files[fIndex], commit});
      }

      // DELETE file
      if (req.method === 'DELETE' && tail.startsWith('/files/')) {
        const fileId = tail.split('/')[2];
        repo.files = repo.files.filter(f=>f.id!==fileId);
        const commit = { id: 'c_' + genId(), message: `Deleted file`, snapshot: JSON.parse(JSON.stringify(repo.files)), author: 'anon', time: now() };
        repo.commits.push(commit);
        await storage.replace(repoId, repo);
        return sendJSON(res, { ok:true });
      }

      // GET commits
      if (req.method === 'GET' && tail === '/commits') return sendJSON(res, repo.commits || []);

      // Revert commit
      if (req.method === 'POST' && tail === '/revert') {
        const body = await parseBody(req);
        const c = (repo.commits||[]).find(x=>x.id===body.commitId);
        if (!c) return sendJSON(res,{error:'commit not found'},404);
        repo.files = JSON.parse(JSON.stringify(c.snapshot || []));
        const commit = { id: 'c_' + genId(), message: `Reverted to ${body.commitId}`, snapshot: JSON.parse(JSON.stringify(repo.files)), author: body.author||'anon', time: now() };
        repo.commits.push(commit);
        await storage.replace(repoId, repo);
        return sendJSON(res, {ok:true, commit});
      }

      // Share repo
      if (req.method === 'POST' && tail === '/share') {
        const body = await parseBody(req);
        repo.collaborators = repo.collaborators || [];
        repo.collaborators.push({ userId: body.userId, access: body.access || 'view' });
        await storage.replace(repoId, repo);
        return sendJSON(res, { ok:true });
      }

      // Star
      if (req.method === 'POST' && tail === '/star') {
        repo.stars = (repo.stars || 0) + 1;
        await storage.replace(repoId, repo);
        return sendJSON(res, { stars: repo.stars });
      }

      return sendJSON(res, { error: 'unknown repo action' }, 404);
    }

    // unknown api
    return sendJSON(res, { error: 'api not found' }, 404);
  } catch (err) {
    console.error('API error', err);
    return sendJSON(res, { error: 'server error' }, 500);
  }
}

// ---- static files ----
function handleStatic(req,res){
  let u = url.parse(req.url);
  let filePath = u.pathname === '/' ? '/index.html' : (u.pathname || '/index.html');

  // normalize and resolve to avoid path traversal
  // ensure we always resolve within PUBLIC_DIR
  const full = path.resolve(PUBLIC_DIR, '.' + filePath);
  const publicResolved = path.resolve(PUBLIC_DIR);
  if (!(full === publicResolved || full.startsWith(publicResolved + path.sep))) return send404(res);
  staticFile(res, full);
}

// ---- server ----
const server = http.createServer((req,res)=>{
  // Basic CORS for APIs and static (adjust for production)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');

  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  try {
    const p = url.parse(req.url || '');
    if (p.pathname && p.pathname.startsWith('/api/')) {
      handleApi(req,res).catch(err=>{ console.error(err); sendJSON(res,{error:"server error"},500); });
    } else {
      handleStatic(req,res);
    }
  } catch (err) {
    console.error('server error', err);
    sendJSON(res, { error: 'server error' }, 500);
  }
});

server.listen(PORT, ()=> console.log(`Server running at http://localhost:${PORT}`));
// ...existing code...
