/* ======================================================
   LEADS PAGE — FULL FEATURED
====================================================== */

function getLeadStatusBadge(s) {
  const m = { New: 'badge-new', Converted: 'badge-converted', Rejected: 'badge-rejected' };
  return m[s] || 'badge-new';
}

async function persistLead(lead, after) {
  if (!window.SalesTrackSupabase) return;
  try {
    await window.SalesTrackSupabase.saveLeadRecord(lead);
    if (typeof after === 'function') after();
  } catch (e) {
    showToast(e.message || 'Unable to save lead to Supabase', 'error');
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

function getLastActivity(lead) {
  const acts = getActivities().filter(a => a.leadId === lead.id);
  if (!acts.length) return { icon: '—', label: '—', date: lead.createdAt };
  const last = acts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
  const icons = { Call: '📞', Email: '📧', Meeting: '🤝', Note: '📝', System: '🔔' };
  return { icon: icons[last.type] || '📝', label: last.type, date: last.createdAt, notes: last.notes };
}

function getLeadsHTML() {
  const isManager = CURRENT_USER.role === 'manager';
  return `
    <div class="page-header no-print">
      <div>
        <div class="page-title">My Leads Directory</div>
        <div class="page-subtitle">Qualify incoming prospects, track communications timelines, and convert commercial accounts.</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <button class="btn btn-secondary btn-sm" onclick="printLeads()"><i class="fa-solid fa-print"></i> Print</button>
        <button class="btn btn-secondary btn-sm" onclick="exportLeadsExcel()"><i class="fa-solid fa-file-excel"></i> Export Excel</button>
        <button class="btn btn-primary" onclick="openAddLeadModal()"><i class="fa-solid fa-plus"></i> Create New Lead</button>
      </div>
    </div>
    <div class="card no-print" style="margin-bottom:16px;padding:14px 18px">
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <input class="form-input" style="max-width:220px" placeholder="🔍 Search company or name..." id="lead-search" oninput="filterLeads()">
        <select class="form-input" style="width:155px" id="lead-status-filter" onchange="filterLeads()">
          <option value="">All Statuses</option>
          <option value="New">New</option>
          <option value="Converted">Converted</option>
          <option value="Rejected">Rejected</option>
        </select>
        <select class="form-input" style="width:195px" id="lead-interacted-sort" onchange="filterLeads()">
          <option value="">Default</option>
          <option value="newest">Newest to Oldest Interacted</option>
          <option value="oldest">Oldest to Newest Interacted</option>
        </select>
        ${isManager ? `
        <select class="form-input" style="width:160px" id="lead-assignee-filter" onchange="filterLeads()">
          <option value="">All Sales Members</option>
          ${ACCOUNTS.filter(a => a.role !== 'manager').map(a => `<option value="${a.name}">${a.name}</option>`).join('')}
        </select>` : `
        <div style="display:flex;align-items:center;gap:6px;padding:6px 12px;background:var(--accent-light);border:1px solid rgba(99,102,241,0.2);border-radius:var(--radius);font-size:12px;color:var(--accent-text)">
          <i class="fa-solid fa-user-tie"></i>
          <span>Showing: <strong>${CURRENT_USER.name}</strong>'s leads</span>
        </div>`}
        <span style="margin-left:auto;font-size:12px;color:var(--text-muted)" id="leads-count-label"></span>
      </div>
    </div>
    <div class="card" id="leads-print-area" style="padding:0;overflow:hidden">
      <div style="overflow-x:auto">
        <table class="data-table" id="leads-table">
          <thead><tr>
            <th>Lead</th><th>Company</th><th>Est. Value</th><th>Status</th>
            ${isManager ? '<th>Assigned To</th>' : ''}
            <th>Last Activity</th><th>Last Day Interacted</th><th class="no-print">Actions</th>
          </tr></thead>
          <tbody id="leads-tbody"></tbody>
        </table>
      </div>
    </div>`;
}

function filterLeads() { renderLeadsTable(); }

function renderLeadsTable() {
  const isManager = CURRENT_USER.role === 'manager';
  let leads = getLeads();

  if (!isManager) {
    leads = leads.filter(l => l.assignedTo === CURRENT_USER.name);
  }

  const search = (document.getElementById('lead-search')?.value || '').toLowerCase();
  const statusF = document.getElementById('lead-status-filter')?.value || '';
  const sortF = document.getElementById('lead-interacted-sort')?.value || '';
  const assigneeF = isManager ? (document.getElementById('lead-assignee-filter')?.value || '') : '';

  if (search) leads = leads.filter(l => (l.name + l.company).toLowerCase().includes(search));
  if (statusF) leads = leads.filter(l => (l.leadStatus || 'New') === statusF);
  if (assigneeF) leads = leads.filter(l => l.assignedTo === assigneeF);

  if (sortF === 'newest' || sortF === 'oldest') {
    leads = leads.map(l => {
      const acts = getActivities().filter(a => a.leadId === l.id);
      const lastDate = acts.length ? Math.max(...acts.map(a => new Date(a.createdAt))) : new Date(l.createdAt);
      return { ...l, _lastInteracted: lastDate };
    });
    leads.sort((a, b) => sortF === 'newest' ? b._lastInteracted - a._lastInteracted : a._lastInteracted - b._lastInteracted);
  }

  const countEl = document.getElementById('leads-count-label');
  if (countEl) countEl.textContent = leads.length + ' lead' + (leads.length !== 1 ? 's' : '');

  const tbody = document.getElementById('leads-tbody');
  if (!tbody) return;
  if (!leads.length) {
    tbody.innerHTML = `<tr><td colspan="${isManager ? 8 : 7}"><div class="empty-state"><i class="fa-solid fa-user-plus"></i><h3>No leads found</h3><p>${!isManager ? 'No leads assigned to you yet.' : 'Add your first lead or adjust filters.'}</p></div></td></tr>`;
    return;
  }

  const memberColors = { 'Anna Nguyen': '#d97706', 'Duy Trần': '#6366f1', 'Mai Lê': '#10b981', 'Hùng Võ': '#8b5cf6' };
  const memberInitials = n => n.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  tbody.innerHTML = leads.map(l => {
    const status = l.leadStatus || 'New';
    const lastAct = getLastActivity(l);
    const isNew = status === 'New';
    const mColor = memberColors[l.assignedTo] || '#6366f1';
    const mInit = l.assignedTo ? memberInitials(l.assignedTo) : '?';
    return `
    <tr onclick="openLeadDrawer('${l.id}')" style="cursor:pointer">
      <td style="font-weight:600;color:var(--text-primary)">${l.name}</td>
      <td style="font-size:12px;color:var(--text-muted)">${l.company}</td>
      <td style="font-weight:700;color:var(--accent)">${formatCurrency(l.dealSize)}</td>
      <td><span class="badge ${getLeadStatusBadge(status)}">${status}</span></td>
      ${isManager ? `<td>
        <div style="display:flex;align-items:center;gap:7px">
          <div style="width:24px;height:24px;border-radius:50%;background:${mColor};display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:#fff;flex-shrink:0">${mInit}</div>
          <span style="font-size:12px;color:var(--text-secondary)">${l.assignedTo || '—'}</span>
        </div>
      </td>` : ''}
      <td>
        <div style="display:flex;align-items:center;gap:6px">
          <span>${lastAct.icon}</span>
          <span style="font-size:12px;color:var(--text-secondary)">${lastAct.label}</span>
        </div>
      </td>
      <td style="font-size:12px;color:var(--text-muted)">${timeAgo(lastAct.date)}</td>
      <td onclick="event.stopPropagation()" class="no-print">
        <div style="display:flex;gap:4px;align-items:center">
          ${isNew ? `
            <button class="btn btn-success btn-sm" onclick="openConvertModal('${l.id}')"><i class="fa-solid fa-check"></i> Convert</button>
            <button class="btn btn-danger btn-sm" onclick="openRejectModal('${l.id}')"><i class="fa-solid fa-xmark"></i> Reject</button>
          ` : `<span style="font-size:11px;color:var(--text-muted);font-style:italic">${status}</span>`}
        </div>
      </td>
    </tr>`;
  }).join('');
}

function openLeadDrawer(id) {
  const lead = getLeads().find(l => l.id === id);
  if (!lead) return;
  const status = lead.leadStatus || 'New';
  const activities = getActivities().filter(a => a.leadId === id).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const memberColors = { 'Anna Nguyen': '#d97706', 'Duy Trần': '#6366f1', 'Mai Lê': '#10b981', 'Hùng Võ': '#8b5cf6' };
  const mColor = memberColors[lead.assignedTo] || '#6366f1';
  const mInit = lead.assignedTo ? lead.assignedTo.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) : '?';

  document.getElementById('drawer-badge').className = 'badge ' + getLeadStatusBadge(status);
  document.getElementById('drawer-badge').textContent = status;
  document.getElementById('drawer-name').textContent = lead.name;
  document.getElementById('drawer-company').textContent = lead.company;

  document.getElementById('drawer-body').innerHTML = `
    <div style="background:linear-gradient(135deg,var(--accent) 0%,#818cf8 100%);border-radius:var(--radius-md);padding:16px;margin-bottom:16px;color:#fff">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
        <div style="width:48px;height:48px;border-radius:50%;background:rgba(255,255,255,0.25);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;flex-shrink:0">${lead.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:15px;font-weight:700;line-height:1.2">${lead.name}</div>
          <div style="font-size:12px;opacity:.8;margin-top:2px">${lead.company}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:18px;font-weight:800">${formatCurrency(lead.dealSize)}</div>
          <div style="font-size:10px;opacity:.7;text-transform:uppercase;letter-spacing:.04em">Est. Value</div>
        </div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <span style="background:rgba(255,255,255,0.2);border-radius:20px;padding:2px 10px;font-size:11px;font-weight:600">${status}</span>
        ${lead.stage ? `<span style="background:rgba(255,255,255,0.2);border-radius:20px;padding:2px 10px;font-size:11px;font-weight:600">${lead.stage}</span>` : ''}
        ${lead.industry ? `<span style="background:rgba(255,255,255,0.15);border-radius:20px;padding:2px 10px;font-size:11px">${lead.industry}</span>` : ''}
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
      <a href="mailto:${lead.email || ''}" style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius);text-decoration:none;transition:all .15s" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
        <i class="fa-solid fa-envelope" style="color:var(--blue);font-size:14px;width:16px"></i>
        <div style="min-width:0">
          <div style="font-size:9px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em">Email</div>
          <div style="font-size:11px;color:var(--text-primary);font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${lead.email || '—'}</div>
        </div>
      </a>
      <a href="tel:${lead.phone || ''}" style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius);text-decoration:none;transition:all .15s" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
        <i class="fa-solid fa-phone" style="color:var(--green);font-size:14px;width:16px"></i>
        <div>
          <div style="font-size:9px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em">Phone</div>
          <div style="font-size:11px;color:var(--text-primary);font-weight:500">${lead.phone || '—'}</div>
        </div>
      </a>
    </div>
    <div style="margin-bottom:16px">
      <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px;display:flex;align-items:center;gap:6px">
        <i class="fa-solid fa-building" style="font-size:10px"></i> Account Details
      </div>
      <div style="background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-md);overflow:hidden">
        ${metaRow2('Website', lead.website ? `<a href="https://${lead.website}" target="_blank" style="color:var(--accent);text-decoration:none">${lead.website}</a>` : '—')}
        ${metaRow2('Industry', lead.industry || '—')}
        ${metaRow2('City', lead.city || '—')}
        ${metaRow2('Lead Source', lead.source || '—')}
        ${metaRow2('Created', formatDate(lead.createdAt))}
      </div>
    </div>
    <div style="margin-bottom:16px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-md);padding:12px">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="width:36px;height:36px;border-radius:50%;background:${mColor};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff;flex-shrink:0">${mInit}</div>
        <div style="flex:1">
          <div style="font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em">Assigned To</div>
          <div style="font-size:13px;font-weight:600;color:var(--text-primary)">${lead.assignedTo || '—'}</div>
        </div>
        <span class="badge badge-member">Sales Member</span>
      </div>
      ${CURRENT_USER.role === 'manager' ? `
      <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);display:flex;align-items:center;gap:8px">
        <select class="form-input" id="drawer-reassign-select" style="flex:1;font-size:12px">
          <option value="">— Reassign to —</option>
          ${ACCOUNTS.filter(a => a.role !== 'manager').map(a => `<option value="${a.name}" ${lead.assignedTo === a.name ? 'selected' : ''}>${a.name}</option>`).join('')}
        </select>
        <button class="btn btn-primary btn-sm" onclick="reassignLead('${lead.id}')"><i class="fa-solid fa-user-check"></i> Assign</button>
      </div>` : ''}
    </div>
    ${lead.notes ? `
    <div style="margin-bottom:16px">
      <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px;display:flex;align-items:center;gap:6px"><i class="fa-solid fa-note-sticky" style="font-size:10px"></i> Notes</div>
      <div style="background:var(--amber-bg);border:1px solid rgba(245,158,11,0.2);border-radius:var(--radius);padding:12px;font-size:12px;color:var(--text-secondary);line-height:1.6">${lead.notes}</div>
    </div>` : ''}
    ${status === 'New' ? `
    <div style="margin-bottom:16px;background:var(--accent-light);border:1px solid rgba(99,102,241,0.2);border-radius:var(--radius-md);padding:14px">
      <div style="font-size:10px;font-weight:700;color:var(--accent-text);text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px;display:flex;align-items:center;gap:6px"><i class="fa-solid fa-pen-to-square" style="font-size:10px"></i> Log Live Action Interaction</div>
      <div style="display:flex;flex-direction:column;gap:10px">
        <div>
          <label class="form-label">Activity Type</label>
          <select class="form-input" id="drawer-act-type">
            <option value="Call">📞 Call</option>
            <option value="Email">📧 Email</option>
            <option value="Meeting">🤝 Meeting</option>
            <option value="Note">📝 Note</option>
          </select>
        </div>
        <div>
          <label class="form-label">Notes</label>
          <textarea class="form-input" id="drawer-act-notes" rows="2" placeholder="What happened?..."></textarea>
        </div>
        <button class="btn btn-primary btn-sm" onclick="logDrawerActivity('${lead.id}')"><i class="fa-solid fa-check"></i> Log Activity</button>
      </div>
    </div>` : ''}
    <div>
      <div style="font-size:10px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between">
        <span style="display:flex;align-items:center;gap:6px"><i class="fa-solid fa-clock-rotate-left" style="font-size:10px"></i> Activity Timeline</span>
        <span style="background:var(--bg-input);border:1px solid var(--border);border-radius:10px;padding:1px 8px;font-size:10px;font-weight:700;color:var(--text-secondary)">${activities.length}</span>
      </div>
      ${activities.length ? `<div class="timeline">${activities.map(a => {
        const tIcons = { Call: 'fa-phone', Email: 'fa-envelope', Meeting: 'fa-handshake', Note: 'fa-note-sticky', System: 'fa-robot' };
        const tColors = { Call: 'var(--green)', Email: 'var(--blue)', Meeting: 'var(--purple)', Note: 'var(--text-muted)', System: 'var(--accent)' };
        const tBgs = { Call: 'var(--green-bg)', Email: 'var(--blue-bg)', Meeting: 'var(--purple-bg)', Note: 'var(--bg-input)', System: 'var(--accent-light)' };
        return `<div class="timeline-item">
          <div class="timeline-dot" style="background:${tColors[a.type] || tColors.Note}"><i class="fa-solid ${tIcons[a.type] || 'fa-circle'}" style="font-size:7px"></i></div>
          <div style="background:${tBgs[a.type] || tBgs.Note};border:1px solid var(--border);border-radius:var(--radius);padding:8px 10px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <span style="font-size:10px;font-weight:700;color:${tColors[a.type] || tColors.Note};text-transform:uppercase;letter-spacing:.04em">${a.type} Log</span>
              <span style="font-size:10px;color:var(--text-muted)">${formatDateTime(a.createdAt)}</span>
            </div>
            <div style="font-size:12px;color:var(--text-secondary);line-height:1.5">${a.notes || ''}</div>
          </div>
        </div>`;
      }).join('')}</div>` :
      `<div class="empty-state" style="padding:20px 0"><i class="fa-solid fa-clock" style="font-size:24px"></i><p style="margin-top:8px">No activities logged yet</p></div>`}
    </div>`;

  document.getElementById('drawer-footer').innerHTML = `
    <div style="display:flex;gap:8px">
      ${status === 'New' ? `
        <button class="btn btn-success btn-sm" onclick="closeDrawer();openConvertModal('${lead.id}')"><i class="fa-solid fa-check"></i> Convert</button>
        <button class="btn btn-danger btn-sm" onclick="closeDrawer();openRejectModal('${lead.id}')"><i class="fa-solid fa-xmark"></i> Reject</button>
      ` : ''}
      <button class="btn btn-secondary" style="flex:1" onclick="closeDrawer()"><i class="fa-solid fa-xmark"></i> Close</button>
    </div>`;
  openDrawer();
}

