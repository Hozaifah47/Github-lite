const user = JSON.parse(localStorage.getItem('loggedUser'));
if (!user) {
  // if not logged in, go back to login page
  window.location.href = 'index.html';
}

document.getElementById('userDisplay').innerText = `Hi, ${user.username}!`;
loadRepos();
// Handle logout
document.getElementById('btnLogout').addEventListener('click', () => {
  localStorage.removeItem('loggedUser');
  window.location.href = 'index.html';
});

// ===== New Repo Modal =====
const repoModal = document.getElementById('repoModal');
document.getElementById('btnNewRepo').addEventListener('click', () => {
  repoModal.classList.remove('hidden');
});

document.getElementById('closeRepoModal').addEventListener('click', () => {
  repoModal.classList.add('hidden');
});

// document.getElementById('createRepoBtn').addEventListener('click', async () => {
//   const name = document.getElementById('repoName').value;
//   const description = document.getElementById('repoDesc').value;
//   console.log(name);

//   const res = await fetch('http://localhost:5000/repos', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({ name, description, owner: user._id })
//   });

//   const data = await res.json();
//   document.getElementById('repoMessage').innerText = data.message;
// });

// const user = JSON.parse(localStorage.getItem('loggedUser'));
// if (!user) window.location.href = 'index.html';

// Display username
//document.getElementById('userDisplay').innerText = `Hi, ${user.username}!`;

// New Repo Modal
// const repoModal = document.getElementById('repoModal');
document.getElementById('btnNewRepo').addEventListener('click', () => {
  repoModal.classList.remove('hidden');
});
document.getElementById('closeRepoModal').addEventListener('click', () => {
  repoModal.classList.add('hidden');
});

// Create repo
document.getElementById('createRepoBtn').addEventListener('click', async () => {
  const name = document.getElementById('repoName').value.trim();
  const description = document.getElementById('repoDesc').value.trim();
  const messageEl = document.getElementById('repoMessage');

  if (!name) {
    messageEl.innerText = 'Repository name is required';
    return;
  }

  const res = await fetch('http://localhost:5000/repos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description, owner: user._id })
  });

  const data = await res.json();
  messageEl.innerText = data.message;

  if (res.ok) {
    repoModal.classList.add('hidden');
    loadRepos(); // refresh the repo list
  }
});

async function loadRepos() {
  const repoList = document.getElementById('repoList');
  repoList.innerHTML = '';

  const res = await fetch(`http://localhost:5000/repos/${user._id}`);
  const repos = await res.json();

  repos.forEach(repo => {
    const div = document.createElement('div');
    div.className = 'repo-item';
    div.innerText = repo.name;

    // ADD THIS
    div.dataset.id = repo._id;

    repoList.appendChild(div);
  });
}




let currentRepoId = null; // store the selected repo

// When user clicks a repo, open it
document.getElementById('repoList').addEventListener('click', (e) => {
  if (e.target.classList.contains('repo-item')) {
    currentRepoId = e.target.dataset.id;
    document.getElementById('repoView').innerHTML = `<h3>${e.target.innerText}</h3><button id="btnNewFile">Add File</button><div id="fileList"></div>`;
    loadFiles(currentRepoId);
  }
});

// Show file modal
// document.body.addEventListener('click', (e) => {
//   if (e.target.id === 'btnNewFile') {
//     document.getElementById('fileModal').classList.remove('hidden');
//   }
// });

// document.getElementById('closeFileModal').addEventListener('click', () => {
//   document.getElementById('fileModal').classList.add('hidden');
// });

// Create file
// document.getElementById('createFileBtn').addEventListener('click', async () => {
//   const filename = document.getElementById('fileName').value.trim();
//   const content = document.getElementById('fileContent').value;
//   const messageEl = document.getElementById('fileMessage');

//   if (!filename || !currentRepoId) {
//     messageEl.innerText = 'Filename and repository required';
//     return;
//   }

//   const res = await fetch('http://localhost:5000/files', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({ filename, content, repoId: currentRepoId })
//   });

//   const data = await res.json();
//   messageEl.innerText = data.message;

//   if (res.ok) {
//     document.getElementById('fileModal').classList.add('hidden');
//     loadFiles(currentRepoId);
//   }
// });

// Load files for a repo
async function loadFiles(repoId) {
  const fileList = document.getElementById('fileList');
  fileList.innerHTML = '';

  const res = await fetch(`http://localhost:5000/files/${repoId}`);
  const files = await res.json();

  files.forEach(file => {
    const div = document.createElement('div');
    div.className = 'file-item';
    div.innerText = file.filename;
    fileList.appendChild(div);
  });
}


const fileUploadModal = document.getElementById('fileUploadModal');
const uploadMessage = document.getElementById('uploadMessage');

// Show modal when user clicks "Add File" inside a repo
document.body.addEventListener('click', (e) => {
  if (e.target.id === 'btnNewFile') {
    fileUploadModal.classList.remove('hidden');
  }
});

document.getElementById('closeFileUploadModal').addEventListener('click', () => {
  fileUploadModal.classList.add('hidden');
});

// Upload file
document.getElementById('uploadFileBtn').addEventListener('click', async () => {
  const fileInput = document.getElementById('fileInput');
  if (!fileInput.files.length || !currentRepoId) {
    uploadMessage.innerText = 'Select a file and a repository';
    return;
  }

  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  formData.append('repoId', currentRepoId);

  const res = await fetch('http://localhost:5000/uploadFile', {
    method: 'POST',
    body: formData
  });

  const data = await res.json();
  uploadMessage.innerText = data.message;

  if (res.ok) {
    fileUploadModal.classList.add('hidden');
    loadFiles(currentRepoId); // refresh file list
  }
});
