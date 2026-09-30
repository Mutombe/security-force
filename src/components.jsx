// Small domain building blocks shared by the screens.
import { CheckCircle, Clock, ShieldCheck, ShieldWarning, XCircle } from '@phosphor-icons/react';
import { useStore } from './store';
import { company, guardById, isActive, licenceStatus } from './access';
import { Avatar, Badge, OrgMark, fmtDate } from './ui';

/** Where a guard's name should link for the current viewer. */
export function guardHref(session, guardId) {
  if (session?.kind === 'company') return `#/guard/${guardId}`;
  if (session?.kind === 'guard' && session.guardId === guardId) return '#/me';
  return null;
}

/** Avatar + name + ProCheQ ID, linked to the guard's profile when the viewer has one. */
export function GuardCell({ guard, id, size = 36, sub, link = true }) {
  const { db, session } = useStore();
  const g = guard ?? guardById(db, id);
  if (!g) return <span className="muted">Unknown</span>;
  const href = link ? guardHref(session, g.id) : null;
  const Tag = href ? 'a' : 'span';
  return (
    <Tag className={`cell-person ${href ? 'is-link' : ''}`} href={href ?? undefined} onClick={href ? (e) => e.stopPropagation() : undefined}>
      <Avatar name={g.name} seed={g.id} src={g.avatar} size={size} />
      <span className="cell-person-text">
        <span className="cell-name">{g.name}</span>
        <span className="cell-sub">{sub ?? <span className="mono">{g.id}</span>}</span>
      </span>
    </Tag>
  );
}

/** Company logo + name, linked to its page. */
export function CompanyCell({ id, size = 30, sub, link = true }) {
  const { db, session } = useStore();
  const co = company(db, id);
  if (!co) return <span className="muted">—</span>;
  const href = link && session ? `#/company/${co.id}` : null;
  const Tag = href ? 'a' : 'span';
  return (
    <Tag className={`cell-person ${href ? 'is-link' : ''}`} href={href ?? undefined} onClick={href ? (e) => e.stopPropagation() : undefined}>
      <OrgMark company={co} size={size} />
      <span className="cell-person-text">
        <span className="cell-name">{co.name}</span>
        {sub !== false && <span className="cell-sub">{sub ?? co.city}</span>}
      </span>
    </Tag>
  );
}

export function LicenceBadge({ guard }) {
  const s = licenceStatus(guard);
  return (
    <Badge tone={s.tone} icon={s.tone === 'ok' ? ShieldCheck : ShieldWarning} title={`${guard.licence.number} · ${fmtDate(guard.licence.expiry)}`}>
      {s.label}
    </Badge>
  );
}

export function RequestBadge({ req }) {
  if (!req) return null;
  if (req.status === 'pending') return <Badge tone="warn" icon={Clock}>Waiting for the guard</Badge>;
  if (req.status === 'declined') return <Badge tone="bad" icon={XCircle}>Declined</Badge>;
  if (req.status === 'revoked') return <Badge tone="neutral">Access withdrawn</Badge>;
  if (isActive(req)) return <Badge tone="ok" icon={CheckCircle}>Approved until {fmtDate(req.expiresAt)}</Badge>;
  return <Badge tone="neutral">Access ended {fmtDate(req.expiresAt)}</Badge>;
}
