/* =========================================================
   NOERZ ASSISTANT — auth.js
   Login / Register / Logout / Session
   ========================================================= */

(function () {
  'use strict';

  /* ============ CONFIG ============ */
  const SUPABASE_URL = 'https://gnrtuggbnuyxlocyarnl.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_73oPOwda0n8_9X7wxbORGA_MuVR_Agx';

  /* ============ CLIENT ============ */
  let sb = null;
  if (window.supabase) {
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  } else {
    console.error('[auth] Supabase library tidak ditemukan');
  }
  window.getSupabase = function () { return sb; };

  /* ============ TOAST ============ */
  window.showToast = function (message, type) {
    type = type || 'info';
    let wrap = document.getElementById('toastWrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.className = 'toast-wrap';
      wrap.id = 'toastWrap';
      document.body.appendChild(wrap);
    }
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    const icon = type === 'success' ? 'bx-check-circle'
               : type === 'error'   ? 'bx-error-circle'
               : 'bx-info-circle';
    toast.innerHTML = "<i class='bx " + icon + "'></i><span></span>";
    toast.querySelector('span').textContent = message;
    wrap.appendChild(toast);
    setTimeout(function () {
      toast.style.transition = 'opacity .3s, transform .3s';
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-8px)';
      setTimeout(function () { if (toast.parentNode) toast.remove(); }, 300);
    }, 3500);
  };

  /* ============ HELPERS ============ */
  window.EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  window.isValidEmail = function (email) {
    return window.EMAIL_REGEX.test(String(email).trim());
  };
  window.setFieldError = function (input, errorEl, show) {
    if (!input || !errorEl) return;
    if (show) {
      input.classList.add('error');
      errorEl.classList.add('show');
    } else {
      input.classList.remove('error');
      errorEl.classList.remove('show');
    }
  };
  window.setLoading = function (btn, loading, label) {
    if (!btn) return;
    const labelEl = btn.querySelector('.btn-label');
    if (loading) {
      btn.disabled = true;
      btn.classList.add('loading');
      if (labelEl && label) labelEl.innerHTML = label;
    } else {
      btn.disabled = false;
      btn.classList.remove('loading');
      if (labelEl && label) labelEl.innerHTML = label;
    }
  };

  /* ============ AUTH API ============ */
  window.getCurrentUser = async function () {
    if (!sb) return null;
    try {
      const { data: { user }, error } = await sb.auth.getUser();
      if (error) return null;
      return user;
    } catch (err) { return null; }
  };

  window.loginUser = async function (email, password) {
    if (!sb) throw new Error('Supabase belum dikonfigurasi');
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  window.registerUser = async function (email, password) {
    if (!sb) throw new Error('Supabase belum dikonfigurasi');
    const { data, error } = await sb.auth.signUp({
      email, password,
      options: { emailRedirectTo: window.location.origin + '/chat.html' }
    });
    if (error) throw error;
    return data;
  };

  window.logoutUser = async function () {
    if (sb) {
      try { await sb.auth.signOut(); } catch (e) {}
    }
    window.location.href = 'login.html';
  };

  /* ============ PAGE INIT ============ */
  document.addEventListener('DOMContentLoaded', async function () {
    const page = document.body.dataset.page;

    /* Halaman login/register: kalau sudah login → chat */
    if (page === 'login' || page === 'register') {
      const user = await window.getCurrentUser();
      if (user) {
        window.location.href = 'chat.html';
        return;
      }
      initAuthPage(page);
    }

    /* Halaman chat: kalau belum login → login */
    if (page === 'chat') {
      const user = await window.getCurrentUser();
      if (!user) {
        window.location.href = 'login.html';
        return;
      }
      document.body.dataset.userId = user.id;
      document.body.dataset.userEmail = user.email;

      /* Bind logout */
      const logoutBtn = document.getElementById('logoutBtn');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', function () {
          window.logoutUser();
        });
      }
    }
  });

  /* ============ INIT AUTH PAGE ============ */
  function initAuthPage(page) {
    /* Toggle password */
    document.querySelectorAll('[data-toggle-password]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const input = document.getElementById(btn.getAttribute('data-toggle-password'));
        if (!input) return;
        const isPwd = input.type === 'password';
        input.type = isPwd ? 'text' : 'password';
        const icon = btn.querySelector('.bx');
        if (icon) icon.className = isPwd ? 'bx bx-hide' : 'bx bx-show';
      });
    });

    /* LOGIN PAGE */
    if (page === 'login') {
      const form = document.getElementById('loginForm');
      const email = document.getElementById('loginEmail');
      const password = document.getElementById('loginPassword');
      const emailError = document.getElementById('loginEmailError');
      const passwordError = document.getElementById('loginPasswordError');
      const btn = document.getElementById('loginBtn');

      if (!form) return;

      email.addEventListener('input', function () {
        if (window.isValidEmail(email.value.trim())) {
          window.setFieldError(email, emailError, false);
        }
      });
      password.addEventListener('input', function () {
        if (password.value.length >= 6) {
          window.setFieldError(password, passwordError, false);
        }
      });

      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        const vEmail = email.value.trim();
        const vPassword = password.value;
        let hasErr = false;

        if (!window.isValidEmail(vEmail)) {
          window.setFieldError(email, emailError, true);
          hasErr = true;
        } else {
          window.setFieldError(email, emailError, false);
        }
        if (!vPassword || vPassword.length < 6) {
          window.setFieldError(password, passwordError, true);
          hasErr = true;
        } else {
          window.setFieldError(password, passwordError, false);
        }
        if (hasErr) return;

        window.setLoading(btn, true, '<span class="spinner"></span> Login...');

        try {
          await window.loginUser(vEmail, vPassword);
          window.showToast('Login berhasil!', 'success');
          setTimeout(function () {
            window.location.href = 'chat.html';
          }, 600);
        } catch (err) {
          const msg = err.message || 'Email atau password salah.';
          window.showToast(msg, 'error');
          window.setLoading(btn, false, "<i class='bx bx-log-in'></i> Login");
        }
      });
    }

    /* REGISTER PAGE */
    if (page === 'register') {
      const form = document.getElementById('registerForm');
      const email = document.getElementById('registerEmail');
      const password = document.getElementById('registerPassword');
      const confirm = document.getElementById('registerConfirm');
      const emailError = document.getElementById('registerEmailError');
      const passwordError = document.getElementById('registerPasswordError');
      const confirmError = document.getElementById('registerConfirmError');
      const btn = document.getElementById('registerBtn');
      const authCard = document.getElementById('authCard');
      const successCard = document.getElementById('successCard');
      const successEmail = document.getElementById('successEmail');
      const statusText = document.getElementById('statusText');
      const backBtn = document.getElementById('backToLoginBtn');

      if (!form) return;

      email.addEventListener('input', function () {
        if (window.isValidEmail(email.value.trim())) {
          window.setFieldError(email, emailError, false);
        }
      });
      password.addEventListener('input', function () {
        if (password.value.length >= 6) {
          window.setFieldError(password, passwordError, false);
        }
        if (confirm.value === password.value) {
          window.setFieldError(confirm, confirmError, false);
        }
      });
      confirm.addEventListener('input', function () {
        if (confirm.value === password.value) {
          window.setFieldError(confirm, confirmError, false);
        }
      });

      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        const vEmail = email.value.trim();
        const vPassword = password.value;
        const vConfirm = confirm.value;
        let hasErr = false;

        if (!window.isValidEmail(vEmail)) {
          window.setFieldError(email, emailError, true);
          hasErr = true;
        } else {
          window.setFieldError(email, emailError, false);
        }
        if (!vPassword || vPassword.length < 6) {
          window.setFieldError(password, passwordError, true);
          hasErr = true;
        } else {
          window.setFieldError(password, passwordError, false);
        }
        if (vPassword !== vConfirm) {
          window.setFieldError(confirm, confirmError, true);
          hasErr = true;
        } else {
          window.setFieldError(confirm, confirmError, false);
        }
        if (hasErr) return;

        window.setLoading(btn, true, '<span class="spinner"></span> Mendaftar...');

        try {
          await window.registerUser(vEmail, vPassword);
          window.showToast('Berhasil! Cek email Anda.', 'success');

          if (successEmail) successEmail.textContent = vEmail;
          if (authCard) authCard.style.display = 'none';
          if (successCard) successCard.classList.add('show');
          if (statusText) statusText.textContent = 'Verifikasi email untuk login';

        } catch (err) {
          const msg = err.message || 'Gagal mendaftar.';
          window.showToast(msg, 'error');
          window.setLoading(btn, false, "<i class='bx bx-user-plus'></i> Daftar");
        }
      });

      if (backBtn) {
        backBtn.addEventListener('click', function () {
          window.location.href = 'login.html';
        });
      }
    }
  }

})();