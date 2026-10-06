/* Màn hình đăng nhập.
   Mật khẩu KHÔNG lưu dạng chữ thường – chỉ lưu bản băm PBKDF2-SHA256 có salt.
   Lưu ý: đây là khoá giao diện phía trình duyệt (web tĩnh, không có server),
   dữ liệu vẫn nằm trong localStorage của chính máy đang dùng. */
(() => {
  'use strict';

  const AUTH = {
    user: 'admin',
    salt: '4dc8cbe47c1a40349d642308436fb75d',
    iterations: 200000,
    hash: '189c6742fe5ed4436f265017fc3eebf7c88fc690c7ba2c45404df9d7650c577e',
  };
  const KEY = 'webnote.auth';
  const LOCK_KEY = 'webnote.authLock';
  const MAX_TRIES = 5, LOCK_MS = 30_000;

  const $ = (s) => document.querySelector(s);
  const hexToBytes = (hex) => new Uint8Array(hex.match(/../g).map((b) => parseInt(b, 16)));
  const bytesToHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  const store = (s) => { try { return s(); } catch { return null; } };

  async function derive(password) {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: hexToBytes(AUTH.salt), iterations: AUTH.iterations }, key, 256);
    return bytesToHex(bits);
  }

  // So sánh không phụ thuộc thời gian
  const safeEqual = (a, b) => a.length === b.length && [...a].reduce((d, ch, i) => d | (ch.charCodeAt(0) ^ b.charCodeAt(i)), 0) === 0;

  function unlock() {
    document.body.classList.remove('locked');
    $('#loginScreen').hidden = true;
  }
  function lock() {
    store(() => sessionStorage.removeItem(KEY));
    store(() => localStorage.removeItem(KEY));
    location.reload();
  }

  // Đã đăng nhập trước đó (trong phiên này hoặc đã chọn "ghi nhớ")
  const saved = store(() => sessionStorage.getItem(KEY)) || store(() => localStorage.getItem(KEY));
  if (saved && safeEqual(saved, AUTH.hash)) unlock();
  else {
    document.body.classList.add('locked');
    $('#loginScreen').hidden = false;
    setTimeout(() => $('#loginUser').focus(), 50);
  }

  $('#btnLogout').onclick = lock;

  const err = $('#loginError');
  const showErr = (msg) => { err.textContent = msg; err.hidden = !msg; };

  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const lockState = JSON.parse(store(() => localStorage.getItem(LOCK_KEY)) || '{"n":0,"until":0}');
    if (Date.now() < lockState.until) {
      showErr(`Sai quá nhiều lần. Thử lại sau ${Math.ceil((lockState.until - Date.now()) / 1000)} giây.`);
      return;
    }
    if (!window.crypto?.subtle) { showErr('Trình duyệt không hỗ trợ đăng nhập an toàn (cần HTTPS).'); return; }

    const btn = $('#loginBtn');
    btn.disabled = true; btn.textContent = 'Đang kiểm tra…';
    const user = $('#loginUser').value.trim();
    const hash = await derive($('#loginPass').value);
    btn.disabled = false; btn.textContent = 'Đăng nhập';

    if (user === AUTH.user && safeEqual(hash, AUTH.hash)) {
      store(() => localStorage.removeItem(LOCK_KEY));
      store(() => ($('#loginRemember').checked ? localStorage : sessionStorage).setItem(KEY, hash));
      $('#loginPass').value = '';
      showErr('');
      unlock();
      return;
    }
    lockState.n += 1;
    if (lockState.n >= MAX_TRIES) { lockState.until = Date.now() + LOCK_MS; lockState.n = 0; }
    store(() => localStorage.setItem(LOCK_KEY, JSON.stringify(lockState)));
    showErr(lockState.until > Date.now()
      ? 'Sai quá nhiều lần. Vui lòng đợi 30 giây.'
      : `Sai tài khoản hoặc mật khẩu (còn ${MAX_TRIES - lockState.n} lần thử).`);
    $('#loginPass').select();
    const card = $('.login-card');
    card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake');
  });

  $('#loginShowPass').addEventListener('change', (e) => { $('#loginPass').type = e.target.checked ? 'text' : 'password'; });
})();
