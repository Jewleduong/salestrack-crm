/* ======================================================
   SALESTRACK — AI EMAIL COMPOSER (SPA module)
====================================================== */

let selectedTone = 'Professional';
let selectedLang = 'English';
let lastEmail = null;
let _aiUsingDemo = false;

const DEMO_LEADS = [
  { id: 'demo_1', name: 'Nguyễn Thị Linh', company: 'TechCorp Vietnam', email: 'linh@techcorp.vn', dealSize: 32000, source: 'Website', stage: 'Proposal', probability: 50 },
  { id: 'demo_2', name: 'Trần Minh Đức', company: 'ABC Manufacturing', email: 'duc@abcmfg.vn', dealSize: 45000, source: 'Referral', stage: 'Negotiation', probability: 75 },
  { id: 'demo_3', name: 'Lê Văn Nam', company: 'StartupVN', email: 'nam@startupvn.vn', dealSize: 78000, source: 'Cold Call', stage: 'Prospecting', probability: 10 }
];
const DEMO_ACTS = [
  { id: 'da_1', type: 'Call', leadId: 'demo_1', leadName: 'Nguyễn Thị Linh', company: 'TechCorp Vietnam', stage: 'Proposal', date: '2026-05-20T10:00:00Z', notes: 'Discussed enterprise pricing. Comparing with 2 competitors.', nextAction: 'Send comparison doc by Friday', createdAt: '2026-05-20T10:30:00Z' },
  { id: 'da_2', type: 'Email', leadId: 'demo_2', leadName: 'Trần Minh Đức', company: 'ABC Manufacturing', stage: 'Negotiation', date: '2026-05-25T14:00:00Z', notes: 'Sent revised proposal with 5% discount. Awaiting reply.', nextAction: 'Follow up if no reply Wed', createdAt: '2026-05-25T14:15:00Z' }
];

const LOADING_TIPS = [
  'Analyzing lead profile and deal history…',
  'Matching strategy to pipeline stage…',
  'Crafting personalized hooks and messaging…',
  'Tuning tone and call-to-action…',
  'Final polish — almost done…'
];

const STAGE_MEANING = {
  Prospecting: 'Earliest stage. First contact made; building awareness and qualifying basic interest.',
  Qualification: 'Assessing fit, budget, authority and timeline.',
  Proposal: 'A formal proposal has been shared and is under evaluation.',
  Negotiation: 'Terms and pricing are being finalized; decision is close.',
  'Closed Won': 'Deal already won. Relationship-building, onboarding or upsell.',
  'Closed Lost': 'Deal was lost. Respectful re-engagement with low pressure.'
};

const STAGE_STRATEGY = {
  Prospecting: {
    aiInstruction: `STAGE GOAL: Initial outreach — spark genuine curiosity and earn a 15-minute call.\nEMAIL RULES:\n- Hook: Open with a specific, data-backed insight about their industry or company\n- Mention exactly ONE value-driver relevant to their company size/industry\n- Keep the body under 120 words\n- CTA: Ask for a 15-minute call, not a demo\n- Do NOT list features; sell the problem you solve\n- Do NOT use cliché openers`
  },
  Qualification: {
    aiInstruction: `STAGE GOAL: Build rapport, confirm fit, and schedule a deeper discovery call.\nEMAIL RULES:\n- Reference how you initially connected\n- Ask 1-2 open-ended discovery questions\n- CTA: Suggest a specific time window for a call\n- Tone: Curious, consultative — not salesy`
  },
  Proposal: {
    aiInstruction: `STAGE GOAL: Follow up on the sent proposal, address hesitation, and move to next steps.\nEMAIL RULES:\n- Acknowledge the proposal was sent\n- Highlight 2-3 specific benefits tailored to THEIR use case\n- Proactively address the #1 common concern at this stage\n- CTA: Offer to walk through the proposal together`
  },
  Negotiation: {
    aiInstruction: `STAGE GOAL: Resolve final hesitations and convert to a closed deal.\nEMAIL RULES:\n- Acknowledge progress made\n- Address known objections directly\n- Offer a concrete next step with a specific date\n- Avoid weasel words like "just checking in"`
  },
  'Closed Won': {
    aiInstruction: `STAGE GOAL: Celebrate the win, set expectations, and start onboarding.\nEMAIL RULES:\n- Open with genuine warmth\n- Outline the first 30 days\n- CTA: Confirm onboarding kickoff call`
  },
  'Closed Lost': {
    aiInstruction: `STAGE GOAL: Graciously close the loop and keep the relationship warm.\nEMAIL RULES:\n- Be genuinely gracious — do NOT pitch\n- Share ONE small piece of value\n- Leave the door open naturally`
  }
};

