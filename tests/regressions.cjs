const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const part = (s, a, b) => { const start = s.indexOf(a), end = s.indexOf(b, start); assert.ok(start >= 0 && end > start, a); return s.slice(start, end); };
const cases = [];
function test(name, run) { cases.push({ name, run }); }
function context(values, code) { vm.createContext(values); vm.runInContext(code, values); return values; }
function localStore(initial = {}) { const data = JSON.parse(JSON.stringify(initial)); return { data, get(k, fallback) { return k in data ? JSON.parse(JSON.stringify(data[k])) : fallback; }, set(k, v) { data[k] = JSON.parse(JSON.stringify(v)); return true; } }; }
const stock = read('stock-compare.html');
function stockContext() {
  const u = { pid:'1000', pname:'A', A:new Map([['1',{vs:20,d99:3}]]), B:new Map([['1',{vs:10,d99:0,by:{Main:10}}]]), whs:[] };
  const c = { plantUnits:[u], poFiles:[{plant:'1000',byMat:new Map([['1',{grVS:0,poVS:10,po99:3}]])}], curPlant:'__all__', rows:[], renderMatchEditor(){}, render(){}, $:()=>({value:'0'}), num:v=>Number(v)||0, code:v=>String(v??'').trim(), sortFor:x=>x, hasIn:()=>true, LBL:{match:'match',gap:'gap'}, window:{XLSX_WRITE:{utils:{book_new:()=>({})}}}, sheets:{}, addSheet(wb,data,kinds,widths,name){ c.sheets[name]=data; } };
  return context(c, part(stock,'function compute(){','/* ตารางจับคู่') + part(stock,'function rowsForUnit(u){',"$('#xls').onclick") + part(stock,'function buildWorkbook(src,wmap,mode){','/* เวอร์ชันรับ wmap') + part(stock,'function parsePO(aoa,grDOs){','/* แปลงข้อความ'));
}
test('stock display and per-Plant export include identical PO and PO-only items', () => {
  const c=stockContext(); c.poFiles[0].byMat.set('2',{grVS:4,poVS:0,po99:0}); c.compute();
  const exported=c.rowsForUnit(c.plantUnits[0]); assert.equal(JSON.stringify(c.rows),JSON.stringify(exported));
  assert.equal(c.rows[0].bv,20); assert.equal(c.rows[0].status,'match'); assert.equal(c.rows[1].bv,4);
});
test('damage Return excludes good Return in summary and detail export', () => {
  const c=stockContext(); c.compute(); c.buildWorkbook(c.rows,[],'summary');
  assert.equal(c.sheets['สรุปของเสีย'][0]['+Return'],3); assert.equal(c.sheets['สรุปของดี'][0]['+Return'],10);
  assert.equal((stock.match(/const ret=.*adjPO/g)||[]).length,0);
});
test('PO rejects mixed Plants and missing Plant', () => {
  const c=stockContext(), head=['PO Type','Material','Mat.Doc','PO Qty','Header Text','Receiving Plant'];
  assert.throws(()=>c.parsePO([head,['72','1','',2,'VS_','1000'],['72','1','',5,'VS_','2000']],new Set()),/Plant เดียว/);
  assert.throws(()=>c.parsePO([head,['72','1','',2,'VS_','']],new Set()),/ไม่พบ Plant/);
  assert.equal(c.parsePO([head,['72','1','',2,'VS_','1000']],new Set()).byMat.get('1').poVS,2);
});
test('duplicate PO Plant is refused before adding a second file', async () => {
  const c=stockContext(); let error=''; c.readFile=(file,cb)=>cb({aoa:[['PO Type','Material','Receiving Plant'],['72','1','1000']]}); c.msg=(id,t)=>error=t; c.esc=x=>x; c.sumBy=()=>0;
  const poSection=stock.slice(stock.indexOf('/* PO files:'));
  const load=part(poSection,'  const loadOne=', '  const load=async');
  vm.runInContext(load+';globalThis.loadOne=loadOne;',c); await c.loadOne({name:'second.xlsx'});
  assert.equal(c.poFiles.length,1); assert.match(error,/มีไฟล์ PO ของ Plant 1000 แล้ว/);
});
test('Audit formula shifting preserves sheet names, text, absolutes and function names', () => {
  const audit=read('audit.html'), code=part(audit,'  function adjFormulaRows(s,off){','  // clone row block');
  const c=context({},code);
  for(const [input,expected] of [
    ["VLOOKUP(A8,'SAP2026'!$A$1:$B$999,2,FALSE)","VLOOKUP(A9,'SAP2026'!$A$1:$B$999,2,FALSE)"],
    ['IF(A8="A8",LOG10(A8),SAP2026!B8)','IF(A9="A8",LOG10(A9),SAP2026!B9)'],
    ["'O''Brien2026'!$A8+A$8+$A$8","'O''Brien2026'!$A9+A$8+$A$8"],
    ['SUM(A8:B9)+1E10','SUM(A9:B10)+1E10']
  ]) assert.equal(c.adjFormulaRows(input,1),expected);
  assert.equal(c.adjFormulaRows('A1',-1),'#REF!');
});
const storage=read('assetsync/js/04-storage.js');
function syncContext() {
  const ls=localStore({'mine-A':[{id:'a1'}],'dirty-A':[0]}); let release;
  const c={LS:ls,meta:{id:'A'},dev:'d',mine:[{id:'a1'}],dirty:new Set([0]),CHUNK:350,writing:false,S:{},online:false,paintSync(){},render(){},clearTimeout(){},setTimeout(){return 1;},scheduleFlush(){},db:{doc:p=>({set:items=>{c.sent.push({p,items});return new Promise(r=>release=r);}})},sent:[]};
  context(c,part(storage,'const sendingJobs =','function pushEvent'));
  return {c,ls,release:()=>release()};
}
test('scanning during upload preserves new dirty events and uploads them next', async()=>{
  const {c,ls,release}=syncContext(); const sent=c.flush(); await Promise.resolve();
  ls.set('mine-A',[{id:'a1'},{id:'a2'}]); c.mine=ls.get('mine-A'); c.dirty.add(0);
  release(); await sent; assert.equal(c.dirty.size,1); assert.deepEqual(ls.get('dirty-A'),[0]);
  const next=c.flush(); await Promise.resolve(); release(); await next; assert.equal(c.sent[1].items.items.length,2); assert.equal(c.dirty.size,0);
});
test('completing upload for A does not change B queue', async()=>{
  const {c,ls,release}=syncContext(); const sent=c.flush(); await Promise.resolve();
  c.meta={id:'B'}; c.mine=[{id:'b1'}]; c.dirty=new Set([0]); ls.set('mine-B',c.mine); ls.set('dirty-B',[0]);
  release(); await sent; assert.equal(c.dirty.size,1); assert.deepEqual(ls.get('dirty-B'),[0]); assert.deepEqual(ls.get('dirty-A'),[]);
});
test('a stale register load cannot replace the selected job', async()=>{
  const waits={},callbacks={};
  const c={currentKey:'A',watchedKey:null,unsubMeta:null,unsubEv:null,jobGeneration:0,meta:{id:'old'},jobs:[{id:'old'}],LS:localStore(),flash(){},retryMaster(){},loadMaster:(m,current)=>new Promise(r=>waits[m.id]=()=>r(current())),curJobKey:()=>c.currentKey,db:{doc:k=>({onSnapshot:cb=>{callbacks[k]=cb;return ()=>{};}})},loadMine(){},S:{},subscribeEvents(){},startPresence(){},render(){},dirty:new Set(),flush(){},flushOtherJobs(){}};
  context(c,part(storage,'watchJob.revision = 0;','async function deleteJob'));
  c.watchJob();const a=callbacks.A({exists:true,data:()=>({id:'A',ver:'a'})});c.currentKey='B';c.watchJob();const b=callbacks.B({exists:true,data:()=>({id:'B',ver:'b'})});
  waits.B();await b;waits.A();await a;assert.equal(c.meta.id,'B');assert.equal(c.S.loadingJob,false);
});
test('storage failure is surfaced and event is not accepted in memory',()=>{
  const messages=[],c={localStorage:{setItem(){throw Error('QuotaExceededError')},getItem(){return null;}},window:{dispatchEvent:e=>messages.push(e)},CustomEvent:function(type,options){this.type=type;this.detail=options.detail;}};
  context(c,part(read('assetsync/js/01-helpers.js'),'const LS =','// look of the app')+';globalThis.LS=LS;');
  assert.throws(()=>c.LS.set('mine-A',[]),/บันทึกในเครื่องไม่สำเร็จ/);assert.equal(messages[0].type,'ams-storage-error');
  Object.assign(c,{meta:{id:'A'},S:{},dev:'d',mine:[],dirty:new Set(),CHUNK:350,saveMine(){throw Error('disk full')},scheduleFlush(){}});
  vm.runInContext(part(storage,'function pushEvent(e)','function pendingCount'),c);
  assert.throws(()=>c.pushEvent({k:'scan',code:'1'}),/disk full/);assert.equal(c.mine.length,0);assert.equal(c.dirty.size,0);
});
test('resync removes deleted events but retains inserts arriving during fetch',async()=>{
  let list=[{id:'e1'}],last,resolve; const timers=[],callbacks={}; const channel={on(type,filter,cb){callbacks[filter.event]=cb;return this},subscribe(){return this}};
  const c={fetchEvents:async()=>list,client:()=>({channel:()=>channel,removeChannel(){}}),resyncers:new Set(),sentIds:new Set(),setTimeout:fn=>{timers.push(fn);return 1},clearTimeout(){},err:()=>Error('error')};
  context(c,part(read('assetsync/store.js'),'  function watchEvents(','  const db ='));
  const drain=async()=>{await new Promise(r=>setImmediate(r));while(timers.length)timers.shift()();};
  c.watchEvents('A',s=>last=s.docs[0].data().items);await drain();assert.equal(last.length,1);
  list=[];await [...c.resyncers][0]();await drain();assert.equal(last.length,0);
  c.fetchEvents=()=>new Promise(r=>resolve=r);const pending=[...c.resyncers][0]();callbacks.INSERT({new:{data:{id:'e2'}}});resolve([]);await pending;await drain();assert.equal(last[0].id,'e2');
});
test('two-hour timeout notifies every tab and preserves notice until navigation',()=>{
  let now=100000000;const data=new Map([['sb-test-auth-token','session']]),tabs=[];
  function makeTab(){const events={},session=new Map(),redirects=[];const c={Date:{now:()=>now},Math,window:{},localStorage:{get length(){return data.size},key:i=>[...data.keys()][i],getItem:k=>data.get(k)||null,setItem(k,v){data.set(k,String(v));for(const t of tabs)if(t!==c)t.events.storage?.({key:k,newValue:String(v)})},removeItem(k){data.delete(k);for(const t of tabs)if(t!==c)t.events.storage?.({key:k,newValue:null})}},sessionStorage:{getItem:k=>session.get(k),setItem:(k,v)=>session.set(k,v),removeItem:k=>session.delete(k)},location:{protocol:'https:',hostname:'example.test',replace:u=>redirects.push(u)},addEventListener:(k,f)=>events[k]=f,setInterval:f=>events.tick=f,document:{readyState:'complete',getElementById:()=>({}),addEventListener(){}}};c.events=events;c.session=session;c.redirects=redirects;tabs.push(c);context(c,read('idle.js'));return c;}
  const a=makeTab(),b=makeTab();now+=7200000;a.events.tick();assert.equal(a.redirects.length,1);assert.equal(b.redirects.length,1);assert.equal(a.session.get('it.idleOut'),'1');assert.equal(b.session.get('it.idleOut'),'1');
});
(async()=>{let failed=0;for(const c of cases)try{await c.run();console.log('PASS '+c.name);}catch(e){failed++;console.error('FAIL '+c.name+'\n'+e.stack);}console.log(`${cases.length-failed}/${cases.length} passed`);process.exitCode=failed?1:0;})();

