// Domain-aware building blocks shared by every screen.
import { useRef, useState } from 'react';
import { Clock, LockSimple, MapPin, ShieldCheck, ShieldWarning, Timer, Trash, UploadSimple } from '@phosphor-icons/react';
import { useStore } from './store';
import { REQUEST_STATUS, RESPONSE_STATUS, company, coverage, expiryStatus, guardById, licenceStatus, siteById, slaStatus } from './access';
import { Avatar, Badge, Button, OrgMark, fileToLogo, fmtDate } from './ui';

/** Avatar + name + Workforce ID. Pass `guard` or `id`. */
export function GuardCell({ guard, id, size = 34, sub, onClick }) {
  const { db } = useStore();
  const g = guard ?? guardById(db, id);
  if (!g) return <span className="muted">Unknown</span>;
  return (
    <span className={`cell-person ${onClick ? 'is-link' : ''}`} onClick={onClick}>
      <Avatar name={g.name} seed={g.id} src={g.avatar} size={size} />
      <span className="cell-person-text">
        <span className="cell-name">{g.name}</span>
        <span className="cell-sub">{sub ?? <span className="mono">{g.id}</span>}</span>
      </span>
    </span>
  );
}

export function UserCell({ user, size = 34, sub }) {
  if (!user) return null;
  return (
    <span className="cell-person">
      <Avatar name={user.name} seed={user.id} src={user.avatar} size={size} />
      <span className="cell-person-text">
        <span className="cell-name">{user.name}</span>
        <span className="cell-sub">{sub ?? user.email}</span>
      </span>
    </span>
  );
}

export function CompanyCell({ id, company: c, size = 28, sub }) {
  const { db } = useStore();
  const co = c ?? company(db, id);
  if (!co) return <span className="muted">—</span>;
  return (
    <span className="cell-person">
      <OrgMark company={co} size={size} />
      <span className="cell-person-text">
        <span className="cell-name">{co.name}</span>
        {sub !== false && <span className="cell-sub">{sub ?? co.city}</span>}
      </span>
    </span>
  );
}

export function SiteLabel({ id, withRisk }) {
  const { db } = useStore();
  const s = siteById(db, id);
  if (!s) return <span className="muted">Unassigned</span>;
  return (
    <span className="site-label">
      <MapPin size={13} />
      <span>{s.name}</span>
      {withRisk && s.risk !== 'Standard' && <RiskBadge risk={s.risk} />}
    </span>
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
