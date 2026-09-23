// Domain-aware building blocks shared by every screen.
import { useRef, useState } from 'react';
import { Clock, LockSimple, MapPin, ShieldCheck, ShieldWarning, Timer, Trash, UploadSimple } from '@phosphor-icons/react';
import { useStore } from './store';
import { REQUEST_STATUS, RESPONSE_STATUS, company, coverage, expiryStatus, guardById, licenceStatus, siteById, slaStatus } from './access';
import { Avatar, Badge, Button, OrgMark, fileToLogo, fmtDate } from './ui';

/*
  LINKS — every item in the app links to its detail page.
    hrefFor(db, session, kind, id) → '#/…' or null when this viewer has no page for it
    <EntityLink kind id>text</EntityLink>  real <a href> (works with middle-click / new tab)
  kinds: guard · company · site · user · request · record · applicant · response · client
*/
export function hrefFor(db, session, kind, id) {
  if (!session || !id) return null;
  const k = session.kind;
  switch (kind) {
    case 'guard':
      if (k === 'guard') return id === session.guardId ? '#/passport' : null;
      if (k === 'client') return `#/verify/${id}`;
      return `#/guard/${id}`;
    case 'company':
      return k === 'regulator' ? `#/companies/${id}` : `#/company/${id}`;
    case 'site': {
      const s = siteById(db, id);
      if (!s) return null;
      if (k === 'staff' && s.companyId === session.companyId) return `#/sites/${id}`;
      if (k === 'client' && s.clientId === session.clientId) return `#/sites/${id}`;
      return null;
    }
    case 'user':
      return k === 'staff' && db.users.find((u) => u.id === id)?.memberships?.some((m) => m.companyId === session.companyId) ? `#/team/${id}` : null;
    case 'request': {
      const r = db.requests.find((x) => x.id === id);
      if (!r) return null;
      if (k === 'staff' && (r.fromCompanyId === session.companyId || r.toCompanyId === session.companyId)) return `#/verification/${id}`;
      if (k === 'guard' && r.guardId === session.guardId) return '#/consents';
      return null;
    }
    case 'record':
      return k === 'client' ? null : `#/record/${id}`;
    case 'applicant':
      return k === 'staff' ? `#/recruitment/${id}` : null;
    case 'response':
      if (k === 'staff') return `#/disputes/${id}`;
      if (k === 'regulator') return `#/escalations/${id}`;
      if (k === 'guard') return `#/responses/${id}`;
      return null;
    default:
      return null;
  }
}

export function EntityLink({ kind, id, children, className = '' }) {
  const { db, session } = useStore();
  const href = hrefFor(db, session, kind, id);
  if (!href) return <span className={className}>{children}</span>;
  return (
    <a href={href} className={`entity-link ${className}`} onClick={(e) => e.stopPropagation()}>
      {children}
    </a>
  );
}

function CellShell({ href, children }) {
  return href ? (
    <a href={href} className="cell-person is-link" onClick={(e) => e.stopPropagation()}>
      {children}
    </a>
  ) : (
    <span className="cell-person">{children}</span>
  );
}

/** Avatar + name + Workforce ID, linked to the guard's page. Pass `guard` or `id`. */
export function GuardCell({ guard, id, size = 34, sub, link = true }) {
  const { db, session } = useStore();
  const g = guard ?? guardById(db, id);
  if (!g) return <span className="muted">Unknown</span>;
  return (
    <CellShell href={link ? hrefFor(db, session, 'guard', g.id) : null}>
      <Avatar name={g.name} seed={g.id} src={g.avatar} size={size} />
      <span className="cell-person-text">
        <span className="cell-name">{g.name}</span>
        <span className="cell-sub">{sub ?? <span className="mono">{g.id}</span>}</span>
      </span>
    </CellShell>
  );
}

export function UserCell({ user, size = 34, sub, link = true }) {
  const { db, session } = useStore();
  if (!user) return null;
  return (
    <CellShell href={link ? hrefFor(db, session, 'user', user.id) : null}>
      <Avatar name={user.name} seed={user.id} src={user.avatar} size={size} />
      <span className="cell-person-text">
        <span className="cell-name">{user.name}</span>
        <span className="cell-sub">{sub ?? user.email}</span>
      </span>
    </CellShell>
  );
}