function metaRow2(label, value) {
  return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-bottom:1px solid var(--border-light)">
    <span style="font-size:11px;color:var(--text-muted);font-weight:500">${label}</span>
    <span style="font-size:12px;font-weight:600;color:var(--text-primary);text-align:right;max-width:65%">${value}</span>
  </div>`;
}

function logDrawerActivity(leadId) {
  const type = document.getElementById('drawer-act-type')?.value;
  const notes = document.getElementById('drawer-act-notes')?.value?.trim();
  if (!notes) { showToast('Please enter notes', 'error'); return; }
  const lead = getLeads().find(l => l.id === leadId);
  const acts = getActivities();
  const newAct = {
    id: 'act_' + Date.now(),
    type, leadId,
    leadName: lead?.name || '',
    company: lead?.company || '',
    stage: lead?.stage || '',
    date: new Date().toISOString(),
    duration: 0,
    notes,
    nextAction: '',
    ownerId: CURRENT_USER.id,
    salesId: CURRENT_USER.salesId,
    createdAt: new Date().toISOString()
  };
  acts.push(newAct);
  saveActivities(acts);
  const leads = getLeads();
  const idx = leads.findIndex(l => l.id === leadId);
  if (idx > -1) { leads[idx].updatedAt = new Date().toISOString(); saveLeads(leads); }
  openLeadDrawer(leadId);
  renderLeadsTable();
  if (currentPage === 'deals') renderDealsTable();
  persistActivity(newAct, () => {
    openLeadDrawer(leadId);
    renderLeadsTable();
    if (currentPage === 'deals') renderDealsTable();
  });
}

function reassignLead(leadId) {
  const sel = document.getElementById('drawer-reassign-select');
  if (!sel) return;
  const newAssignee = sel.value;
  if (!newAssignee) { showToast('Please select a sales member', 'error'); return; }
  const leads = getLeads();
  const idx = leads.findIndex(l => l.id === leadId);
  if (idx === -1) return;
  const oldAssignee = leads[idx].assignedTo || '—';
  leads[idx].assignedTo = newAssignee;
  leads[idx].updatedAt = new Date().toISOString();
  saveLeads(leads);
  const acts = getActivities();
  const newAct = {
    id: 'act_' + Date.now(),
    type: 'System',
    leadId,
    leadName: leads[idx].name,
    company: leads[idx].company,
    stage: leads[idx].stage || '',
    date: new Date().toISOString(),
    duration: 0,
    notes: `Lead reassigned from ${oldAssignee} → ${newAssignee} by ${CURRENT_USER.name}.`,
    nextAction: '',
    ownerId: CURRENT_USER.id,
    salesId: CURRENT_USER.salesId,
    createdAt: new Date().toISOString()
  };
  acts.push(newAct);
  saveActivities(acts);
  openLeadDrawer(leadId);
  renderLeadsTable();
  persistLead(leads[idx], () => {
    persistActivity(newAct, () => {
      openLeadDrawer(leadId);
      renderLeadsTable();
    });
  });
}

let _convertLeadId = null;
function openConvertModal(id) {
  _convertLeadId = id;
  const lead = getLeads().find(l => l.id === id);
  if (!lead) return;
  document.getElementById('convert-deal-name').value = 'Opportunity - ' + lead.company;
  document.getElementById('convert-company').value = lead.company;
  document.getElementById('convert-contact').value = lead.name;
  document.getElementById('convert-value').value = lead.dealSize || '';
  document.getElementById('convert-close-date').value = '';
  document.getElementById('convert-stage').value = 'Prospecting (10%)';
  openModal('convert-modal');
}

function saveConvertDeal() {
  const dealName = document.getElementById('convert-deal-name').value.trim();
  const value = document.getElementById('convert-value').value;
  const closeDate = document.getElementById('convert-close-date').value;
  if (!dealName) { showToast('Deal Name is required', 'error'); return; }
  if (!value) { showToast('Deal Value is required', 'error'); return; }
  if (!closeDate) { showToast('Expected Close Date is required', 'error'); return; }

  const stageRaw = document.getElementById('convert-stage').value;
  const stage = stageRaw.split(' (')[0];
  const leads = getLeads();
  const idx = leads.findIndex(l => l.id === _convertLeadId);
  if (idx > -1) {
    leads[idx].leadStatus = 'Converted';
    leads[idx].dealSize = parseInt(value) || leads[idx].dealSize;
    leads[idx].stage = stage;
    leads[idx].probability = getDefaultProbability(stage);
    leads[idx].updatedAt = new Date().toISOString();
    if (dealName) leads[idx].dealName = dealName;
    saveLeads(leads);
  }
  const acts = getActivities();
  const newAct = {
    id: 'act_' + Date.now(),
    type: 'System',
    leadId: _convertLeadId,
    leadName: leads[idx]?.name || '',
    company: leads[idx]?.company || '',
    stage: leads[idx]?.stage || '',
    date: new Date().toISOString(),
    duration: 0,
    notes: 'Lead converted into pipeline opportunity.',
    nextAction: '',
    ownerId: CURRENT_USER.id,
    salesId: CURRENT_USER.salesId,
    createdAt: new Date().toISOString()
  };
  acts.push(newAct);
  saveActivities(acts);
  closeModal('convert-modal');
  renderLeadsTable();
  updateLeadsBadge();
  if (currentPage === 'deals') renderDealsTable();
  if (idx > -1) {
    persistLead(leads[idx], () => {
      persistActivity(newAct, () => {
        renderLeadsTable();
        updateLeadsBadge();
        if (currentPage === 'deals') renderDealsTable();
      });
    });
  }
}

let _rejectLeadId = null;
function openRejectModal(id) {
  _rejectLeadId = id;
  openModal('reject-modal');
}

function confirmRejectLead() {
  const leads = getLeads();
  const idx = leads.findIndex(l => l.id === _rejectLeadId);
  if (idx > -1) {
    leads[idx].leadStatus = 'Rejected';
    leads[idx].updatedAt = new Date().toISOString();
    saveLeads(leads);
  }
  const acts = getActivities();
  const newAct = {
    id: 'act_' + Date.now(),
    type: 'System',
    leadId: _rejectLeadId,
    leadName: leads[idx]?.name || '',
    company: leads[idx]?.company || '',
    stage: leads[idx]?.stage || '',
    date: new Date().toISOString(),
    duration: 0,
    notes: 'Lead marked as Rejected.',
    nextAction: '',
    ownerId: CURRENT_USER.id,
    salesId: CURRENT_USER.salesId,
    createdAt: new Date().toISOString()
  };
  acts.push(newAct);
  saveActivities(acts);
  closeModal('reject-modal');
  renderLeadsTable();
  updateLeadsBadge();
  if (idx > -1) {
    persistLead(leads[idx], () => {
      persistActivity(newAct, () => {
        renderLeadsTable();
        updateLeadsBadge();
      });
    });
  }
}

let _addLeadActivities = [];
function openAddLeadModal() {
  _addLeadActivities = [];
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const dateStr = now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate());
  const rand = String(Math.floor(Math.random() * 9000) + 1000);
  const leadId = 'LD-' + dateStr + '-' + rand;
  document.getElementById('new-lead-form').reset();
  document.getElementById('new-lead-id').value = leadId;
  document.getElementById('new-lead-notes-counter').textContent = '0/500';
  document.getElementById('new-lead-source-other').style.display = 'none';
  document.getElementById('new-lead-activities-list').innerHTML = '';
  const assignedWrap = document.getElementById('new-lead-assigned-wrap');
  if (assignedWrap) assignedWrap.style.display = CURRENT_USER.role === 'manager' ? 'block' : 'none';
  openModal('add-lead-modal');
}

function checkOtherSource() {
  const val = document.getElementById('new-lead-source').value;
  document.getElementById('new-lead-source-other').style.display = val === 'Other' ? 'block' : 'none';
}

function updateNotesCounter() {
  const val = document.getElementById('new-lead-notes').value;
  document.getElementById('new-lead-notes-counter').textContent = val.length + '/500';
  if (val.length > 500) document.getElementById('new-lead-notes').value = val.slice(0, 500);
}

function addLeadActivityRow() {
  const id = 'la_' + Date.now();
  _addLeadActivities.push({ id, type: 'Call', date: '', description: '' });
  renderAddLeadActivities();
}

function removeLeadActivityRow(id) {
  _addLeadActivities = _addLeadActivities.filter(a => a.id !== id);
  renderAddLeadActivities();
}

function renderAddLeadActivities() {
  const container = document.getElementById('new-lead-activities-list');
  if (!container) return;
  container.innerHTML = _addLeadActivities.map(a => `
    <div style="display:grid;grid-template-columns:1fr 1fr 2fr auto;gap:8px;align-items:start;padding:10px;background:var(--bg-input);border-radius:var(--radius);margin-bottom:8px" id="larow-${a.id}">
      <div>
        <label class="form-label">Type</label>
        <select class="form-input" onchange="updateLeadActivity('${a.id}','type',this.value)">
          <option>Call</option><option>Email</option><option>Meeting</option><option>Note</option>
        </select>
      </div>
      <div>
        <label class="form-label">Date</label>
        <input type="date" class="form-input" onchange="updateLeadActivity('${a.id}','date',this.value)">
      </div>
      <div>
        <label class="form-label">Description</label>
        <input class="form-input" placeholder="Brief description..." onchange="updateLeadActivity('${a.id}','description',this.value)" oninput="updateLeadActivity('${a.id}','description',this.value)">
      </div>
      <div style="padding-top:20px">
        <button class="btn btn-danger btn-icon btn-sm" onclick="removeLeadActivityRow('${a.id}')"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>`).join('');
}

function updateLeadActivity(id, field, val) {
  const a = _addLeadActivities.find(x => x.id === id);
  if (a) a[field] = val;
}

function saveNewLead() {
  const g = id => document.getElementById(id)?.value?.trim();
  const name = g('new-lead-name');
  const company = g('new-lead-company');
  const industry = g('new-lead-industry');
  const email = g('new-lead-email');
  const source = g('new-lead-source');
  const isManager = CURRENT_USER.role === 'manager';
  const assignedTo = isManager ? g('new-lead-assigned') : CURRENT_USER.name;
  if (!name) { showToast('Full Name is required', 'error'); return; }
  if (!company) { showToast('Company is required', 'error'); return; }
  if (!industry) { showToast('Industry is required', 'error'); return; }
  if (!email) { showToast('Email is required', 'error'); return; }
  if (!source) { showToast('Lead Source is required', 'error'); return; }
  if (isManager && !assignedTo) { showToast('Assigned To is required', 'error'); return; }

  const now = new Date().toISOString();
  const newLead = {
    id: document.getElementById('new-lead-id').value || ('lead_' + Date.now()),
    name, company, industry,
    website: g('new-lead-website') || '',
    email,
    phone: g('new-lead-phone') || '',
    city: g('new-lead-city') || '',
    dealSize: 0,
    probability: 0,
    source: source === 'Other' ? (g('new-lead-source-other-val') || 'Other') : source,
    stage: 'Prospecting',
    leadStatus: 'New',
    assignedTo,
    notes: g('new-lead-notes') || '',
    createdAt: now,
    updatedAt: now
  };

  const leads = getLeads();
  leads.push(newLead);
  saveLeads(leads);

  if (_addLeadActivities.length) {
    const acts = getActivities();
    _addLeadActivities.forEach(a => {
      if (a.description) {
        acts.push({
          id: 'act_' + Date.now() + Math.random(),
          type: a.type,
          leadId: newLead.id,
          leadName: name,
          company: company,
          stage: 'Prospecting',
          date: a.date || now,
          duration: 0,
          notes: a.description,
          nextAction: '',
          ownerId: CURRENT_USER.id,
          salesId: CURRENT_USER.salesId,
          createdAt: now
        });
      }
    });
    saveActivities(acts);
  }

  closeModal('add-lead-modal');
  renderLeadsTable();
  updateLeadsBadge();
  persistLead(newLead, async function () {
    for (const a of _addLeadActivities) {
      if (!a.description) continue;
      await persistActivity({
        id: 'act_' + Date.now() + Math.random(),
        type: a.type,
        leadId: newLead.id,
        leadName: name,
        company,
        stage: 'Prospecting',
        date: a.date || now,
        duration: 0,
        notes: a.description,
        nextAction: '',
        ownerId: CURRENT_USER.id,
        salesId: CURRENT_USER.salesId,
        createdAt: now
      });
    }
    renderLeadsTable();
    updateLeadsBadge();
  });
}

function exportLeadsExcel() {
  if (typeof XLSX === 'undefined') { showToast('SheetJS not loaded', 'error'); return; }
  let leads = getLeads();
  if (CURRENT_USER.role !== 'manager') {
    leads = leads.filter(l => l.assignedTo === CURRENT_USER.name);
  }
  const search = (document.getElementById('lead-search')?.value || '').toLowerCase();
  const statusF = document.getElementById('lead-status-filter')?.value || '';
  if (search) leads = leads.filter(l => (l.name + l.company).toLowerCase().includes(search));
  if (statusF) leads = leads.filter(l => (l.leadStatus || 'New') === statusF);

  const rows = leads.map(l => ({
    'Lead Name': l.name,
    'Company': l.company,
    'Industry': l.industry || '',
    'Email': l.email || '',
    'Phone': l.phone || '',
    'City': l.city || '',
    'Est. Value ($)': l.dealSize || 0,
    'Probability (%)': l.probability || 0,
    'Stage': l.stage || '',
    'Status': l.leadStatus || 'New',
    'Lead Source': l.source || '',
    'Assigned To': l.assignedTo || '',
    'Created Date': formatDate(l.createdAt),
    'Updated Date': formatDate(l.updatedAt)
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Leads');
  const now = new Date();
  const dateStr = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
  XLSX.writeFile(wb, 'LeadManagement_' + dateStr + '.xlsx');
}

function printLeads() {
  window.print();
}

function updateLeadsBadge() {
  const newCount = getLeads().filter(l => (l.leadStatus || 'New') === 'New').length;
  const badge = document.getElementById('badge-leads');
  if (badge) { badge.textContent = newCount; badge.style.display = newCount > 0 ? 'inline' : 'none'; }
}