const TONE_RULES = {
  Professional: {
    salutation: 'Use a formal salutation with the contact\'s last name: "Dear Mr./Ms. [Last Name]," — extract the last name from the full name provided.',
    language: `
LANGUAGE RULES — PROFESSIONAL:
- NO contractions. Write "I am" not "I'm", "we would" not "we'd", "do not" not "don't".
- Formal vocabulary: use "regarding" not "about", "request" not "ask", "endeavour" not "try", "assist" not "help".
- Complete, structured sentences. No casual phrases like "just checking in", "quick question", "hope you're doing well".
- No exclamation marks.
- Each paragraph has exactly one clear purpose.
- Measured, authoritative, and respectful throughout.`,
    cta: 'Frame the call-to-action formally: "I would welcome the opportunity to discuss this at your earliest convenience." or "Please do not hesitate to contact me should you require any further information."',
    closing: '"Yours sincerely," or "Best regards,"',
    style: 'Write as a business letter — precise, dignified, and substantive. The prospect should sense they are being addressed by a senior professional.'
  },
  Friendly: {
    salutation: 'Use a warm first-name salutation: "Hi [First Name]," — use only the first name.',
    language: `
LANGUAGE RULES — FRIENDLY:
- Conversational and warm, but still credible. Contractions are welcome ("I'd love to", "we've seen").
- Natural, human language. Avoid jargon. Write how a trusted colleague would speak.
- One or two light personal touches are fine (acknowledge their industry, a shared context, a small compliment on their work).
- Enthusiastic but not over the top — no excessive exclamation marks.
- Short, readable sentences. One idea per sentence.`,
    cta: 'Friendly, low-pressure CTA: "Would you be open to a quick 15-minute call this week?" or "Happy to jump on a call if that works for you."',
    closing: '"Best," or "Looking forward to connecting,"',
    style: 'Write as if emailing a respected contact you enjoy working with — approachable, genuine, and helpful.'
  },
  Urgent: {
    salutation: 'Direct salutation: "Dear [First Name]," — concise and immediate.',
    language: `
LANGUAGE RULES — URGENT:
- Time-sensitive, action-oriented language. Every sentence drives toward a decision.
- Use specific urgency signals: "before end of quarter", "this week only", "limited availability", "time-sensitive opportunity".
- Short, punchy sentences. No filler. No pleasantries beyond a single line.
- Create pressure through specificity, not aggression — deadlines, limited slots, expiring terms.
- Active voice only: "Act now" not "Action should be taken".`,
    cta: 'Urgent, specific CTA with a hard deadline or time constraint: "Could we connect before Friday to lock this in?" or "I have two slots remaining this week — would [Day] at [Time] work?"',
    closing: '"I look forward to your prompt response," or "Please do reach out at your earliest convenience,"',
    style: 'Write as if the window is closing. Compelling and clear — the prospect should feel they have a real reason to respond today.'
  }
};

