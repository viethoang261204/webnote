/* WebNote – sổ tay công việc theo tháng & ghi chú lớp học.
   Toàn bộ dữ liệu lưu trong localStorage của trình duyệt. */
(() => {
  'use strict';

  const STORE_KEY = 'webnote.data.v1';
  const THEME_KEY = 'webnote.theme';
  const COLORS = ['#3b5bdb', '#0ca678', '#f59f00', '#e03131', '#ae3ec9', '#1098ad', '#f76707', '#5c940d', '#868e96'];
  const WEEKDAYS = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
  const PRIORITY_LABEL = { low: 'Thấp', med: 'Vừa', high: 'Cao' };
  const PRIORITY_RANK = { high: 0, med: 1, low: 2 };

  /* ---------- Helpers ---------- */
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const todayStr = () => ymd(new Date());
  const fmtDate = (s) => { const d = parseYmd(s); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  /* Thông báo nổi. type: 'ok' | 'danger' | 'warn'. undo: hàm hoàn tác (hiện nút "Hoàn tác"). */
  let toastUndo = null;
  function toast(msg, { type = 'ok', undo = null } = {}) {
    const el = $('#toast');
    el.className = `toast ${type}`;
    $('#toastIco').textContent = type === 'danger' ? '🗑' : type === 'warn' ? '⚠' : '✓';
    $('#toastMsg').textContent = msg;
    toastUndo = undo;
    $('#toastAction').classList.toggle('hidden', !undo);
    void el.offsetWidth; // khởi động lại hiệu ứng
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(hideToast, undo ? 6000 : 2500);
  }
  function hideToast() { $('#toast').classList.remove('show'); toastUndo = null; }
  $('#toastClose').onclick = hideToast;
  $('#toastAction').onclick = () => { const fn = toastUndo; hideToast(); if (fn) fn(); };

  /* Hộp xác nhận rõ ràng thay cho confirm() của trình duyệt.
     Trả về Promise với value của nút được bấm, hoặc null nếu huỷ. */
  function confirmBox({ title, message = '', detail = '', icon = '!', actions }) {
    const dlg = $('#confirmDialog');
    $('#cfIcon').textContent = icon;
    $('#cfTitle').textContent = title;
    $('#cfMsg').textContent = message;
    $('#cfDetail').textContent = detail;
    $('#cfDetail').classList.toggle('hidden', !detail);
    const acts = actions || [{ label: 'Xoá', value: true, cls: 'btn-danger solid' }];
    $('#cfActions').innerHTML = '<button type="button" class="btn-sm" data-i="-1">Huỷ</button>' +
      acts.map((a, i) => `<button type="button" class="${a.cls || 'btn-danger'}" data-i="${i}">${esc(a.label)}</button>`).join('');
    return new Promise((resolve) => {
      let result = null;
      $('#cfActions').onclick = (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        const i = Number(b.dataset.i);
        result = i < 0 ? null : acts[i].value;
        dlg.close();
      };
      dlg.onclose = () => resolve(result);
      dlg.showModal();
      $('#cfActions button:last-child').focus();
    });
  }

  /* ---------- Data ---------- */
  function seed() {
    const t = todayStr();
    const classId = uid();
    return {
      tasks: [
        { id: uid(), title: 'Chào mừng! Bấm vào ô để mở chi tiết', date: t, time: '', priority: 'med', category: 'Hướng dẫn', note: 'Tích ô vuông bên trái để đánh dấu hoàn thành.', done: false },
      ],
      classes: [{ id: classId, name: 'Lớp mẫu', teacher: '', schedule: '', color: COLORS[0] }],
      notes: [{
        id: uid(), classId, title: 'Buổi 1 – Giới thiệu', date: t, tags: ['mẫu'], pinned: true, updated: Date.now(),
        content: '# Nội dung chính\n\n- Ý **quan trọng** cần nhớ\n- Công thức: `a² + b² = c²`\n- ==Sẽ có trong bài kiểm tra==\n\n## Bài tập về nhà\n\n- [ ] Làm bài 1, 2, 3\n- [x] Đọc chương 1\n\n> Ghi chú hỗ trợ định dạng nhanh – bấm tab **Xem** để xem kết quả.',
      }],
    };
  }

  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(STORE_KEY));
      if (d && Array.isArray(d.tasks) && Array.isArray(d.notes) && Array.isArray(d.classes)) return migrate(d);
    } catch { /* fall through */ }
    return migrate(seed());
  }
  // Bổ sung các trường mới cho dữ liệu cũ
  function migrate(d) {
    if (!Array.isArray(d.money)) d.money = [];
    if (!d.budgets || typeof d.budgets !== 'object') d.budgets = {};
    return d;
  }

  let db = load();
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(db)); }
    catch { toast('Không lưu được – bộ nhớ trình duyệt đầy hoặc bị chặn', { type: 'warn' }); }
  }

  /* ---------- UI state ---------- */
  const now = new Date();
  const ui = {
    view: 'tasks',
    year: now.getFullYear(),
    month: now.getMonth(),
    selDate: todayStr(),            // ngày "neo" (ngày bấm đầu tiên)
    selDates: new Set([todayStr()]), // tất cả các ngày đang được chọn
    taskMode: 'calendar',
    taskFilter: 'all',
    taskSearch: '',
    classId: 'all',
    noteId: null,
    noteSearch: '',
    editorMode: 'write',
    mYear: now.getFullYear(),
    mMonth: now.getMonth(),
    mType: 'out',      // loại của form thêm nhanh
    mFilter: 'all',    // all | in | out | day
    mDay: null,        // ngày được chọn trên biểu đồ
    mSearch: '',
    mCatType: 'out',
  };

  /* ================= THEME ================= */
  function applyTheme(t) { document.documentElement.dataset.theme = t; }
  let theme;
  try { theme = localStorage.getItem(THEME_KEY); } catch { /* ignore */ }
  if (!theme) theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  applyTheme(theme);
  $('#btnTheme').onclick = () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    applyTheme(theme);
    try { localStorage.setItem(THEME_KEY, theme); } catch { /* ignore */ }
  };

  /* ================= NAV ================= */
  function setView(v) {
    ui.view = v;
    $$('.nav-item').forEach((b) => b.classList.toggle('active', b.dataset.view === v));
    ['tasks', 'notes', 'money'].forEach((x) => $(`#view-${x}`).classList.toggle('hidden', v !== x));
    ({ tasks: renderTasks, notes: renderNotes, money: renderMoney })[v]();
    try { localStorage.setItem('webnote.view', v); } catch { /* ignore */ }
  }
  $$('.nav-item').forEach((b) => (b.onclick = () => setView(b.dataset.view)));

  /* ================= TASKS ================= */
  const monthKey = () => `${ui.year}-${pad(ui.month + 1)}`;
  const isOverdue = (t) => !t.done && t.date < todayStr();
  const sortTasks = (a, b) =>
    (a.done - b.done) || (a.time || '99').localeCompare(b.time || '99') || (PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);

  function tasksByDate() {
    const map = {};
    for (const t of db.tasks) (map[t.date] ||= []).push(t);
    for (const k in map) map[k].sort(sortTasks);
    return map;
  }

  function renderTasks() {
    $('#monthTitle').textContent = `Tháng ${ui.month + 1}, ${ui.year}`;
    renderStats();
    $('#calendarPanel').classList.toggle('hidden', ui.taskMode !== 'calendar');
    $('#listPanel').classList.toggle('hidden', ui.taskMode !== 'list');
    $$('#taskMode button').forEach((b) => b.classList.toggle('active', b.dataset.mode === ui.taskMode));
    if (ui.taskMode === 'calendar') renderCalendar(); else renderMonthList();
    renderDayPanel();
    renderCategoryList();
  }

  function renderStats() {
    const mk = monthKey();
    const list = db.tasks.filter((t) => t.date.startsWith(mk));
    const done = list.filter((t) => t.done).length;
    const overdue = list.filter(isOverdue).length;
    const pct = list.length ? Math.round((done / list.length) * 100) : 0;
    $('#stats').innerHTML = `
      <div class="stat"><div class="stat-label">Tổng việc</div><div class="stat-val">${list.length}</div></div>
      <div class="stat"><div class="stat-label">Hoàn thành</div><div class="stat-val">${done}</div></div>
      <div class="stat"><div class="stat-label">Tiến độ</div><div class="stat-val">${pct}%</div><div class="progress"><i style="width:${pct}%"></i></div></div>
      <div class="stat"><div class="stat-label">Quá hạn</div><div class="stat-val ${overdue ? 'warn' : ''}">${overdue}</div></div>`;
  }

  function renderCalendar() {
    const map = tasksByDate();
    const first = new Date(ui.year, ui.month, 1);
    const offset = (first.getDay() + 6) % 7; // thứ 2 đầu tuần
    const daysInMonth = new Date(ui.year, ui.month + 1, 0).getDate();
    const cells = Math.ceil((offset + daysInMonth) / 7) * 7;
    const today = todayStr();
    let html = '';
    for (let i = 0; i < cells; i++) {
      const d = new Date(ui.year, ui.month, 1 - offset + i);
      const key = ymd(d);
      const tasks = map[key] || [];
      const cls = ['cal-day'];
      if (d.getMonth() !== ui.month) cls.push('other');
      if (key === today) cls.push('today');
      if (ui.selDates.has(key)) cls.push('selected', ui.selDates.size > 1 ? 'multi' : '');
      if (d.getDay() === 0) cls.push('weekend');
      const left = tasks.filter((t) => !t.done).length;
      const chips = tasks.slice(0, 3).map((t) =>
        `<div class="chip ${t.priority} ${t.done ? 'done' : ''}" title="${esc(t.title)}">${t.time ? esc(t.time) + ' ' : ''}${esc(t.title)}</div>`).join('');
      const more = tasks.length > 3 ? `<div class="chip-more">+${tasks.length - 3} việc</div>` : '';
      const dots = tasks.length ? `<div class="cal-dots">${tasks.slice(0, 6).map((t) => `<i class="${t.priority} ${t.done ? 'done' : ''}"></i>`).join('')}</div>` : '';
      html += `<div class="${cls.join(' ')}" data-date="${key}">
        <div class="cal-num"><span>${d.getDate()}</span>${tasks.length ? `<span class="cal-badge">${left ? left + ' còn' : '✓'}</span>` : ''}</div>
        ${chips}${more}${dots}
      </div>`;
    }
    $('#calGrid').innerHTML = html;
  }

  /* ---- Chọn nhiều ngày: kéo chuột / Ctrl+click / Shift+click ---- */
  function rangeSet(a, b) {
    let [from, to] = a <= b ? [a, b] : [b, a];
    const set = new Set();
    for (let d = parseYmd(from); ymd(d) <= to; d.setDate(d.getDate() + 1)) set.add(ymd(d));
    return set;
  }

  // Chỉ đổi class trên các ô đang có (không vẽ lại lịch) để kéo mượt và không làm hỏng dblclick
  function paintSelection() {
    const multi = ui.selDates.size > 1;
    $$('#calGrid .cal-day').forEach((c) => {
      const on = ui.selDates.has(c.dataset.date);
      c.classList.toggle('selected', on);
      c.classList.toggle('multi', on && multi);
    });
  }

  let drag = null;
  const grid = $('#calGrid');
  grid.addEventListener('pointerdown', (e) => {
    const cell = e.target.closest('.cal-day');
    if (!cell || e.button !== 0) return;
    // preventDefault bên dưới không làm ô nhập mất focus -> tự blur để phím Backspace/Esc áp dụng cho lịch
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    const key = cell.dataset.date;
    if (e.ctrlKey || e.metaKey) {
      if (ui.selDates.has(key) && ui.selDates.size > 1) ui.selDates.delete(key);
      else ui.selDates.add(key);
      ui.selDate = ui.selDates.has(key) ? key : [...ui.selDates].sort()[0];
      paintSelection(); renderDayPanel();
      return;
    }
    if (e.shiftKey) {
      ui.selDates = rangeSet(ui.selDate, key);
      paintSelection(); renderDayPanel();
      return;
    }
    e.preventDefault();
    drag = { anchor: key, current: key };
    ui.selDate = key;
    ui.selDates = new Set([key]);
    paintSelection();
  });
  grid.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const cell = document.elementFromPoint(e.clientX, e.clientY)?.closest('.cal-day');
    if (!cell || cell.dataset.date === drag.current) return;
    drag.current = cell.dataset.date;
    ui.selDates = rangeSet(drag.anchor, drag.current);
    paintSelection();
  });
  const endDrag = () => {
    if (!drag) return;
    drag = null;
    const d = parseYmd(ui.selDate);
    // Bấm 1 ô thuộc tháng khác -> chuyển sang tháng đó
    if (ui.selDates.size === 1 && (d.getMonth() !== ui.month || d.getFullYear() !== ui.year)) selectDate(ui.selDate);
    else renderDayPanel();
  };
  document.addEventListener('pointerup', endDrag);
  document.addEventListener('pointercancel', endDrag);

  grid.addEventListener('dblclick', (e) => {
    const cell = e.target.closest('.cal-day');
    if (cell) { selectDate(cell.dataset.date); openTaskDialog(null); }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && ui.view === 'tasks' && ui.selDates.size > 1 && !document.querySelector('dialog[open]')) {
      selectDate(ui.selDate);
    }
  });

  function selectDate(key) {
    ui.selDate = key;
    ui.selDates = new Set([key]);
    const d = parseYmd(key);
    if (d.getFullYear() !== ui.year || d.getMonth() !== ui.month) {
      ui.year = d.getFullYear();
      ui.month = d.getMonth();
    }
    renderTasks();
  }

  // Các công việc cùng chuỗi (tạo cùng lúc trên nhiều ngày), sắp theo ngày
  const groupOf = (t) => (t.groupId ? db.tasks.filter((x) => x.groupId === t.groupId).sort((a, b) => a.date.localeCompare(b.date)) : [t]);

  function taskItemHtml(t, showDate = false) {
    const meta = [];
    if (showDate) meta.push(`<span>${fmtDate(t.date)}</span>`);
    if (t.time) meta.push(`<span>🕒 ${esc(t.time)}</span>`);
    const g = groupOf(t);
    if (g.length > 1) meta.push(`<span class="series" title="Công việc lặp trên nhiều ngày">↔ Ngày ${g.indexOf(t) + 1}/${g.length}</span>`);
    meta.push(`<span>${PRIORITY_LABEL[t.priority]}</span>`);
    if (t.category) meta.push(`<span class="tag">${esc(t.category)}</span>`);
    if (isOverdue(t)) meta.push('<span class="overdue">Quá hạn</span>');
    return `<li class="task ${t.priority} ${t.done ? 'done' : ''}" data-id="${t.id}">
      <input type="checkbox" ${t.done ? 'checked' : ''} aria-label="Hoàn thành">
      <div class="task-main">
        <div class="task-title">${esc(t.title)}</div>
        <div class="task-meta">${meta.join('')}</div>
        ${t.note ? `<div class="task-note">${esc(t.note)}</div>` : ''}
      </div>
      <button class="icon-btn danger task-del" title="Xoá">×</button>
    </li>`;
  }

  const fmtShort = (s) => { const d = parseYmd(s); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`; };

  function describeDates(dates) {
    const contiguous = rangeSet(dates[0], dates[dates.length - 1]).size === dates.length;
    if (contiguous) return `${fmtShort(dates[0])} → ${fmtShort(dates[dates.length - 1])}`;
    return dates.length <= 5 ? dates.map(fmtShort).join(', ') : `${dates.slice(0, 4).map(fmtShort).join(', ')}… (+${dates.length - 4})`;
  }

  function renderDayPanel() {
    const dates = [...ui.selDates].sort();
    const multi = dates.length > 1;
    const list = db.tasks.filter((t) => ui.selDates.has(t.date)).sort((a, b) => a.date.localeCompare(b.date) || sortTasks(a, b));
    const done = list.filter((t) => t.done).length;

    if (multi) {
      $('#dayWeekday').textContent = `Đang chọn ${dates.length} ngày`;
      $('#dayDate').textContent = describeDates(dates);
      $('#qaTitle').placeholder = `Thêm 1 việc cho cả ${dates.length} ngày… (Enter)`;
    } else {
      const d = parseYmd(ui.selDate);
      $('#dayWeekday').textContent = ui.selDate === todayStr() ? `Hôm nay · ${WEEKDAYS[d.getDay()]}` : WEEKDAYS[d.getDay()];
      $('#dayDate').textContent = fmtDate(ui.selDate);
      $('#qaTitle').placeholder = 'Thêm việc cho ngày này… (Enter)';
    }
    $('#clearSel').hidden = !multi;
    $('#dayCount').textContent = list.length ? `${done}/${list.length} xong` : 'Trống';

    if (!list.length) {
      $('#dayTasks').innerHTML = `<li class="empty-line">${multi ? 'Các ngày này chưa có việc nào.' : 'Chưa có việc nào. Thêm ở ô phía trên nhé.'}</li>`;
    } else if (multi) {
      const groups = {};
      for (const t of list) (groups[t.date] ||= []).push(t);
      $('#dayTasks').innerHTML = Object.entries(groups).map(([date, ts]) =>
        `<li><h4 class="list-group-head">${WEEKDAYS[parseYmd(date).getDay()]}, ${fmtShort(date)}</h4>
          <ul class="task-list">${ts.map((t) => taskItemHtml(t)).join('')}</ul></li>`).join('');
    } else {
      $('#dayTasks').innerHTML = list.map((t) => taskItemHtml(t)).join('');
    }

    const overdueCount = db.tasks.filter(isOverdue).length;
    const btn = $('#carryOver');
    btn.hidden = !(!multi && ui.selDate === todayStr() && overdueCount);
    btn.textContent = `↪ Dời ${overdueCount} việc quá hạn sang hôm nay`;
  }
  $('#clearSel').onclick = () => selectDate(ui.selDate);

  function renderMonthList() {
    const mk = monthKey();
    const q = ui.taskSearch.trim().toLowerCase();
    let list = db.tasks.filter((t) => t.date.startsWith(mk));
    if (ui.taskFilter === 'todo') list = list.filter((t) => !t.done);
    if (ui.taskFilter === 'done') list = list.filter((t) => t.done);
    if (ui.taskFilter === 'overdue') list = list.filter(isOverdue);
    if (q) list = list.filter((t) => (t.title + ' ' + (t.category || '') + ' ' + (t.note || '')).toLowerCase().includes(q));
    list.sort((a, b) => a.date.localeCompare(b.date) || sortTasks(a, b));
    $$('#taskFilter button').forEach((b) => b.classList.toggle('active', b.dataset.f === ui.taskFilter));
    if (!list.length) { $('#monthList').innerHTML = '<div class="empty-line">Không có công việc phù hợp.</div>'; return; }
    const groups = {};
    for (const t of list) (groups[t.date] ||= []).push(t);
    const today = todayStr();
    $('#monthList').innerHTML = Object.entries(groups).map(([date, ts]) => {
      const d = parseYmd(date);
      return `<div class="list-group">
        <h4 class="list-group-head ${date === today ? 'today' : ''}">${WEEKDAYS[d.getDay()]}, ${fmtDate(date)}${date === today ? ' · Hôm nay' : ''}</h4>
        <ul class="task-list">${ts.map((t) => taskItemHtml(t)).join('')}</ul>
      </div>`;
    }).join('');
  }

  function renderCategoryList() {
    const cats = [...new Set(db.tasks.map((t) => t.category).filter(Boolean))].sort();
    $('#catList').innerHTML = cats.map((c) => `<option value="${esc(c)}">`).join('');
  }

  // Task list interactions (dùng chung cho panel ngày và danh sách tháng)
  function onTaskListClick(e) {
    const li = e.target.closest('.task');
    if (!li) return;
    const t = db.tasks.find((x) => x.id === li.dataset.id);
    if (!t) return;
    if (e.target.matches('input[type="checkbox"]')) {
      t.done = e.target.checked;
      save(); renderTasks();
      if (t.done) toast(`Hoàn thành: ${t.title}`);
    } else if (e.target.closest('.task-del')) {
      askDeleteTask(t);
    } else if (e.target.closest('.task-main')) {
      openTaskDialog(t);
    }
  }
  $('#dayTasks').addEventListener('click', onTaskListClick);
  $('#monthList').addEventListener('click', onTaskListClick);

  /* Xoá có xác nhận rõ ràng + thông báo kèm nút Hoàn tác (hoặc Ctrl+Z) */
  let lastDeleted = null;
  function restoreDeleted() {
    if (!lastDeleted) return;
    db.tasks.push(...lastDeleted);
    toast(`Đã khôi phục ${lastDeleted.length > 1 ? lastDeleted.length + ' công việc' : '"' + lastDeleted[0].title + '"'}`);
    lastDeleted = null;
    save(); renderTasks();
  }
  function deleteTasks(ids) {
    const set = new Set(ids);
    const removed = db.tasks.filter((x) => set.has(x.id));
    if (!removed.length) return;
    db.tasks = db.tasks.filter((x) => !set.has(x.id));
    lastDeleted = removed;
    save(); renderTasks();
    const sameSeries = removed[0].groupId && removed.every((x) => x.groupId === removed[0].groupId);
    const msg = removed.length === 1 ? `Đã xoá "${removed[0].title}" (${fmtShort(removed[0].date)})`
      : sameSeries ? `Đã xoá "${removed[0].title}" khỏi ${removed.length} ngày`
      : `Đã xoá ${removed.length} công việc`;
    toast(msg, { type: 'danger', undo: restoreDeleted });
  }
  async function askDeleteTask(t) {
    const g = groupOf(t);
    if (g.length > 1) {
      const choice = await confirmBox({
        title: 'Xoá công việc lặp nhiều ngày?',
        message: `"${t.title}" đang có trên ${g.length} ngày. Bạn muốn xoá ngày nào?`,
        detail: `Ngày đang chọn: ${WEEKDAYS[parseYmd(t.date).getDay()]}, ${fmtDate(t.date)}\nCả chuỗi: ${describeDates(g.map((x) => x.date))}`,
        icon: '🗑',
        actions: [
          { label: 'Chỉ ngày này', value: 'one', cls: 'btn-danger' },
          { label: `Xoá cả ${g.length} ngày`, value: 'all', cls: 'btn-danger solid' },
        ],
      });
      if (choice === 'one') deleteTasks([t.id]);
      if (choice === 'all') deleteTasks(g.map((x) => x.id));
      return choice;
    }
    const ok = await confirmBox({
      title: 'Xoá công việc này?',
      message: 'Bạn vẫn có thể hoàn tác ngay sau khi xoá.',
      detail: `${t.title}\n${WEEKDAYS[parseYmd(t.date).getDay()]}, ${fmtDate(t.date)}${t.time ? ' · ' + t.time : ''}`,
      icon: '🗑',
      actions: [{ label: 'Xoá công việc', value: true, cls: 'btn-danger solid' }],
    });
    if (ok) deleteTasks([t.id]);
    return ok;
  }
  // Bôi đen ngày trên lịch rồi bấm Backspace / Delete -> xoá các việc trong những ngày đó
  document.addEventListener('keydown', async (e) => {
    if (e.key !== 'Backspace' && e.key !== 'Delete') return;
    if (ui.view !== 'tasks' || e.target.matches('input, textarea, select') || document.querySelector('dialog[open]')) return;
    e.preventDefault();
    const dates = [...ui.selDates].sort();
    const list = db.tasks.filter((t) => ui.selDates.has(t.date)).sort((a, b) => a.date.localeCompare(b.date) || sortTasks(a, b));
    const where = dates.length > 1 ? `${dates.length} ngày đã chọn (${describeDates(dates)})` : `ngày ${fmtDate(dates[0])}`;
    if (!list.length) { toast(`Không có công việc nào trong ${where}`, { type: 'warn' }); return; }
    const MAX = 10;
    const ok = await confirmBox({
      title: `Xoá ${list.length} công việc?`,
      message: `Toàn bộ công việc trong ${where} sẽ bị xoá.`,
      detail: list.slice(0, MAX).map((t) => `${t.done ? '✓' : '○'} ${fmtShort(t.date)} · ${t.title}`).join('\n') +
        (list.length > MAX ? `\n… và ${list.length - MAX} việc khác` : ''),
      icon: '🗑',
      actions: [{ label: `Xoá ${list.length} công việc`, value: true, cls: 'btn-danger solid' }],
    });
    if (ok) deleteTasks(list.map((t) => t.id));
  });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && lastDeleted && ui.view === 'tasks'
      && !e.target.matches('input, textarea') && !document.querySelector('dialog[open]')) {
      e.preventDefault();
      hideToast();
      restoreDeleted();
    }
  });

  // Tạo 1 công việc trên tất cả các ngày đã chọn (cùng groupId nếu > 1 ngày)
  function addTaskToDates(dates, data) {
    const groupId = dates.length > 1 ? uid() : '';
    for (const date of dates) db.tasks.push({ id: uid(), ...data, date, done: false, groupId });
    save(); renderTasks();
    toast(dates.length > 1 ? `Đã thêm "${data.title}" vào ${dates.length} ngày` : `Đã thêm "${data.title}"`);
  }

  $('#quickAdd').addEventListener('submit', (e) => {
    e.preventDefault();
    const title = $('#qaTitle').value.trim();
    if (!title) return;
    addTaskToDates([...ui.selDates].sort(), { title, time: '', priority: $('#qaPriority').value, category: '', note: '' });
    $('#qaTitle').value = '';
    $('#qaTitle').focus();
  });

  $('#carryOver').onclick = () => {
    const t = todayStr();
    let n = 0;
    db.tasks.forEach((x) => { if (isOverdue(x)) { x.date = t; n++; } });
    save(); renderTasks();
    toast(`Đã dời ${n} việc quá hạn sang hôm nay`);
  };

  $('#prevMonth').onclick = () => shiftMonth(-1);
  $('#nextMonth').onclick = () => shiftMonth(1);
  $('#todayBtn').onclick = () => selectDate(todayStr());
  function shiftMonth(delta) {
    const d = new Date(ui.year, ui.month + delta, 1);
    ui.year = d.getFullYear();
    ui.month = d.getMonth();
    // Giữ ngày được chọn trong tháng đang xem
    const sel = parseYmd(ui.selDate);
    const day = Math.min(sel.getDate(), new Date(ui.year, ui.month + 1, 0).getDate());
    ui.selDate = ymd(new Date(ui.year, ui.month, day));
    renderTasks();
  }

  $$('#taskMode button').forEach((b) => (b.onclick = () => { ui.taskMode = b.dataset.mode; renderTasks(); }));
  $$('#taskFilter button').forEach((b) => (b.onclick = () => { ui.taskFilter = b.dataset.f; renderMonthList(); }));
  $('#taskSearch').addEventListener('input', (e) => { ui.taskSearch = e.target.value; renderMonthList(); });

  /* ---- Task dialog ---- */
  const taskDlg = $('#taskDialog');
  let editingTaskId = null;
  function openTaskDialog(task) {
    editingTaskId = task ? task.id : null;
    const dates = [...ui.selDates].sort();
    const multiNew = !task && dates.length > 1;
    const g = task ? groupOf(task) : [];
    $('#taskDlgTitle').textContent = task ? 'Sửa công việc' : multiNew ? `Thêm công việc cho ${dates.length} ngày` : 'Thêm công việc';
    $('#tDateWrap').classList.toggle('hidden', multiNew);
    $('#tMultiInfo').classList.toggle('hidden', !multiNew);
    $('#tMultiInfo').textContent = multiNew ? `📅 Sẽ thêm vào ${dates.length} ngày: ${describeDates(dates)}` : '';
    $('#tGroupWrap').classList.toggle('hidden', g.length < 2);
    $('#tApplyGroup').checked = true;
    $('#tGroupLabel').textContent = `Áp dụng thay đổi (tên, giờ, ưu tiên, phân loại, ghi chú) cho cả ${g.length} ngày trong chuỗi`;
    $('#tDeleteGroup').classList.toggle('hidden', g.length < 2);
    $('#tDeleteGroup').textContent = `Xoá cả ${g.length} ngày`;
    $('#tDelete').textContent = g.length > 1 ? 'Xoá ngày này' : 'Xoá';
    $('#tTitle').value = task?.title || '';
    $('#tDate').value = task?.date || ui.selDate;
    $('#tTime').value = task?.time || '';
    $('#tPriority').value = task?.priority || 'med';
    $('#tCategory').value = task?.category || '';
    $('#tNote').value = task?.note || '';
    $('#tDone').checked = !!task?.done;
    $('#tDelete').classList.toggle('hidden', !task);
    taskDlg.showModal();
    $('#tTitle').focus();
  }
  $('#taskForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = {
      title: $('#tTitle').value.trim(),
      date: $('#tDate').value,
      time: $('#tTime').value,
      priority: $('#tPriority').value,
      category: $('#tCategory').value.trim(),
      note: $('#tNote').value.trim(),
      done: $('#tDone').checked,
    };
    if (!data.title || !data.date) return;
    taskDlg.close();
    if (!editingTaskId) {
      const dates = ui.selDates.size > 1 ? [...ui.selDates].sort() : [data.date];
      const { date, done, ...rest } = data;
      addTaskToDates(dates, rest);
      if (dates.length === 1) selectDate(data.date);
      return;
    }
    const task = db.tasks.find((t) => t.id === editingTaskId);
    const g = groupOf(task);
    if (g.length > 1 && $('#tApplyGroup').checked) {
      const { date, done, ...shared } = data;
      g.forEach((x) => Object.assign(x, shared));
    }
    Object.assign(task, data);
    save();
    toast(g.length > 1 && $('#tApplyGroup').checked ? `Đã cập nhật cả ${g.length} ngày` : 'Đã lưu công việc');
    if (ui.selDates.has(data.date)) renderTasks(); else selectDate(data.date);
  });
  $('#tCancel').onclick = () => taskDlg.close();
  $('#tDelete').onclick = async () => {
    const t = db.tasks.find((x) => x.id === editingTaskId);
    taskDlg.close();
    if (groupOf(t).length > 1) deleteTasks([t.id]); // đã chọn rõ "Xoá ngày này"
    else if (!(await askDeleteTask(t))) openTaskDialog(t);
  };
  $('#tDeleteGroup').onclick = async () => {
    const t = db.tasks.find((x) => x.id === editingTaskId);
    const g = groupOf(t);
    taskDlg.close();
    const ok = await confirmBox({
      title: `Xoá cả ${g.length} ngày?`,
      message: `Công việc "${t.title}" sẽ bị xoá khỏi tất cả các ngày trong chuỗi.`,
      detail: g.map((x) => `${x.done ? '✓' : '○'} ${WEEKDAYS[parseYmd(x.date).getDay()]}, ${fmtDate(x.date)}`).join('\n'),
      icon: '🗑',
      actions: [{ label: `Xoá ${g.length} công việc`, value: true, cls: 'btn-danger solid' }],
    });
    if (ok) deleteTasks(g.map((x) => x.id)); else openTaskDialog(t);
  };

  /* ================= NOTES ================= */
  const notesBody = document.querySelector('.notes-body');
  const classById = (id) => db.classes.find((c) => c.id === id);

  function renderNotes() {
    renderClassList();
    renderNoteList();
    renderEditor();
  }

  function renderClassList() {
    const count = (id) => db.notes.filter((n) => n.classId === id).length;
    let html = `<li class="class-item ${ui.classId === 'all' ? 'active' : ''}" data-id="all">
      <span class="dot" style="background:var(--text-2)"></span><span class="class-name">Tất cả ghi chú</span><span class="class-count">${db.notes.length}</span></li>`;
    const orphan = db.notes.filter((n) => !classById(n.classId)).length;
    if (orphan) html += `<li class="class-item ${ui.classId === 'none' ? 'active' : ''}" data-id="none">
      <span class="dot"></span><span class="class-name">Chưa phân lớp</span><span class="class-count">${orphan}</span></li>`;
    html += '<li class="class-sep"></li>';
    html += db.classes.map((c) => `<li class="class-item ${ui.classId === c.id ? 'active' : ''}" data-id="${c.id}">
      <span class="dot" style="background:${esc(c.color)}"></span>
      <span class="class-name">${esc(c.name)}${c.schedule ? `<span class="class-sub">${esc(c.schedule)}</span>` : ''}</span>
      <span class="class-count">${count(c.id)}</span>
      <button class="icon-btn class-edit" title="Sửa lớp">✎</button></li>`).join('');
    if (!db.classes.length) html += '<li class="empty-line">Chưa có lớp nào.<br>Bấm + để thêm.</li>';
    $('#classList').innerHTML = html;
  }

  $('#classList').addEventListener('click', (e) => {
    const li = e.target.closest('.class-item');
    if (!li) return;
    if (e.target.closest('.class-edit')) { openClassDialog(classById(li.dataset.id)); return; }
    ui.classId = li.dataset.id;
    renderClassList(); renderNoteList();
  });

  function filteredNotes() {
    let list = db.notes;
    if (ui.classId === 'none') list = list.filter((n) => !classById(n.classId));
    else if (ui.classId !== 'all') list = list.filter((n) => n.classId === ui.classId);
    const q = ui.noteSearch.trim().toLowerCase();
    if (q) {
      if (q.startsWith('#')) {
        const tag = q.slice(1);
        list = list.filter((n) => n.tags.some((t) => t.toLowerCase().includes(tag)));
      } else {
        list = list.filter((n) => (n.title + ' ' + n.content + ' ' + n.tags.join(' ')).toLowerCase().includes(q));
      }
    }
    return [...list].sort((a, b) => (b.pinned - a.pinned) || b.date.localeCompare(a.date) || b.updated - a.updated);
  }

  function snippet(s) {
    return s.replace(/[#>*`=_~\-\[\]]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
  }

  function renderNoteList() {
    const list = filteredNotes();
    $('#noteList').innerHTML = list.length ? list.map((n) => {
      const c = classById(n.classId);
      return `<li class="note-item ${n.id === ui.noteId ? 'active' : ''}" data-id="${n.id}">
        <div class="note-item-title">${n.pinned ? '<b class="pin-mark">★</b>' : ''}<span>${esc(n.title || 'Không tiêu đề')}</span></div>
        <div class="note-item-meta"><span class="dot" style="background:${esc(c?.color || '')}"></span>${esc(c?.name || 'Chưa phân lớp')} · ${fmtDate(n.date)}</div>
        ${n.content ? `<div class="note-item-snip">${esc(snippet(n.content))}</div>` : ''}
      </li>`;
    }).join('') : `<li class="empty-line">${ui.noteSearch ? 'Không tìm thấy ghi chú.' : 'Chưa có ghi chú.'}</li>`;
  }

  $('#noteList').addEventListener('click', (e) => {
    const li = e.target.closest('.note-item');
    if (!li) return;
    ui.noteId = li.dataset.id;
    renderNoteList(); renderEditor();
  });
  $('#noteSearch').addEventListener('input', (e) => { ui.noteSearch = e.target.value; renderNoteList(); });

  $('#addNote').onclick = () => {
    const classId = ui.classId !== 'all' && ui.classId !== 'none' ? ui.classId : (db.classes[0]?.id || '');
    const n = { id: uid(), classId, title: '', date: todayStr(), tags: [], pinned: false, content: '', updated: Date.now() };
    db.notes.push(n);
    ui.noteId = n.id;
    ui.noteSearch = ''; $('#noteSearch').value = '';
    ui.editorMode = 'write';
    save(); renderNotes();
    $('#noteTitle').focus();
  };

  const currentNote = () => db.notes.find((n) => n.id === ui.noteId);

  function renderEditor() {
    const n = currentNote();
    $('#editorEmpty').classList.toggle('hidden', !!n);
    $('#editorWrap').classList.toggle('hidden', !n);
    notesBody.classList.toggle('editing', !!n);
    if (!n) return;
    $('#noteTitle').value = n.title;
    $('#noteDate').value = n.date;
    $('#noteTags').value = n.tags.join(', ');
    $('#noteContent').value = n.content;
    $('#noteClass').innerHTML = '<option value="">— Chưa phân lớp —</option>' +
      db.classes.map((c) => `<option value="${c.id}" ${c.id === n.classId ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
    $('#notePin').classList.toggle('on', n.pinned);
    $('#notePin').textContent = n.pinned ? '★' : '☆';
    $('#saveState').textContent = 'Đã lưu · ' + new Date(n.updated).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
    setEditorMode(ui.editorMode);
  }

  function setEditorMode(mode) {
    ui.editorMode = mode;
    $$('#editorMode button').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
    $('#noteContent').classList.toggle('hidden', mode !== 'write');
    $('#notePreview').classList.toggle('hidden', mode !== 'preview');
    if (mode === 'preview') $('#notePreview').innerHTML = renderMarkdown(currentNote()?.content || '') || '<p style="color:var(--text-3)">Ghi chú trống.</p>';
  }
  $$('#editorMode button').forEach((b) => (b.onclick = () => setEditorMode(b.dataset.mode)));

  const persistNote = debounce(() => {
    save();
    renderNoteList();
    renderClassList();
    $('#saveState').textContent = 'Đã lưu';
  }, 400);

  function updateNote(patch) {
    const n = currentNote();
    if (!n) return;
    Object.assign(n, patch, { updated: Date.now() });
    $('#saveState').textContent = 'Đang lưu…';
    persistNote();
  }
  $('#noteTitle').addEventListener('input', (e) => updateNote({ title: e.target.value }));
  $('#noteContent').addEventListener('input', (e) => updateNote({ content: e.target.value }));
  $('#noteDate').addEventListener('change', (e) => e.target.value && updateNote({ date: e.target.value }));
  $('#noteClass').addEventListener('change', (e) => updateNote({ classId: e.target.value }));
  $('#noteTags').addEventListener('input', (e) =>
    updateNote({ tags: [...new Set(e.target.value.split(',').map((s) => s.trim().replace(/^#/, '')).filter(Boolean))] }));

  // Tab trong ô soạn thảo -> chèn 2 khoảng trắng
  $('#noteContent').addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    const ta = e.target, s = ta.selectionStart;
    ta.setRangeText('  ', s, ta.selectionEnd, 'end');
    updateNote({ content: ta.value });
  });

  // Click checkbox trong chế độ xem -> cập nhật nội dung gốc
  $('#notePreview').addEventListener('change', (e) => {
    if (!e.target.matches('input[data-line]')) return;
    const n = currentNote();
    const lines = n.content.split('\n');
    const i = Number(e.target.dataset.line);
    lines[i] = lines[i].replace(/\[( |x|X)\]/, e.target.checked ? '[x]' : '[ ]');
    updateNote({ content: lines.join('\n') });
    setEditorMode('preview');
  });

  $('#notePin').onclick = () => {
    const n = currentNote();
    updateNote({ pinned: !n.pinned });
    renderEditor();
  };
  $('#noteDelete').onclick = async () => {
    const n = currentNote();
    if (!n) return;
    const c = classById(n.classId);
    const ok = await confirmBox({
      title: 'Xoá ghi chú này?',
      message: 'Bạn vẫn có thể hoàn tác ngay sau khi xoá.',
      detail: `${n.title || 'Không tiêu đề'}\n${c ? c.name : 'Chưa phân lớp'} · ${fmtDate(n.date)}${n.content ? ' · ' + n.content.length + ' ký tự' : ''}`,
      icon: '🗑',
      actions: [{ label: 'Xoá ghi chú', value: true, cls: 'btn-danger solid' }],
    });
    if (!ok) return;
    const idx = db.notes.indexOf(n);
    db.notes.splice(idx, 1);
    ui.noteId = null;
    save(); renderNotes();
    toast(`Đã xoá ghi chú "${n.title || 'Không tiêu đề'}"`, {
      type: 'danger',
      undo: () => { db.notes.splice(idx, 0, n); ui.noteId = n.id; save(); renderNotes(); toast('Đã khôi phục ghi chú'); },
    });
  };
  $('#backToList').onclick = () => { ui.noteId = null; renderNotes(); };

  /* ---- Markdown (tối giản, an toàn: escape trước rồi mới định dạng) ---- */
  function inline(s) {
    return s
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
      .replace(/==([^=]+)==/g, '<mark>$1</mark>')
      .replace(/~~([^~]+)~~/g, '<del>$1</del>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  }

  function renderMarkdown(src) {
    const lines = src.split('\n');
    let html = '', list = null, inCode = false, code = [], para = [];
    const flushPara = () => { if (para.length) { html += `<p>${para.map((l) => inline(esc(l))).join('<br>')}</p>`; para = []; } };
    const closeList = () => { if (list) { html += `</${list}>`; list = null; } };
    const openList = (type) => { if (list !== type) { closeList(); html += `<${type}>`; list = type; } };

    lines.forEach((raw, i) => {
      if (raw.trim().startsWith('```')) {
        if (inCode) { html += `<pre><code>${esc(code.join('\n'))}</code></pre>`; code = []; inCode = false; }
        else { flushPara(); closeList(); inCode = true; }
        return;
      }
      if (inCode) { code.push(raw); return; }
      let m;
      if (!raw.trim()) { flushPara(); closeList(); return; }
      if ((m = raw.match(/^(#{1,3})\s+(.*)$/))) { flushPara(); closeList(); html += `<h${m[1].length}>${inline(esc(m[2]))}</h${m[1].length}>`; return; }
      if (/^\s*(---+|\*\*\*+)\s*$/.test(raw)) { flushPara(); closeList(); html += '<hr>'; return; }
      if ((m = raw.match(/^>\s?(.*)$/))) { flushPara(); closeList(); html += `<blockquote>${inline(esc(m[1]))}</blockquote>`; return; }
      if ((m = raw.match(/^\s*[-*+]\s+\[( |x|X)\]\s+(.*)$/))) {
        flushPara(); openList('ul');
        const on = m[1] !== ' ';
        html += `<li class="check ${on ? 'done' : ''}"><label><input type="checkbox" data-line="${i}" ${on ? 'checked' : ''}><span>${inline(esc(m[2]))}</span></label></li>`;
        return;
      }
      if ((m = raw.match(/^\s*[-*+]\s+(.*)$/))) { flushPara(); openList('ul'); html += `<li>${inline(esc(m[1]))}</li>`; return; }
      if ((m = raw.match(/^\s*\d+[.)]\s+(.*)$/))) { flushPara(); openList('ol'); html += `<li>${inline(esc(m[1]))}</li>`; return; }
      closeList();
      para.push(raw);
    });
    if (inCode) html += `<pre><code>${esc(code.join('\n'))}</code></pre>`;
    flushPara(); closeList();
    return html;
  }

  /* ---- Class dialog ---- */
  const classDlg = $('#classDialog');
  let editingClassId = null, pickedColor = COLORS[0];
  function renderSwatches() {
    $('#cColors').innerHTML = COLORS.map((c) =>
      `<button type="button" data-c="${c}" class="${c === pickedColor ? 'active' : ''}" style="background:${c}" aria-label="Màu ${c}"></button>`).join('');
  }
  $('#cColors').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    pickedColor = b.dataset.c;
    renderSwatches();
  });
  function openClassDialog(c) {
    editingClassId = c?.id || null;
    $('#classDlgTitle').textContent = c ? 'Sửa lớp học' : 'Thêm lớp học';
    $('#cName').value = c?.name || '';
    $('#cTeacher').value = c?.teacher || '';
    $('#cSchedule').value = c?.schedule || '';
    pickedColor = c?.color || COLORS[db.classes.length % COLORS.length];
    renderSwatches();
    $('#cDelete').classList.toggle('hidden', !c);
    classDlg.showModal();
    $('#cName').focus();
  }
  $('#addClass').onclick = () => openClassDialog(null);
  $('#cCancel').onclick = () => classDlg.close();
  $('#classForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const data = { name: $('#cName').value.trim(), teacher: $('#cTeacher').value.trim(), schedule: $('#cSchedule').value.trim(), color: pickedColor };
    if (!data.name) return;
    if (editingClassId) Object.assign(classById(editingClassId), data);
    else { const c = { id: uid(), ...data }; db.classes.push(c); ui.classId = c.id; }
    save(); classDlg.close(); renderNotes();
  });
  $('#cDelete').onclick = async () => {
    const c = classById(editingClassId);
    const moved = db.notes.filter((x) => x.classId === c.id);
    classDlg.close();
    const ok = await confirmBox({
      title: `Xoá lớp "${c.name}"?`,
      message: moved.length
        ? `${moved.length} ghi chú của lớp sẽ được chuyển sang "Chưa phân lớp" – ghi chú KHÔNG bị mất.`
        : 'Lớp này chưa có ghi chú nào.',
      detail: moved.length ? moved.slice(0, 8).map((x) => '• ' + (x.title || 'Không tiêu đề')).join('\n') + (moved.length > 8 ? `\n… và ${moved.length - 8} ghi chú khác` : '') : '',
      icon: '🗑',
      actions: [{ label: 'Xoá lớp', value: true, cls: 'btn-danger solid' }],
    });
    if (!ok) { openClassDialog(c); return; }
    const idx = db.classes.indexOf(c);
    db.classes.splice(idx, 1);
    moved.forEach((x) => { x.classId = ''; });
    if (ui.classId === c.id) ui.classId = 'all';
    save(); renderNotes();
    toast(`Đã xoá lớp "${c.name}"`, {
      type: 'danger',
      undo: () => {
        db.classes.splice(idx, 0, c);
        moved.forEach((x) => { x.classId = c.id; });
        save(); renderNotes(); toast('Đã khôi phục lớp');
      },
    });
  };

  /* ================= THU CHI ================= */
  const CATS = {
    out: [['Ăn uống', '🍜'], ['Đi lại', '🛵'], ['Học tập', '📚'], ['Mua sắm', '🛍️'], ['Nhà ở & hoá đơn', '🏠'],
      ['Giải trí', '🎮'], ['Sức khoẻ', '💊'], ['Quà & hiếu hỉ', '🎁'], ['Khác', '📦']],
    in: [['Lương', '💼'], ['Làm thêm', '💻'], ['Gia đình cho', '👪'], ['Học bổng', '🎓'], ['Thưởng', '🎉'], ['Khác', '💰']],
  };
  const QUICK = { out: ['20k', '50k', '100k', '200k', '500k'], in: ['500k', '1tr', '2tr', '5tr', '10tr'] };
  const TYPE_LABEL = { in: 'khoản thu', out: 'khoản chi' };
  const catIcon = (type, name) => (CATS[type].find((c) => c[0] === name) || [0, type === 'in' ? '💰' : '📦'])[1];
  const fmtMoney = (n) => Math.round(n).toLocaleString('vi-VN') + ' đ';
  const fmtCompact = (n) => n >= 1e6 ? (n / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + 'tr'
    : n >= 1e3 ? Math.round(n / 1e3) + 'k' : String(Math.round(n));
  const mKey = () => `${ui.mYear}-${pad(ui.mMonth + 1)}`;
  const monthTx = (key) => db.money.filter((m) => m.date.startsWith(key));
  const sumOf = (list, type) => list.reduce((s, m) => s + (m.type === type ? m.amount : 0), 0);
  const budgetFor = (key) => db.budgets[key] || db.budgets.default || 0;

  /* "50k" -> 50000, "1.5tr" / "1,5tr" -> 1500000, "120.000" -> 120000. Trả NaN nếu không hợp lệ. */
  function parseAmount(str) {
    const s = String(str || '').toLowerCase().replace(/\s|đ|vnd|₫/g, '');
    if (!s) return 0;
    const m = s.match(/^([\d.,]+)(k|n|nghìn|ngàn|tr|triệu|trieu|m|củ|cu)?$/);
    if (!m) return NaN;
    let num = m[1];
    let mult = 1;
    if (m[2]) {
      mult = /^(k|n|nghìn|ngàn)$/.test(m[2]) ? 1e3 : 1e6;
      num = num.replace(',', '.');
      if ((num.match(/\./g) || []).length > 1) return NaN;
    } else {
      num = num.replace(/[.,]/g, '');
    }
    const v = parseFloat(num) * mult;
    return Number.isFinite(v) ? Math.round(v) : NaN;
  }

  function fillCategories(sel, type, current) {
    const opts = CATS[type].map((c) => c[0]);
    if (current && !opts.includes(current)) opts.unshift(current);
    sel.innerHTML = opts.map((c) => `<option value="${esc(c)}" ${c === current ? 'selected' : ''}>${catIcon(type, c)} ${esc(c)}</option>`).join('');
  }

  function renderMoney() {
    $('#mTitle').textContent = `Tháng ${ui.mMonth + 1}, ${ui.mYear}`;
    const list = monthTx(mKey());
    renderMoneyStats(list);
    renderDaily(list);
    renderCats(list);
    renderTxList(list);
    syncMoneyForm();
  }

  function renderMoneyStats(list) {
    const key = mKey();
    const inc = sumOf(list, 'in'), out = sumOf(list, 'out'), net = inc - out;
    const prev = new Date(ui.mYear, ui.mMonth - 1, 1);
    const prevOut = sumOf(monthTx(ymd(prev).slice(0, 7)), 'out');
    let cmp;
    if (prevOut > 0 && out > 0) {
      const pct = Math.round(((out - prevOut) / prevOut) * 100);
      cmp = pct === 0 ? 'Bằng tháng trước'
        : `<span class="${pct > 0 ? 'up' : 'down'}">${pct > 0 ? '▲' : '▼'} ${Math.abs(pct)}%</span> so với tháng trước`;
    } else {
      cmp = `${list.filter((m) => m.type === 'out').length} khoản chi`;
    }
    const nIn = list.filter((m) => m.type === 'in').length;

    const budget = budgetFor(key);
    let budgetHtml;
    if (budget) {
      const pct = Math.round((out / budget) * 100);
      const remain = budget - out;
      const isCurrent = key === todayStr().slice(0, 7);
      const daysLeft = new Date(ui.mYear, ui.mMonth + 1, 0).getDate() - new Date().getDate() + 1;
      const sub = remain < 0 ? `<span class="up">Vượt ${fmtMoney(-remain)}</span>`
        : `Còn ${fmtMoney(remain)}${isCurrent && daysLeft > 0 ? ` · ≈ ${fmtCompact(remain / daysLeft)}/ngày` : ''}`;
      budgetHtml = `<div class="stat-label">Ngân sách · ${pct}%</div>
        <div class="stat-val money">${fmtCompact(out)} / ${fmtCompact(budget)}</div>
        <div class="progress budget ${pct >= 100 ? 'over' : pct >= 80 ? 'warn' : ''}"><i style="width:${Math.min(pct, 100)}%"></i></div>
        <div class="stat-sub">${sub}</div>`;
    } else {
      budgetHtml = `<div class="stat-label">Ngân sách</div><div class="stat-val money" style="color:var(--text-3)">Chưa đặt</div>
        <div class="stat-sub">Bấm để đặt mức chi tối đa</div>`;
    }

    $('#mStats').innerHTML = `
      <div class="stat in"><div class="stat-label">Tiền kiếm được</div><div class="stat-val money">${fmtMoney(inc)}</div><div class="stat-sub">${nIn} khoản thu</div></div>
      <div class="stat out"><div class="stat-label">Tiền tiêu đi</div><div class="stat-val money">${fmtMoney(out)}</div><div class="stat-sub">${cmp}</div></div>
      <div class="stat"><div class="stat-label">Còn lại</div><div class="stat-val money ${net < 0 ? 'neg' : ''}">${net < 0 ? '−' : ''}${fmtMoney(Math.abs(net))}</div>
        <div class="stat-sub">${inc > 0 ? (net >= 0 ? `Tiết kiệm được ${Math.round((net / inc) * 100)}% thu nhập` : 'Tiêu nhiều hơn kiếm được') : 'Chưa có khoản thu'}</div></div>
      <div class="stat clickable" id="mBudgetTile" title="Đặt ngân sách tháng">${budgetHtml}</div>`;
    $('#mBudgetTile').onclick = openBudgetDialog;
  }

  function niceMax(v) {
    const step = 10 ** Math.floor(Math.log10(v));
    return [1, 2, 2.5, 5, 10].map((k) => k * step).find((x) => x >= v);
  }

  function renderDaily(list) {
    const days = new Date(ui.mYear, ui.mMonth + 1, 0).getDate();
    const outBy = Array(days + 1).fill(0), inBy = Array(days + 1).fill(0);
    for (const m of list) (m.type === 'out' ? outBy : inBy)[Number(m.date.slice(8, 10))] += m.amount;
    const max = Math.max(...outBy);
    const top = max > 0 ? niceMax(max) : 1;
    const key = mKey(), today = todayStr();
    const isCurrent = key === today.slice(0, 7);
    const elapsed = isCurrent ? new Date().getDate() : key < today.slice(0, 7) ? days : 0;
    const totalOut = outBy.reduce((a, b) => a + b, 0);
    $('#mDailySub').textContent = elapsed && totalOut ? `Trung bình ${fmtMoney(totalOut / elapsed)}/ngày` : '';

    let cols = '', xs = '';
    for (let d = 1; d <= days; d++) {
      const date = `${key}-${pad(d)}`;
      const cls = ['dc-col'];
      if (date === today) cls.push('today');
      if (date > today) cls.push('future');
      if (date === ui.mDay) cls.push('sel');
      if (!outBy[d]) cls.push('zero');
      cols += `<div class="${cls.join(' ')}" data-date="${date}" data-out="${outBy[d]}" data-in="${inBy[d]}">
        <div class="dc-bar" style="height:${(outBy[d] / top) * 100}%"></div></div>`;
      const show = d === 1 || d % 5 === 0 || d === days;
      xs += `<span class="${show ? 'show' : ''} ${date === today ? 'today' : ''}">${show || date === today ? d : ''}</span>`;
    }
    $('#mDaily').innerHTML = `
      <div class="dc-plot">
        ${max > 0 ? `<div class="dc-grid" style="bottom:100%"><span>${fmtCompact(top)}</span></div>
        <div class="dc-grid" style="bottom:50%"><span>${fmtCompact(top / 2)}</span></div>` : '<div class="dc-empty">Chưa có khoản chi nào trong tháng</div>'}
        ${cols}
      </div>
      <div class="dc-x">${xs}</div>
      <div class="dc-tip hidden" id="dcTip"></div>`;
  }

  // Tooltip + bấm cột để lọc danh sách theo ngày
  $('#mDaily').addEventListener('mousemove', (e) => {
    const col = e.target.closest('.dc-col');
    const tip = $('#dcTip');
    if (!tip) return;
    if (!col) { tip.classList.add('hidden'); return; }
    const d = parseYmd(col.dataset.date);
    tip.innerHTML = `<b>${WEEKDAYS[d.getDay()]}, ${fmtShort(col.dataset.date)}</b>
      <div class="row-v"><i style="background:var(--out)"></i>Chi: ${fmtMoney(Number(col.dataset.out))}</div>
      ${Number(col.dataset.in) ? `<div class="row-v"><i style="background:var(--in)"></i>Thu: ${fmtMoney(Number(col.dataset.in))}</div>` : ''}`;
    const box = $('#mDaily').getBoundingClientRect(), r = col.getBoundingClientRect();
    const x = Math.min(Math.max(r.left + r.width / 2 - box.left, 70), box.width - 70);
    tip.style.left = `${x}px`;
    tip.style.top = `${r.top - box.top - 6}px`;
    tip.classList.remove('hidden');
  });
  $('#mDaily').addEventListener('mouseleave', () => $('#dcTip')?.classList.add('hidden'));
  $('#mDaily').addEventListener('click', (e) => {
    const col = e.target.closest('.dc-col');
    if (!col) return;
    ui.mDay = ui.mDay === col.dataset.date ? null : col.dataset.date;
    if (ui.mDay) $('#mDate').value = ui.mDay; // thêm giao dịch mới vào đúng ngày đang xem
    renderMoney();
  });

  function renderCats(list) {
    const type = ui.mCatType;
    $$('#mCatType button').forEach((b) => b.classList.toggle('active', b.dataset.t === type));
    $('#mCatTitle').textContent = type === 'out' ? 'Chi theo danh mục' : 'Thu theo nguồn';
    $('.cat-panel').classList.toggle('in', type === 'in');
    const agg = {};
    for (const m of list) if (m.type === type) agg[m.category] = (agg[m.category] || 0) + m.amount;
    const rows = Object.entries(agg).sort((a, b) => b[1] - a[1]);
    if (!rows.length) { $('#mCats').innerHTML = `<div class="empty-line">Chưa có ${TYPE_LABEL[type]} nào.</div>`; return; }
    const total = rows.reduce((s, r) => s + r[1], 0), max = rows[0][1];
    $('#mCats').innerHTML = rows.map(([cat, v]) => `
      <div class="cat-row" title="${esc(cat)}: ${fmtMoney(v)}">
        <span class="cat-ico">${catIcon(type, cat)}</span>
        <span class="cat-name">${esc(cat)}</span>
        <span class="cat-val">${fmtMoney(v)}<small>${Math.round((v / total) * 100)}%</small></span>
        <div class="cat-bar"><i style="width:${(v / max) * 100}%"></i></div>
      </div>`).join('');
  }
  $$('#mCatType button').forEach((b) => (b.onclick = () => { ui.mCatType = b.dataset.t; renderCats(monthTx(mKey())); }));

  function renderTxList(list) {
    const q = ui.mSearch.trim().toLowerCase();
    const order = new Map(db.money.map((m, i) => [m.id, i]));
    let rows = list;
    if (ui.mFilter !== 'all') rows = rows.filter((m) => m.type === ui.mFilter);
    if (ui.mDay) rows = rows.filter((m) => m.date === ui.mDay);
    if (q) rows = rows.filter((m) => `${m.category} ${m.note} ${m.amount} ${fmtMoney(m.amount)}`.toLowerCase().includes(q));
    rows = [...rows].sort((a, b) => b.date.localeCompare(a.date) || order.get(b.id) - order.get(a.id));

    $$('#mFilter button[data-f]').forEach((b) => b.classList.toggle('active', b.dataset.f === ui.mFilter));
    const chip = $('#mDayChip');
    chip.classList.toggle('hidden', !ui.mDay);
    if (ui.mDay) chip.textContent = `Ngày ${fmtShort(ui.mDay)} ×`;

    if (!rows.length) {
      $('#mList').innerHTML = `<div class="empty-line">${list.length ? 'Không có giao dịch phù hợp.' : 'Tháng này chưa có giao dịch nào.<br>Thêm khoản đầu tiên ở khung bên cạnh nhé.'}</div>`;
      return;
    }
    const groups = {};
    for (const m of rows) (groups[m.date] ||= []).push(m);
    const today = todayStr();
    $('#mList').innerHTML = Object.entries(groups).map(([date, ms]) => {
      const i = sumOf(ms, 'in'), o = sumOf(ms, 'out');
      const sums = [i ? `<span style="color:var(--in)">+${fmtCompact(i)}</span>` : '', o ? `<span style="color:var(--out)">−${fmtCompact(o)}</span>` : ''].filter(Boolean).join(' · ');
      return `<div class="tx-group">
        <h4 class="tx-group-head ${date === today ? 'today' : ''}"><span>${WEEKDAYS[parseYmd(date).getDay()]}, ${fmtShort(date)}${date === today ? ' · Hôm nay' : ''}</span><span class="tx-day-sum">${sums}</span></h4>
        <ul class="tx-list">${ms.map((m) => `
          <li class="tx ${m.type}" data-id="${m.id}">
            <span class="tx-ico">${catIcon(m.type, m.category)}</span>
            <div class="tx-main"><div class="tx-cat">${esc(m.category)}</div>${m.note ? `<div class="tx-note">${esc(m.note)}</div>` : ''}</div>
            <span class="tx-amt"><span class="tx-sign">${m.type === 'in' ? '+' : '−'}</span>${fmtMoney(m.amount)}</span>
            <button class="icon-btn danger tx-del" title="Xoá">×</button>
          </li>`).join('')}</ul>
      </div>`;
    }).join('');
  }

  $$('#mFilter button[data-f]').forEach((b) => (b.onclick = () => {
    if (b.dataset.f === 'day') ui.mDay = null; else ui.mFilter = b.dataset.f;
    renderMoney();
  }));
  $('#mSearch').addEventListener('input', (e) => { ui.mSearch = e.target.value; renderTxList(monthTx(mKey())); });

  $('#mList').addEventListener('click', (e) => {
    const li = e.target.closest('.tx');
    if (!li) return;
    const m = db.money.find((x) => x.id === li.dataset.id);
    if (!m) return;
    if (e.target.closest('.tx-del')) askDeleteTx(m); else openMoneyDialog(m);
  });

  async function askDeleteTx(m) {
    const ok = await confirmBox({
      title: `Xoá ${TYPE_LABEL[m.type]} này?`,
      message: 'Bạn vẫn có thể hoàn tác ngay sau khi xoá.',
      detail: `${m.type === 'in' ? '+' : '−'}${fmtMoney(m.amount)} · ${catIcon(m.type, m.category)} ${m.category}\n${WEEKDAYS[parseYmd(m.date).getDay()]}, ${fmtDate(m.date)}${m.note ? '\n' + m.note : ''}`,
      icon: '🗑',
      actions: [{ label: 'Xoá giao dịch', value: true, cls: 'btn-danger solid' }],
    });
    if (!ok) return false;
    const idx = db.money.indexOf(m);
    db.money.splice(idx, 1);
    save(); renderMoney();
    toast(`Đã xoá ${TYPE_LABEL[m.type]} ${fmtMoney(m.amount)} (${m.category})`, {
      type: 'danger',
      undo: () => { db.money.splice(idx, 0, m); save(); renderMoney(); toast('Đã khôi phục giao dịch'); },
    });
    return true;
  }

  /* ---- Form thêm nhanh ---- */
  let formMonth = null;
  function setMoneyType(t) {
    ui.mType = t;
    $$('#mType button').forEach((b) => b.classList.toggle('active', b.dataset.t === t));
    $('#mForm').classList.toggle('in', t === 'in');
    $('#mSubmit').textContent = t === 'in' ? 'Thêm khoản thu' : 'Thêm khoản chi';
    fillCategories($('#mCategory'), t, CATS[t][0][0]);
    $('#mQuick').innerHTML = QUICK[t].map((q) => `<button type="button">${q}</button>`).join('');
  }
  $$('#mType button').forEach((b) => (b.onclick = () => { setMoneyType(b.dataset.t); $('#mAmount').focus(); }));
  $('#mQuick').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    $('#mAmount').value = b.textContent;
    updateAmountHint();
    $('#mAmount').focus();
  });

  function updateAmountHint() {
    const raw = $('#mAmount').value;
    const v = parseAmount(raw);
    const hint = $('#mAmountHint');
    hint.classList.toggle('ok', v > 0);
    hint.textContent = !raw.trim() ? 'Gõ nhanh: 50k · 1.5tr · 120000' : Number.isNaN(v) ? '⚠ Số tiền chưa đúng định dạng' : `= ${fmtMoney(v)}`;
  }
  $('#mAmount').addEventListener('input', updateAmountHint);

  // Ngày mặc định của form: hôm nay nếu đang xem tháng hiện tại, ngược lại ngày 1 của tháng đang xem
  function syncMoneyForm() {
    if (!$('#mCategory').options.length) setMoneyType(ui.mType);
    if (formMonth === mKey()) return;
    formMonth = mKey();
    $('#mDate').value = formMonth === todayStr().slice(0, 7) ? todayStr() : `${formMonth}-01`;
  }

  $('#mForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const amount = parseAmount($('#mAmount').value);
    if (!(amount > 0)) {
      toast(Number.isNaN(amount) ? 'Số tiền chưa đúng định dạng (VD: 50k, 1.5tr, 120000)' : 'Nhập số tiền trước đã', { type: 'warn' });
      $('#mAmount').focus();
      return;
    }
    const m = { id: uid(), type: ui.mType, amount, category: $('#mCategory').value, date: $('#mDate').value || todayStr(), note: $('#mNote').value.trim() };
    db.money.push(m);
    save();
    $('#mAmount').value = ''; $('#mNote').value = '';
    updateAmountHint();
    if (!m.date.startsWith(mKey())) {
      const d = parseYmd(m.date);
      ui.mYear = d.getFullYear(); ui.mMonth = d.getMonth(); ui.mDay = null; formMonth = mKey();
    }
    renderMoney();
    toast(`Đã thêm ${TYPE_LABEL[m.type]} ${fmtMoney(m.amount)} · ${m.category}`);
    $('#mAmount').focus();
  });

  /* ---- Điều hướng tháng ---- */
  function shiftMoneyMonth(delta) {
    const d = new Date(ui.mYear, ui.mMonth + delta, 1);
    ui.mYear = d.getFullYear(); ui.mMonth = d.getMonth(); ui.mDay = null;
    renderMoney();
  }
  $('#mPrev').onclick = () => shiftMoneyMonth(-1);
  $('#mNext').onclick = () => shiftMoneyMonth(1);
  $('#mToday').onclick = () => { const n = new Date(); ui.mYear = n.getFullYear(); ui.mMonth = n.getMonth(); ui.mDay = null; renderMoney(); };

  /* ---- Dialog sửa giao dịch ---- */
  const moneyDlg = $('#moneyDialog');
  let editingTx = null, editType = 'out';
  function setEditType(t, current) {
    editType = t;
    $$('#eType button').forEach((b) => b.classList.toggle('active', b.dataset.t === t));
    fillCategories($('#eCategory'), t, current || CATS[t][0][0]);
  }
  $$('#eType button').forEach((b) => (b.onclick = () => setEditType(b.dataset.t)));
  function openMoneyDialog(m) {
    editingTx = m;
    setEditType(m.type, m.category);
    $('#eAmount').value = m.amount.toLocaleString('vi-VN');
    $('#eDate').value = m.date;
    $('#eNote').value = m.note;
    moneyDlg.showModal();
    $('#eAmount').select();
  }
  $('#moneyEditForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const amount = parseAmount($('#eAmount').value);
    if (!(amount > 0)) { toast('Số tiền chưa đúng định dạng', { type: 'warn' }); return; }
    Object.assign(editingTx, { type: editType, amount, category: $('#eCategory').value, date: $('#eDate').value || editingTx.date, note: $('#eNote').value.trim() });
    save(); moneyDlg.close(); renderMoney();
    toast('Đã lưu giao dịch');
  });
  $('#eCancel').onclick = () => moneyDlg.close();
  $('#eDelete').onclick = async () => {
    const m = editingTx;
    moneyDlg.close();
    if (!(await askDeleteTx(m))) openMoneyDialog(m);
  };

  /* ---- Ngân sách ---- */
  const budgetDlg = $('#budgetDialog');
  function openBudgetDialog() {
    const b = budgetFor(mKey());
    $('#budgetTitle').textContent = `Ngân sách chi tiêu – tháng ${ui.mMonth + 1}/${ui.mYear}`;
    $('#bAmount').value = b ? b.toLocaleString('vi-VN') : '';
    budgetDlg.showModal();
    $('#bAmount').select();
  }
  $('#bCancel').onclick = () => budgetDlg.close();
  $('#budgetForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const key = mKey();
    const raw = $('#bAmount').value.trim();
    const v = parseAmount(raw);
    if (raw && !(v > 0)) { toast('Số tiền chưa đúng định dạng', { type: 'warn' }); return; }
    if (!raw) {
      delete db.budgets[key];
      if ($('#bDefault').checked) delete db.budgets.default;
    } else {
      db.budgets[key] = v;
      if ($('#bDefault').checked) db.budgets.default = v;
    }
    save(); budgetDlg.close(); renderMoney();
    toast(raw ? `Đã đặt ngân sách ${fmtMoney(v)}` : 'Đã bỏ ngân sách tháng này');
  });

  /* ================= EXPORT / IMPORT ================= */
  $('#btnExport').onclick = () => {
    const blob = new Blob([JSON.stringify({ app: 'webnote', version: 1, exportedAt: new Date().toISOString(), ...db }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `webnote-backup-${todayStr()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('Đã tải file sao lưu');
  };
  $('#btnImport').onclick = () => $('#importFile').click();
  $('#importFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const d = JSON.parse(await file.text());
      if (!Array.isArray(d.tasks) || !Array.isArray(d.notes) || !Array.isArray(d.classes)) throw new Error('bad');
      const ok = await confirmBox({
        title: 'Thay thế toàn bộ dữ liệu?',
        message: 'Dữ liệu hiện tại sẽ bị XOÁ và thay bằng nội dung trong file. Nên "Xuất dữ liệu" để sao lưu trước.',
        detail: `File: ${file.name}\nSẽ nhập: ${d.tasks.length} công việc · ${d.classes.length} lớp · ${d.notes.length} ghi chú\nHiện có: ${db.tasks.length} công việc · ${db.classes.length} lớp · ${db.notes.length} ghi chú`,
        icon: '⚠',
        actions: [{ label: 'Thay thế dữ liệu', value: true, cls: 'btn-danger solid' }],
      });
      if (!ok) return;
      db = {
        tasks: d.tasks.map((t) => ({ id: t.id || uid(), title: String(t.title || ''), date: t.date || todayStr(), time: t.time || '', priority: PRIORITY_LABEL[t.priority] ? t.priority : 'med', category: t.category || '', note: t.note || '', done: !!t.done, groupId: t.groupId ? String(t.groupId) : '' })),
        classes: d.classes.map((c) => ({ id: c.id || uid(), name: String(c.name || 'Lớp'), teacher: c.teacher || '', schedule: c.schedule || '', color: COLORS.includes(c.color) ? c.color : COLORS[0] })),
        notes: d.notes.map((n) => ({ id: n.id || uid(), classId: n.classId || '', title: String(n.title || ''), date: n.date || todayStr(), tags: Array.isArray(n.tags) ? n.tags.map(String) : [], pinned: !!n.pinned, content: String(n.content || ''), updated: Number(n.updated) || Date.now() })),
        money: (Array.isArray(d.money) ? d.money : []).filter((m) => Number(m.amount) > 0).map((m) => ({ id: m.id || uid(), type: m.type === 'in' ? 'in' : 'out', amount: Math.round(Number(m.amount)), category: String(m.category || 'Khác'), date: m.date || todayStr(), note: String(m.note || '') })),
        budgets: Object.fromEntries(Object.entries(d.budgets && typeof d.budgets === 'object' ? d.budgets : {}).filter(([, v]) => Number(v) > 0).map(([k, v]) => [k, Math.round(Number(v))])),
      };
      ui.noteId = null; ui.classId = 'all';
      save();
      setView(ui.view);
      toast('Khôi phục thành công');
    } catch {
      toast('File không hợp lệ – không phải bản sao lưu WebNote', { type: 'warn' });
    }
  });

  // Đồng bộ khi mở nhiều tab
  window.addEventListener('storage', (e) => {
    if (e.key === STORE_KEY) { db = load(); setView(ui.view); }
  });

  // Đầu ngày mới (để tab mở qua đêm) -> làm mới "hôm nay"
  let lastDay = todayStr();
  setInterval(() => { if (todayStr() !== lastDay) { lastDay = todayStr(); if (ui.view !== 'notes') setView(ui.view); } }, 60_000);

  let startView = 'tasks';
  try { startView = location.hash.slice(1) || localStorage.getItem('webnote.view') || 'tasks'; } catch { /* ignore */ }
  setView(['tasks', 'notes', 'money'].includes(startView) ? startView : 'tasks');
})();
