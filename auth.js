/* ============================================================
   IP One Tools — ล็อกอินกลาง (ใช้ร่วมกันทุกหน้าในเว็บนี้)
   ต้องโหลด supabase-js ก่อนไฟล์นี้
   ============================================================ */
(function(){
  var SUPABASE_URL = 'https://hcjbjbdjddnnutpwjbny.supabase.co';
  var SUPABASE_KEY = 'sb_publishable_3f4E6MIXQOxMS7Ss_2uG2g_LEcwPH4k';
  var DOMAIN = 'ipone.co.th';

  var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  function toEmail(u){
    var s = String(u||'').trim().toLowerCase();
    return !s ? '' : (s.indexOf('@')>=0 ? s : s + '@' + DOMAIN);
  }

  async function profile(){
    var r = await sb.auth.getSession();
    var s = r && r.data && r.data.session;
    if(!s || !s.user) return null;
    var fallback = { id:s.user.id, username:(s.user.email||'user').split('@')[0], role:'user', perms:null, tools:null };
    try{
      var q = await sb.from('profiles').select('id,username,role,perms,tools').eq('id', s.user.id).single();
      if(q.error || !q.data){
        // ยังไม่ได้รัน portal-setup.sql (ไม่มีคอลัมน์ tools) → ลองแบบเดิม
        var q2 = await sb.from('profiles').select('id,username,role,perms').eq('id', s.user.id).single();
        return q2.data ? Object.assign({ tools:null }, q2.data) : fallback;
      }
      return q.data;
    }catch(e){ return fallback; }
  }

  function canUseTool(p, toolId){
    if(!p) return false;
    if(p.role === 'admin') return true;
    return !Array.isArray(p.tools) || p.tools.indexOf(toolId) >= 0;
  }

  function portalUrl(){
    var here = location.pathname.split('/').pop() || '';
    return './' + (here && here !== 'index.html' ? '?next=' + encodeURIComponent(here + location.hash) : '');
  }

  /* ใช้ในหน้าเครื่องมือ: ไม่ได้ล็อกอิน → ไป Portal, ไม่มีสิทธิ์ → กลับ Portal */
  async function guard(toolId){
    document.documentElement.style.visibility = 'hidden';
    var p = await profile();
    if(!p){ location.replace(portalUrl()); return null; }
    if(toolId && !canUseTool(p, toolId)){ location.replace('./'); return null; }
    document.documentElement.style.visibility = '';
    return p;
  }

  async function logout(){
    try{ await sb.auth.signOut(); }catch(e){}
    location.replace('./');
  }

  window.IPAuth = { sb:sb, toEmail:toEmail, profile:profile, canUseTool:canUseTool, guard:guard, logout:logout, portalUrl:portalUrl };
})();
