// script.js
const api = (path, opts = {}) => fetch('/api' + path, opts).then(r => r.json());

// state
let currentUser = null;
let repos = [];
let currentRepo = null;

// UI elements
const repoListEl = document.getElementById('repoList');
const repoViewEl = document.getElementById('repoView');
const modal = document.getElementById('modal');
const userDisplay = document.getElementById('userDisplay');

async function loadRepos(q = '') {
  try {
    const data = await api('/repos' + (q ? ('?q=' + encodeURIComponent(q)) : ''));
    repos = data || [];
    renderRepoList();
  } catch (err) {
    console.error('Failed to load repos', err);
    repos = [];
    renderRepoList();
  }
}

function renderRepoList() {
  repoListEl.innerHTML = '';
  repos.forEach(r => {
    const div = document.createElement('div');
    div.className = 'repo-item';
    div.innerHTML = `<div style="display:flex;justify-content:space-between"><div><b>${escapeHtml(r.name)}</b><div class="repo-meta">${escapeHtml(r.description || '')}</div></div><div><button class="btn" data-id="${r.id}">Open</button></div></div>`;
    repoListEl.appendChild(div);
    const btn = div.querySelector('button');
    if (btn) btn.addEventListener('click', () => openRepo(r.id));
  });
}

function showModal(html) {
  modal.innerHTML = `<div class="card">${html}</div>`;
  modal.classList.remove('hidden');
  // close on click outside card
  modal.addEventListener('click', modalClickHandler);
}
function modalClickHandler(e) {
  if (e.target === modal) closeModal();
}
function closeModal() {
  modal.classList.add('hidden');
  modal.innerHTML = '';
  modal.removeEventListener('click', modalClickHandler);
}

