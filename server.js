// server.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { connect, readFallback, writeFallback, config } = require('./db');
const jwt = require('jsonwebtoken');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const JWT_SECRET = config.jwtSecret || 'dev_secret_change_me';

// ---- helpers ----
function send404(res) { res.writeHead(404, {'Content-Type':'text/plain'}); res.end('Not Found'); }
function sendJSON(res, obj, status=200){ res.writeHead(status, {'Content-Type':'application/json'}); res.end(JSON.stringify(obj)); }
function parseBody(req){ return new Promise((resolve,reject)=>{ let b=''; req.on('data',c=>b+=c); req.on('end',()=>{ try{ resolve(b?JSON.parse(b):{}); }catch(e){ resolve({}); } }); req.on('error',reject); }); }
function staticFile(res, filepath) {
  const ext = path.extname(filepath).toLowerCase();
  const map = {'.html':'text/html','.css':'text/css','.js':'application/javascript','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon'};
  if (!fs.existsSync(filepath)) return send404(res);
  res.writeHead(200, {'Content-Type': map[ext]||'application/octet-stream'});
  fs.createReadStream(filepath).pipe(res);
}

// ---- storage abstraction (repos collection) ----
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
    // fallback to file-based storage
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

// ---- minimal auth (mock OAuth demo)
// For production: replace this with real OAuth flow (see notes below)
function sign(user){ return jwt.sign({ id: user.id, name: user.name }, JWT_SECRET, { expiresIn:'12h'}); }
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
  const pathname = u.pathname;

  // --- AUTH (mock login) ---
  if (req.method === 'POST' && pathname === '/api/auth/mock') {
    const body = await parseBody(req);
    const name = body.name || ('user' + Math.floor(Math.random()*999));
    const user = { id: 'u_' + genId(), name };
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
      files: [], // { id, path (e.g. src/app.js), content }
      commits: [], // { id, message, snapshot, author, time }
      createdAt: now(),
      stars: 0
    };
    await storage.insert(repo);
    return sendJSON(res, repo, 201);
  }

  // match /api/repos/:id/*
  const repoMatch = pathname.match(/^\/api\/repos\/([^\/]+)(\/?.*)$/);
  if (repoMatch) {
    const repoId = repoMatch[1];
    const tail = repoMatch[2] || '';
    const repo = await storage.get(repoId);
    if (!repo) return sendJSON(res, {error:'repo not found'},404);

    // GET repo detail
    if (req.method === 'GET' && (tail === '' || tail === '/')) return sendJSON(res, repo);

    // GET files list
    if (req.method === 'GET' && tail === '/files') {
      return sendJSON(res, repo.files || []);
    }

    // CREATE / UPDATE / DELETE file
    if (req.method === 'POST' && tail === '/files') {
      const body = await parseBody(req);
      // body: path, content
      const file = { id: 'f_' + genId(), path: body.path, content: body.content || '' };
      repo.files.push(file);
      // add commit
      const commit = { id: 'c_' + genId(), message: `Added ${body.path}`, snapshot: JSON.parse(JSON.stringify(repo.files)), author: body.author||'anonymous', time: now() };
      repo.commits.push(commit);
      await storage.replace(repoId, repo);
      return sendJSON(res, {file, commit});
    }

    if (req.method === 'PUT' && tail.startsWith('/files/')) {
      const fileId = tail.split('/')[2];
      const body = await parseBody(req);
      const fIndex = repo.files.findIndex(f=>f.id===fileId);
      if (fIndex===-1) return sendJSON(res,{error:'file not found'},404);
      repo.files[fIndex].content = body.content || repo.files[fIndex].content;
      repo.files[fIndex].path = body.path || repo.files[fIndex].path;
      const commit = { id: 'c_' + genId(), message: body.message || `Edited ${repo.files[fIndex].path}`, snapshot: JSON.parse(JSON.stringify(repo.files)), author: body.author||'anonymous', time: now() };
      repo.commits.push(commit);
      await storage.replace(repoId, repo);
      return sendJSON(res, {file:repo.files[fIndex], commit});
    }

    if (req.method === 'DELETE' && tail.startsWith('/files/')) {
      const fileId = tail.split('/')[2];
      repo.files = repo.files.filter(f=>f.id!==fileId);
      const commit = { id: 'c_' + genId(), message: `Deleted file`, snapshot: JSON.parse(JSON.stringify(repo.files)), author: 'anon', time: now() };
      repo.commits.push(commit);
      await storage.replace(repoId, repo);
      return sendJSON(res, { ok:true });
    }

    // Commit history
    if (req.method === 'GET' && tail === '/commits') {
      return sendJSON(res, repo.commits || []);
    }

    // Revert to commit
    if (req.method === 'POST' && tail === '/revert') {
      const body = await parseBody(req);
      const commitId = body.commitId;
      const c = (repo.commits||[]).find(x=>x.id===commitId);
      if (!c) return sendJSON(res,{error:'commit not found'},404);
      repo.files = JSON.parse(JSON.stringify(c.snapshot || []));
      const commit = { id: 'c_' + genId(), message: `Reverted to ${commitId}`, snapshot: JSON.parse(JSON.stringify(repo.files)), author: body.author||'anonymous', time: now() };
      repo.commits.push(commit);
      await storage.replace(repoId, repo);
      return sendJSON(res, {ok:true, commit});
    }

    // Share repo (add collaborator or view-only)
    if (req.method === 'POST' && tail === '/share') {
      const body = await parseBody(req); // { userId, access: 'view'|'write' }
      repo.collaborators = repo.collaborators || [];
      repo.collaborators.push({ userId: body.userId, access: body.access || 'view' });
      await storage.replace(repoId, repo);
      return sendJSON(res, { ok:true });
    }

    // star
    if (req.method === 'POST' && tail === '/star') {
      repo.stars = (repo.stars || 0) + 1;
      await storage.replace(repoId, repo);
      return sendJSON(res, { stars: repo.stars });
    }

    return sendJSON(res, { error: 'unknown repo action' }, 404);
  }

  // unknown api
  return sendJSON(res, { error: 'api not found' }, 404);
}

// ---- static file server ----
function handleStatic(req, res) {
  let u = url.parse(req.url);
  let filePath = u.pathname === '/' ? '/index.html' : u.pathname;
  const full = path.join(PUBLIC_DIR, filePath);
  if (full.indexOf(PUBLIC_DIR) !== 0) return send404(res); // security
  staticFile(res, full);
}

// ---- main server ----
const server = http.createServer((req,res)=>{
  const p = url.parse(req.url);
  if (p.pathname.startsWith('/api/')) {
    handleApi(req,res).catch(err=>{ console.error(err); sendJSON(res,{error:"server error"},500); });
  } else {
    handleStatic(req,res);
  }
});

server.listen(PORT, ()=> console.log(`Server running at http://localhost:${PORT}`));

