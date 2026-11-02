/* AssetSync · ปรับขนาดได้เอง (หน้าเว็บ): ทุกตาราง 1 บรรทัดต่อแถว · ลากขอบหัวคอลัมน์เพื่อย่อ/ขยายคอลัมน์ · ลากเส้นแบ่งเพื่อย่อ/ขยายกล่องด้านขวา
 * จำขนาดไว้ในเครื่องนี้ · ดับเบิลคลิกที่ขอบ = กลับเป็นขนาดเดิม · ไม่แตะข้อมูลหรือการทำงานอื่น */
(function () {
  const ls = {
    get(k) {
      try {
        return JSON.parse(localStorage.getItem(k) || 'null');
      } catch {
        return null;
      }
    },
    set(k, v) {
      try {
        v == null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v));
      } catch {}
    }
  };
  const st = document.createElement('style');
  st.textContent = `
th.rsz-th{position:relative}
.rsz-h{position:absolute;top:0;right:-5px;width:10px;height:100%;cursor:col-resize;z-index:3;touch-action:none}
.rsz-h::after{content:'';position:absolute;top:22%;bottom:22%;left:4px;width:2px;border-radius:2px;background:var(--line)}
.rsz-h:hover::after,.rsz-h.on::after{background:var(--blue)}
.row.pair>.pair-split{flex:0 0 12px;align-self:stretch;height:auto;overflow:visible;cursor:col-resize;position:relative;touch-action:none;margin:0 -6px}
.pair-split::after{content:'';position:absolute;left:5px;top:35%;bottom:35%;width:3px;border-radius:3px;background:var(--line)}
.pair-split:hover::after,.pair-split.on::after{background:var(--blue)}
body.rsz-drag,body.rsz-drag *{cursor:col-resize!important;user-select:none!important}
table.tauto{table-layout:fixed}
table.tauto td{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;vertical-align:middle}
@media (max-width:860px){.row.pair>.pair-split{display:none}}`;
  document.head.appendChild(st);

  const drag = (el, onMove, onEnd) => {
    el.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const x0 = e.clientX,
        ctx = onMove(null);
      el.classList.add('on');
      document.body.classList.add('rsz-drag');
      const mv = ev => onMove(ev.clientX - x0, ctx),
        up = () => {
          el.classList.remove('on');
          document.body.classList.remove('rsz-drag');
          removeEventListener('pointermove', mv);
          removeEventListener('pointerup', up);
          onEnd(ctx);
        };
      addEventListener('pointermove', mv);
      addEventListener('pointerup', up);
    });
    el.addEventListener('click', e => e.stopPropagation());
  };

  /* ---------- คอลัมน์ตาราง ---------- */
  function setupTable(t) {
    t.dataset.rsz = '1';
    const cols = [...t.querySelectorAll(':scope > colgroup > col')],
      ths = t.tHead ? [...t.tHead.rows[0].cells] : [];
    if (!cols.length || cols.length !== ths.length) return;
    const key = 'rszCols:' + ths.map(c => c.textContent.trim()).join('|'),
      base = t.style.minWidth;
    const apply = w => {
      w.forEach((px, i) => px && (cols[i].style.width = px + 'px'));
      t.style.minWidth = w.reduce((a, b) => a + (b || 0), 0) + 'px';
    };
    const saved = ls.get(key);
    if (Array.isArray(saved) && saved.length === cols.length) apply(saved);
    ths.forEach((th, i) => {
      th.classList.add('rsz-th');
      const h = document.createElement('span');
      h.className = 'rsz-h';
      h.title = 'ลากเพื่อย่อ/ขยายคอลัมน์ · ดับเบิลคลิก = ขนาดเดิม';
      th.appendChild(h);
      drag(
        h,
        (dx, ctx) => {
          if (dx === null) return { w: ths.map(c => Math.round(c.getBoundingClientRect().width)) };
          const w = ctx.w.slice();
          w[i] = Math.max(44, ctx.w[i] + dx);
          ctx.now = w;
          apply(w);
          return ctx;
        },
        ctx => ctx.now && ls.set(key, ctx.now)
      );
      h.addEventListener('dblclick', e => {
        e.stopPropagation();
        ls.set(key, null);
        cols.forEach(c => (c.style.width = ''));
        t.style.minWidth = base;
        if (typeof render === 'function') render();
      });
    });
  }

  /* ---------- ตารางที่ยังไม่กำหนดคอลัมน์: 1 บรรทัดต่อแถว · ชื่อยาวตัด … · ลากขยายได้ · เลื่อนซ้าย/ขวาได้ ---------- */
  function autoTable(t) {
    const ths = t.tHead ? [...t.tHead.rows[0].cells] : [];
    if (!ths.length || !t.offsetWidth || ths.some(c => c.colSpan > 1)) return;
    t.style.tableLayout = 'auto';
    t.querySelectorAll('td').forEach(td => (td.style.whiteSpace = 'nowrap'));
    const w = ths.map(c => Math.max(44, Math.min(360, Math.ceil(c.getBoundingClientRect().width))));
    t.querySelectorAll('td').forEach(td => (td.style.whiteSpace = ''));
    t.style.tableLayout = '';
    // ให้พอดีกล่องเท่าที่ทำได้: ลดคอลัมน์ที่กว้างที่สุดก่อน · คอลัมน์ชื่อเหลืออย่างน้อย 280px คอลัมน์อื่น 120px
    // ไม่พอ = เลื่อนซ้าย/ขวาดู · ลากขอบหัวคอลัมน์ขยายเองได้
    const room = (t.parentElement?.clientWidth || 0) - 2,
      floor = ths.map((c, i) => Math.min(w[i], /ชื่อ|description|name/i.test(c.textContent) ? 280 : 120)),
      sum = () => w.reduce((a, b) => a + b, 0);
    for (let k = 0; k < 400 && room > 0 && sum() > room; k++) {
      const cand = w.map((x, i) => (x > floor[i] ? x : -1)),
        i = cand.indexOf(Math.max(...cand));
      if (cand[i] < 0) break;
      w[i] = Math.max(floor[i], w[i] - Math.min(20, sum() - room));
    }
    const cg = document.createElement('colgroup');
    w.forEach(px => {
      const c = document.createElement('col');
      c.style.width = px + 'px';
      cg.appendChild(c);
    });
    t.insertBefore(cg, t.firstChild);
    t.style.minWidth = w.reduce((a, b) => a + b, 0) + 'px';
    t.classList.add('tauto', 'tfix');
    t.querySelectorAll('td').forEach(td => !td.title && td.textContent.trim() && !td.querySelector('input,select,button') && (td.title = td.textContent.trim()));
  }
  // ตารางรายงานกำหนดคอลัมน์เป็น % : ให้มีความกว้างขั้นต่ำ จอเล็กจะเลื่อนซ้าย/ขวาแทนการบีบชื่อ
  function minTable(t) {
    const n = t.querySelectorAll(':scope > colgroup > col').length;
    if (n && !t.style.minWidth) t.style.minWidth = Math.max(720, n * 90) + 'px';
  }

  /* ---------- เส้นแบ่งกล่องซ้าย/ขวา ---------- */
  function setupPair(row) {
    row.dataset.split = '1';
    const kids = [...row.children],
      left = kids.find(k => k.classList.contains('grow')),
      side = kids.find(k => k.classList.contains('side'));
    if (!left || !side || left.nextElementSibling !== side) return;
    const key = 'rszSide',
      sv = ls.get(key),
      orig = side.style.flex;
    if (sv) side.style.flex = `0 0 ${sv}px`;
    const bar = document.createElement('div');
    bar.className = 'pair-split';
    bar.title = 'ลากเพื่อย่อ/ขยายกล่องด้านขวา · ดับเบิลคลิก = ขนาดเดิม';
    bar.setAttribute('aria-hidden', 'true');
    row.insertBefore(bar, side);
    drag(
      bar,
      (dx, ctx) => {
        if (dx === null) return { w: side.getBoundingClientRect().width, max: row.getBoundingClientRect().width * 0.7 };
        ctx.now = Math.round(Math.min(ctx.max, Math.max(220, ctx.w - dx)));
        side.style.flex = `0 0 ${ctx.now}px`;
        return ctx;
      },
      ctx => ctx.now && ls.set(key, ctx.now)
    );
    bar.addEventListener('dblclick', () => {
      ls.set(key, null);
      side.style.flex = orig;
    });
  }

  const scan = () => {
    document.querySelectorAll('.tbl-wrap > table:not(.tfix)').forEach(autoTable);
    document.querySelectorAll('table.tfix:not([data-rsz])').forEach(t => (minTable(t), setupTable(t)));
    document.querySelectorAll('.row.pair:not([data-split])').forEach(setupPair);
  };
  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  scan();
})();
