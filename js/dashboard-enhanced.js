/**
 * Enhanced Dashboard — cohort filters, KPIs, dual-axis chart, timeline & deals feed.
 */
(function () {
  const MASTER_DEALS = [
    { ownerId: 101, repName: 'Duy Nguyen', name: 'AeroSpace Engine Link Framework', value: 80000, stage: 'Prospecting', probability: 10, updated: '2026-06-09T14:22:00Z' },
    { ownerId: 101, repName: 'Duy Nguyen', name: 'AeroSpace Analytics Module Expansion', value: 30000, stage: 'Prospecting', probability: 15, updated: '2026-06-08T10:12:00Z' },
    { ownerId: 101, repName: 'Duy Nguyen', name: 'Quantum Workspace Cloud Core Sync', value: 100000, stage: 'Qualification', probability: 20, updated: '2026-06-05T09:00:00Z' },
    { ownerId: 101, repName: 'Duy Nguyen', name: 'CyberShield Core Perimeter Framework', value: 150000, stage: 'Proposal', probability: 45, updated: '2026-06-01T16:45:00Z' },
    { ownerId: 101, repName: 'Duy Nguyen', name: 'Nexus AI Logistics Orchestration', value: 200000, stage: 'Negotiation', probability: 85, updated: '2026-05-28T11:30:00Z' },
    { ownerId: 101, repName: 'Duy Nguyen', name: 'Vortex Distributed Node Setup', value: 220000, stage: 'Closed Won', probability: 100, updated: '2026-05-25T13:10:00Z' },
    { ownerId: 101, repName: 'Duy Nguyen', name: 'Titanium Steel ERP Linkage Core', value: 75000, stage: 'Closed Lost', probability: 0, updated: '2026-05-20T08:15:00Z' },
    { ownerId: 102, repName: 'Minh Tran', name: 'Hyperion Solar Grid Connector Suite', value: 200000, stage: 'Qualification', probability: 25, updated: '2026-06-07T11:05:00Z' },
    { ownerId: 102, repName: 'Minh Tran', name: 'Genesis Cloud Datacenter Migration', value: 300000, stage: 'Proposal', probability: 50, updated: '2026-06-04T15:20:00Z' },
    { ownerId: 102, repName: 'Minh Tran', name: 'Apex Real Estate Billing Architecture', value: 132000, stage: 'Closed Won', probability: 100, updated: '2026-05-29T14:40:00Z' },
    { ownerId: 102, repName: 'Minh Tran', name: 'Apex CRM Custom Overhaul Subscriptions', value: 84000, stage: 'Closed Lost', probability: 0, updated: '2026-04-18T09:12:00Z' },
    { ownerId: 103, repName: 'Thu Nguyen', name: 'Nova Biotech Lab Cloud Containerization', value: 180000, stage: 'Proposal', probability: 55, updated: '2026-06-06T10:15:00Z' },
    { ownerId: 103, repName: 'Thu Nguyen', name: 'Omega Retail OmniPOS Sync Engine', value: 200000, stage: 'Negotiation', probability: 75, updated: '2026-06-02T11:00:00Z' },
    { ownerId: 103, repName: 'Thu Nguyen', name: 'Stellar Fleet Telemetry Core Linkage', value: 310000, stage: 'Closed Won', probability: 100, updated: '2026-05-27T15:35:00Z' },
    { ownerId: 103, repName: 'Thu Nguyen', name: 'Stellar Backup Datacenter Cluster Group', value: 450000, stage: 'Closed Lost', probability: 0, updated: '2026-04-15T14:20:00Z' },
  ];

  const MASTER_ACTIVITIES = [
    { id: 'act_901', type: 'Call', ownerId: 101, repName: 'Duy Nguyen', leadName: 'TechCorp Vietnam', company: 'TechCorp Vietnam', stage: 'Proposal', notes: 'Discovery call scheduled to finalize technical parameters of perimeter shield project.', date: '2026-06-15T09:00:00Z' },
    { id: 'act_902', type: 'Meeting', ownerId: 101, repName: 'Duy Nguyen', leadName: 'ABC Manufacturing', company: 'ABC Manufacturing', stage: 'Negotiation', notes: 'Contract negotiation meeting regarding pricing discount structures and deployment lifecycle timelines.', date: '2026-06-18T14:00:00Z' },
    { id: 'act_903', type: 'Email', ownerId: 102, repName: 'Minh Tran', leadName: 'Hyperion Solar', company: 'Hyperion Solar', stage: 'Qualification', notes: 'Send technical cloud catalog specifications sheet requested during qualification review.', date: '2026-06-12T10:30:00Z' },
    { id: 'act_904', type: 'Meeting', ownerId: 103, repName: 'Thu Nguyen', leadName: 'Nova Biotech', company: 'Nova Biotech', stage: 'Proposal', notes: 'Present detailed architecture blueprint wireframes to technical steering committee board.', date: '2026-06-22T11:00:00Z' },
    { id: 'act_905', type: 'Call', ownerId: 101, repName: 'Duy Nguyen', leadName: 'Quantum Cloud', company: 'Quantum Workspace', stage: 'Qualification', notes: 'Follow up call to capture budgetary approval limits and timelines updates.', date: '2026-06-14T15:00:00Z' },
  ];

  const USER_ID_MAP = { 'Anna Nguyen': 0, 'Duy Trần': 101, 'Duy Nguyen': 101, 'Mai Lê': 102, 'Minh Tran': 102, 'Hùng Võ': 103, 'Thu Nguyen': 103 };
  function ownerIdForName(name) {
    const acc = typeof ACCOUNTS !== 'undefined' ? ACCOUNTS.find(a => a.name === name) : null;
    return acc ? acc.id : (USER_ID_MAP[name] || 101);
  }

  let pipelineChart = null;
  let leadDonutChart = null;

  function leadsToDeals(leads) {
    return leads.map(l => ({
      ownerId: l.ownerId ?? ownerIdForName(l.assignedTo),
      repName: l.assignedTo || 'Unassigned',
      name: (l.company || '') + ' — ' + (l.name || ''),
      value: l.dealSize || 0,
      stage: l.stage,
      probability: l.probability || 0,
      updated: l.updatedAt || l.createdAt,
    }));
  }

  function getScopedDeals() {
    const leads = typeof getLeads === 'function' ? getLeads() : [];
    let deals = leads.length ? leadsToDeals(leads) : [...MASTER_DEALS];
    if (CURRENT_USER.role !== 'manager') {
      const uid = CURRENT_USER.id ?? ownerIdForName(CURRENT_USER.name);
      deals = deals.filter(d => d.ownerId === uid);
    }
    const startEl = document.getElementById('dashboard-start-date');
    const endEl = document.getElementById('dashboard-end-date');
    if (startEl && endEl && startEl.value && endEl.value) {
      const filterStart = new Date(startEl.value + 'T00:00:00');
      const filterEnd = new Date(endEl.value + 'T23:59:59');
      deals = deals.filter(d => {
        const u = new Date(d.updated);
        return u >= filterStart && u <= filterEnd;
      });
    }
    return deals;
  }

  window.adjustCohortFilterDates = function (type) {
    const start = document.getElementById('dashboard-start-date');
    const end = document.getElementById('dashboard-end-date');
    if (!start || !end) return;
    if (type === 'QUARTER') { start.value = '2026-04-01'; end.value = '2026-06-30'; }
    else if (type === 'MONTH') { start.value = '2026-06-01'; end.value = '2026-06-30'; }
    else if (type === 'YEAR') { start.value = '2026-01-01'; end.value = '2026-12-31'; }
    window.triggerAsynchronousDashboardRecalc();
  };

  window.triggerAsynchronousDashboardRecalc = function () {
    setTimeout(() => window.renderDashboardCharts(), 200);
  };

  window.getDashboardHTML = function () {
    return `
    <div class="card" style="margin-bottom:16px;padding:14px 18px">
      <div style="display:flex;flex-wrap:wrap;gap:16px;align-items:flex-end">
        <div style="min-width:180px">
          <label class="form-label">Cohort Period Filter</label>
          <select id="dashboard-period-select" onchange="adjustCohortFilterDates(this.value)" class="form-input">
            <option value="QUARTER">Current Quarter (Q2 2026)</option>
            <option value="MONTH">Current Month</option>
            <option value="YEAR">Fiscal Year (YTD)</option>
          </select>
        </div>
        <div style="display:flex;align-items:flex-end;gap:8px">
          <div>
            <label class="form-label">Start Date</label>
            <input type="date" id="dashboard-start-date" value="2026-04-01" onchange="triggerAsynchronousDashboardRecalc()" class="form-input">
          </div>
          <div style="padding-bottom:10px;color:var(--text-muted);font-weight:700">-</div>
          <div>
            <label class="form-label">End Date</label>
            <input type="date" id="dashboard-end-date" value="2026-06-30" onchange="triggerAsynchronousDashboardRecalc()" class="form-input">
          </div>
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:14px;margin-bottom:20px">
      <div class="metric-card" style="border-left-color:var(--accent)"><div class="metric-label">My Open Deals</div><div class="metric-value" id="kpi-open-count">0</div><div class="metric-sub">ACTIVE IN PIPELINES</div></div>
      <div class="metric-card" style="border-left-color:var(--blue)"><div class="metric-label">Total Pipeline Value</div><div class="metric-value" id="kpi-pipeline-val">$0</div><div class="metric-sub">UNWEIGHTED SUM</div></div>
      <div class="metric-card" style="border-left-color:var(--purple)"><div class="metric-label">Forecasted Revenue</div><div class="metric-value" style="color:var(--accent-text)" id="kpi-forecast-val">$0</div><div class="metric-sub">WEIGHTED BY PROBABILITY</div></div>
      <div class="metric-card" style="border-left-color:var(--green)"><div class="metric-label">Won Revenue</div><div class="metric-value" style="color:var(--green)" id="kpi-won-val">$0</div><div class="metric-sub">CLOSED WON DEALS</div></div>
      <div class="metric-card" style="border-left-color:var(--red)"><div class="metric-label">Lost Revenue</div><div class="metric-value" style="color:var(--red)" id="kpi-lost-val">$0</div><div class="metric-sub">CLOSED LOST DEALS</div></div>
      <div class="metric-card" style="border-left-color:var(--amber)"><div class="metric-label">Win Outcome Rate</div><div class="metric-value" id="kpi-win-rate">0%</div><div class="metric-sub">BASED ON VALUE</div></div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 2fr;gap:16px;margin-bottom:20px">
      <div class="card" style="display:flex;flex-direction:column;height:320px">
        <div class="card-title"><i class="fa-solid fa-chart-pie" style="color:var(--accent);margin-right:6px"></i> Lead Volume Composition</div>
        <div style="flex:1;position:relative;min-height:0"><canvas id="leadStatusChart"></canvas></div>
      </div>
      <div class="card" style="display:flex;flex-direction:column;height:320px">
        <div class="card-title"><i class="fa-solid fa-chart-line" style="color:var(--accent);margin-right:6px"></i> Deal Pipeline Stage Volume</div>
        <div style="flex:1;position:relative;min-height:0"><canvas id="pipelineDoubleAxisChart"></canvas></div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:5fr 7fr;gap:16px">
      <div class="card" style="padding:0;overflow:hidden;display:flex;flex-direction:column;height:540px">
        <div style="padding:14px 18px;background:var(--bg-input);border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
          <div style="font-size:13px;font-weight:700"><i class="fa-regular fa-clock" style="color:var(--accent);margin-right:6px"></i> Upcoming Timeline Activities</div>
          <div id="timeline-filter-wrapper" style="display:none">
            <select id="timeline-rep-filter" onchange="filterUpcomingTimelineFeed()" class="form-input" style="width:auto;padding:4px 8px;font-size:11px"></select>
          </div>
        </div>
        <div id="render-timeline-body" style="padding:16px 24px;overflow-y:auto;flex:1"></div>
      </div>
      <div class="card" style="padding:0;overflow:hidden;display:flex;flex-direction:column;height:540px">
        <div style="padding:14px 18px;background:var(--bg-input);border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
          <div style="font-size:13px;font-weight:700"><i class="fa-solid fa-rectangle-list" style="color:var(--accent);margin-right:6px"></i> Recently Updated Deals Feed</div>
          <button class="btn btn-secondary btn-sm" onclick="navigateTo('deals')"><i class="fa-solid fa-arrow-right"></i> View All Deals</button>
        </div>
        <div id="render-deals-feed-body" style="padding:16px 24px;overflow-y:auto;flex:1"></div>
      </div>
    </div>`;
  };

  window.filterUpcomingTimelineFeed = function () {
    const body = document.getElementById('render-timeline-body');
    if (!body) return;
    let acts = (typeof getScheduled === 'function' ? getScheduled() : []).map(s => {
      const owner = ACCOUNTS.find(a => a.id === (s.assignedTo ?? s.ownerId));
      const scheduledAt = s.scheduledDate + 'T' + (s.scheduledTime || '00:00');
      return {
        id: s.id,
        type: s.type || 'Task',
        ownerId: s.assignedTo ?? s.ownerId,
        repName: owner?.name || 'Unassigned',
        leadName: s.leadName || '',
        company: s.company || '',
        stage: s.stage || '',
        notes: s.agenda || 'Scheduled follow-up',
        date: scheduledAt,
        done: !!s.done,
      };
    });
    const filterWrap = document.getElementById('timeline-filter-wrapper');
    if (CURRENT_USER.role === 'manager') {
      if (filterWrap) filterWrap.style.display = 'block';
      const select = document.getElementById('timeline-rep-filter');
      if (select && !select.options.length) {
        select.innerHTML = '<option value="ALL">All Team Members</option>' + ACCOUNTS.map(a => `<option value="${a.id}">${a.name}</option>`).join('');
      }
      const sel = select?.value || 'ALL';
      if (sel !== 'ALL') acts = acts.filter(a => a.ownerId === parseInt(sel, 10));
    } else {
      if (filterWrap) filterWrap.style.display = 'none';
      const uid = CURRENT_USER.id ?? ownerIdForName(CURRENT_USER.name);
      acts = acts.filter(a => a.ownerId === uid);
    }
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    acts = acts.filter(a => !a.done && new Date(a.date) >= todayStart).sort((a, b) => new Date(a.date) - new Date(b.date));
    if (!acts.length) {
      body.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text-muted);font-size:12px;font-style:italic">No scheduled tasks matching target criteria.</div>';
      return;
    }
    const typeStyles = {
      Call: { bg: 'var(--green-bg)', border: 'rgba(16,185,129,0.3)', color: 'var(--green-text)' },
      Email: { bg: 'var(--blue-bg)', border: 'rgba(59,130,246,0.3)', color: 'var(--blue-text)' },
      Meeting: { bg: 'var(--purple-bg)', border: 'rgba(139,92,246,0.3)', color: 'var(--purple-text)' },
    };
    body.innerHTML = acts.map(act => {
      const ts = typeStyles[act.type] || { bg: 'var(--bg-input)', border: 'var(--border)', color: 'var(--text-secondary)' };
      return `
        <div onclick="navigateTo('activities')" style="padding:14px;border:1px solid var(--border);border-radius:var(--radius-md);margin-bottom:10px;cursor:pointer;background:var(--bg-input);transition:all .15s" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
          <div style="display:flex;justify-content:space-between;margin-bottom:8px">
            <span class="badge" style="background:${ts.bg};color:${ts.color};border:1px solid ${ts.border}">${act.type}</span>
            <span style="font-size:11px;color:var(--text-muted);font-weight:600"><i class="fa-regular fa-calendar-days"></i> ${formatDate(act.date)}</span>
          </div>
          <div style="font-size:12px;font-weight:600;margin-bottom:8px;color:var(--text-primary)">${act.notes}</div>
          <div style="font-size:11px;color:var(--text-muted);display:flex;justify-content:space-between;border-top:1px solid var(--border-light);padding-top:8px">
            <span>Rep: ${act.repName}</span><span><i class="fa-regular fa-building"></i> ${act.company || act.leadName}</span>
          </div>
        </div>`;
    }).join('');
  };

  window.compileRecentlyUpdatedDealsFeed = function (deals) {
    const body = document.getElementById('render-deals-feed-body');
    if (!body) return;
    const feed = [...deals].sort((a, b) => new Date(b.updated) - new Date(a.updated)).slice(0, 4);
    if (!feed.length) {
      body.innerHTML = '<div style="text-align:center;padding:32px;color:var(--text-muted);font-size:12px;font-style:italic">No deals recorded during this timeframe.</div>';
      return;
    }
    body.innerHTML = feed.map(deal => `
      <div style="padding:14px;border:1px solid var(--border);border-radius:var(--radius-md);margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;transition:border-color .15s" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
        <div style="min-width:0;padding-right:12px">
          <div style="font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${deal.name}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px">Owner: ${deal.repName} • Updated: ${formatDate(deal.updated)}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-weight:800;font-size:14px">${formatCurrency(deal.value)}</div>
          <div style="display:flex;align-items:center;gap:6px;justify-content:flex-end;margin-top:4px">
            <span style="font-size:10px;color:var(--text-muted);font-weight:600">Prob: ${deal.probability}%</span>
            <span class="badge ${getStageBadgeClass(deal.stage)}">${deal.stage}</span>
          </div>
        </div>
      </div>`).join('');
  };

  window.renderLeadStatusDonutChart = function () {
    const canvas = document.getElementById('leadStatusChart');
    if (!canvas) return;
    if (leadDonutChart) leadDonutChart.destroy();
    const isDark = document.documentElement.dataset.theme === 'dark';
    const textColor = isDark ? '#f1f5f9' : '#334155';
    const borderColor = isDark ? '#1e293b' : '#ffffff';
    let composition = CURRENT_USER.role === 'manager' ? [45, 120, 25] : [15, 42, 8];
    const leads = typeof getLeads === 'function' ? getLeads() : [];
    if (leads.length) {
      composition = [
        leads.filter(l => l.leadStatus === 'New' || l.stage === 'Prospecting').length || 1,
        leads.filter(l => l.leadStatus === 'Converted' || l.stage === 'Closed Won').length,
        leads.filter(l => l.leadStatus === 'Rejected' || l.stage === 'Closed Lost').length,
      ];
    }
    leadDonutChart = new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: ['New Leads', 'Converted', 'Rejected/Archived'],
        datasets: [{ data: composition, backgroundColor: ['#6366f1', '#10b981', '#ef4444'], borderWidth: 2, borderColor }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '72%',
        plugins: { legend: { position: 'right', labels: { boxWidth: 12, color: textColor, font: { size: 11, weight: '700' } } } },
      },
    });
  };

  window.renderGranularMixedChart = function (dealsArray) {
    const canvas = document.getElementById('pipelineDoubleAxisChart');
    if (!canvas) return;
    if (pipelineChart) pipelineChart.destroy();
    const stages = ['Prospecting', 'Qualification', 'Proposal', 'Negotiation'];
    const volumes = stages.map(s => dealsArray.filter(d => d.stage === s).length);
    const values = stages.map(s => dealsArray.filter(d => d.stage === s).reduce((sum, d) => sum + d.value, 0));
    const isDark = document.documentElement.dataset.theme === 'dark';
    const textColor = isDark ? '#f1f5f9' : '#334155';
    pipelineChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: stages,
        datasets: [
          {
            type: 'line', label: 'Pipeline Capacity Value ($)', data: values,
            borderColor: '#6366f1', backgroundColor: '#6366f1', borderWidth: 3.5,
            pointRadius: 6, pointHoverRadius: 8, pointBackgroundColor: '#ffffff',
            pointBorderColor: '#6366f1', pointBorderWidth: 2.5, tension: 0.15,
            yAxisID: 'yValue', pointStyle: 'line',
          },
          {
            type: 'bar', label: 'Deals Volume (Count)', data: volumes,
            backgroundColor: ['rgba(148,163,184,0.85)', 'rgba(59,130,246,0.85)', 'rgba(245,158,11,0.85)', 'rgba(249,115,22,0.85)'],
            borderColor: ['#475569', '#1d4ed8', '#b45309', '#c2410c'],
            borderWidth: 1.5, borderRadius: 6, yAxisID: 'yVolume', barPercentage: 0.45, pointStyle: 'rect',
          },
        ],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: {
          x: { grid: { display: false }, ticks: { color: textColor, font: { weight: '700', size: 11 } } },
          yVolume: {
            position: 'left', title: { display: true, text: 'Volume Count', color: textColor, font: { weight: '800', size: 11 } },
            grid: { color: isDark ? '#334155' : '#f1f5f9' }, ticks: { stepSize: 1, color: textColor, font: { weight: '700' } },
          },
          yValue: {
            position: 'right', grid: { display: false },
            title: { display: true, text: 'Financial Capacity ($)', color: textColor, font: { weight: '800', size: 11 } },
            ticks: { color: textColor, font: { weight: '700' }, callback: v => '$' + (v >= 1000 ? v / 1000 + 'k' : v) },
          },
        },
        plugins: { legend: { labels: { color: textColor, usePointStyle: true, font: { weight: '700', size: 12 }, boxWidth: 16 } } },
      },
    });
  };

  window.renderDashboardCharts = function () {
    const deals = getScopedDeals();
    const active = deals.filter(d => !['Closed Won', 'Closed Lost'].includes(d.stage));
    const won = deals.filter(d => d.stage === 'Closed Won');
    const lost = deals.filter(d => d.stage === 'Closed Lost');
    const pipeline = active.reduce((s, d) => s + d.value, 0);
    const forecast = active.reduce((s, d) => s + d.value * (d.probability / 100), 0);
    const wonVal = won.reduce((s, d) => s + d.value, 0);
    const lostVal = lost.reduce((s, d) => s + d.value, 0);
    const closedVal = wonVal + lostVal;
    const winRate = closedVal > 0 ? ((wonVal / closedVal) * 100).toFixed(1) : '0.0';
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('kpi-open-count', active.length);
    set('kpi-pipeline-val', formatCurrency(pipeline));
    set('kpi-forecast-val', formatCurrency(Math.round(forecast)));
    set('kpi-won-val', formatCurrency(wonVal));
    set('kpi-lost-val', formatCurrency(lostVal));
    set('kpi-win-rate', winRate + '%');
    renderLeadStatusDonutChart();
    renderGranularMixedChart(deals);
    filterUpcomingTimelineFeed();
    compileRecentlyUpdatedDealsFeed(deals);
  };
})();