document.getElementById('btnNewRepo').addEventListener('click', () => {
  showModal(`
    <h3>New Repository</h3>
    <div class="form-row"><input id="newName" placeholder="Repository name" style="width:96%;padding:8px" /></div>
    <div class="form-row"><input id="newDesc" placeholder="Short description" style="width:96%;padding:8px" /></div>
    <div style="text-align:right"><button id="createRepo" class="btn">Create</button></div>
  `);
  document.getElementById('createRepo').addEventListener('click', async () => {
    const name = document.getElementById('newName').value.trim();
    const desc = document.getElementById('newDesc').value.trim();
    if (!name) return alert('Name needed');
    const owner = currentUser ? currentUser.id : null;
    try {
      await api('/repos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, description: desc, owner }) });
      closeModal();
      loadRepos();
    } catch (err) {
      console.error('Create repo failed', err);
      alert('Failed to create repo');
    }
  }, { once: true });
});

document.getElementById('btnLogin').addEventListener('click', () => {
  showModal(`<h3>Mock Login</h3><input id="mn" placeholder="Your name" style="width:96%;padding:8px" /><div style="text-align:right;margin-top:8px"><button id="ml" class="btn">Login</button></div>`);
  document.getElementById('ml').addEventListener('click', async () => {
    const name = document.getElementById('mn').value.trim();
    if (!name) return alert('Enter a name');
    try {
      const res = await fetch('/api/auth/mock', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
      const dat = await res.json();
      if (dat.token) {
        currentUser = dat.user;
        window.localStorage.setItem('demo_token', dat.token);
        updateUserUI();
        closeModal();
      } else {
        alert('Login failed');
      }
    } catch (err) {
      console.error('Mock login failed', err);
      alert('Login failed');
    }
  }, { once: true });
});

function updateUserUI() {
  userDisplay.textContent = currentUser ? `Hi, ${currentUser.name}` : '';
}

// open repo view
async function openRepo(id) {
  try {
    const r = await api('/repos/' + id);
    currentRepo = r;
    renderRepoView();
  } catch (err) {
    console.error('openRepo failed', err);
    alert('Failed to open repo');
  }
}

function renderRepoView() {
  if (!currentRepo) return;
  repoViewEl.innerHTML = `
    <div class="header-row">
      <div><h2>${escapeHtml(currentRepo.name)}</h2><div class="small">${escapeHtml(currentRepo.description || '')}</div></div>
      <div>
        <button id="btnAddFile" class="btn">Add File</button>
        <button id="btnShare" class="btn">Share</button>
        <button id="btnCommits" class="btn">Commits</button>
        <button id="btnStar" class="btn">Star (${currentRepo.stars || 0})</button>
      </div>
    </div>
    <div class="files-tree" id="filesTree"></div>
    <div id="readmeArea" style="margin-top:12px"></div>
  `;
  document.getElementById('btnAddFile').addEventListener('click', () => showAddFile());
  document.getElementById('btnShare').addEventListener('click', () => showShare());
  document.getElementById('btnCommits').addEventListener('click', () => showCommits());
  document.getElementById('btnStar').addEventListener('click', async () => {
    try {
      const data = await api(`/${currentRepo.id}/star`, { method: 'POST' });
      if (data.stars !== undefined) currentRepo.stars = data.stars;
      renderRepoView();
    } catch (err) {
      console.error('Star failed', err);
    }
  });
  renderFileTree();
  renderReadme();
}

function renderFileTree() {
  const container = document.getElementById('filesTree');
  container.innerHTML = '';
  const files = currentRepo.files || [];
  if (files.length === 0) {
    container.innerHTML = '<div class="small">No files yet.</div>';
    return;
  }
  files.forEach(f => {
    const fdiv = document.createElement('div');
    fdiv.className = 'file';
    fdiv.innerHTML = `<div style="display:flex;justify-content:space-between"><div>${escapeHtml(f.path)}</div><div><button class="btn small" data-id="${f.id}" data-action="edit">Edit</button><button class="btn small" data-id="${f.id}" data-action="del">Delete</button></div></div>`;
    container.appendChild(fdiv);
    const editBtn = fdiv.querySelector('[data-action="edit"]');
    const delBtn = fdiv.querySelector('[data-action="del"]');
    if (editBtn) editBtn.addEventListener('click', () => editFile(f.id));
    if (delBtn) delBtn.addEventListener('click', async () => {
      if (!confirm('Delete file?')) return;
      try {
        await fetch(`/api/repos/${currentRepo.id}/files/${f.id}`, { method: 'DELETE' });
        currentRepo = await api(`/repos/${currentRepo.id}`);
        renderRepoView();
      } catch (err) {
        console.error('Delete file failed', err);
      }
    });
  });
}

function renderReadme() {
  const readmeArea = document.getElementById('readmeArea');
  const readme = (currentRepo.files || []).find(f => f.path.toLowerCase() === 'readme.md' || f.path.toLowerCase() === 'readme');
  if (!readme) { readmeArea.innerHTML = ''; return; }
  const html = renderMarkdown(readme.content || '');
  readmeArea.innerHTML = `<h3>README</h3><div>${html}</div>`;
}

function renderMarkdown(md) {
  let out = md.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  out = out.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  out = out.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  out = out.replace(/^# (.*$)/gim, '<h1>$1</h1>');
  out = out.replace(/\*\*(.*?)\*\*/gim, '<b>$1</b>');
  out = out.replace(/\*(.*?)\*/gim, '<i>$1</i>');
  out = out.replace(/\n/g, '<br/>');
  return out;
}

function showAddFile() {
  showModal(`
    <h3>New File</h3>
    <div class="form-row"><input id="fpath" placeholder="path e.g. src/app.js or README.md" style="width:100%;padding:8px" /></div>
    <div class="form-row"><textarea id="fcontent" placeholder="file content" style="width:100%;height:160px;padding:8px"></textarea></div>
    <div style="text-align:right"><button id="saveFile" class="btn">Save</button></div>
  `);
  document.getElementById('saveFile').addEventListener('click', async () => {
    const pathv = document.getElementById('fpath').value.trim();
    const content = document.getElementById('fcontent').value;
    if (!pathv) return alert('Enter path');
    try {
      await fetch(`/api/repos/${currentRepo.id}/files`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: pathv, content, author: currentUser ? currentUser.name : 'anon' }) });
      currentRepo = await api(`/repos/${currentRepo.id}`);
      closeModal(); renderRepoView();
    } catch (err) {
      console.error('Save file failed', err);
      alert('Failed to save file');
    }
  }, { once: true });
}

