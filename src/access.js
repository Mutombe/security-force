// ProCheQ rules. Three levels of visibility:
//   Public (anyone at a gate)   name, photo, ProCheQ ID, current employer, licence status
//   Any member company          + career history, training, commendations
//   With the guard's approval   + incidents, disciplinary actions, exit reasons, rehire answers, replies
// A company always sees what it recorded itself. The guard always sees everything about themself.
import { daysUntil } from './util';

export const RECORD_TYPES = {
  training: { label: 'Training', tone: 'info', private: false },
  commendation: { label: 'Commendation', tone: 'ok', private: false },
  incident: { label: 'Incident', tone: 'warn', private: true },
  disciplinary: { label: 'Disciplinary', tone: 'bad', private: true },
};

export const EXIT_REASONS = ['Resigned', 'Contract ended', 'Retrenched', 'Retired', 'Dismissed — performance', 'Dismissed — misconduct', 'Absconded'];
export const REHIRE = ['Yes', 'With conditions', 'No'];
export const ROLES = ['Security Officer', 'Senior Security Officer', 'Access Control Officer', 'Control Room Operator', 'Response Team Officer', 'Shift Supervisor', 'Site Supervisor'];
export const CITIES = ['Harare', 'Bulawayo', 'Mutare', 'Gweru', 'Masvingo', 'Kwekwe', 'Chinhoyi'];
export const ACCESS_DAYS = 30;

export const company = (db, id) => db.companies.find((c) => c.id === id);
export const guardById = (db, id) => db.guards.find((g) => g.id === id);
export const careerOf = (db, guardId) => db.employments.filter((e) => e.guardId === guardId).sort((a, b) => b.start.localeCompare(a.start));
export const currentJob = (db, guardId) => db.employments.find((e) => e.guardId === guardId && !e.end) ?? null;
export const recordsOf = (db, guardId) => db.records.filter((r) => r.guardId === guardId).sort((a, b) => b.date.localeCompare(a.date));
export const myGuards = (db, companyId) => db.employments.filter((e) => e.companyId === companyId && !e.end);

export function findGuard(db, query) {
  const q = query.trim().toUpperCase().replace(/\s+/g, '');
  if (!q) return null;
  const id = /^\d{6}$/.test(q) ? `PQ-${q}` : /^PQ\d{6}$/.test(q) ? `PQ-${q.slice(2)}` : q;
  return db.guards.find((g) => g.id === id || g.nationalId.toUpperCase() === q) ?? null;
}

export const isActive = (r) => r.status === 'approved' && new Date(r.expiresAt) > new Date();

/** The request a company has open or approved for a guard (latest first). */
export const requestFor = (db, companyId, guardId) =>
  db.requests.filter((r) => r.companyId === companyId && r.guardId === guardId).sort((a, b) => b.askedAt.localeCompare(a.askedAt))[0] ?? null;

/** Can this viewer see the private part of the record written by `sourceCompanyId`? */
export function canSeePrivate(db, session, guardId, sourceCompanyId) {
  if (!session) return false;
  if (session.kind === 'guard') return session.guardId === guardId;
  if (session.kind !== 'company') return false;
  if (sourceCompanyId && sourceCompanyId === session.companyId) return true;
  return db.requests.some((r) => r.companyId === session.companyId && r.guardId === guardId && isActive(r));
}

/** Personal details: the guard, companies that employ(ed) them, and companies with approval. */
export function canSeePersonal(db, session, guardId) {
  if (!session) return false;
  if (session.kind === 'guard') return session.guardId === guardId;
  return db.employments.some((e) => e.guardId === guardId && e.companyId === session.companyId) || canSeePrivate(db, session, guardId, null);
}

export function licenceStatus(guard) {
  const d = daysUntil(guard.licence.expiry);
  if (d < 0) return { tone: 'bad', label: 'Licence expired', days: d };
  if (d <= 60) return { tone: 'warn', label: `Licence expires in ${d} days`, days: d };
  return { tone: 'ok', label: 'Licence valid', days: d };
}

export const rehireTone = (r) => (r === 'Yes' ? 'ok' : r === 'No' ? 'bad' : 'warn');
export const isSeriousExit = (reason) => /Dismissed|Absconded/.test(reason);
export const maskId = (nid) => nid.replace(/^(\d{2})-\d+/, (_, a) => `${a}-•••••••`);
export const maskPhone = (p) => p.replace(/\d(?=[\d ]{4})/g, '•');
