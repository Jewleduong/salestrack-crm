/**
 * Activity Log v3 — role-based KPIs, todos, temperature alerts, history.
 */
(function () {
  let _actTypeFilter = 'all';
  let _timeFilter = 'all';
  let _leadStatusFilter = 'all';
  let _actMode = 'log';
  let _selectedAssignee = null;
  let _todoMemberFilter = null;

  if (typeof window.getScheduled !== 'function') {
    window.getScheduled = function () { return JSON.parse(localStorage.getItem('st_scheduled') || '[]'); };
  }
  if (typeof window.saveScheduled !== 'function') {
    window.saveScheduled = function (d) { localStorage.setItem('st_scheduled', JSON.stringify(d)); };
  }
  if (typeof window.getLeadRules !== 'function') {
    window.getLeadRules = function () {
      return JSON.parse(localStorage.getItem('st_lead_rules') || '{"warmDays":7,"coldDays":14,"stages":["Prospecting","Qualification","Proposal","Negotiation"]}');
    };
  }
  if (typeof window.saveLeadRulesData !== 'function') {
    window.saveLeadRulesData = function (d) { localStorage.setItem('st_lead_rules', JSON.stringify(d)); };
  }

  async function persistScheduled(todo, after) {
    if (!window.SalesTrackSupabase) return;
    try {
      await window.SalesTrackSupabase.saveScheduledRecord(todo);
      if (typeof after === 'function') after();
    } catch (e) {
      showToast(e.message || 'Unable to save scheduled todo to Supabase', 'error');
    }
  }

  async function removeScheduled(id, after) {
    if (!window.SalesTrackSupabase) return;
    try {
      await window.SalesTrackSupabase.deleteScheduledRecord(id);
      if (typeof after === 'function') after();
    } catch (e) {
      showToast(e.message || 'Unable to delete scheduled todo from Supabase', 'error');
    }
  }

  async function persistActivity(activity, after) {
    if (!window.SalesTrackSupabase) return;
    try {
      await window.SalesTrackSupabase.saveActivityRecord(activity);
      if (typeof after === 'function') after();
    } catch (e) {
      showToast(e.message || 'Unable to save activity to Supabase', 'error');
    }
  }

  function isManager() { return CURRENT_USER.role === 'manager'; }

  function scopeActs(arr) {
    if (isManager()) return arr;
    return arr.filter(a => !a.ownerId || a.ownerId === CURRENT_USER.id);
  }
  function scopeSched(arr) {
    if (isManager()) return arr;
    return arr.filter(s => s.ownerId === CURRENT_USER.id || s.assignedTo === CURRENT_USER.id);
  }
  function scopeLeads(arr) {
    if (isManager()) return arr;
    return arr.filter(l => !l.ownerId || l.ownerId === CURRENT_USER.id);
  }

  function sparkBar(pct, color) {
    return `<div style="flex:1;height:6px;background:var(--border);border-radius:3px;overflow:hidden"><div style="height:100%;width:${pct}%;background:${color};border-radius:3px"></div></div>`;
  }

  function daysSinceLastActivity(leadId) {
    const acts = getActivities().filter(a => a.leadId === leadId && !a.isScheduled);
    if (!acts.length) return 9999;
    const last = Math.max(...acts.map(a => new Date(a.createdAt || a.date).getTime()));
    return Math.floor((Date.now() - last) / 86400000);
  }

  window.getLeadTemp = function (leadId) {
    const rules = getLeadRules();
    const days = daysSinceLastActivity(leadId);
    if (days >= rules.coldDays) return 'cold';
    if (days >= rules.warmDays) return 'cooling';
    return 'warm';
  };

  window.getActivitiesHTML = function () {
    const mgr = isManager();
    return `
    <div class="page-header">
      <div>
        <div class="page-title">Activity Log</div>
        <div class="page-subtitle">${mgr ? 'Full team view — all members, all leads' : 'Your personal activity log & schedule'}</div>
      </div>
      <div style="display:flex;gap:8px">
        ${mgr ? '<button class="btn btn-secondary btn-sm" onclick="openLeadRulesModal()"><i class="fa-solid fa-sliders"></i> Lead Rules</button>' : ''}
        <button class="btn btn-secondary btn-sm" onclick="exportActivitiesCSV()"><i class="fa-solid fa-download"></i> Export</button>
        <button class="btn btn-primary" onclick="openAddActivityModal()"><i class="fa-solid fa-plus"></i> Log / Schedule</button>
      </div>
    </div>

    <div class="act-role-banner" style="background:${mgr ? 'var(--amber-bg)' : 'var(--accent-light)'};color:${mgr ? 'var(--amber-text)' : 'var(--accent-text)'};border:1px solid ${mgr ? 'rgba(245,158,11,0.2)' : 'rgba(99,102,241,0.2)'}">
      <i class="fa-solid ${mgr ? 'fa-crown' : 'fa-user'}" style="font-size:14px"></i>
      ${mgr
        ? '<span><strong>Manager view</strong> — you can see all team activities, configure lead rules, and monitor the full pipeline.</span>'
        : '<span><strong>Your view</strong> — showing only your activities and leads.</span>'}
    </div>

    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:20px" id="act-kpis"></div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:18px">
      <div class="card" style="padding:0;overflow:hidden">
        <div style="padding:14px 18px 10px;display:flex;align-items:flex-start;justify-content:space-between">
          <div>
            <div style="font-size:13px;font-weight:700;display:flex;align-items:center;gap:8px">
              <i class="fa-solid fa-list-check" style="color:var(--accent)"></i>
              ${mgr ? 'Team To-Do' : 'My To-Do'}
              <span id="todo-badge" style="background:var(--red);color:#fff;font-size:10px;font-weight:700;padding:1px 6px;border-radius:8px;display:none"></span>
            </div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:2px" id="todo-date-label"></div>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="openAddActivityModal();setActivityMode('schedule')"><i class="fa-solid fa-plus"></i> ${mgr ? 'Add / Assign' : 'Add'}</button>
        </div>
        <div id="todo-list" style="padding:0 0 8px;max-height:320px;overflow-y:auto"></div>
      </div>
      <div class="card" style="padding:0;overflow:hidden">
        <div style="padding:14px 18px 0;display:flex;align-items:center;justify-content:space-between">
          <div>
            <div style="font-size:13px;font-weight:700;display:flex;align-items:center;gap:8px">
              <i class="fa-solid fa-temperature-half" style="color:var(--amber)"></i> Lead Temperature Alerts
              <span id="alert-badge" style="background:var(--amber);color:#fff;font-size:10px;font-weight:700;padding:1px 6px;border-radius:8px;display:none"></span>
            </div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:2px" id="alert-rule-desc"></div>
          </div>
          ${mgr ? '<button class="btn btn-secondary btn-sm" onclick="openLeadRulesModal()"><i class="fa-solid fa-gear"></i> Rules</button>' : ''}
        </div>
        <div id="cold-lead-alerts" style="padding:12px 18px 16px;max-height:280px;overflow-y:auto"></div>
      </div>
    </div>

    <div class="card" style="margin-bottom:18px;padding:0;overflow:hidden">
      <div style="padding:14px 18px 0;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
        <div style="font-size:13px;font-weight:700"><i class="fa-solid fa-clock-rotate-left" style="color:var(--accent);margin-right:8px"></i>${mgr ? 'Team Activity History' : 'My Activity History'}</div>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
          <div style="display:flex;gap:4px">
            <div class="time-chip active" id="tchip-all" onclick="setTimeFilter('all')">All time</div>
            <div class="time-chip" id="tchip-today" onclick="setTimeFilter('today')">Today</div>
            <div class="time-chip" id="tchip-week" onclick="setTimeFilter('week')">This week</div>
            <div class="time-chip" id="tchip-month" onclick="setTimeFilter('month')">This month</div>
          </div>
          <input class="form-input" style="width:190px;padding:6px 10px;font-size:12px" placeholder="🔍 Search…" id="act-search" oninput="filterActivities()">
          <select class="form-input" style="width:130px;padding:6px 10px;font-size:12px" id="act-sort" onchange="filterActivities()">
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="lead">By lead</option>
            <option value="type">By type</option>
          </select>
        </div>
      </div>
      <div style="display:flex;align-items:center;border-bottom:1px solid var(--border);padding:0 18px;gap:0;overflow-x:auto;margin-top:10px">
        <div class="act-htab active" id="tab-all" onclick="setActTab('all')">All <span id="tab-count-all" class="tab-cnt"></span></div>
        <div class="act-htab" id="tab-Call" onclick="setActTab('Call')"><i class="fa-solid fa-phone" style="color:var(--green);margin-right:5px"></i>Calls <span id="tab-count-Call" class="tab-cnt tc-green"></span></div>
        <div class="act-htab" id="tab-Email" onclick="setActTab('Email')"><i class="fa-solid fa-envelope" style="color:var(--blue);margin-right:5px"></i>Emails <span id="tab-count-Email" class="tab-cnt tc-blue"></span></div>
        <div class="act-htab" id="tab-Meeting" onclick="setActTab('Meeting')"><i class="fa-solid fa-handshake" style="color:var(--purple);margin-right:5px"></i>Meetings <span id="tab-count-Meeting" class="tab-cnt tc-purple"></span></div>
        <div class="act-htab" id="tab-Note" onclick="setActTab('Note')"><i class="fa-solid fa-note-sticky" style="color:var(--amber);margin-right:5px"></i>Notes <span id="tab-count-Note" class="tab-cnt tc-amber"></span></div>
        ${mgr ? `<select class="form-input" style="width:150px;padding:5px 10px;font-size:12px;margin-left:auto" id="act-member-filter" onchange="filterActivities()">
          <option value="">All members</option>
          ${ACCOUNTS.filter(a => a.role === 'member').map(a => `<option value="${a.id}">${a.name}</option>`).join('')}
        </select>` : ''}
      </div>
      <div style="padding:16px" id="activities-list"></div>
    </div>

    <div class="card" style="padding:0;overflow:hidden">
      <div style="padding:14px 18px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;border-bottom:1px solid var(--border)">
        <div style="font-size:13px;font-weight:700"><i class="fa-solid fa-users" style="color:var(--accent);margin-right:8px"></i>${mgr ? 'All Leads Activity Status' : 'My Leads Activity Status'}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <div class="filter-chip active" id="lstatus-all" onclick="setLeadStatusFilter('all')">All</div>
          <div class="filter-chip" id="lstatus-warm" onclick="setLeadStatusFilter('warm')"><i class="fa-solid fa-fire" style="color:var(--green)"></i> Warm</div>
          <div class="filter-chip" id="lstatus-cooling" onclick="setLeadStatusFilter('cooling')"><i class="fa-solid fa-temperature-half" style="color:var(--amber)"></i> Cooling</div>
          <div class="filter-chip" id="lstatus-cold" onclick="setLeadStatusFilter('cold')"><i class="fa-solid fa-snowflake" style="color:var(--blue)"></i> Cold</div>
          <select class="form-input" style="width:160px;padding:6px 10px;font-size:12px" id="lead-act-filter" onchange="renderLeadStatusList()">
            <option value="">All activity types</option>
            <option value="Call">Calls only</option>
            <option value="Email">Emails only</option>
            <option value="Meeting">Meetings only</option>
            <option value="Note">Notes only</option>
          </select>
        </div>
      </div>
      <div id="lead-status-list"></div>
    </div>`;
  };

  window.setActivityMode = function (mode) {
    _actMode = mode;
    const isLog = mode === 'log';
    const logEl = document.getElementById('mode-log');
    const schEl = document.getElementById('mode-schedule');
    if (logEl) { logEl.style.background = isLog ? 'var(--accent)' : 'transparent'; logEl.style.color = isLog ? '#fff' : 'var(--text-secondary)'; }
    if (schEl) { schEl.style.background = !isLog ? 'var(--accent)' : 'transparent'; schEl.style.color = !isLog ? '#fff' : 'var(--text-secondary)'; }
    const logRow = document.getElementById('logged-date-row');
    const schRow = document.getElementById('scheduled-date-row');
    if (logRow) logRow.style.display = isLog ? 'grid' : 'none';
    if (schRow) schRow.style.display = !isLog ? 'grid' : 'none';
    const noteLbl = document.getElementById('notes-label');
    if (noteLbl) noteLbl.textContent = isLog ? 'Notes / What happened' : 'Agenda / What to discuss';
    const btn = document.getElementById('save-act-btn');
    if (btn) btn.innerHTML = isLog ? '<i class="fa-solid fa-check"></i> Log Activity' : '<i class="fa-solid fa-calendar-plus"></i> Schedule';
    const nxRow = document.getElementById('next-action-row');
    if (nxRow) nxRow.style.display = isLog ? 'block' : 'none';
    const assignRow = document.getElementById('assign-to-row');
    if (assignRow) {
      const show = !isLog && isManager();
      assignRow.style.display = show ? 'block' : 'none';
      if (show) _renderAssignOptions();
    }
    if (!isLog) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const el = document.getElementById('new-act-sched-date');
      if (el && !el.value) el.value = tomorrow.toISOString().split('T')[0];
    }
  };

  function _renderAssignOptions() {
    const container = document.getElementById('assign-options');
    if (!container) return;
    container.innerHTML = ACCOUNTS.map(a => {
      const isSelf = a.id === CURRENT_USER.id;
      const isSelected = _selectedAssignee === null ? isSelf : _selectedAssignee === a.id;
      return `
        <div onclick="_selectAssignee(${a.id})" id="assign-opt-${a.id}"
             style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1.5px solid ${isSelected ? 'var(--accent)' : 'var(--border)'};border-radius:var(--radius-md);cursor:pointer;background:${isSelected ? 'var(--accent-light)' : 'var(--bg-input)'}">
          <div style="width:28px;height:28px;border-radius:50%;background:${a.color};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff">${a.initials}</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:600">${a.name.split(' ').slice(-1)[0]}${isSelf ? ' <span style="font-size:10px;color:var(--text-muted)">(me)</span>' : ''}</div>
            <div style="font-size:10px;color:var(--text-muted)">${a.roleLabel}</div>
          </div>
          ${isSelected ? '<i class="fa-solid fa-circle-check" style="color:var(--accent)"></i>' : ''}
        </div>`;
    }).join('');
  }

  window._selectAssignee = function (id) { _selectedAssignee = id; _renderAssignOptions(); };

  window.setActTab = function (type) {
    _actTypeFilter = type;
    const tabColors = { all: 'var(--accent)', Call: 'var(--green)', Email: 'var(--blue)', Meeting: 'var(--purple)', Note: 'var(--amber)' };
    ['all', 'Call', 'Email', 'Meeting', 'Note'].forEach(t => {
      const el = document.getElementById('tab-' + t);
      if (!el) return;
      el.classList.toggle('active', t === type);
      el.style.color = t === type ? tabColors[t] : 'var(--text-secondary)';
      el.style.borderBottomColor = t === type ? tabColors[t] : 'transparent';
      el.style.fontWeight = t === type ? '700' : '500';
    });
    filterActivities();
  };

  window.setTimeFilter = function (range) {
    _timeFilter = range;
    ['all', 'today', 'week', 'month'].forEach(r => {
      const el = document.getElementById('tchip-' + r);
      if (el) el.classList.toggle('active', r === range);
    });
    filterActivities();
  };

  window.filterActivities = function () {
    const search = document.getElementById('act-search')?.value?.toLowerCase() || '';
    const sort = document.getElementById('act-sort')?.value || 'newest';
    const memberFilter = isManager() ? (document.getElementById('act-member-filter')?.value || '') : '';
    let acts = scopeActs(getActivities().filter(a => !a.isScheduled));
    if (_actTypeFilter !== 'all') acts = acts.filter(a => a.type === _actTypeFilter);
    if (memberFilter) {
      const memberLeadIds = new Set(getLeads().filter(l => String(l.ownerId) === String(memberFilter)).map(l => l.id));
      acts = acts.filter(a => memberLeadIds.has(a.leadId));
    }
    if (_timeFilter !== 'all') {
      const now = new Date();
      acts = acts.filter(a => {
        const d = new Date(a.date || a.createdAt);
        if (_timeFilter === 'today') return d.toDateString() === now.toDateString();
        if (_timeFilter === 'week') { const w = new Date(now); w.setDate(now.getDate() - 7); return d >= w; }
        if (_timeFilter === 'month') { const m = new Date(now); m.setDate(now.getDate() - 30); return d >= m; }
        return true;
      });
    }
    if (search) acts = acts.filter(a => (a.leadName + a.company + (a.notes || '') + (a.type || '') + (a.nextAction || '')).toLowerCase().includes(search));
    if (sort === 'newest') acts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    else if (sort === 'oldest') acts.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    else if (sort === 'lead') acts.sort((a, b) => a.leadName.localeCompare(b.leadName));
    else if (sort === 'type') acts.sort((a, b) => a.type.localeCompare(b.type));
    renderActivitiesList(acts);
  };

  window.setLeadStatusFilter = function (f) {
    _leadStatusFilter = f;
    ['all', 'warm', 'cooling', 'cold'].forEach(v => {
      const el = document.getElementById('lstatus-' + v);
      if (el) el.classList.toggle('active', v === f);
    });
    renderLeadStatusList();
  };

  window.setTodoMemberFilter = function (id) {
    _todoMemberFilter = id;
    _renderTodayTodos();
  };

  function _renderTodayTodos() {
    const allSched = getScheduled();
    let sched;
    if (isManager()) {
      sched = _todoMemberFilter !== null
        ? allSched.filter(s => s.assignedTo === _todoMemberFilter || (!s.assignedTo && s.ownerId === _todoMemberFilter))
        : allSched;
    } else {
      sched = allSched.filter(s => s.ownerId === CURRENT_USER.id || s.assignedTo === CURRENT_USER.id);
    }
    const today = new Date().toDateString();
    const todayItems = sched.filter(s => new Date(s.scheduledDate).toDateString() === today);
    const upcoming = sched.filter(s => new Date(s.scheduledDate) > new Date() && new Date(s.scheduledDate).toDateString() !== today)
      .sort((a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate)).slice(0, 4);
    const badge = document.getElementById('todo-badge');
    const dateEl = document.getElementById('todo-date-label');
    const listEl = document.getElementById('todo-list');
    const allScoped = isManager() ? allSched : allSched.filter(s => s.ownerId === CURRENT_USER.id || s.assignedTo === CURRENT_USER.id);
    const pending = allScoped.filter(s => new Date(s.scheduledDate).toDateString() === today && !s.done).length;
    if (badge) { badge.textContent = pending; badge.style.display = pending > 0 ? 'inline' : 'none'; }
    if (dateEl) dateEl.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    if (!listEl) return;

    let tabsHtml = '';
    if (isManager()) {
      tabsHtml = `<div style="display:flex;gap:4px;flex-wrap:wrap;padding:0 18px 10px;border-bottom:1px solid var(--border-light);margin-bottom:10px">
        <div id="todo-mtab-all" onclick="setTodoMemberFilter(null)" style="padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;cursor:pointer;background:${_todoMemberFilter === null ? 'var(--accent)' : 'var(--bg-input)'};color:${_todoMemberFilter === null ? '#fff' : 'var(--text-secondary)'}">All</div>
        ${ACCOUNTS.map(a => {
          const aCount = allSched.filter(s => (s.assignedTo === a.id || (!s.assignedTo && s.ownerId === a.id)) && new Date(s.scheduledDate).toDateString() === today && !s.done).length;
          const isActive = _todoMemberFilter === a.id;
          return `<div id="todo-mtab-${a.id}" onclick="setTodoMemberFilter(${a.id})" style="display:flex;align-items:center;gap:5px;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:${isActive ? '700' : '500'};cursor:pointer;background:${isActive ? a.color : 'var(--bg-input)'};color:${isActive ? '#fff' : 'var(--text-secondary)'};border:1.5px solid ${isActive ? a.color : 'var(--border)'}">
            <span style="width:16px;height:16px;border-radius:50%;background:${isActive ? 'rgba(255,255,255,0.3)' : a.color};display:inline-flex;align-items:center;justify-content:center;font-size:7px;font-weight:700;color:#fff">${a.initials}</span>
            ${a.name.split(' ').slice(-1)[0]}${aCount > 0 ? `<span style="margin-left:4px;font-size:9px;font-weight:700">${aCount}</span>` : ''}
          </div>`;
        }).join('')}
      </div>`;
    }

    if (!todayItems.length && !upcoming.length) {
      listEl.innerHTML = tabsHtml + '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:12px"><i class="fa-solid fa-circle-check" style="color:var(--green);display:block;margin-bottom:8px"></i>Nothing scheduled today!</div>';
      return;
    }

    const renderItem = (s, isUpcoming) => {
      const overdue = !isUpcoming && !s.done && new Date(s.scheduledDate) < new Date();
      const bg = s.done ? 'var(--bg-input)' : overdue ? 'var(--red-bg)' : 'var(--bg-input)';
      const border = s.done ? 'var(--border)' : overdue ? 'rgba(239,68,68,0.3)' : 'var(--border)';
      const assignedAcc = ACCOUNTS.find(a => a.id === (s.assignedTo ?? s.ownerId));
      const creatorAcc = ACCOUNTS.find(a => a.id === s.ownerId);
      const isAssigned = s.assignedTo !== undefined && s.assignedTo !== s.ownerId;
      const canEdit = isManager() || s.assignedTo === CURRENT_USER.id || s.ownerId === CURRENT_USER.id;
      let tag = '';
      if (isManager() && assignedAcc) {
        tag = `<span style="font-size:9px;padding:1px 5px;border-radius:3px;background:${assignedAcc.color}22;color:${assignedAcc.color};font-weight:700">${assignedAcc.initials}</span>`;
      } else if (isAssigned && creatorAcc && creatorAcc.role === 'manager') {
        tag = `<span style="font-size:9px;padding:1px 6px;border-radius:3px;background:var(--amber-bg);color:var(--amber-text);font-weight:700"><i class="fa-solid fa-crown" style="font-size:7px"></i> from ${creatorAcc.name.split(' ')[0]}</span>`;
      }
      return `
        <div style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border:1px solid ${border};border-radius:var(--radius-md);background:${bg};margin:0 12px 6px;opacity:${s.done ? '.6' : '1'}">
          <div onclick="${canEdit ? `toggleTodoDone('${s.id}')` : ''}" style="width:18px;height:18px;border-radius:4px;border:2px solid ${s.done ? 'var(--green)' : 'var(--border)'};background:${s.done ? 'var(--green)' : 'transparent'};display:flex;align-items:center;justify-content:center;cursor:${canEdit ? 'pointer' : 'default'};flex-shrink:0">
            ${s.done ? '<i class="fa-solid fa-check" style="font-size:9px;color:#fff"></i>' : ''}
          </div>
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:5px;margin-bottom:2px;flex-wrap:wrap">
              <span style="font-size:11px;font-weight:700;color:${getTypeColor(s.type)}">${s.type}</span>
              <span style="font-size:12px;font-weight:600;${s.done ? 'text-decoration:line-through;' : ''}">${s.leadName}</span>
              ${tag}
              ${overdue ? '<span style="font-size:9px;background:var(--red-bg);color:var(--red-text);padding:1px 5px;border-radius:4px;font-weight:700">OVERDUE</span>' : ''}
              <span style="font-size:10px;color:var(--text-muted);margin-left:auto">${isUpcoming ? formatDate(s.scheduledDate) : (s.scheduledTime || '')}</span>
            </div>
            <div style="font-size:11px;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${s.agenda || s.notes || '—'}</div>
          </div>
          ${canEdit ? `<button onclick="deleteTodo('${s.id}')" style="background:none;border:none;color:var(--text-muted);cursor:pointer"><i class="fa-solid fa-xmark"></i></button>` : ''}
        </div>`;
    };

    let html = tabsHtml;
    html += todayItems.map(s => renderItem(s, false)).join('');
    if (upcoming.length) {
      html += '<div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin:10px 18px 6px">Upcoming</div>';
      html += upcoming.map(s => renderItem(s, true)).join('');
    }
    listEl.innerHTML = html;
  }

  window.toggleTodoDone = function (id) {
    const sched = getScheduled();
    const item = sched.find(s => s.id === id);
    if (!item) return;
    item.done = !item.done;
    saveScheduled(sched);
    _renderTodayTodos();
    if (typeof renderActivitiesPage === 'function') renderActivitiesPage();
    persistScheduled(item, () => {
      _renderTodayTodos();
      if (typeof renderActivitiesPage === 'function') renderActivitiesPage();
    });
  };

  window.deleteTodo = function (id) {
    saveScheduled(getScheduled().filter(s => s.id !== id));
    _renderTodayTodos();
    removeScheduled(id, _renderTodayTodos);
  };

  function _renderColdAlerts() {
    const leads = scopeLeads(getLeads());
    const rules = getLeadRules();
    const alertEl = document.getElementById('cold-lead-alerts');
    const ruleDesc = document.getElementById('alert-rule-desc');
    const badge = document.getElementById('alert-badge');
    if (ruleDesc) ruleDesc.textContent = `Warm: >${rules.warmDays}d · Cold: >${rules.coldDays}d inactive`;
    const alertLeads = leads
      .filter(l => !['Closed Won', 'Closed Lost'].includes(l.stage) && rules.stages.includes(l.stage))
      .map(l => ({ ...l, temp: getLeadTemp(l.id), days: daysSinceLastActivity(l.id) }))
      .filter(l => l.temp !== 'warm')
      .sort((a, b) => b.days - a.days);
    if (badge) { badge.textContent = alertLeads.length; badge.style.display = alertLeads.length > 0 ? 'inline' : 'none'; }
    if (!alertEl) return;
    if (!alertLeads.length) {
      alertEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:12px"><i class="fa-solid fa-fire" style="color:var(--green);display:block;margin-bottom:8px"></i>All leads are warm!</div>';
      return;
    }
    alertEl.innerHTML = alertLeads.map(l => {
      const isCold = l.temp === 'cold';
      const bg = isCold ? 'var(--blue-bg)' : 'var(--amber-bg)';
      const border = isCold ? 'rgba(59,130,246,0.25)' : 'rgba(245,158,11,0.25)';
      const color = isCold ? 'var(--blue-text)' : 'var(--amber-text)';
      const icon = isCold ? 'fa-snowflake' : 'fa-temperature-half';
      const label = isCold ? 'Cold' : 'Cooling';
      const ownerAcc = isManager() ? ACCOUNTS.find(a => a.id === l.ownerId) : null;
      return `
        <div style="display:flex;align-items:center;gap:10px;padding:9px 12px;border:1px solid ${border};border-radius:var(--radius-md);background:${bg};margin-bottom:6px">
          <div style="width:30px;height:30px;border-radius:50%;background:${color};opacity:.15;position:relative;flex-shrink:0">
            <i class="fa-solid ${icon}" style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:12px;color:${color}"></i>
          </div>
          <div style="flex:1;min-width:0">
            <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap">
              <span style="font-size:12px;font-weight:700">${l.name}</span>
              <span class="badge ${getStageBadgeClass(l.stage)}" style="font-size:9px">${l.stage}</span>
              ${ownerAcc ? `<span style="font-size:9px;padding:1px 5px;border-radius:3px;background:${ownerAcc.color}22;color:${ownerAcc.color};font-weight:700">${ownerAcc.initials}</span>` : ''}
              <span style="font-size:9px;font-weight:700;margin-left:auto;color:${color}">${label}</span>
            </div>
            <div style="font-size:11px;color:${color}">${l.days === 9999 ? 'No activity yet' : l.days + 'd without activity'}</div>
          </div>
          <button class="btn btn-sm btn-secondary" onclick="openLogActivity('${l.id}','${l.name.replace(/'/g, "\\'")}','${l.stage}')"><i class="fa-solid fa-plus"></i> Log</button>
        </div>`;
    }).join('');
  }

  window.renderActivitiesList = function (activities) {
    const container = document.getElementById('activities-list');
    if (!container) return;
    if (!activities.length) {
      container.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text-muted)"><div style="font-size:13px;font-weight:600;margin-bottom:4px">No activities found</div><div style="font-size:12px">Try adjusting filters or log a new activity.</div></div>';
      return;
    }
    const groups = {};
    activities.forEach(a => {
      const d = new Date(a.date || a.createdAt).toDateString();
      if (!groups[d]) groups[d] = [];
      groups[d].push(a);
    });
    const typeColors = { Call: 'var(--green)', Email: 'var(--blue)', Meeting: 'var(--purple)', Note: 'var(--amber)' };
    container.innerHTML = Object.entries(groups).map(([date, acts]) => `
      <div style="margin-bottom:18px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
          <div style="height:1px;flex:1;background:var(--border)"></div>
          <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase">${formatDate(new Date(date).toISOString())}</div>
          <div style="height:1px;flex:1;background:var(--border)"></div>
          <div style="font-size:10px;color:var(--text-muted);background:var(--bg-input);border:1px solid var(--border);padding:1px 7px;border-radius:8px">${acts.length} item${acts.length > 1 ? 's' : ''}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:7px">
          ${acts.map(a => {
            const c = typeColors[a.type] || 'var(--accent)';
            const ownerAcc = ACCOUNTS.find(ac => ac.id === a.ownerId);
            return `
            <div style="display:flex;border:1px solid var(--border);border-radius:var(--radius-md);overflow:hidden;cursor:pointer;background:var(--bg-card)" onclick="openActivityDrawer('${a.id}')">
              <div style="width:4px;background:${c}"></div>
              <div style="flex:1;padding:11px 14px;display:flex;gap:12px">
                <div style="width:36px;height:36px;border-radius:50%;background:${getTypeBg(a.type)};color:${getTypeColor(a.type)};display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0"><i class="fa-solid ${getTypeIcon(a.type)}"></i></div>
                <div style="flex:1;min-width:0">
                  <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;flex-wrap:wrap">
                    <span class="badge ${getTypeBadgeClass(a.type)}">${a.type}</span>
                    <span style="font-size:13px;font-weight:700">${a.leadName}</span>
                    <span style="font-size:11px;color:var(--text-muted)">${a.company}</span>
                    <span class="badge ${getStageBadgeClass(a.stage || '')}" style="margin-left:auto">${a.stage || ''}</span>
                  </div>
                  <div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px">${a.notes || '<em style="color:var(--text-muted)">No notes.</em>'}</div>
                  <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
                    ${a.duration > 0 ? `<span style="font-size:11px;color:var(--text-muted)"><i class="fa-regular fa-clock"></i> ${a.duration}m</span>` : ''}
                    ${a.nextAction ? `<span style="font-size:11px;color:var(--accent);background:var(--accent-light);padding:1px 7px;border-radius:4px">${a.nextAction}</span>` : ''}
                    ${ownerAcc ? `<span style="display:inline-flex;align-items:center;gap:5px;font-size:11px;color:var(--text-muted);margin-left:auto"><span style="width:18px;height:18px;border-radius:50%;background:${ownerAcc.color};display:inline-flex;align-items:center;justify-content:center;font-size:8px;color:#fff;font-weight:700">${ownerAcc.initials}</span>${ownerAcc.name.split(' ')[0]}</span>` : ''}
                    <span style="font-size:10px;color:var(--text-muted)">${timeAgo(a.createdAt)}</span>
                  </div>
                </div>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>`).join('');
  };

  window.renderLeadStatusList = function () {
    const allLeads = getLeads().filter(l => !['Closed Won', 'Closed Lost'].includes(l.stage));
    const visibleLeads = scopeLeads(allLeads);
    const acts = scopeActs(getActivities().filter(a => !a.isScheduled));
    const actTypeFilter = document.getElementById('lead-act-filter')?.value || '';
    const el = document.getElementById('lead-status-list');
    if (!el) return;
    let filtered = visibleLeads.map(l => {
      const leadActs = acts.filter(a => a.leadId === l.id && (!actTypeFilter || a.type === actTypeFilter));
      return { ...l, temp: getLeadTemp(l.id), days: daysSinceLastActivity(l.id), actCount: leadActs.length, lastAct: [...leadActs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] };
    });
    if (actTypeFilter) filtered = filtered.filter(l => l.actCount > 0);
    if (_leadStatusFilter !== 'all') filtered = filtered.filter(l => l.temp === _leadStatusFilter);
    filtered.sort((a, b) => b.days - a.days);
    if (!filtered.length) {
      el.innerHTML = `<div style="text-align:center;padding:32px;color:var(--text-muted);font-size:13px">${actTypeFilter ? 'No leads have a ' + actTypeFilter + ' activity logged yet.' : 'No leads match this filter.'}</div>`;
      return;
    }
    const tempConfig = {
      warm: { icon: 'fa-fire', color: 'var(--green)', bg: 'var(--green-bg)', label: 'Warm' },
      cooling: { icon: 'fa-temperature-half', color: 'var(--amber)', bg: 'var(--amber-bg)', label: 'Cooling' },
      cold: { icon: 'fa-snowflake', color: 'var(--blue)', bg: 'var(--blue-bg)', label: 'Cold' },
    };
    el.innerHTML = `
      <table class="data-table">
        <thead><tr>
          <th>Lead / Company</th><th>Stage</th><th>Temperature</th>
          <th>${actTypeFilter ? 'Last ' + actTypeFilter : 'Last Activity'}</th>
          <th>Days Inactive</th><th>${actTypeFilter ? actTypeFilter + ' Count' : 'Activity Count'}</th>
          ${isManager() ? '<th>Owner</th>' : ''}<th>Actions</th>
        </tr></thead>
        <tbody>
          ${filtered.map(l => {
            const cfg = tempConfig[l.temp];
            const daysLabel = l.days === 9999 ? 'Never' : l.days + 'd';
            const daysColor = l.days >= 14 ? 'var(--red-text)' : l.days >= 7 ? 'var(--amber-text)' : 'var(--green-text)';
            const ownerAcc = isManager() ? ACCOUNTS.find(a => a.id === l.ownerId) : null;
            return `
            <tr onclick="openLeadDrawer('${l.id}')">
              <td><div style="font-weight:700">${l.name}</div><div style="font-size:11px;color:var(--text-muted)">${l.company}</div></td>
              <td><span class="badge ${getStageBadgeClass(l.stage)}">${l.stage}</span></td>
              <td><div style="display:flex;align-items:center;gap:6px"><div style="width:24px;height:24px;border-radius:50%;background:${cfg.bg};display:flex;align-items:center;justify-content:center"><i class="fa-solid ${cfg.icon}" style="font-size:11px;color:${cfg.color}"></i></div><span style="font-size:12px;font-weight:600;color:${cfg.color}">${cfg.label}</span></div></td>
              <td style="font-size:12px">${l.lastAct ? `<span class="badge ${getTypeBadgeClass(l.lastAct.type)}">${l.lastAct.type}</span><br><span style="font-size:10px">${timeAgo(l.lastAct.createdAt)}</span>` : '—'}</td>
              <td style="font-weight:700;color:${daysColor}">${daysLabel}</td>
              <td><div style="display:flex;align-items:center;gap:8px"><span style="font-weight:700">${l.actCount}</span><div style="width:60px">${sparkBar(Math.min(l.actCount * 20, 100), 'var(--accent)')}</div></div></td>
              ${isManager() ? `<td>${ownerAcc ? `<span style="font-size:11px">${ownerAcc.initials} ${ownerAcc.name.split(' ')[0]}</span>` : '—'}</td>` : ''}
              <td onclick="event.stopPropagation()"><div style="display:flex;gap:4px">
                <button class="btn btn-icon btn-secondary btn-sm" onclick="openLogActivity('${l.id}','${l.name.replace(/'/g, "\\'")}','${l.stage}')"><i class="fa-solid fa-plus"></i></button>
                <button class="btn btn-icon btn-secondary btn-sm" onclick="openScheduleFor('${l.id}','${l.name.replace(/'/g, "\\'")}','${l.stage}')"><i class="fa-solid fa-calendar-plus"></i></button>
              </div></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;
  };

  window.renderActivitiesPage = function () {
    _actTypeFilter = 'all';
    _timeFilter = 'all';
    _leadStatusFilter = 'all';
    _todoMemberFilter = null;
    const allActs = getActivities().filter(a => !a.isScheduled);
    const myActs = scopeActs(allActs);
    const allSched = getScheduled();
    const mySched = scopeSched(allSched);
    const allLeads = getLeads();
    const kpiEl = document.getElementById('act-kpis');
    if (kpiEl) {
      const calls = myActs.filter(a => a.type === 'Call').length;
      const emails = myActs.filter(a => a.type === 'Email').length;
      const meetings = myActs.filter(a => a.type === 'Meeting').length;
      const todaySched = mySched.filter(s => { const d = new Date(s.scheduledDate); return d.toDateString() === new Date().toDateString() && !s.done; }).length;
      const coldCount = allLeads.filter(l => !['Closed Won', 'Closed Lost'].includes(l.stage) && getLeadTemp(l.id) === 'cold').length;
      kpiEl.innerHTML = `
        <div class="metric-card" style="border-left-color:var(--green)"><div class="metric-label">📞 Calls</div><div class="metric-value" style="color:var(--green)">${calls}</div><div class="metric-sub">${isManager() ? 'team total' : 'my total'}</div></div>
        <div class="metric-card" style="border-left-color:var(--blue)"><div class="metric-label">📧 Emails</div><div class="metric-value" style="color:var(--blue)">${emails}</div><div class="metric-sub">logged</div></div>
        <div class="metric-card" style="border-left-color:var(--purple)"><div class="metric-label">🤝 Meetings</div><div class="metric-value" style="color:var(--purple)">${meetings}</div><div class="metric-sub">held</div></div>
        <div class="metric-card" style="border-left-color:var(--accent)"><div class="metric-label">📅 Today's Tasks</div><div class="metric-value" style="color:var(--accent)">${todaySched}</div><div class="metric-sub">pending</div></div>
        <div class="metric-card" style="border-left-color:var(--red)"><div class="metric-label">🧊 Cold Leads</div><div class="metric-value" style="color:var(--red)">${coldCount}</div><div class="metric-sub">need attention</div></div>`;
    }
    _renderTodayTodos();
    _renderColdAlerts();
    const countMap = { all: myActs.length, Call: 0, Email: 0, Meeting: 0, Note: 0 };
    myActs.forEach(a => { if (countMap[a.type] !== undefined) countMap[a.type]++; });
    Object.entries(countMap).forEach(([t, n]) => { const el = document.getElementById('tab-count-' + t); if (el) el.textContent = n; });
    setActTab('all');
    filterActivities();
    renderLeadStatusList();
  };

  window.openLeadRulesModal = function () {
    if (!isManager()) { showToast('Only managers can edit lead rules', 'warning'); return; }
    const rules = getLeadRules();
    const warmEl = document.getElementById('rule-warm-days');
    const coldEl = document.getElementById('rule-cold-days');
    if (warmEl) warmEl.value = rules.warmDays;
    if (coldEl) coldEl.value = rules.coldDays;
    ['Prospecting', 'Qualification', 'Proposal', 'Negotiation'].forEach(s => {
      const el = document.getElementById('rule-stage-' + s);
      if (el) el.checked = rules.stages.includes(s);
    });
    openModal('lead-rules-modal');
  };

  window.saveLeadRules = function () {
    const warmDays = parseInt(document.getElementById('rule-warm-days')?.value, 10) || 7;
    const coldDays = parseInt(document.getElementById('rule-cold-days')?.value, 10) || 14;
    if (warmDays >= coldDays) { showToast('Warm threshold must be less than cold threshold', 'error'); return; }
    const stages = ['Prospecting', 'Qualification', 'Proposal', 'Negotiation'].filter(s => document.getElementById('rule-stage-' + s)?.checked);
    saveLeadRulesData({ warmDays, coldDays, stages });
    closeModal('lead-rules-modal');
    if (typeof currentPage !== 'undefined' && currentPage === 'activities') { _renderColdAlerts(); renderLeadStatusList(); }
    if (window.SalesTrackSupabase) {
      window.SalesTrackSupabase.saveLeadRulesRecord({ warmDays, coldDays, stages })
        .then(() => { if (typeof currentPage !== 'undefined' && currentPage === 'activities') { _renderColdAlerts(); renderLeadStatusList(); } })
        .catch(e => showToast(e.message || 'Unable to save lead rules to Supabase', 'error'));
    }
  };

  window.exportActivitiesCSV = function () {
    const acts = scopeActs(getActivities().filter(a => !a.isScheduled));
    if (!acts.length) { showToast('No activities to export', 'warning'); return; }
    const headers = ['ID', 'Type', 'Lead', 'Company', 'Stage', 'Date', 'Duration(min)', 'Notes', 'Next Action', 'Owner', 'Created At'];
    const rows = acts.map(a => {
      const ownerAcc = ACCOUNTS.find(x => x.id === a.ownerId);
      return [a.id, a.type, a.leadName, a.company, a.stage || '', a.date ? new Date(a.date).toLocaleDateString() : '', a.duration || 0, '"' + (a.notes || '').replace(/"/g, '""') + '"', '"' + (a.nextAction || '').replace(/"/g, '""') + '"', ownerAcc ? ownerAcc.name : '', a.createdAt ? new Date(a.createdAt).toLocaleDateString() : ''];
    });
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'activities_export.csv';
    link.click();
  };

  window.openScheduleFor = function (leadId) {
    openAddActivityModal();
    setActivityMode('schedule');
    const sel = document.getElementById('new-act-lead');
    if (sel) sel.value = leadId;
  };

  window.openActivityDrawer = function (id) {
    const acts = getActivities();
    const a = acts.find(x => x.id === id);
    if (!a) return;
    if (!isManager() && a.ownerId && a.ownerId !== CURRENT_USER.id) { showToast('You can only view your own activities', 'warning'); return; }
    const leadActs = acts.filter(x => x.leadId === a.leadId && (isManager() || !x.ownerId || x.ownerId === CURRENT_USER.id))
      .sort((x, y) => new Date(y.createdAt) - new Date(x.createdAt));
    const ownerAcc = ACCOUNTS.find(ac => ac.id === a.ownerId);
    document.getElementById('drawer-badge').className = 'badge ' + getTypeBadgeClass(a.type);
    document.getElementById('drawer-badge').textContent = a.type;
    document.getElementById('drawer-name').textContent = a.leadName;
    document.getElementById('drawer-company').textContent = a.company + (a.stage ? ' · ' + a.stage : '');
    document.getElementById('drawer-body').innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;padding:14px;background:${getTypeBg(a.type)};border-radius:var(--radius-md)">
        <div style="width:44px;height:44px;border-radius:50%;background:${getTypeColor(a.type)};display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px"><i class="fa-solid ${getTypeIcon(a.type)}"></i></div>
        <div><div style="font-size:14px;font-weight:700">${a.type} with ${a.leadName}</div><div style="font-size:12px;color:var(--text-secondary)">${formatDateTime(a.date)}${a.duration > 0 ? ' · ' + a.duration + ' min' : ''}</div></div>
      </div>
      <div style="margin-bottom:16px">
        <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:8px">Notes</div>
        <div style="font-size:13px;color:var(--text-secondary);line-height:1.6;background:var(--bg-input);padding:12px;border-radius:var(--radius)">${a.notes || 'No notes recorded.'}</div>
      </div>
      ${a.nextAction ? `<div style="padding:12px;background:var(--accent-light);border-radius:var(--radius);border-left:3px solid var(--accent);margin-bottom:18px"><div style="font-size:10px;font-weight:700;color:var(--accent-text);margin-bottom:4px">Next Action</div><div style="font-size:13px;color:var(--accent-text)">${a.nextAction}</div></div>` : ''}
      <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;margin-bottom:12px">All Activities for ${a.leadName} (${leadActs.length})</div>
      <div class="timeline">${leadActs.map(la => `
        <div class="timeline-item" onclick="openActivityDrawer('${la.id}')" style="cursor:pointer">
          <div class="timeline-dot" style="background:${getTypeColor(la.type)}"><i class="fa-solid ${getTypeIcon(la.type)}" style="font-size:7px"></i></div>
          <div style="background:${la.id === a.id ? 'var(--accent-light)' : 'var(--bg-input)'};border:1px solid ${la.id === a.id ? 'var(--accent)' : 'var(--border)'};border-radius:var(--radius);padding:8px 10px">
            <div style="display:flex;justify-content:space-between;margin-bottom:3px">
              <span style="font-size:10px;font-weight:700;color:${getTypeColor(la.type)}">${la.type}</span>
              <span style="font-size:10px;color:var(--text-muted)">${timeAgo(la.createdAt)}</span>
            </div>
            <div class="timeline-note">${la.notes || '—'}</div>
          </div>
        </div>`).join('')}</div>`;
    document.getElementById('drawer-footer').innerHTML = `
      <div style="display:flex;gap:8px">
        <button class="btn btn-secondary" style="flex:1" onclick="openLogActivity('${a.leadId}','${a.leadName.replace(/'/g, "\\'")}','${a.stage || ''}')"><i class="fa-solid fa-plus"></i> Log New</button>
        <button class="btn btn-secondary" style="flex:1" onclick="navigateTo('leads')"><i class="fa-solid fa-user"></i> View Lead</button>
        ${isManager() || !a.ownerId || a.ownerId === CURRENT_USER.id ? `<button class="btn btn-danger btn-sm" onclick="deleteActivity('${a.id}')"><i class="fa-solid fa-trash"></i></button>` : ''}
      </div>`;
    openDrawer();
  };

  window.deleteActivity = function (id) {
    if (!confirm('Delete this activity?')) return;
    saveActivities(getActivities().filter(a => a.id !== id));
    closeDrawer();
    if (typeof currentPage !== 'undefined' && currentPage === 'activities') renderActivitiesPage();
    if (typeof currentPage !== 'undefined' && currentPage === 'dashboard' && typeof renderDashboardCharts === 'function') renderDashboardCharts();
    if (window.SalesTrackSupabase) {
      window.SalesTrackSupabase.deleteActivityRecord(id)
        .then(() => {
          if (typeof currentPage !== 'undefined' && currentPage === 'activities') renderActivitiesPage();
          if (typeof currentPage !== 'undefined' && currentPage === 'dashboard' && typeof renderDashboardCharts === 'function') renderDashboardCharts();
        })
        .catch(e => showToast(e.message || 'Unable to delete activity from Supabase', 'error'));
    }
  };

  window.openAddActivityModal = function () {
    const leads = scopeLeads(getLeads());
    const sel = document.getElementById('new-act-lead');
    if (sel) sel.innerHTML = '<option value="">Select a lead...</option>' + leads.map(l => `<option value="${l.id}" data-name="${l.name}" data-company="${l.company}" data-stage="${l.stage}">${l.name} — ${l.company}</option>`).join('');
    const di = document.getElementById('new-act-date');
    if (di) di.value = new Date().toISOString().split('T')[0];
    _actMode = 'log';
    _selectedAssignee = null;
    setActivityMode('log');
    ['new-act-notes', 'new-act-next'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const di2 = document.getElementById('new-act-duration');
    if (di2) di2.value = '';
    const schedDate = document.getElementById('new-act-sched-date');
    if (schedDate) schedDate.value = '';
    openModal('add-activity-modal');
  };

  window.openLogActivity = function (leadId, leadName, stage) {
    openAddActivityModal();
    const sel = document.getElementById('new-act-lead');
    if (sel) sel.value = leadId;
    closeDrawer();
  };

  window.saveActivity = function () {
    const type = document.getElementById('new-act-type')?.value;
    const leadEl = document.getElementById('new-act-lead');
    const leadId = leadEl?.value;
    const notes = document.getElementById('new-act-notes')?.value?.trim();
    const nextAct = document.getElementById('new-act-next')?.value?.trim();
    const isSched = _actMode === 'schedule';
    if (!leadId) { showToast('Please select a lead', 'error'); return; }
    if (!notes && !isSched) { showToast('Please enter notes', 'error'); return; }
    const opt = leadEl.options[leadEl.selectedIndex];
    const lead = getLeads().find(l => l.id === leadId);
    if (isSched) {
      const schedDate = document.getElementById('new-act-sched-date')?.value;
      const schedTime = document.getElementById('new-act-sched-time')?.value;
      if (!schedDate) { showToast('Please pick a scheduled date', 'error'); return; }
      const assignedTo = isManager() ? (_selectedAssignee !== null ? _selectedAssignee : CURRENT_USER.id) : CURRENT_USER.id;
      const newSched = {
        id: 'sched_' + Date.now(), type, leadId,
        leadName: opt.dataset.name || '', company: opt.dataset.company || '', stage: opt.dataset.stage || lead?.stage || '',
        scheduledDate: schedDate, scheduledTime: schedTime || '', agenda: notes || '', done: false,
        ownerId: CURRENT_USER.id, assignedTo, createdAt: new Date().toISOString(),
      };
      const all = getScheduled();
      all.push(newSched);
      saveScheduled(all);
      closeModal('add-activity-modal');
      if (typeof currentPage !== 'undefined' && currentPage === 'activities') renderActivitiesPage();
      persistScheduled(newSched, () => {
        if (typeof currentPage !== 'undefined' && currentPage === 'activities') renderActivitiesPage();
      });
    } else {
      const date = document.getElementById('new-act-date')?.value;
      const duration = parseInt(document.getElementById('new-act-duration')?.value, 10) || 0;
      const now = new Date().toISOString();
      const newAct = {
        id: 'act_' + Date.now(), type, leadId,
        leadName: opt.dataset.name || '', company: opt.dataset.company || '', stage: opt.dataset.stage || lead?.stage || '',
        date: date ? new Date(date + 'T00:00:00').toISOString() : now, duration, notes, nextAction: nextAct || '',
        ownerId: CURRENT_USER.id, createdAt: now,
      };
      const acts = getActivities();
      acts.push(newAct);
      saveActivities(acts);
      const leads = getLeads();
      const leadIdx = leads.findIndex(l => l.id === leadId);
      if (leadIdx !== -1) { leads[leadIdx].updatedAt = now; saveLeads(leads); }
      closeModal('add-activity-modal');
      if (typeof currentPage !== 'undefined' && currentPage === 'activities') renderActivitiesPage();
      if (typeof currentPage !== 'undefined' && currentPage === 'dashboard' && typeof renderDashboardCharts === 'function') renderDashboardCharts();
      if (typeof currentPage !== 'undefined' && currentPage === 'deals' && typeof renderDealsTable === 'function') renderDealsTable();
      if (typeof currentPage !== 'undefined' && currentPage === 'leads' && typeof renderLeadsTable === 'function') renderLeadsTable();
      persistActivity(newAct, () => {
        if (typeof currentPage !== 'undefined' && currentPage === 'activities') renderActivitiesPage();
        if (typeof currentPage !== 'undefined' && currentPage === 'dashboard' && typeof renderDashboardCharts === 'function') renderDashboardCharts();
        if (typeof currentPage !== 'undefined' && currentPage === 'deals' && typeof renderDealsTable === 'function') renderDealsTable();
        if (typeof currentPage !== 'undefined' && currentPage === 'leads' && typeof renderLeadsTable === 'function') renderLeadsTable();
      });
    }
  };
})();