function aiEscapeHtml(s) {
  return String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function aiGetLeads() {
  let d = [];
  try { d = typeof getLeads === 'function' ? getLeads() : JSON.parse(localStorage.getItem('salestrack_leads') || '[]'); } catch (e) {}
  if (d && d.length) { _aiUsingDemo = false; return d; }
  _aiUsingDemo = true;
  return DEMO_LEADS;
}

function aiGetActivities() {
  let d = [];
  try { d = typeof getActivities === 'function' ? getActivities() : JSON.parse(localStorage.getItem('salestrack_activities') || '[]'); } catch (e) {}
  return (_aiUsingDemo && (!d || !d.length)) ? DEMO_ACTS : (d || []);
}

function aiGetCurrentUser() {
  if (typeof CURRENT_USER !== 'undefined' && CURRENT_USER && CURRENT_USER.name) return CURRENT_USER;
  try {
    const u = JSON.parse(localStorage.getItem('salestrack_current_user'));
    if (u && u.name) return u;
  } catch (e) {}
  return { name: 'Anna Nguyen', role: 'manager', roleLabel: 'Account Manager', email: 'anna.nguyen@salestrack.vn', initials: 'AN', color: '#d97706' };
}

function getApiKey() {
  return (window.__VITE_GOOGLE_AI_KEY) || localStorage.getItem('google_ai_key') || '';
}

function getGeminiUrl() {
  return 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
}

function getStageBadgeClass(s) {
  return ({ Prospecting: 'badge-prospecting', Qualification: 'badge-qualification', Proposal: 'badge-proposal', Negotiation: 'badge-negotiation', 'Closed Won': 'badge-won', 'Closed Lost': 'badge-lost' })[s] || 'badge-prospecting';
}

function getTypeIcon(t) { return ({ Call: 'fa-phone', Email: 'fa-envelope', Meeting: 'fa-handshake', Note: 'fa-note-sticky' })[t] || 'fa-circle'; }
function getTypeColor(t) { return ({ Call: 'var(--green)', Email: 'var(--blue)', Meeting: 'var(--purple)', Note: 'var(--text-muted)' })[t] || 'var(--text-muted)'; }
function getTypeBg(t) { return ({ Call: 'var(--green-bg)', Email: 'var(--blue-bg)', Meeting: 'var(--purple-bg)', Note: 'var(--bg-input)' })[t] || 'var(--bg-input)'; }

function getAIEmailHTML() {
  return `
    <div class="page-header">
      <div>
        <div class="page-title">AI Email Composer</div>
        <div class="page-subtitle">Draft context-aware sales emails powered by Gemini</div>
      </div>
      <span style="font-size:11px;background:rgba(99,102,241,0.15);color:var(--accent);padding:5px 12px;border-radius:20px;font-weight:700">✨ AI Powered</span>
    </div>
    <div class="ai-grid">
      <div class="card">
        <div class="card-title">Lead Information <span>from your pipeline</span></div>
        <div style="margin-bottom:14px">
          <label class="form-label">Select Lead</label>
          <select class="form-input" id="lead-select" onchange="onLeadChange()">
            <option value="">Choose a lead…</option>
          </select>
        </div>
        <div id="lead-detail">
          <div class="empty-state" style="padding:28px 12px">
            <i class="fa-solid fa-user-tag"></i>
            <h3>No lead selected</h3>
            <p>Pick a lead to load its details and history.</p>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-title">Email Configuration</div>
        <div style="display:flex;flex-direction:column;gap:14px">
          <div>
            <label class="form-label">Tone</label>
            <div class="tone-grid" id="tone-grid">
              <div class="tone-chip active" data-tone="Professional" onclick="selectTone(this)">Professional</div>
              <div class="tone-chip" data-tone="Friendly" onclick="selectTone(this)">Friendly</div>
              <div class="tone-chip" data-tone="Urgent" onclick="selectTone(this)">Urgent</div>
            </div>
          </div>
          <div>
            <label class="form-label">Purpose</label>
            <select class="form-input" id="purpose-select">
              <optgroup label="— First Contact —">
                <option value="Initial Outreach">Initial Outreach</option>
                <option value="Response to Inbound Inquiry">Response to Inbound Inquiry</option>
                <option value="Referral Introduction">Referral Introduction</option>
                <option value="Schedule a Demo">Schedule a Demo</option>
              </optgroup>
              <optgroup label="— During the Deal —">
                <option value="Follow-up After Call">Follow-up After Call</option>
                <option value="Thank You After Meeting">Thank You After Meeting</option>
                <option value="Send Proposal">Send Proposal</option>
                <option value="Share Pricing / Quote">Share Pricing / Quote</option>
                <option value="Share Case Study / Reference">Share Case Study / Reference</option>
                <option value="Address Objection / Concern">Address Objection / Concern</option>
                <option value="Closing the Deal">Closing the Deal</option>
                <option value="Contract / Agreement Follow-up">Contract / Agreement Follow-up</option>
              </optgroup>
              <optgroup label="— After the Deal —">
                <option value="Welcome / Onboarding Kickoff">Welcome / Onboarding Kickoff</option>
                <option value="Check-in After Onboarding">Check-in After Onboarding</option>
                <option value="Upsell / Cross-sell Opportunity">Upsell / Cross-sell Opportunity</option>
                <option value="Contract Renewal">Contract Renewal</option>
                <option value="Request for Referral">Request for Referral</option>
              </optgroup>
              <optgroup label="— Re-engagement —">
                <option value="Re-engage Cold Lead">Re-engage Cold Lead</option>
                <option value="Introduce New Product / Feature">Introduce New Product / Feature</option>
                <option value="Share Industry Insight">Share Industry Insight</option>
                <option value="Reconnect After Long Silence">Reconnect After Long Silence</option>
              </optgroup>
            </select>
          </div>
          <div>
            <label class="form-label">Language</label>
            <div class="lang-toggle" id="lang-toggle">
              <div class="lang-opt active" data-lang="English" onclick="selectLang(this)">English</div>
              <div class="lang-opt" data-lang="Vietnamese" onclick="selectLang(this)">Vietnamese</div>
            </div>
          </div>
          <div>
            <label class="form-label">Additional Context (optional)</label>
            <textarea class="form-input" id="extra-context" rows="3" placeholder="Any specific points, offers, or constraints to include…"></textarea>
          </div>
          <button class="btn btn-primary btn-block" id="generate-btn" onclick="generateEmail()">
            <i class="fa-solid fa-wand-magic-sparkles"></i> Generate Email
          </button>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="card-title">Generated Email <span id="gen-status"></span></div>
      <div id="email-output">
        <div class="empty-state">
          <i class="fa-solid fa-envelope-open-text"></i>
          <h3>Your email will appear here</h3>
          <p>Select a lead, configure the settings, then click Generate Email.<br>The <b>Design Email</b> and <b>Send Email</b> buttons appear once a draft is ready.</p>
        </div>
      </div>
    </div>`;
}

function setApiKeyPanelVisible(visible) {
  const panel = document.getElementById('api-key-panel');
  const main = document.getElementById('main-wrapper');
  if (panel) panel.style.display = visible ? 'flex' : 'none';
  if (main) main.classList.toggle('ai-page-active', !!visible);
}

function initAIEmailPage() {
  selectedTone = 'Professional';
  selectedLang = 'English';
  lastEmail = null;
  populateLeads();
  initApiKeyPanel();
  setApiKeyPanelVisible(true);
}

function populateLeads() {
  const leads = aiGetLeads();
  const sel = document.getElementById('lead-select');
  if (!sel) return;
  sel.innerHTML = '<option value="">Choose a lead…</option>' +
    leads.map(l => `<option value="${l.id}">${aiEscapeHtml(l.name)} — ${aiEscapeHtml(l.company)}</option>`).join('');
  if (!leads.length) {
    sel.innerHTML = '<option value="">No leads found — load sample data in the CRM</option>';
  }
}

function onLeadChange() {
  const id = document.getElementById('lead-select')?.value;
  const detail = document.getElementById('lead-detail');
  if (!detail) return;
  if (!id) {
    detail.innerHTML = `<div class="empty-state" style="padding:28px 12px"><i class="fa-solid fa-user-tag"></i><h3>No lead selected</h3><p>Pick a lead to load its details and history.</p></div>`;
    return;
  }
  const lead = aiGetLeads().find(l => l.id === id);
  if (!lead) return;
  const acts = aiGetActivities().filter(a => a.leadId === id)
    .sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date)).slice(0, 3);

  detail.innerHTML = `
    <div style="margin-bottom:14px">
      <div class="lead-detail-row"><span class="lead-detail-label">Name</span><span class="lead-detail-value">${aiEscapeHtml(lead.name)}</span></div>
      <div class="lead-detail-row"><span class="lead-detail-label">Company</span><span class="lead-detail-value">${aiEscapeHtml(lead.company)}</span></div>
      <div class="lead-detail-row"><span class="lead-detail-label">Pipeline Stage</span><span class="lead-detail-value"><span class="badge ${getStageBadgeClass(lead.stage)}">${aiEscapeHtml(lead.stage)}</span></span></div>
      <div class="lead-detail-row"><span class="lead-detail-label">Deal Size</span><span class="lead-detail-value" style="color:var(--accent)">${formatCurrency(lead.dealSize)}</span></div>
      <div class="lead-detail-row"><span class="lead-detail-label">Email</span><span class="lead-detail-value" style="font-weight:500">${aiEscapeHtml(lead.email || '—')}</span></div>
    </div>
    <div class="form-label" style="margin-bottom:8px">Recent Activity ${acts.length ? `(${acts.length})` : ''}</div>
    ${acts.length ? acts.map(a => `
      <div class="activity-mini">
        <div class="activity-mini-icon" style="background:${getTypeBg(a.type)};color:${getTypeColor(a.type)}"><i class="fa-solid ${getTypeIcon(a.type)}"></i></div>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:600;color:var(--text-primary)">${aiEscapeHtml(a.type)} · <span style="font-weight:400;color:var(--text-muted)">${formatDate(a.date)}</span></div>
          <div style="font-size:12px;color:var(--text-secondary);line-height:1.45">${aiEscapeHtml(a.notes || '')}</div>
        </div>
      </div>`).join('')
    : `<div style="font-size:12px;color:var(--text-muted);padding:6px 0">No activity logged for this lead yet.</div>`}`;
}

