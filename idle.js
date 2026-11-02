/* ============================================================
   Inventory Tools — ออกจากระบบอัตโนมัติเมื่อไม่ได้ใช้งาน 2 ชั่วโมง
   ใช้ร่วมกันทุกหน้า (Portal, Audit, เทียบ Stock, AssetSync บนเว็บ)
   · มีการคลิก/พิมพ์/เลื่อนในแท็บไหนก็ได้ = ยังใช้งานอยู่ (นับรวมทุกแท็บ)
   · ไม่ทำงานในแอปเครื่องยิง (แอปมีล็อกอินของตัวเอง)
   ============================================================ */
(function () {
  var LIMIT = 2 * 60 * 60 * 1000, // 2 ชั่วโมง
    KEY = 'it.lastActive',
    FLAG = 'it.idleOut';
  if (!/^https?:$/.test(location.protocol) || /androidplatform\.net$/i.test(location.hostname)) return;
  var get = function () {
      try { return +localStorage.getItem(KEY) || 0; } catch (e) { return 0; }
    },
    set = function (t) {
      try { localStorage.setItem(KEY, String(t)); } catch (e) {}
    },
    loggedIn = function () {
      try {
        for (var i = 0; i < localStorage.length; i++) if (/^sb-.+-auth-token$/.test(localStorage.key(i))) return true;
      } catch (e) {}
      return false;
    };
  function logout() {
    try {
      var ks = [];
      for (var i = 0; i < localStorage.length; i++) if (/^sb-.+-auth-token$/.test(localStorage.key(i))) ks.push(localStorage.key(i));
      ks.forEach(function (k) { localStorage.removeItem(k); });
      localStorage.removeItem(KEY);
      sessionStorage.setItem(FLAG, '1');
    } catch (e) {}
    location.replace('/');
  }
  function check() {
    if (!loggedIn()) {
      try { localStorage.removeItem(KEY); } catch (e) {} // ออกจากระบบแล้ว → เริ่มนับใหม่ตอนล็อกอินครั้งหน้า
      return;
    }
    var t = get();
    if (!t) return set(Date.now()); // เพิ่งล็อกอิน / เริ่มใช้ระบบนี้ครั้งแรก
    if (Date.now() - t > LIMIT) logout();
  }
  check();
  var last = 0;
  function active() {
    var n = Date.now();
    if (n - last < 30000) return; // บันทึกไม่เกินทุก 30 วินาที
    last = n;
    if (loggedIn()) {
      if (get() && n - get() > LIMIT) return logout();
      set(n);
    }
  }
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(function (ev) {
    addEventListener(ev, active, { passive: true, capture: true });
  });
  setInterval(check, 60000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) check(); });
  // หน้าล็อกอินของ Portal: บอกเหตุผลที่ต้องล็อกอินใหม่
  function note() {
    var el = document.getElementById('lgErr');
    var f = null;
    try { f = sessionStorage.getItem(FLAG); } catch (e) {}
    if (!f || !el) return;
    try { sessionStorage.removeItem(FLAG); } catch (e) {}
    el.textContent = 'ออกจากระบบอัตโนมัติ เพราะไม่ได้ใช้งานเกิน 2 ชั่วโมง · กรุณาเข้าสู่ระบบใหม่';
    el.className = 'err show';
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', note); else note();
})();
