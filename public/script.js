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

// ====== EMAIL VALIDATION FUNCTION ======
function isValidEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

// ====== SIGN UP ======
document.getElementById('signupSubmit').addEventListener('click', async () => {
  const username = document.getElementById('signupUsername').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const password = document.getElementById('signupPassword').value;

  // Email validation
  if (!isValidEmail(email)) {
    document.getElementById('signupMessage').innerText = "Please enter a valid email (example@domain.com).";
    return; // stop submission
  }

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
  const email = document.getElementById('signinEmail').value.trim();
  const password = document.getElementById('signinPassword').value;

  // Email validation
  if (!isValidEmail(email)) {
    document.getElementById('signinMessage').innerText = "Please enter a valid email (example@domain.com).";
    return; // stop submission
  }

  const res = await fetch('http://localhost:5000/signin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();
  document.getElementById('signinMessage').innerText = data.message;

  if (res.ok) {
    localStorage.setItem('loggedUser', JSON.stringify(data.user));
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

// ====== PASSWORD TOGGLE ======
document.querySelectorAll('.toggle-password').forEach(icon => {
  icon.addEventListener('click', () => {
    const input = icon.previousElementSibling; // gets the password input
    if (input.type === 'password') {
      input.type = 'text';
      icon.textContent = '🙈'; // visible
    } else {
      input.type = 'password';
      icon.textContent = '👁️'; // hidden
    }
  });
});