async function editFile(fileId) {
  const file = (currentRepo.files || []).find(f => f.id === fileId);
  if (!file) return alert('File not found');
  showModal(`
    <h3>Edit ${escapeHtml(file.path)}</h3>
    <div class="form-row"><input id="epath" value="${escapeHtml(file.path)}" style="width:100%;padding:8px" /></div>
    <div class="form-row"><textarea id="econtent" style="width:100%;height:240px;padding:8px">${escapeHtml(file.content || '')}</textarea></div>
    <div style="text-align:right"><button id="saveEdit" class="btn">Save</button></div>
  `);
  document.getElementById('saveEdit').addEventListener('click', async () => {
    const newPath = document.getElementById('epath').value.trim();
    const newContent = document.getElementById('econtent').value;
    try {
      await fetch(`/api/repos/${currentRepo.id}/files/${fileId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: newPath, content: newContent, author: currentUser ? currentUser.name : 'anon', message: `Edited ${newPath}` }) });
      currentRepo = await api(`/repos/${currentRepo.id}`);
      closeModal(); renderRepoView();
    } catch (err) {
      console.error('Edit save failed', err);
      alert('Failed to save changes');
    }
  }, { once: true });
}

function showShare() {
  showModal(`
    <h3>Share Repository</h3>
    <div class="form-row"><input id="shareUser" placeholder="User id (demo)" style="width:100%;padding:8px" /></div>
    <div class="form-row">
      <select id="shareAccess" style="width:100%;padding:8px">
        <option value="view">View</option>
        <option value="write">Write</option>
      </select>
    </div>
    <div style="text-align:right"><button id="doShare" class="btn">Share</button></div>
  `);
  document.getElementById('doShare').addEventListener('click', async () => {
    const uid = document.getElementById('shareUser').value.trim();
    const access = document.getElementById('shareAccess').value;
    if (!uid) return alert('user id needed');
    try {
      await fetch(`/api/repos/${currentRepo.id}/share`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: uid, access }) });
      currentRepo = await api(`/repos/${currentRepo.id}`);
      closeModal(); renderRepoView();
    } catch (err) {
      console.error('Share failed', err);
      alert('Failed to share repo');
    }
  }, { once: true });
}

async function showCommits() {
  try {
    const res = await api(`/${currentRepo.id}/commits`);
    const commits = res || [];
    let html = `<h3>Commits</h3><div style="max-height:300px;overflow:auto">`;
    commits.slice().reverse().forEach(c => {
      html += `<div class="commit-item"><b>${escapeHtml(c.message)}</b> <div class="small">by ${escapeHtml(c.author || 'anon')} at ${escapeHtml(c.time || '')}</div><div style="margin-top:6px"><button data-cid="${c.id}" class="btn revert">Revert to this</button></div></div>`;
    });
    html += `</div>`;
    showModal(html);
    modal.querySelectorAll('.revert').forEach(btn => {
      btn.addEventListener('click', async () => {
        const cid = btn.getAttribute('data-cid');
        if (!confirm('Revert repo to this commit?')) return;
        try {
          await fetch(`/api/repos/${currentRepo.id}/revert`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ commitId: cid, author: currentUser ? currentUser.name : 'anon' }) });
          currentRepo = await api(`/repos/${currentRepo.id}`);
          closeModal(); renderRepoView();
        } catch (err) {
          console.error('Revert failed', err);
          alert('Failed to revert');
        }
      });
    });
  } catch (err) {
    console.error('Show commits failed', err);
  }
}

// search
document.getElementById('search').addEventListener('input', (e) => {
  const q = e.target.value.trim();
  loadRepos(q);
});

// Theme Toggle
const toggleBtn = document.getElementById("themeToggle");
if (localStorage.getItem("theme") === "dark") {
  document.body.classList.add("dark");
  toggleBtn.textContent = "☀";
}
toggleBtn.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  if (document.body.classList.contains("dark")) {
    toggleBtn.textContent = "☀️";
    localStorage.setItem("theme", "dark");
  } else {
    toggleBtn.textContent = "🌙";
    localStorage.setItem("theme", "light");
  }
});

// initial load
loadRepos();
updateUserUI();

//
// Small helper to avoid injecting raw HTML from data
//
function escapeHtml(unsafe) {
  if (unsafe === undefined || unsafe === null) return '';
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
