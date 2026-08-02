'use strict';

(function () {
  // Redirect if already logged in
  const existingToken = localStorage.getItem('twa_token');
  if (existingToken) {
    window.location.href = '/dashboard';
    return;
  }

  const errorAlert = document.getElementById('errorAlert');
  const successAlert = document.getElementById('successAlert');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const tabs = document.querySelectorAll('#authTabs .nav-link');

  // Tab switching
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');

      const which = tab.dataset.tab;
      if (which === 'login') {
        loginForm.classList.remove('d-none');
        registerForm.classList.add('d-none');
      } else {
        loginForm.classList.add('d-none');
        registerForm.classList.remove('d-none');
      }
      clearAlerts();
    });
  });

  function showError(msg) {
    errorAlert.textContent = msg;
    errorAlert.classList.remove('d-none');
    successAlert.classList.add('d-none');
  }

  function showSuccess(msg) {
    successAlert.textContent = msg;
    successAlert.classList.remove('d-none');
    errorAlert.classList.add('d-none');
  }

  function clearAlerts() {
    errorAlert.classList.add('d-none');
    successAlert.classList.add('d-none');
  }

  async function doAuth(url, body, btn, btnLabel) {
    btn.disabled = true;
    btn.textContent = 'Please wait...';
    clearAlerts();

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        showError(data.error || 'An error occurred');
        return;
      }

      localStorage.setItem('twa_token', data.token);
      localStorage.setItem('twa_email', data.user.email);
      showSuccess('Success! Redirecting...');
      setTimeout(() => { window.location.href = '/dashboard'; }, 600);
    } catch (err) {
      showError('Network error: ' + err.message);
    } finally {
      btn.disabled = false;
      btn.textContent = btnLabel;
    }
  }

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    doAuth('/api/auth/login', { email, password }, document.getElementById('loginBtn'), 'Login');
  });

  registerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const confirm = document.getElementById('regPasswordConfirm').value;

    if (password !== confirm) {
      showError('Passwords do not match');
      return;
    }
    if (password.length < 8) {
      showError('Password must be at least 8 characters');
      return;
    }
    doAuth('/api/auth/register', { email, password }, document.getElementById('registerBtn'), 'Create Account');
  });
})();