export function CompanyCell({ id, company: c, size = 28, sub, link = true }) {
  const { db, session } = useStore();
  const co = c ?? company(db, id);
  if (!co) return <span className="muted">—</span>;
  return (
    <CellShell href={link ? hrefFor(db, session, 'company', co.id) : null}>
      <OrgMark company={co} size={size} />
      <span className="cell-person-text">
        <span className="cell-name">{co.name}</span>
        {sub !== false && <span className="cell-sub">{sub ?? co.city}</span>}
      </span>
    </CellShell>
  );
}

export function SiteLabel({ id, withRisk, link = true }) {
  const { db, session } = useStore();
  const s = siteById(db, id);
  if (!s) return <span className="muted">Unassigned</span>;
  const href = link ? hrefFor(db, session, 'site', id) : null;
  const Tag = href ? 'a' : 'span';
  return (
    <Tag className={`site-label ${href ? 'is-link' : ''}`} href={href ?? undefined} onClick={href ? (e) => e.stopPropagation() : undefined}>
      <MapPin size={13} />
      <span>{s.name}</span>
      {withRisk && s.risk !== 'Standard' && <RiskBadge risk={s.risk} />}
    </Tag>
  );
}

export function RiskBadge({ risk }) {
  return <Badge tone={risk === 'Critical' ? 'bad' : risk === 'High' ? 'warn' : 'neutral'}>{risk}</Badge>;
}

export function CoverageBadge({ site }) {
  const { db } = useStore();
  const c = coverage(db, site);
  return (
    <Badge tone={c.tone} dot>
      {c.filled}/{c.posts} posts
    </Badge>
  );
}

export function LicenceBadge({ guard, compact }) {
  const s = licenceStatus(guard);
  const Icon = s.tone === 'ok' ? ShieldCheck : ShieldWarning;
  return (
    <Badge tone={s.tone} icon={Icon} title={`Licence ${guard.licence.number} · expires ${fmtDate(guard.licence.expiry)}`}>
      {compact ? (s.tone === 'ok' ? 'Licensed' : s.label) : s.tone === 'ok' ? `Licensed to ${fmtDate(guard.licence.expiry)}` : s.label}
    </Badge>
  );
}

export function ExpiryBadge({ iso }) {
  const s = expiryStatus(iso);
  if (!iso) return null;
  return (
    <Badge tone={s.tone} icon={Timer}>
      {s.tone === 'ok' ? `Valid to ${fmtDate(iso)}` : s.label}
    </Badge>
  );
}

export function RequestStatus({ req }) {
  const s = REQUEST_STATUS[req.status] ?? { label: req.status, tone: 'neutral' };
  return (
    <Badge tone={s.tone} dot>
      {s.label}
    </Badge>
  );
}

export function SlaBadge({ req }) {
  const s = slaStatus(req);
  if (!s) return null;
  return (
    <Badge tone={s.tone} icon={Clock}>
      {s.label}
    </Badge>
  );
}

export function ResponseStatus({ resp }) {
  const s = RESPONSE_STATUS[resp.status] ?? { label: resp.status, tone: 'neutral' };
  return (
    <Badge tone={s.tone} dot>
      {s.label}
    </Badge>
  );
}

/** Inline explanation when the current role can't do something. */
export function PermissionNote({ children }) {
  return (
    <div className="perm-note">
      <LockSimple size={14} />
      <span>{children}</span>
    </div>
  );
}

/** Logo picker used when registering or editing a company. */
export function LogoUpload({ company: co, value, onChange }) {
  const ref = useRef(null);
  const [err, setErr] = useState('');
  return (
    <div className="photo-edit">
      <OrgMark company={{ ...co, logo: value }} size={64} />
      <div className="stack-xs">
        <div className="row gap-s">
          <Button variant="ghost" size="sm" icon={UploadSimple} onClick={() => ref.current?.click()}>
            {value ? 'Replace logo' : 'Upload logo'}
          </Button>
          {value && (
            <Button variant="subtle" size="sm" icon={Trash} onClick={() => onChange(null)}>
              Remove
            </Button>
          )}
        </div>
        <span className={err ? 'field-error' : 'field-hint'}>{err || 'PNG with a transparent background works best. Shown wherever your company appears.'}</span>
        <input
          ref={ref}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          hidden
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            if (file.size > 5 * 1024 * 1024) return setErr('That file is over 5 MB.');
            setErr('');
            onChange(await fileToLogo(file));
          }}
        />
      </div>
    </div>
  );
}
