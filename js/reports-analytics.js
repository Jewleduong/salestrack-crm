/**
 * Analytics Reports — Pipeline, Performance, Lead Source ROI tabs.
 */
(function () {
  const PRODUCTION_DEALS = [
    { ownerId: 101, repName: 'Duy Nguyen', name: 'AeroSpace Engine Link', value: 80000, stage: 'Prospecting', probability: 10, age: 14, source: 'LinkedIn' },
    { ownerId: 101, repName: 'Duy Nguyen', name: 'AeroSpace Analytics Sync', value: 30000, stage: 'Prospecting', probability: 15, age: 12, source: 'Website' },
    { ownerId: 101, repName: 'Duy Nguyen', name: 'Quantum Workspace Sync', value: 100000, stage: 'Qualification', probability: 20, age: 22, source: 'Referral' },
    { ownerId: 101, repName: 'Duy Nguyen', name: 'CyberShield Core Pack', value: 150000, stage: 'Proposal', probability: 45, age: 18, source: 'Website' },
    { ownerId: 101, repName: 'Duy Nguyen', name: 'Nexus AI Logistics Suite', value: 200000, stage: 'Negotiation', probability: 85, age: 31, source: 'Referral' },
    { ownerId: 101, repName: 'Duy Nguyen', name: 'Vortex Data Architecture Plan', value: 220000, stage: 'Closed Won', probability: 100, age: 45, source: 'Website' },
    { ownerId: 101, repName: 'Duy Nguyen', name: 'Titanium Steel ERP Integration', value: 75000, stage: 'Closed Lost', probability: 0, age: 51, source: 'Cold Call' },
    { ownerId: 102, repName: 'Minh Tran', name: 'Hyperion Solar Grid Connect', value: 200000, stage: 'Qualification', probability: 25, age: 29, source: 'LinkedIn' },
    { ownerId: 102, repName: 'Minh Tran', name: 'Genesis Cloud Migration Phase 1', value: 300000, stage: 'Proposal', probability: 50, age: 25, source: 'Event' },
    { ownerId: 102, repName: 'Minh Tran', name: 'Apex Real Estate Billing Core', value: 132000, stage: 'Closed Won', probability: 100, age: 39, source: 'Website' },
    { ownerId: 102, repName: 'Minh Tran', name: 'Apex CRM Custom Overhaul Sub', value: 84000, stage: 'Closed Lost', probability: 0, age: 44, source: 'Other' },
    { ownerId: 103, repName: 'Thu Nguyen', name: 'Nova Biotech Laboratory Cloud', value: 180000, stage: 'Proposal', probability: 55, age: 19, source: 'Website' },
    { ownerId: 103, repName: 'Thu Nguyen', name: 'Omega Retail OmniPOS Engine', value: 200000, stage: 'Negotiation', probability: 75, age: 26, source: 'Referral' },
    { ownerId: 103, repName: 'Thu Nguyen', name: 'Stellar Fleet Telemetry Core Link', value: 310000, stage: 'Closed Won', probability: 100, age: 35, source: 'Event' },
    { ownerId: 103, repName: 'Thu Nguyen', name: 'Stellar Backup Server Clusters', value: 450000, stage: 'Closed Lost', probability: 0, age: 40, source: 'LinkedIn' },
  ];

  const PIPELINE_STAGES = ['Prospecting', 'Qualification', 'Proposal', 'Negotiation'];
  const SOURCE_CHANNELS = [
    { title: 'Cold Call', benchmarkLeads: 600 },
    { title: 'Event', benchmarkLeads: 40 },
    { title: 'LinkedIn', benchmarkLeads: 280 },
    { title: 'Referral', benchmarkLeads: 35 },
    { title: 'Website', benchmarkLeads: 150 },
    { title: 'Other', benchmarkLeads: 85 },
  ];

  let currentTabScope = 'PIPELINE';

  function isManager() { return CURRENT_USER.role === 'manager'; }

  function populateRepDropdown() {
    const repDropdown = document.getElementById('filter-dropdown-rep');
    if (!repDropdown) return;
    if (isManager()) {
      repDropdown.disabled = false;
      repDropdown.innerHTML = `
        <option value="ALL">All Team Members</option>
        <option value="101">Duy Nguyen</option>
        <option value="102">Minh Tran</option>
        <option value="103">Thu Nguyen</option>`;
    } else {
      repDropdown.innerHTML = '<option value="101">Duy Nguyen</option>';
      repDropdown.disabled = true;
    }
  }

  window.getReportsHTML = function () {
    return `
    <div class="page-header">
      <div><div class="page-title">Analytics Reports</div><div class="page-subtitle">Pipeline performance and team insights</div></div>
    </div>

    <div class="card no-print" style="margin-bottom:16px;padding:14px 18px">
      <div style="display:flex;flex-wrap:wrap;gap:16px;align-items:flex-end;justify-content:space-between">
        <div style="display:flex;flex-wrap:wrap;gap:16px;align-items:flex-end">
          <div style="min-width:180px">
            <label class="form-label">Sales Representative</label>
            <select id="filter-dropdown-rep" onchange="triggerAsynchronousRecalc()" class="form-input"></select>
          </div>
          <div style="display:flex;align-items:flex-end;gap:8px">
            <div>
              <label class="form-label">Start Date</label>
              <input type="date" id="filter-start-date" value="2026-04-01" onchange="triggerAsynchronousRecalc()" class="form-input">
            </div>
            <div style="padding-bottom:10px;color:var(--text-muted);font-weight:700">-</div>
            <div>
              <label class="form-label">End Date</label>
              <input type="date" id="filter-end-date" value="2026-06-30" onchange="triggerAsynchronousRecalc()" class="form-input">
            </div>
          </div>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-success btn-sm" onclick="triggerExcelDownload()"><i class="fa-solid fa-file-excel"></i> Export</button>
          <button class="btn btn-secondary btn-sm" onclick="window.print()" style="background:var(--text-primary);color:#fff;border-color:var(--text-primary)"><i class="fa-solid fa-print"></i> Print</button>
        </div>
      </div>
    </div>

    <div class="flex border-b border-slate-200 gap-1 no-print" style="display:flex;border-bottom:1px solid var(--border);margin-bottom:16px">
      <button onclick="switchActiveTab('PIPELINE')" id="tab-btn-PIPELINE" class="tab-btn active">Tab 1: Pipeline Value & Forecast</button>
      <button onclick="switchActiveTab('PERFORMANCE')" id="tab-btn-PERFORMANCE" class="tab-btn">Tab 2: Performance Summary</button>
      <button onclick="switchActiveTab('SOURCING')" id="tab-btn-SOURCING" class="tab-btn">Tab 3: Lead Source ROI Attribution</button>
    </div>

    <div id="report-window-PIPELINE" class="card report-tab-container" style="padding:0;overflow:hidden">
      <div style="padding:14px 18px;background:var(--bg-input);border-bottom:1px solid var(--border);font-weight:700;font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Pipeline Value & Forecast</div>
      <div style="overflow-x:auto">
        <table class="data-table" id="table-target-PIPELINE">
          <thead><tr>
            <th>Pipeline Stage</th><th style="text-align:center">Active Deals Volume</th>
            <th style="text-align:right">Total Pipeline Value</th><th style="text-align:right">Weighted Forecast Value</th>
            <th style="text-align:center">Avg Phase Aging</th>
          </tr></thead>
          <tbody id="render-body-PIPELINE"></tbody>
        </table>
      </div>
    </div>

    <div id="report-window-PERFORMANCE" class="card report-tab-container hidden" style="padding:0;overflow:hidden;display:none">
      <div style="padding:14px 18px;background:var(--bg-input);border-bottom:1px solid var(--border);font-weight:700;font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Performance Summary</div>
      <div id="container-perf-MANAGER" style="overflow-x:auto">
        <table class="data-table" id="table-target-PERFORMANCE-MGR">
          <thead><tr>
            <th>Sales Representative</th><th style="text-align:center">Total Closed Ops</th>
            <th style="text-align:right">Won Amount ($)</th><th style="text-align:right">Lost Amount ($)</th>
            <th style="text-align:center">Conversion Win Rate</th>
          </tr></thead>
          <tbody id="render-body-perf-MANAGER"></tbody>
        </table>
      </div>
      <div id="container-perf-REP" style="padding:24px;display:none">
        <div style="max-width:520px;margin:0 auto;border:1px solid var(--border);border-radius:var(--radius-md);overflow:hidden;background:var(--bg-input)" id="table-target-PERFORMANCE-REP">
          <div style="padding:12px;background:var(--accent-light);border-bottom:1px solid var(--border);font-weight:700;font-size:11px;text-transform:uppercase;text-align:center;color:var(--accent-text)" id="rep-card-profile-header">Personal Performance Summary</div>
          <table class="data-table">
            <tbody>
              <tr><td style="background:var(--bg-input);font-size:10px;font-weight:700;text-transform:uppercase;color:var(--text-muted)">Total Closed Opportunities</td><td style="text-align:right;font-weight:700" id="rep-card-closed-count">0 Deals</td></tr>
              <tr><td style="background:var(--bg-input);font-size:10px;font-weight:700;text-transform:uppercase;color:var(--text-muted)">Total Won Amount ($)</td><td style="text-align:right;font-weight:700;color:var(--green)" id="rep-card-won-amt">+$0</td></tr>
              <tr><td style="background:var(--bg-input);font-size:10px;font-weight:700;text-transform:uppercase;color:var(--text-muted)">Total Lost Amount ($)</td><td style="text-align:right;font-weight:700;color:var(--red)" id="rep-card-lost-amt">-$0</td></tr>
              <tr><td style="background:var(--bg-input);font-size:10px;font-weight:700;text-transform:uppercase;color:var(--text-muted)">Conversion Win Rate (%)</td><td style="text-align:right;font-weight:700;color:var(--accent-text)" id="rep-card-win-rate">0%</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div id="report-window-SOURCING" class="card report-tab-container hidden" style="padding:0;overflow:hidden;display:none">
      <div style="padding:14px 18px;background:var(--bg-input);border-bottom:1px solid var(--border);font-weight:700;font-size:11px;color:var(--text-muted);text-transform:uppercase;letter-spacing:.06em">Lead Source ROI Attribution</div>
      <div style="overflow-x:auto">
        <table class="data-table" id="table-target-SOURCING">
          <thead><tr>
            <th>Source Channel Origin</th><th style="text-align:center">Total Ingested Leads</th>
            <th style="text-align:center">Pipeline Conversion Rate</th><th style="text-align:right">Attributed Won Revenue</th>
            <th style="text-align:right">Average Deal Size</th>
          </tr></thead>
          <tbody id="render-body-SOURCING"></tbody>
        </table>
      </div>
    </div>`;
  };

  function compileTab1Pipeline(activeArray) {
    const tbody = document.getElementById('render-body-PIPELINE');
    if (!tbody) return;
    tbody.innerHTML = '';
    const totals = { count: 0, val: 0, forecast: 0, ageSum: 0 };

    PIPELINE_STAGES.forEach(stage => {
      const stageDeals = activeArray.filter(d => d.stage === stage);
      if (!stageDeals.length) return;
      let stageCash = 0, stageForecast = 0, stageAge = 0;
      stageDeals.forEach(deal => {
        stageCash += deal.value;
        stageForecast += deal.value * (deal.probability / 100);
        stageAge += deal.age;
      });
      totals.count += stageDeals.length;
      totals.val += stageCash;
      totals.forecast += stageForecast;
      totals.ageSum += stageAge;
      tbody.innerHTML += `
        <tr>
          <td style="font-weight:700">${stage}</td>
          <td style="text-align:center;font-weight:600;color:var(--text-secondary)">${stageDeals.length}</td>
          <td style="text-align:right;font-weight:700">$${stageCash.toLocaleString()}</td>
          <td style="text-align:right;font-weight:700;color:var(--accent-text)">$${Math.round(stageForecast).toLocaleString()}</td>
          <td style="text-align:center;color:var(--text-muted);font-weight:600">${(stageAge / stageDeals.length).toFixed(1)} days</td>
        </tr>`;
    });

    tbody.innerHTML += `
      <tr style="background:var(--bg-input);font-weight:800;border-top:2px solid var(--border)">
        <td style="font-weight:800;text-transform:uppercase;font-size:11px;letter-spacing:.04em">Total Pipeline Active Assets</td>
        <td style="text-align:center;font-weight:800">${totals.count} Deals</td>
        <td style="text-align:right;font-weight:800">$${totals.val.toLocaleString()}</td>
        <td style="text-align:right;font-weight:800;color:var(--accent-text)">$${Math.round(totals.forecast).toLocaleString()}</td>
        <td style="text-align:center;font-weight:700">${totals.count > 0 ? (totals.ageSum / totals.count).toFixed(1) : 0} days</td>
      </tr>`;
  }

  function compileTab2Performance(selectedRepValue) {
    const mgrContainer = document.getElementById('container-perf-MANAGER');
    const repContainer = document.getElementById('container-perf-REP');
    if (!mgrContainer || !repContainer) return;

    if (!isManager() || selectedRepValue !== 'ALL') {
      mgrContainer.style.display = 'none';
      repContainer.style.display = 'block';
      const targetId = selectedRepValue === 'ALL' ? 101 : parseInt(selectedRepValue, 10);
      const userDeals = PRODUCTION_DEALS.filter(d => d.ownerId === targetId);
      const won = userDeals.filter(d => d.stage === 'Closed Won');
      const lost = userDeals.filter(d => d.stage === 'Closed Lost');
      const closedCount = won.length + lost.length;
      const wonAmt = won.reduce((s, d) => s + d.value, 0);
      const lostAmt = lost.reduce((s, d) => s + d.value, 0);
      const rate = closedCount > 0 ? ((won.length / closedCount) * 100).toFixed(1) : 0;
      const targetRep = PRODUCTION_DEALS.find(d => d.ownerId === targetId);
      document.getElementById('rep-card-profile-header').textContent = `${targetRep?.repName || 'Sales Rep'} — Personal Performance Summary`;
      document.getElementById('rep-card-closed-count').textContent = `${closedCount} Deals`;
      document.getElementById('rep-card-won-amt').textContent = `+$${wonAmt.toLocaleString()}`;
      document.getElementById('rep-card-lost-amt').textContent = `-$${lostAmt.toLocaleString()}`;
      document.getElementById('rep-card-win-rate').textContent = `${rate}%`;
    } else {
      repContainer.style.display = 'none';
      mgrContainer.style.display = 'block';
      const tbodyMgr = document.getElementById('render-body-perf-MANAGER');
      if (!tbodyMgr) return;
      tbodyMgr.innerHTML = '';
      [101, 102, 103].forEach(id => {
        const rDeals = PRODUCTION_DEALS.filter(d => d.ownerId === id);
        const nameStr = rDeals[0]?.repName || 'Sales Rep';
        const won = rDeals.filter(d => d.stage === 'Closed Won');
        const lost = rDeals.filter(d => d.stage === 'Closed Lost');
        const closedCount = won.length + lost.length;
        const wonAmt = won.reduce((s, d) => s + d.value, 0);
        const lostAmt = lost.reduce((s, d) => s + d.value, 0);
        const rate = closedCount > 0 ? ((won.length / closedCount) * 100).toFixed(1) : 0;
        tbodyMgr.innerHTML += `
          <tr>
            <td style="font-weight:700"><span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--accent);margin-right:8px"></span>${nameStr}</td>
            <td style="text-align:center;font-weight:600;color:var(--text-secondary)">${closedCount}</td>
            <td style="text-align:right;font-weight:700;color:var(--green)">+$${wonAmt.toLocaleString()}</td>
            <td style="text-align:right;font-weight:700;color:var(--red)">-$${lostAmt.toLocaleString()}</td>
            <td style="text-align:center;font-weight:700">${rate}%</td>
          </tr>`;
      });
    }
  }

  function compileTab3Sourcing(activeArray) {
    const tbody = document.getElementById('render-body-SOURCING');
    if (!tbody) return;
    tbody.innerHTML = '';
    SOURCE_CHANNELS.forEach(channel => {
      const vectorDeals = activeArray.filter(d => d.source === channel.title);
      const wonVectorDeals = vectorDeals.filter(d => d.stage === 'Closed Won');
      const attributedRevenueSum = wonVectorDeals.reduce((s, d) => s + d.value, 0);
      const conversionVelocityPct = ((vectorDeals.length / channel.benchmarkLeads) * 100).toFixed(1);
      const averageContractSize = wonVectorDeals.length > 0 ? Math.round(attributedRevenueSum / wonVectorDeals.length) : 0;
      tbody.innerHTML += `
        <tr>
          <td style="font-weight:700">${channel.title}</td>
          <td style="text-align:center;font-weight:600;color:var(--text-secondary)">${channel.benchmarkLeads}</td>
          <td style="text-align:center;font-weight:700;color:var(--accent-text)">${conversionVelocityPct}%</td>
          <td style="text-align:right;font-weight:700;color:var(--green)">$${attributedRevenueSum.toLocaleString()}</td>
          <td style="text-align:right;font-weight:700;color:var(--accent-text)">$${averageContractSize.toLocaleString()}</td>
        </tr>`;
    });
  }

  function executeComputationGrid() {
    const repEl = document.getElementById('filter-dropdown-rep');
    const selectedRepValue = repEl ? repEl.value : 'ALL';
    let filteredDeals = selectedRepValue === 'ALL'
      ? [...PRODUCTION_DEALS]
      : PRODUCTION_DEALS.filter(d => d.ownerId === parseInt(selectedRepValue, 10));
    compileTab1Pipeline(filteredDeals);
    compileTab2Performance(selectedRepValue);
    compileTab3Sourcing(filteredDeals);
  }

  window.switchActiveTab = function (targetTabKey) {
    currentTabScope = targetTabKey;
    ['PIPELINE', 'PERFORMANCE', 'SOURCING'].forEach(key => {
      const panel = document.getElementById('report-window-' + key);
      const tabBtn = document.getElementById('tab-btn-' + key);
      const active = key === targetTabKey;
      if (panel) {
        panel.style.display = active ? 'block' : 'none';
        panel.classList.toggle('hidden', !active);
      }
      if (tabBtn) tabBtn.classList.toggle('active', active);
    });
  };

  window.triggerAsynchronousRecalc = function () {
    setTimeout(executeComputationGrid, 100);
  };

  window.triggerExcelDownload = function () {
    let elementTargetId = 'table-target-' + currentTabScope;
    if (currentTabScope === 'PERFORMANCE') {
      const repSelect = document.getElementById('filter-dropdown-rep')?.value;
      elementTargetId = (!isManager() || repSelect !== 'ALL') ? 'table-target-PERFORMANCE-REP' : 'table-target-PERFORMANCE-MGR';
    }
    const tableNode = document.getElementById(elementTargetId);
    if (!tableNode) return;
    const baseUriLink = 'data:application/vnd.ms-excel,' + encodeURIComponent(tableNode.outerHTML);
    const virtualAnchor = document.createElement('a');
    virtualAnchor.href = baseUriLink;
    virtualAnchor.download = 'SalesTrack_' + currentTabScope + '_Report.xls';
    document.body.appendChild(virtualAnchor);
    virtualAnchor.click();
    document.body.removeChild(virtualAnchor);
  };

  window.renderReportsCharts = function () {
    populateRepDropdown();
    currentTabScope = 'PIPELINE';
    switchActiveTab('PIPELINE');
    executeComputationGrid();
  };
})();