function selectTone(el) {
  document.querySelectorAll('.tone-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  selectedTone = el.dataset.tone;
}

function selectLang(el) {
  document.querySelectorAll('.lang-opt').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  selectedLang = el.dataset.lang;
}

function buildSystemPrompt() {
  const toneRule = TONE_RULES[selectedTone] || TONE_RULES.Professional;
  return `You are an expert B2B sales email copywriter with 15+ years of experience.
Your emails achieve above-average reply rates because they are hyper-personalized, stage-perfect, and ruthlessly on-tone.

TONE ENFORCEMENT — THIS IS THE MOST IMPORTANT INSTRUCTION:
The requested tone is: ${selectedTone.toUpperCase()}
${toneRule.language}

SALUTATION RULE: ${toneRule.salutation}
CLOSING RULE: ${toneRule.closing}
CTA RULE: ${toneRule.cta}
STYLE GOAL: ${toneRule.style}

You MUST follow every language rule above without exception. Do NOT default to a generic friendly/casual style.

CRITICAL OUTPUT FORMAT:
Respond with ONLY a valid JSON object — no markdown fences, no preamble, no extra text:
{"subject": "subject line here", "body": "email body here with \\n for line breaks between paragraphs"}

Subject line: compelling and specific — never use "Following up" or "Checking in".
Body: must feel personally written for THIS prospect, not templated.`;
}

function buildUserPrompt(lead, acts, effectiveStage, purpose, extraContext, language) {
  const u = aiGetCurrentUser();
  const senderRole = (u.roleLabel || (u.role === 'manager' ? 'Account Manager' : 'Account Sales')) + ', SalesTrack';
  const strategy = STAGE_STRATEGY[effectiveStage] || {};
  const toneRule = TONE_RULES[selectedTone] || TONE_RULES.Professional;

  const actHistory = acts.length > 0
    ? acts.map(a => `  • ${a.type} on ${formatDate(a.date)}: ${a.notes ? a.notes.slice(0, 120) : 'No notes'}${a.nextAction ? ' | Next: ' + a.nextAction : ''}`).join('\n')
    : '  • No previous activities logged (this may be first outreach)';

  return `Write a sales email for this exact scenario:

═══ LEAD PROFILE ═══
Full Name: ${lead.name}
Company: ${lead.company}
Email: ${lead.email || 'N/A'}
Deal Size: ${formatCurrency(lead.dealSize)}
Lead Source: ${lead.source || 'Unknown'}
Pipeline Stage: ${effectiveStage}
Win Probability: ${lead.probability || 0}%
${lead.notes ? `Notes: ${lead.notes}` : ''}

═══ RECENT ACTIVITY HISTORY ═══
${actHistory}

═══ EMAIL STRATEGY FOR THIS STAGE ═══
${strategy.aiInstruction || STAGE_MEANING[effectiveStage] || 'Write a helpful, personalized email appropriate for this pipeline stage.'}

═══ TONE & STYLE (MANDATORY — override any defaults) ═══
Tone: ${selectedTone.toUpperCase()}
Salutation to use: ${toneRule.salutation}
Language style: See system prompt rules — enforce strictly.
Closing sign-off: ${toneRule.closing}

═══ EMAIL BRIEF ═══
- Purpose of this email: ${purpose || 'General outreach'}
- Output Language: Write the ENTIRE email in ${language} — including salutation, body, and sign-off
- Sender sign-off: "${u.name}" on one line, then "${senderRole}" on the next line
${extraContext ? `\n═══ ADDITIONAL CONTEXT FROM SALESPERSON ═══\n${extraContext}` : ''}

FINAL CHECKLIST before outputting:
✓ Salutation matches the ${selectedTone} tone rule exactly
✓ No language violations (e.g. no contractions if Professional)
✓ CTA is appropriate for the tone and stage
✓ Signed off with sender's name and role
✓ No placeholder text like [Company Name] — use actual data above
✓ Output is ONLY the JSON object, nothing else`;
}

function fallbackEmail(lead, acts) {
  const u = aiGetCurrentUser();
  const senderRole = (u.roleLabel || (u.role === 'manager' ? 'Account Manager' : 'Account Sales')) + ', SalesTrack';
  const first = lead.name.split(' ').slice(-1)[0];
  const lastAct = acts[0];
  const vi = selectedLang === 'Vietnamese';
  if (vi) {
    return {
      subject: `${lead.company} — bước tiếp theo cùng SalesTrack`,
      body: `Chào ${first},\n\n${lastAct ? `Cảm ơn buổi ${lastAct.type.toLowerCase()} gần đây của chúng ta. ` : ''}Tôi viết email này để tiếp nối trao đổi về cách SalesTrack có thể hỗ trợ ${lead.company}.\n\nBạn có rảnh 15 phút trong tuần này để trao đổi thêm không?\n\nTrân trọng,\n${u.name}\n${senderRole}`
    };
  }
  return {
    subject: `Next steps for ${lead.company} with SalesTrack`,
    body: `Hi ${first},\n\n${lastAct ? `Thanks for the recent ${lastAct.type.toLowerCase()}. ` : ''}I wanted to follow up on how SalesTrack can help ${lead.company} at this stage.\n\nA few highlights:\n• A clear, easy-to-track pipeline\n• Automated sales activity logging\n• Real-time reporting and forecasts\n\nWould you have 15 minutes this week for a quick chat?\n\nBest regards,\n${u.name}\n${senderRole}`
  };
}

async function generateEmail() {
  const id = document.getElementById('lead-select')?.value;
  if (!id) { showToast('Please select a lead first', 'error'); return; }
  const lead = aiGetLeads().find(l => l.id === id);
  const acts = aiGetActivities().filter(a => a.leadId === id)
    .sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date)).slice(0, 4);

  const btn = document.getElementById('generate-btn');
  const status = document.getElementById('gen-status');
  const output = document.getElementById('email-output');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="gen-spinner"></span> Generating…'; }
  if (status) status.textContent = 'generating…';

  let tipIdx = 0;
  if (output) {
    output.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 32px;text-align:center">
      <span class="gen-spinner" style="width:36px;height:36px;border-width:3px;border-color:var(--border);border-top-color:var(--accent);margin-bottom:20px;display:inline-block"></span>
      <div style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:6px">Drafting your email…</div>
      <div id="loading-tip" style="font-size:13px;color:var(--text-muted);max-width:260px;transition:opacity .3s">${LOADING_TIPS[0]}</div>
    </div>`;
  }

  const tipInterval = setInterval(() => {
    tipIdx = (tipIdx + 1) % LOADING_TIPS.length;
    const el = document.getElementById('loading-tip');
    if (el) {
      el.style.opacity = '0';
      setTimeout(() => { if (el) { el.textContent = LOADING_TIPS[tipIdx]; el.style.opacity = '1'; } }, 150);
    }
  }, 1400);

  const key = getApiKey();
  let email = null;

  try {
    if (!key) throw new Error('NO_KEY');

    const purpose = document.getElementById('purpose-select')?.value || '';
    const extraContext = document.getElementById('extra-context')?.value.trim() || '';
    const systemPrompt = buildSystemPrompt();
    const userPrompt = buildUserPrompt(lead, acts, lead.stage, purpose, extraContext, selectedLang);

    const res = await fetch(`${getGeminiUrl()}?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: { maxOutputTokens: 1500, temperature: 0.7 }
      })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error?.message || `HTTP ${res.status}`);
    }

    const data = await res.json();
    const parts = data.candidates[0].content.parts;
    const textPart = parts.find(p => !p.thought && p.text) || parts[0];
    const raw = (textPart.text || '').trim();

    let parsed;
    try {
      const clean = raw.replace(/^```json\s*/i, '').replace(/\s*```$/, '').trim();
      parsed = JSON.parse(clean);
    } catch (e) {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
      else throw new Error('BAD_SHAPE');
    }

    if (!parsed.subject || !parsed.body) throw new Error('BAD_SHAPE');
    email = { subject: parsed.subject, body: parsed.body.replace(/\\n/g, '\n') };
  } catch (err) {
    email = fallbackEmail(lead, acts);
    if (err.message === 'NO_KEY') {
      showToast('No API key — enter your Gemini key in the panel below and click Save Key.', 'warning');
    } else if (err.message.includes('HTTP 400') || err.message.includes('INVALID_ARGUMENT')) {
      showToast(`Bad request — ${err.message} · Check model selection.`, 'error');
    } else if (err.message.includes('HTTP 403') || err.message.includes('HTTP 401') || err.message.includes('PERMISSION_DENIED')) {
      showToast('API key rejected — verify your key in the panel below.', 'error');
    } else if (err.message.includes('HTTP 404') || err.message.includes('NOT_FOUND')) {
      showToast('Model not found — try switching to Gemini 2.0 Flash in the panel below.', 'error');
    } else if (err.message === 'BAD_SHAPE') {
      showToast('AI replied but in unexpected format — template draft shown. Try again.', 'warning');
    } else {
      showToast(`AI error: ${err.message} — template draft shown.`, 'error');
    }
    console.error('[SalesTrack AI] Gemini error:', err.message);
  }

  clearInterval(tipInterval);
  lastEmail = email;
  renderEmailOutput(email, lead);
  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Generate Email'; }
  if (status) status.textContent = 'ready';
}

