(function () {
  const SUPABASE_URL = 'https://tqjiwlytjvqjppbblwdl.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_hD6O3JgH6ZNv3yz_JCerqg_sBDX64Pr';
  const DEFAULT_STAGES = ['Prospecting', 'Qualification', 'Proposal', 'Negotiation'];
  const COLORS = ['#d97706', '#6366f1', '#10b981', '#8b5cf6', '#0ea5e9', '#ec4899', '#14b8a6'];

  const cache = {
    loaded: false,
    user: null,
    team: [],
    leads: [],
    deals: [],
    activities: [],
    scheduled: [],
    leadRules: { warmDays: 7, coldDays: 14, stages: DEFAULT_STAGES.slice() },
    products: [],
  };

  const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });

  window.supabaseClient = client;
  window.SalesTrackSupabase = {
    client,
    cache,
    signIn,
    signOut,
    restoreSession,
    loadCrmData,
    saveLeadRecord,
    deleteLeadRecord,
    saveActivityRecord,
    deleteActivityRecord,
    saveScheduledRecord,
    deleteScheduledRecord,
    saveLeadRulesRecord,
  };

  function titleRole(role) {
    return role === 'manager' ? 'manager' : 'member';
  }

  function roleLabel(role) {
    return role === 'manager' ? 'Account Manager' : 'Account Sales';
  }

  function initials(name) {
    return String(name || '?').split(/\s+/).filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
  }

  function uiStatus(dbStatus) {
    return ({ new: 'New', qualified: 'New', converted: 'Converted', unqualified: 'Rejected' })[dbStatus] || 'New';
  }

  function dbStatus(uiValue) {
    return ({ New: 'new', Converted: 'converted', Rejected: 'unqualified' })[uiValue] || 'new';
  }

  function uiActivityType(row) {
    const notes = row.notes || '';
    const m = notes.match(/^\[(Note|System)\]\s*/);
    return m ? m[1] : row.activity_type;
  }

  function dbActivityType(type) {
    if (['Call', 'Email', 'Meeting', 'Demo', 'Proposal Sent', 'Contract Sent'].includes(type)) return type;
    return 'Call';
  }

  function dbNotes(activity) {
    if (activity.type === 'Note' || activity.type === 'System') return `[${activity.type}] ${activity.notes || ''}`.trim();
    return activity.notes || '';
  }

  function uiNotes(row) {
    return String(row.notes || '').replace(/^\[(Note|System)\]\s*/, '');
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7).toUpperCase();
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function ensureOk(result) {
    if (result.error) throw result.error;
    return result.data;
  }

  function salesByDbId(id) {
    return cache.team.find(s => s.salesId === id);
  }

  function salesByUiId(id) {
    return cache.team.find(s => String(s.id) === String(id));
  }

  function salesByName(name) {
    return cache.team.find(s => s.name === name);
  }

  function resolveSales(input) {
    return salesByDbId(input) || salesByUiId(input) || salesByName(input) || cache.team[0] || null;
  }

  function refreshAccounts(salesRows) {
    if (!salesRows || !salesRows.length) return;
    const mapped = salesRows.map((s, idx) => {
      const role = titleRole(s.role);
      return {
        id: idx,
        salesId: s.id,
        name: s.sales_name,
        initials: initials(s.sales_name),
        email: s.email,
        role,
        color: COLORS[idx % COLORS.length],
        roleLabel: roleLabel(role),
      };
    });
    cache.team = mapped;
    try {
      if (typeof ACCOUNTS !== 'undefined') {
        ACCOUNTS.splice(0, ACCOUNTS.length, ...mapped);
      }
      if (typeof refreshTeamFromAccounts === 'function') refreshTeamFromAccounts();
    } catch (e) {}
  }

  function applyUserFromProfile(profile, authUser) {
    if (!profile) throw new Error('No CRM profile found for this account.');
    const acc = resolveSales(profile.id) || {
      id: 0,
      salesId: profile.id,
      name: profile.sales_name,
      initials: initials(profile.sales_name),
      email: profile.email || authUser.email,
      role: titleRole(profile.role),
      color: COLORS[0],
      roleLabel: roleLabel(titleRole(profile.role)),
    };
    Object.assign(CURRENT_USER, acc);
    document.body.dataset.role = acc.role;
    try { localStorage.setItem('salestrack_current_user', JSON.stringify(CURRENT_USER)); } catch (e) {}
    if (typeof updateUserUI === 'function') updateUserUI();
  }

  async function loadSalesTeam() {
    const rows = ensureOk(await client
      .from('dim_sales')
      .select('id,sales_code,sales_name,email,role,is_active')
      .eq('is_active', true)
      .order('sales_code'));
    refreshAccounts(rows || []);
    return rows || [];
  }

  async function profileForEmail(email) {
    const result = await client
      .from('dim_sales')
      .select('id,sales_code,sales_name,email,role,is_active')
      .ilike('email', email)
      .eq('is_active', true)
      .maybeSingle();
    if (result.error) throw result.error;
    return result.data;
  }

  async function restoreSession() {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    const user = data.session?.user;
    cache.user = user || null;
    if (!user) {
      showSignInOverlay();
      return false;
    }
    await loadSalesTeam();
    const profile = await profileForEmail(user.email);
    applyUserFromProfile(profile, user);
    await loadCrmData();
    hideSignInOverlay();
    return true;
  }

  async function signIn(email, password) {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    cache.user = data.user;
    await loadSalesTeam();
    const profile = await profileForEmail(data.user.email);
    if (!profile) {
      await client.auth.signOut();
      throw new Error('No CRM profile found for this account.');
    }
    applyUserFromProfile(profile, data.user);
    await loadCrmData();
    hideSignInOverlay();
    return data.user;
  }

  async function signOut() {
    await client.auth.signOut();
    cache.user = null;
    cache.loaded = false;
    cache.leads = [];
    cache.deals = [];
    cache.activities = [];
    cache.scheduled = [];
    showSignInOverlay();
  }

  function showSignInOverlay() {
    const overlay = document.getElementById('signin-overlay');
    if (!overlay) return;
    overlay.style.display = 'flex';
    setTimeout(() => overlay.classList.remove('hidden'), 10);
  }

  function hideSignInOverlay() {
    const overlay = document.getElementById('signin-overlay');
    if (!overlay) return;
    overlay.classList.add('hidden');
    setTimeout(() => { overlay.style.display = 'none'; }, 350);
  }

  async function loadCrmData() {
    const [
      leadsRes,
      dealsRes,
      actsRes,
      schedRes,
      rulesRes,
      productRes,
    ] = await Promise.all([
      client.from('dim_leads').select('*').order('created_at', { ascending: false }),
      client.from('fact_deals').select('*').order('updated_at', { ascending: false }),
      client.from('fact_activities').select('*').order('created_at', { ascending: false }),
      client.from('scheduled_todos').select('*').order('scheduled_date', { ascending: true }),
      client.from('lead_rules').select('*').order('updated_at', { ascending: false }).limit(1),
      client.from('dim_product').select('id,product_code,product_name').order('product_code').limit(20),
    ]);

    const leadRows = ensureOk(leadsRes) || [];
    const dealRows = ensureOk(dealsRes) || [];
    const activityRows = ensureOk(actsRes) || [];
    const scheduledRows = ensureOk(schedRes) || [];
    const ruleRows = ensureOk(rulesRes) || [];
    cache.products = ensureOk(productRes) || [];
    cache.deals = dealRows;

    const leadById = new Map(leadRows.map(l => [l.id, l]));
    const dealByLead = new Map();
    dealRows.forEach(d => {
      if (!dealByLead.has(d.lead_id)) dealByLead.set(d.lead_id, d);
    });
    const dealById = new Map(dealRows.map(d => [d.id, d]));

    cache.leads = leadRows.map(l => {
      const deal = dealByLead.get(l.id);
      const owner = resolveSales(l.assigned_sales_id || deal?.sales_id);
      return {
        id: l.id,
        dbId: l.id,
        dealDbId: deal?.id || null,
        name: l.contact_name || l.company_name,
        company: l.company_name,
        email: l.email || '',
        phone: l.phone || '',
        website: l.website || '',
        city: l.city || '',
        industry: l.industry || '',
        source: l.lead_source || deal?.lead_source || '',
        leadStatus: uiStatus(l.lead_status),
        stage: deal?.stage || 'Prospecting',
        dealSize: Number(deal?.deal_value || 0),
        probability: Number(deal?.probability_pct || 0),
        assignedTo: owner?.name || '',
        ownerId: owner?.id,
        salesId: owner?.salesId || l.assigned_sales_id || deal?.sales_id,
        notes: l.current_software || '',
        createdAt: l.created_at,
        updatedAt: l.updated_at,
      };
    });

    cache.activities = activityRows.map(a => {
      const deal = dealById.get(a.deal_id);
      const lead = deal ? leadById.get(deal.lead_id) : null;
      const owner = resolveSales(a.sales_id || deal?.sales_id);
      const type = uiActivityType(a);
      return {
        id: a.id,
        dbId: a.id,
        type,
        leadId: lead?.id || deal?.lead_id || '',
        dealDbId: a.deal_id,
        leadName: lead?.contact_name || lead?.company_name || '',
        company: lead?.company_name || '',
        stage: deal?.stage || '',
        date: a.activity_date,
        duration: a.duration || 0,
        notes: uiNotes(a),
        nextAction: '',
        ownerId: owner?.id,
        salesId: owner?.salesId || a.sales_id,
        createdAt: a.created_at,
      };
    });

    cache.scheduled = scheduledRows.map(s => {
      const owner = resolveSales(s.owner_id);
      return {
        id: s.id,
        dbId: s.id,
        type: 'Call',
        leadId: s.lead_id || '',
        leadName: s.lead_name,
        company: s.company || '',
        stage: s.stage || '',
        scheduledDate: s.scheduled_date,
        scheduledTime: s.scheduled_time || '',
        agenda: s.agenda || '',
        done: !!s.done,
        ownerId: owner?.id ?? s.owner_id,
        assignedTo: owner?.id ?? s.owner_id,
        createdAt: s.created_at,
      };
    });

    if (ruleRows[0]) {
      cache.leadRules = {
        id: ruleRows[0].id,
        warmDays: ruleRows[0].warm_days,
        coldDays: ruleRows[0].cold_days,
        stages: DEFAULT_STAGES.slice(),
      };
    }

    cache.loaded = true;
    return cache;
  }

  function replaceArray(target, source) {
    target.splice(0, target.length, ...(source || []));
  }

  window.getLeads = function () { return cache.leads.slice(); };
  window.saveLeads = function (d) {
    replaceArray(cache.leads, d);
    try { localStorage.setItem('salestrack_leads', JSON.stringify(d)); } catch (e) {}
  };
  window.getActivities = function () { return cache.activities.slice(); };
  window.saveActivities = function (d) {
    replaceArray(cache.activities, d);
    try { localStorage.setItem('salestrack_activities', JSON.stringify(d)); } catch (e) {}
  };
  window.getScheduled = function () { return cache.scheduled.slice(); };
  window.saveScheduled = function (d) {
    replaceArray(cache.scheduled, d);
    try { localStorage.setItem('st_scheduled', JSON.stringify(d)); } catch (e) {}
  };
  window.getLeadRules = function () { return { ...cache.leadRules, stages: cache.leadRules.stages.slice() }; };
  window.saveLeadRulesData = function (d) {
    cache.leadRules = { ...cache.leadRules, ...d };
    try { localStorage.setItem('st_lead_rules', JSON.stringify(cache.leadRules)); } catch (e) {}
  };

  async function ensureDealForLead(lead) {
    if (!lead) throw new Error('Lead not found.');
    if (lead.dealDbId) return lead.dealDbId;
    const owner = resolveSales(lead.salesId || lead.ownerId || lead.assignedTo || CURRENT_USER.salesId || CURRENT_USER.id);
    const product = cache.products[0];
    if (!product) throw new Error('No product found for deal creation.');
    const row = {
      deal_code: 'DL-' + uid(),
      sales_id: owner?.salesId,
      lead_id: lead.dbId || lead.id,
      product_id: product.id,
      stage: lead.stage || 'Prospecting',
      contract_type: 'New Business',
      deal_value: Number(lead.dealSize || 0),
      probability_pct: Number(lead.probability || 0),
      lead_source: lead.source || '',
      created_date: today(),
    };
    const inserted = ensureOk(await client.from('fact_deals').insert(row).select('*').single());
    lead.dealDbId = inserted.id;
    cache.deals.unshift(inserted);
    return inserted.id;
  }

  async function upsertDealForLead(lead) {
    if (!lead.dealSize && !lead.dealDbId && !lead.stage) return null;
    const dealId = await ensureDealForLead(lead);
    const owner = resolveSales(lead.salesId || lead.ownerId || lead.assignedTo || CURRENT_USER.salesId || CURRENT_USER.id);
    ensureOk(await client.from('fact_deals').update({
      sales_id: owner?.salesId,
      stage: lead.stage || 'Prospecting',
      deal_value: Number(lead.dealSize || 0),
      probability_pct: Number(lead.probability || 0),
      lead_source: lead.source || '',
      updated_at: new Date().toISOString(),
    }).eq('id', dealId));
    return dealId;
  }

  async function saveLeadRecord(lead) {
    const owner = resolveSales(lead.salesId || lead.ownerId || lead.assignedTo || CURRENT_USER.salesId || CURRENT_USER.id);
    const payload = {
      company_name: lead.company || lead.name || 'Unknown Company',
      industry: lead.industry || null,
      contact_name: lead.name || null,
      email: lead.email || null,
      phone: lead.phone || null,
      website: lead.website || null,
      city: lead.city || null,
      lead_source: lead.source || null,
      lead_status: dbStatus(lead.leadStatus),
      current_software: lead.notes || null,
      assigned_sales_id: owner?.salesId || null,
      updated_at: new Date().toISOString(),
    };
    let saved;
    if (lead.dbId || (lead.id && /^[0-9a-f-]{36}$/i.test(lead.id))) {
      const id = lead.dbId || lead.id;
      saved = ensureOk(await client.from('dim_leads').update(payload).eq('id', id).select('*').single());
    } else {
      saved = ensureOk(await client.from('dim_leads').insert({ ...payload, lead_code: lead.id || ('LD-' + uid()) }).select('*').single());
    }
    lead.id = saved.id;
    lead.dbId = saved.id;
    lead.ownerId = owner?.id;
    lead.salesId = owner?.salesId;
    await upsertDealForLead(lead);
    await loadCrmData();
    return cache.leads.find(l => l.id === saved.id) || lead;
  }

  async function deleteLeadRecord(leadId) {
    const lead = cache.leads.find(l => l.id === leadId);
    const dbId = lead?.dbId || leadId;
    const dealIds = cache.deals.filter(d => d.lead_id === dbId).map(d => d.id);
    if (dealIds.length) {
      ensureOk(await client.from('fact_activities').delete().in('deal_id', dealIds));
      ensureOk(await client.from('fact_deals').delete().in('id', dealIds));
    }
    ensureOk(await client.from('scheduled_todos').delete().eq('lead_id', dbId));
    ensureOk(await client.from('dim_leads').delete().eq('id', dbId));
    await loadCrmData();
  }

  async function saveActivityRecord(activity) {
    const lead = cache.leads.find(l => l.id === activity.leadId);
    const owner = resolveSales(activity.salesId || activity.ownerId || lead?.salesId || CURRENT_USER.salesId || CURRENT_USER.id);
    const dealId = activity.dealDbId || await ensureDealForLead(lead);
    const payload = {
      deal_id: dealId,
      sales_id: owner?.salesId,
      activity_type: dbActivityType(activity.type),
      activity_date: activity.date || new Date().toISOString(),
      duration: Number(activity.duration || 0),
      notes: dbNotes(activity),
      updated_at: new Date().toISOString(),
    };
    if (activity.dbId || (activity.id && /^[0-9a-f-]{36}$/i.test(activity.id))) {
      ensureOk(await client.from('fact_activities').update(payload).eq('id', activity.dbId || activity.id));
    } else {
      ensureOk(await client.from('fact_activities').insert({ ...payload, activity_code: 'ACT-' + uid() }));
    }
    if (lead) await saveLeadRecord({ ...lead, updatedAt: new Date().toISOString() });
    else await loadCrmData();
  }

  async function deleteActivityRecord(id) {
    ensureOk(await client.from('fact_activities').delete().eq('id', id));
    await loadCrmData();
  }

  async function saveScheduledRecord(todo) {
    const owner = resolveSales(todo.assignedTo || todo.ownerId || CURRENT_USER.id);
    const payload = {
      lead_id: todo.leadId || null,
      lead_name: todo.leadName || 'Untitled lead',
      company: todo.company || null,
      stage: todo.stage || null,
      scheduled_date: todo.scheduledDate,
      scheduled_time: todo.scheduledTime || null,
      agenda: todo.agenda || todo.notes || '',
      done: !!todo.done,
      owner_id: owner?.salesId || String(todo.assignedTo || todo.ownerId || CURRENT_USER.id),
    };
    if (todo.dbId || (todo.id && /^[0-9a-f-]{36}$/i.test(todo.id))) {
      ensureOk(await client.from('scheduled_todos').update(payload).eq('id', todo.dbId || todo.id));
    } else {
      ensureOk(await client.from('scheduled_todos').insert(payload));
    }
    await loadCrmData();
  }

  async function deleteScheduledRecord(id) {
    ensureOk(await client.from('scheduled_todos').delete().eq('id', id));
    await loadCrmData();
  }

  async function saveLeadRulesRecord(rules) {
    const payload = {
      warm_days: rules.warmDays,
      cold_days: rules.coldDays,
      updated_at: new Date().toISOString(),
      updated_by: CURRENT_USER.email || CURRENT_USER.name,
    };
    if (cache.leadRules.id) {
      ensureOk(await client.from('lead_rules').update(payload).eq('id', cache.leadRules.id));
    } else {
      ensureOk(await client.from('lead_rules').insert(payload));
    }
    await loadCrmData();
  }
})();
