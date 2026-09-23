// Trust architecture and domain selectors.
//
//  - Identity, employment periods, training and commendations are visible across the network.
//  - Attendance, incidents, disciplinary actions and separation details stay with the employer
//    that recorded them. They are released only through a GRANT, created when an employer
//    approves a consented verification request or when the guard shares a code. Grants expire.
//  - Personal details (national ID, DOB, phone) are for the guard, the regulator, and companies
//    that have employed the guard.
import { daysUntil, hoursUntil } from './util';

export const SCOPES = [
  { key: 'attendance', label: 'Attendance record', short: 'Attendance' },
  { key: 'incident', label: 'Incident reports', short: 'Incidents' },
  { key: 'disciplinary', label: 'Disciplinary actions', short: 'Disciplinary' },
  { key: 'separation', label: 'Separation & rehire eligibility', short: 'Separation' },
];
export const RESTRICTED = SCOPES.map((s) => s.key);
export const scopeLabel = (k) => SCOPES.find((s) => s.key === k)?.label ?? k;
export const scopeShort = (k) => SCOPES.find((s) => s.key === k)?.short ?? k;

export const RECORD_TYPES = {
  training: { label: 'Training / certification', short: 'Training', tone: 'info', icon: 'GraduationCap' },
  commendation: { label: 'Commendation', short: 'Commendation', tone: 'ok', icon: 'Medal' },
  incident: { label: 'Incident', short: 'Incident', tone: 'warn', icon: 'Flag' },
  disciplinary: { label: 'Disciplinary action', short: 'Disciplinary', tone: 'bad', icon: 'Warning' },
};

export const SEPARATION_CATEGORIES = [
  'Resignation', 'Contract ended', 'Redundancy', 'Transferred', 'Retirement',
  'Dismissal — performance', 'Dismissal — misconduct', 'Absconded',
];
export const SERIOUS_SEPARATIONS = ['Dismissal — performance', 'Dismissal — misconduct', 'Absconded'];

export const POSITIONS = [
  'Trainee Security Officer', 'Security Officer', 'Senior Security Officer', 'Access Control Officer',
  'Control Room Operator', 'Response Team Officer', 'Shift Supervisor', 'Site Supervisor',
];
export const CITIES = ['Harare', 'Bulawayo', 'Mutare', 'Gweru', 'Masvingo', 'Kwekwe', 'Chinhoyi', 'Victoria Falls'];
export const RISK_LEVELS = ['Standard', 'High', 'Critical'];
export const STAGES = [
  { key: 'applied', label: 'Applied' },
  { key: 'screening', label: 'Screening' },
  { key: 'verification', label: 'Verification' },
  { key: 'offer', label: 'Offer' },
  { key: 'hired', label: 'Hired' },
  { key: 'rejected', label: 'Rejected' },
];

// ---------- Roles & permissions (company staff) ----------
export const ROLES = {
  owner: { label: 'Owner', desc: 'Full control, including team, company profile and integrations.' },
  hr: { label: 'HR & compliance', desc: 'Hire, record, verify and release. Cannot manage the team.' },
  supervisor: { label: 'Supervisor', desc: 'Add records and attendance for guards on their sites.' },
  viewer: { label: 'Viewer', desc: 'Read-only access, for auditors and consultants.' },
};
export const PERMISSIONS = [
  { key: 'guard.hire', label: 'Register and hire guards' },
  { key: 'employment.manage', label: 'Reassign sites and record separations' },
  { key: 'attendance.update', label: 'Update attendance' },
  { key: 'record.create', label: 'Add records' },
  { key: 'record.manage', label: 'Edit and retract records' },
  { key: 'site.manage', label: 'Create and edit sites' },
  { key: 'recruit.manage', label: 'Manage the recruitment pipeline' },
  { key: 'verification.request', label: 'Request verification' },
  { key: 'verification.release', label: 'Release records to other employers' },
  { key: 'dispute.resolve', label: 'Resolve guard responses' },
  { key: 'audit.export', label: 'Export audit trail and reports' },
  { key: 'integration.manage', label: 'Manage API keys, webhooks and imports' },
  { key: 'team.manage', label: 'Invite and manage team members' },
  { key: 'company.manage', label: 'Edit company profile and sharing policy' },
];
const ALL = PERMISSIONS.map((p) => p.key);
export const ROLE_PERMS = {
  owner: ALL,
  hr: ALL.filter((p) => !['team.manage', 'company.manage', 'integration.manage'].includes(p)),
  supervisor: ['attendance.update', 'record.create'],
  viewer: [],
};
export function can(session, perm) {
  if (!session || session.kind !== 'staff') return false;
  return (ROLE_PERMS[session.role] ?? []).includes(perm);
}
export const deniedHint = (session, perm) =>
  can(session, perm) ? undefined : `Your role (${ROLES[session?.role]?.label ?? 'none'}) can't do this.`;