function renderEmailOutput(email, lead) {
  const output = document.getElementById('email-output');
  if (!output) return;
  output.innerHTML = `
    <div style="margin-bottom:14px">
      <label class="form-label">Subject</label>
      <input class="form-input" id="email-subject" value="${aiEscapeHtml(email.subject)}">
    </div>
    <div style="margin-bottom:14px">
      <label class="form-label">Body</label>
      <textarea class="form-input" id="email-body" rows="13" style="font-size:13px">${aiEscapeHtml(email.body)}</textarea>
    </div>
    <div style="margin-bottom:12px;display:grid;grid-template-columns:1fr auto;gap:10px;align-items:end">
      <div>
        <label class="form-label"><i class="fa-solid fa-link" style="margin-right:4px;color:var(--accent)"></i>CTA Button URL <span style="font-weight:400;color:var(--text-muted);text-transform:none;letter-spacing:0">(link tới file/tài liệu)</span></label>
        <input class="form-input" id="email-cta-url" placeholder="https://drive.google.com/file/d/..." value="">
      </div>
      <div>
        <label class="form-label">Button Label</label>
        <input class="form-input" id="email-cta-label" placeholder="Xem tài liệu" value="Xem tài liệu" style="width:140px">
      </div>
    </div>
    <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">
      <button class="btn btn-secondary" onclick="generateEmail()"><i class="fa-solid fa-rotate"></i> Regenerate</button>
      <div style="flex:1"></div>
      <button class="btn btn-primary" onclick="openDesignEmail()"><i class="fa-solid fa-palette"></i> Design Email</button>
      <button class="btn btn-success" onclick="sendEmail()"><i class="fa-solid fa-paper-plane"></i> Send Email</button>
    </div>`;
}

