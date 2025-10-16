// ====== MODAL CONTROL ======
const signupModal = document.getElementById('signupModal');
const signinModal = document.getElementById('signinModal');
const btnLogin = document.getElementById('btnLogin');

btnLogin.addEventListener('click', () => {
  signinModal.classList.remove('hidden');
});

// close buttons
document.getElementById('signupClose').onclick = () => signupModal.classList.add('hidden');
document.getElementById('signinClose').onclick = () => signinModal.classList.add('hidden');

// ====== SIGN UP ======
document.getElementById('signupSubmit').addEventListener('click', async () => {
  const username = document.getElementById('signupUsername').value;
  const email = document.getElementById('signupEmail').value;
  const password = document.getElementById('signupPassword').value;

  const res = await fetch('http://localhost:5000/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password })
  });

  const data = await res.json();
  document.getElementById('signupMessage').innerText = data.message;
});

// ====== SIGN IN ======
document.getElementById('signinSubmit').addEventListener('click', async () => {
  const email = document.getElementById('signinEmail').value;
  const password = document.getElementById('signinPassword').value;

  const res = await fetch('http://localhost:5000/signin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();
  document.getElementById('signinMessage').innerText = data.message;

//   if (res.ok) {
//     document.getElementById('userDisplay').innerText = data.user.username;
//     signinModal.classList.add('hidden');
//   }

  if (res.ok) {
  // Save user info (for later use)
  localStorage.setItem('loggedUser', JSON.stringify(data.user));

  // Redirect to homepage
  window.location.href = 'home.html';
}

});


// ====== TOGGLE BETWEEN SIGN IN / SIGN UP ======
const linkToSignup = document.getElementById('linkToSignup');
const linkToSignin = document.getElementById('linkToSignin');

linkToSignup.addEventListener('click', (e) => {
  e.preventDefault();
  signinModal.classList.add('hidden');
  signupModal.classList.remove('hidden');
});

linkToSignin.addEventListener('click', (e) => {
  e.preventDefault();
  signupModal.classList.add('hidden');
  signinModal.classList.remove('hidden');
});

// 🌗 Theme Toggle
const toggleBtn = document.getElementById("themeToggle");


if (localStorage.getItem("theme") === "dark") {
  document.body.classList.add("dark");
  toggleBtn.textContent = "☀️";
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