// ---------- Selectors ----------
export const company = (db, id) => db.companies.find((c) => c.id === id);
export const guardById = (db, id) => db.guards.find((g) => g.id === id);
export const siteById = (db, id) => db.sites.find((s) => s.id === id);
export const clientById = (db, id) => db.clients.find((c) => c.id === id);
export const userById = (db, id) => db.users.find((u) => u.id === id);
export const employmentsOf = (db, guardId) =>
  db.employments.filter((e) => e.guardId === guardId).sort((a, b) => b.start.localeCompare(a.start));
export const currentEmployment = (db, guardId) => db.employments.find((e) => e.guardId === guardId && !e.end) ?? null;
export const activeEmployments = (db, companyId) => db.employments.filter((e) => e.companyId === companyId && !e.end);
export const siteGuards = (db, siteId) =>
  db.employments.filter((e) => e.siteId === siteId && !e.end).map((e) => ({ e, g: guardById(db, e.guardId) }));
export const companyMembers = (db, companyId) =>
  db.users.filter((u) => u.kind === 'staff' && u.memberships.some((m) => m.companyId === companyId));
export const roleIn = (user, companyId) => user.memberships.find((m) => m.companyId === companyId)?.role;

export function coverage(db, site) {
  const filled = siteGuards(db, site.id).length;
  const pct = site.posts ? Math.round((filled / site.posts) * 100) : 100;
  return { filled, posts: site.posts, pct, tone: filled >= site.posts ? 'ok' : filled === 0 ? 'bad' : 'warn' };
}

// ---------- Visibility ----------
export const grantActive = (g) => !g.revokedAt && new Date(g.expiresAt) > new Date();

export function releasedScopes(db, viewerCompanyId, guardId, sourceCompanyId) {
  if (viewerCompanyId === sourceCompanyId) return new Set(RESTRICTED);
  const set = new Set();
  db.grants
    .filter((g) => g.guardId === guardId && g.viewerCompanyId === viewerCompanyId && (g.sourceCompanyId === sourceCompanyId || g.sourceCompanyId === '*') && grantActive(g))
    .forEach((g) => g.scopes.forEach((s) => set.add(s)));
  return set;
}

export function canSee(db, session, guardId, sourceCompanyId, scope) {
  if (!session) return false;
  if (session.kind === 'regulator') return true;
  if (session.kind === 'guard') return session.guardId === guardId;
  if (session.kind === 'client') return false;
  if (!RESTRICTED.includes(scope)) return true;
  return releasedScopes(db, session.companyId, guardId, sourceCompanyId).has(scope);
}

export function canSeePII(db, session, guardId) {
  if (!session) return false;
  if (session.kind === 'regulator') return true;
  if (session.kind === 'guard') return session.guardId === guardId;
  if (session.kind === 'staff') return db.employments.some((e) => e.guardId === guardId && e.companyId === session.companyId);
  return false;
}

export const maskId = (nid) => nid.replace(/^(\d{2})-\d+/, (_, a) => `${a}-•••••••`);
export const maskPhone = (p) => p.replace(/\d(?=[\d ]{4})/g, '•');