function readEmail() {
  return {
    subject: document.getElementById('email-subject')?.value || (lastEmail?.subject || ''),
    body: document.getElementById('email-body')?.value || (lastEmail?.body || ''),
    headerImg: '',
    ctaUrl: document.getElementById('email-cta-url')?.value || '',
    ctaLabel: document.getElementById('email-cta-label')?.value || 'Xem tài liệu'
  };
}

function bodyToHtmlBlocks(body) {
  const lines = body.split('\n');
  let html = '';
  let bullets = [];
  const F = "'Times New Roman',Times,Baskerville,Georgia,serif";

  const flushBullets = () => {
    if (!bullets.length) return;
    html += `<ul style="margin:0 0 18px 0;padding-left:22px;color:#0f172a;font-size:16px;font-family:${F};line-height:1.8">`
      + bullets.map(b => `<li style="margin-bottom:5px">${b}</li>`).join('')
      + '</ul>';
    bullets = [];
  };

  lines.forEach(line => {
    const t = line.trim();
    if (/^[•\-\*]\s+/.test(t)) {
      bullets.push(aiEscapeHtml(t.replace(/^[•\-\*]\s+/, '')));
    } else {
      flushBullets();
      if (t) html += `<p style="margin:0 0 18px 0;color:#0f172a;font-size:16px;font-family:${F};line-height:1.8;text-align:justify">${aiEscapeHtml(t)}</p>`;
    }
  });
  flushBullets();
  return html;
}

