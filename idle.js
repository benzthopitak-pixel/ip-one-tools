/* Inventory Tools — shared two-hour inactivity session (web only). */
(function () {
  var LIMIT = 2 * 60 * 60 * 1000, KEY = 'it.lastActive', FLAG = 'it.idleOut', SIGNAL = 'it.logout';
  if (!/^https?:$/.test(location.protocol) || /androidplatform\.net$/i.test(location.hostname)) return;
  var exiting = false, last = 0;
  function get() { try { return +localStorage.getItem(KEY) || 0; } catch (e) { return 0; } }
  function tokenKeys() {
    var out = [];
    try { for (var i = 0; i < localStorage.length; i++) if (/^sb-.+-auth-token$/.test(localStorage.key(i))) out.push(localStorage.key(i)); } catch (e) {}
    return out;
  }
  function set(t) { try { localStorage.setItem(KEY, String(t)); } catch (e) {} }
  function leave(reason, broadcast) {
    if (exiting) return;
    exiting = true;
    try {
      if (reason === 'idle') sessionStorage.setItem(FLAG, '1');
      if (broadcast) localStorage.setItem(SIGNAL, JSON.stringify({ reason: reason, at: Date.now(), nonce: Math.random() }));
    } catch (e) {}
    // Notify the SDK as well as other tabs. Never revoke sessions on other devices.
    try {
      var auth = window.IPAuth && window.IPAuth.sb && window.IPAuth.sb.auth || window.sb && window.sb.auth;
      var p = auth ? auth.signOut({ scope: 'local' }) : window.AMSStore && window.AMSStore.auth.logout({ scope: 'local' });
      if (p && p.catch) p.catch(function () {});
    } catch (e) {}
    try { tokenKeys().forEach(function (k) { localStorage.removeItem(k); }); localStorage.removeItem(KEY); } catch (e) {}
    location.replace('/');
  }
  function check() {
    if (exiting) return;
    if (!tokenKeys().length) { try { localStorage.removeItem(KEY); } catch (e) {} return; }
    var t = get();
    if (!t) return set(Date.now());
    if (Date.now() - t >= LIMIT) leave('idle', true);
  }
  function active() {
    if (exiting) return;
    if (!tokenKeys().length) { try { localStorage.removeItem(KEY); } catch (e) {} return; }
    var n = Date.now(), t = get();
    if (t && n - t >= LIMIT) return leave('idle', true);
    if (n - last < 30000) return;
    last = n; set(n);
  }
  addEventListener('storage', function (e) {
    if (exiting) return;
    if (e.key === SIGNAL && e.newValue) {
      try { leave(JSON.parse(e.newValue).reason, false); } catch (err) {}
    } else if (e.key && /^sb-.+-auth-token$/.test(e.key) && !e.newValue) {
      var reason = 'signedout';
      try { var out = JSON.parse(localStorage.getItem(SIGNAL) || 'null'); if (out && Date.now() - out.at < 5000) reason = out.reason; } catch (err) {}
      leave(reason, false);
    }
  });
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(function (ev) { addEventListener(ev, active, { passive: true, capture: true }); });
  setInterval(check, 60000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) check(); });
  addEventListener('pageshow', check);
  check();
  function note() {
    if (exiting) return;
    var el = document.getElementById('lgErr'), f = null;
    try { f = sessionStorage.getItem(FLAG); } catch (e) {}
    if (!f || !el) return;
    try { sessionStorage.removeItem(FLAG); } catch (e) {}
    el.textContent = 'ออกจากระบบอัตโนมัติ เพราะไม่ได้ใช้งานเกิน 2 ชั่วโมง · กรุณาเข้าสู่ระบบใหม่';
    el.className = 'err show';
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', note); else note();
})();