// ---------- Compliance ----------
export function expiryStatus(iso, warnDays = 60) {
  if (!iso) return { tone: 'neutral', label: 'No expiry', days: Infinity };
  const d = daysUntil(iso);
  if (d < 0) return { tone: 'bad', label: `Expired ${-d}d ago`, days: d };
  if (d <= warnDays) return { tone: 'warn', label: `Expires in ${d}d`, days: d };
  return { tone: 'ok', label: 'Valid', days: d };
}
export const licenceStatus = (guard) => expiryStatus(guard.licence?.expiry);

export function complianceIssues(db, companyId) {
  const out = [];
  activeEmployments(db, companyId).forEach((e) => {
    const g = guardById(db, e.guardId);
    const ls = licenceStatus(g);
    if (ls.tone !== 'ok') out.push({ kind: 'licence', tone: ls.tone, guard: g, label: `Security licence ${ls.label.toLowerCase()}`, days: ls.days });
    db.records
      .filter((r) => r.guardId === g.id && r.type === 'training' && r.expires && !r.retracted)
      .forEach((r) => {
        const s = expiryStatus(r.expires);
        const renewed = db.records.some((x) => x.guardId === g.id && x.title === r.title && x.date > r.date);
        if (s.tone !== 'ok' && !renewed) out.push({ kind: 'cert', tone: s.tone, guard: g, label: `${r.title} ${s.label.toLowerCase()}`, days: s.days });
      });
  });
  return out.sort((a, b) => a.days - b.days);
}

export function slaStatus(req) {
  if (!['pending', 'awaiting_consent'].includes(req.status)) return null;
  const h = hoursUntil(req.dueAt);
  if (h < 0) return { tone: 'bad', label: `Overdue by ${Math.round(-h) >= 24 ? Math.round(-h / 24) + 'd' : Math.round(-h) + 'h'}`, hours: h };
  if (h < 24) return { tone: 'warn', label: `Due in ${Math.max(1, Math.round(h))}h`, hours: h };
  return { tone: 'neutral', label: `Due in ${Math.round(h / 24)}d`, hours: h };
}

export const REQUEST_STATUS = {
  awaiting_consent: { label: 'Awaiting consent', tone: 'info' },
  pending: { label: 'Pending', tone: 'warn' },
  approved: { label: 'Released', tone: 'ok' },
  declined: { label: 'Declined', tone: 'bad' },
  withdrawn: { label: 'Withdrawn', tone: 'neutral' },
  expired: { label: 'Expired', tone: 'neutral' },
};
export const RESPONSE_STATUS = {
  open: { label: 'Awaiting employer', tone: 'warn' },
  maintained: { label: 'Record maintained', tone: 'neutral' },
  amended: { label: 'Record amended', tone: 'ok' },
  escalated: { label: 'With regulator', tone: 'info' },
  upheld: { label: 'Regulator upheld record', tone: 'neutral' },
  overturned: { label: 'Regulator overturned record', tone: 'ok' },
};

// Accountability for companies too: how well do they answer the network?
export function companyReputation(db, companyId) {
  const answered = db.requests.filter((r) => r.toCompanyId === companyId && r.respondedAt);
  const hrs = answered.map((r) => (new Date(r.respondedAt) - new Date(r.createdAt)) / 3600000);
  const inSla = answered.filter((r) => new Date(r.respondedAt) <= new Date(r.dueAt)).length;
  const overdue = db.requests.filter((r) => r.toCompanyId === companyId && r.status === 'pending' && new Date(r.dueAt) < new Date()).length;
  const disputes = db.responses.filter((r) => r.companyId === companyId);
  const overturned = disputes.filter((r) => r.status === 'overturned' || r.status === 'amended').length;
  return {
    answered: answered.length,
    avgHours: hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : null,
    slaRate: answered.length ? Math.round((inSla / answered.length) * 100) : null,
    overdue,
    disputes: disputes.length,
    amended: overturned,
  };
}

export function verificationScore(g) {
  const v = Object.values(g.verification);
  return Math.round((v.filter(Boolean).length / v.length) * 100);
}