function buildEmailHtml() {
  const { subject, body, headerImg, ctaUrl, ctaLabel } = readEmail();
  const u = aiGetCurrentUser();
  const senderRole = u.roleLabel || (u.role === 'manager' ? 'Account Manager' : 'Account Sales');
  const headerBlock = headerImg
    ? `<img src="${aiEscapeHtml(headerImg)}" alt="" style="width:100%;max-height:200px;object-fit:cover;display:block">`
    : `<div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 24px;text-align:center"><div style="font-size:22px;font-weight:700;color:#fff">SalesTrack</div><div style="font-size:12px;color:rgba(255,255,255,0.8);margin-top:4px">Sales CRM Platform</div></div>`;
  const ctaBlock = ctaUrl
    ? `<div style="text-align:center;margin:24px 0"><a href="${aiEscapeHtml(ctaUrl)}" style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:15px;font-weight:600">${aiEscapeHtml(ctaLabel)}</a></div>`
    : '';

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${aiEscapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#e9ecf3;font-family:'Plus Jakarta Sans',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">
<tr><td>${headerBlock}</td></tr>
<tr><td style="padding:32px 36px">${bodyToHtmlBlocks(body)}${ctaBlock}
<div style="margin-top:28px;padding-top:20px;border-top:1px solid #e2e8f0;font-size:14px;color:#64748b;line-height:1.6">
<strong style="color:#0f172a">${aiEscapeHtml(u.name)}</strong><br>${aiEscapeHtml(senderRole)}
</div></td></tr>
</table></td></tr></table></body></html>`;
}

function openDesignEmail() {
  const html = buildEmailHtml();
  const shell = document.getElementById('email-preview-shell');
  if (shell) {
    shell.innerHTML = '';
    const frame = document.createElement('iframe');
    frame.title = 'Email preview';
    frame.style.cssText = 'width:100%;height:560px;border:none;border-radius:8px;background:#fff';
    shell.appendChild(frame);

    const doc = frame.contentDocument || frame.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
    }
  }
  openModal('design-modal');
}

function copyEmailHtml() {
  const html = buildEmailHtml();
  navigator.clipboard?.writeText(html)
    .then(() => showToast('Email HTML copied to clipboard', 'success'))
    .catch(() => showToast('Copy failed — please copy manually', 'error'));
}

function sendEmail() {
  const id = document.getElementById('lead-select')?.value;
  const lead = aiGetLeads().find(l => l.id === id);
  const { subject, body } = readEmail();
  const to = lead?.email || '';
  const href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = href;
  showToast('Opening your email client…', 'info');

  if (lead && typeof saveActivities === 'function') {
    const acts = aiGetActivities();
    acts.unshift({
      id: 'act_' + Date.now(),
      type: 'Email',
      leadId: lead.id,
      leadName: lead.name,
      company: lead.company,
      stage: lead.stage,
      date: new Date().toISOString(),
      notes: `Sent: ${subject}`,
      createdAt: new Date().toISOString()
    });
    saveActivities(acts);
  }
}

function initApiKeyPanel() {
  const input = document.getElementById('api-key-input');
  const badge = document.getElementById('api-key-badge');
  const statusText = document.getElementById('api-key-status-text');
  const clearBtn = document.getElementById('api-clear-btn');
  const saved = localStorage.getItem('google_ai_key') || '';
  if (input) input.value = saved;
  updateApiKeyBadge(!!saved, badge, statusText, clearBtn);
}

function updateApiKeyBadge(hasKey, badge, statusText, clearBtn) {
  if (badge) {
    badge.className = 'api-badge ' + (hasKey ? 'set' : 'unset');
  }
  if (statusText) {
    statusText.textContent = hasKey ? 'Key saved — ready to generate' : 'Not set — using template fallback';
  }
  if (clearBtn) clearBtn.style.display = hasKey ? '' : 'none';
}

function saveApiKey() {
  const input = document.getElementById('api-key-input');
  const key = input?.value.trim() || '';
  if (!key) { showToast('Please paste your API key first', 'error'); return; }
  localStorage.setItem('google_ai_key', key);
  initApiKeyPanel();
  showToast('API key saved locally', 'success');
}

function clearApiKey() {
  localStorage.removeItem('google_ai_key');
  const input = document.getElementById('api-key-input');
  if (input) input.value = '';
  initApiKeyPanel();
  showToast('API key cleared', 'info');
}

function toggleApiKeyVisibility() {
  const input = document.getElementById('api-key-input');
  const eye = document.getElementById('api-key-eye');
  if (!input) return;
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  if (eye) eye.innerHTML = show ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>';
}
