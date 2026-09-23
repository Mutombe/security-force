// Public network profile of a security company. Visible to staff of any company, guards and clients.
import { useEffect, useState } from 'react';
import {
  ArrowsLeftRight, Buildings, CalendarBlank, ChartLineUp, Envelope, GearSix, Handshake, LockSimpleOpen, MapPin, Phone, ShieldCheck, Users,
} from '@phosphor-icons/react';
import { useStore } from '../../store';
import {
  activeEmployments, company, companyReputation, coverage, employmentsOf, expiryStatus, grantActive, guardById, scopeShort,
} from '../../access';
import {
  Badge, Button, Card, ConfirmModal, DataTable, EmptyState, Meter, OrgMark, Stat, daysUntil, fmtDate, fmtMonth, fromNow,
} from '../../ui';
import { CoverageBadge, EntityLink, GuardCell, RequestStatus, RiskBadge, SiteLabel } from '../../components';
import './detail.css';

const STATUS = { active: ['ok', 'Active'], pending: ['warn', 'Awaiting approval'], suspended: ['bad', 'Suspended'], rejected: ['bad', 'Rejected'] };

export default function CompanyProfile({ id, go }) {
  const { db, session } = useStore();
  const co = company(db, id);

  useEffect(() => {
    if (session.kind === 'regulator') go('companies', { id });
  }, [session.kind, id, go]);

  if (!co)
    return (
      <div className="card">
        <EmptyState icon={Buildings} title="Company not found" body={`No company in the network has the ID ${id}.`} />
      </div>
    );

  const rep = companyReputation(db, co.id);
  const deployed = activeEmployments(db, co.id).length;
  const sites = db.sites.filter((s) => s.companyId === co.id && s.active);
  const lic = expiryStatus(co.licenceExpiry);
  const [tone, label] = STATUS[co.status] ?? ['neutral', co.status];
  const isOwn = session.kind === 'staff' && session.companyId === co.id;
  const isOther = session.kind === 'staff' && !isOwn;

  return (
    <div className="stack dt2">
      <section className="card dt2-hero">
        <OrgMark company={co} size={96} />
        <div className="dt2-hero-main">
          <div className="eyebrow">Security company · {co.city}</div>
          <h1>{co.name}</h1>
          <div className="chips mt-10">
            <Badge tone={tone} dot>
              {label}
            </Badge>
            <Badge>
              <span className="mono">{co.reg}</span>
            </Badge>
            {co.licenceExpiry ? (
              <Badge tone={lic.tone} icon={ShieldCheck}>
                {lic.tone === 'ok' ? `Operating licence to ${fmtDate(co.licenceExpiry)}` : `Operating licence ${lic.label.toLowerCase()}`}
              </Badge>
            ) : (
              <Badge>Licence not on file</Badge>
            )}
          </div>
          <dl className="dt2-contact">
            {co.phone && (
              <div>
                <dt>
                  <Phone size={14} /> Phone
                </dt>
                <dd>{co.phone}</dd>
              </div>
            )}
            {co.email && (
              <div>
                <dt>
                  <Envelope size={14} /> Email
                </dt>
                <dd>{co.email}</dd>
              </div>
            )}
            {co.address && (
              <div>
                <dt>
                  <MapPin size={14} /> Head office
                </dt>
                <dd>{co.address}</dd>
              </div>
            )}
            {co.joinedAt && (
              <div>
                <dt>
                  <CalendarBlank size={14} /> In the network since
                </dt>
                <dd>{fmtMonth(co.joinedAt)}</dd>
              </div>
            )}
          </dl>
        </div>
        {isOwn && (
          <div className="dt2-hero-actions">
            <Button variant="ghost" icon={GearSix} onClick={() => go('settings')}>
              Edit profile
            </Button>
          </div>
        )}
      </section>

      {isOwn && (
        <div className="notice">
          <GearSix size={16} />
          <span>This is how other companies, guards and clients see your company. Update the logo, contact details and licence in Settings.</span>
        </div>
      )}

      <div className="stats">
        <Stat label="Guards deployed" value={deployed} icon={Users} />
        <Stat label="Active sites" value={sites.length} icon={Buildings} />
        <Stat label="Requests answered" value={rep.answered} hint={rep.overdue ? `${rep.overdue} overdue now` : 'None overdue'} tone={rep.overdue ? 'warn' : undefined} icon={ArrowsLeftRight} />
        <Stat label="Guard disputes" value={rep.disputes} hint={`${rep.amended} led to a correction`} icon={Handshake} />
      </div>

      <Card title="Network standing" subtitle="How this company answers other employers. The regulator and every company in the network see the same figures." icon={ChartLineUp}>
        <div className="dt2-standing">
          <div>
            <span className="dt2-k">Average response</span>
            <b className="dt2-v">{rep.avgHours == null ? '—' : rep.avgHours >= 48 ? `${Math.round(rep.avgHours / 24)} days` : `${rep.avgHours} h`}</b>
          </div>
          <div>
            <span className="dt2-k">Answered on time</span>
            {rep.slaRate == null ? <b className="dt2-v">—</b> : <Meter value={rep.slaRate} label={`${rep.slaRate}%`} />}
          </div>
          <div>
            <span className="dt2-k">Overdue now</span>
            <b className={`dt2-v ${rep.overdue ? 'is-bad' : ''}`}>{rep.overdue}</b>
          </div>
          <div>
            <span className="dt2-k">Records corrected after a dispute</span>
            <b className="dt2-v">
              {rep.amended}/{rep.disputes}
            </b>
          </div>
        </div>
      </Card>

      {isOwn && <OwnSites sites={sites} />}
      {isOther && <SharedHistory co={co} />}
      {session.kind === 'guard' && <GuardView co={co} />}
      {session.kind === 'client' && <ClientView co={co} />}
    </div>
  );
}

function OwnSites({ sites }) {
  return (
    <Card title="Sites" subtitle="Only your company and each site's client see site names." icon={Buildings} flush>
      <DataTable
        rows={sites}
        columns={[
          { key: 'name', header: 'Site', width: 'minmax(200px, 2fr)', mobile: 'primary', sort: (s) => s.name, render: (s) => <SiteLabel id={s.id} /> },
          { key: 'risk', header: 'Risk', width: '110px', mobile: 'aside', render: (s) => <RiskBadge risk={s.risk} /> },
          { key: 'cov', header: 'Coverage', width: '130px', mobile: 'meta', render: (s) => <CoverageBadge site={s} /> },
        ]}
        empty={<EmptyState compact body="No active sites." />}
      />
    </Card>
  );
}

function SharedHistory({ co }) {
  const { db, session } = useStore();
  const me = session.companyId;
  const reqs = db.requests
    .filter((r) => (r.fromCompanyId === me && r.toCompanyId === co.id) || (r.fromCompanyId === co.id && r.toCompanyId === me))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const theirs = new Set(db.employments.filter((e) => e.companyId === co.id).map((e) => e.guardId));
  const both = [...new Set(db.employments.filter((e) => e.companyId === me && theirs.has(e.guardId)).map((e) => e.guardId))].map((gid) => guardById(db, gid));

  return (
    <div className="grid-2">
      <Card title="Your history with them" subtitle="Verification requests between your two companies" icon={ArrowsLeftRight} flush>
        <DataTable
          rows={reqs}
          pageSize={5}
          columns={[
            {
              key: 'guard',
              header: 'Request',
              width: 'minmax(180px, 2fr)',
              mobile: 'primary',
              render: (r) => (
                <span className="dt2-req">
                  <EntityLink kind="request" id={r.id}>
                    {guardById(db, r.guardId)?.name}
                  </EntityLink>
                  <span className="cell-sub">
                    {r.fromCompanyId === me ? 'You asked them' : 'They asked you'} · {fmtDate(r.createdAt)}
                  </span>
                </span>
              ),
            },
            { key: 'status', header: 'Status', width: '130px', align: 'right', mobile: 'aside', render: (r) => <RequestStatus req={r} /> },
          ]}
          empty={<EmptyState compact body="No requests between your companies yet." />}
        />
      </Card>
      <Card title="Guards who worked for both" subtitle="People with verified employment at both companies" icon={Users} flush>
        <DataTable
          rows={both}
          pageSize={5}
          columns={[
            { key: 'g', header: 'Guard', width: 'minmax(0, 1fr)', mobile: 'primary', render: (g) => <GuardCell guard={g} /> },
            {
              key: 'at',
              header: 'With them',
              width: '150px',
              mobile: 'meta',
              render: (g) => {
                const e = employmentsOf(db, g.id).find((x) => x.companyId === co.id);
                return <span className="small muted">{e ? `${fmtMonth(e.start)} – ${fmtMonth(e.end)}` : '—'}</span>;
              },
            },
          ]}
          empty={<EmptyState compact body="No shared guards." />}
        />
      </Card>
    </div>
  );
}

function GuardView({ co }) {
  const { db, session, act } = useStore();
  const me = session.guardId;
  const emps = employmentsOf(db, me).filter((e) => e.companyId === co.id);
  const grants = db.grants.filter((g) => g.guardId === me && g.viewerCompanyId === co.id && grantActive(g));
  const [revoke, setRevoke] = useState(null);

  return (
    <div className="grid-2">
      <Card title={`Your work with ${co.name}`} icon={Users}>
        {emps.length ? (
          <ul className="items">
            {emps.map((e) => (
              <li key={e.id}>
                <OrgMark company={co} size={34} />
                <div className="grow">
                  <div className="item-title">{e.position}</div>
                  <div className="item-sub">
                    {fmtMonth(e.start)} – {fmtMonth(e.end)}
                    {e.separation && ` · ${e.separation.category}`}
                  </div>
                </div>
                {!e.end && <Badge tone="ok">Current</Badge>}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState compact body={`You have not worked for ${co.name}.`} />
        )}
      </Card>
      <Card title="What they can see about you" subtitle="Restricted records you have allowed this company to see" icon={LockSimpleOpen}>
        {grants.length ? (
          <ul className="items">
            {grants.map((g) => (
              <li key={g.id}>
                <div className="grow">
                  <div className="item-title">{g.scopes.map(scopeShort).join(', ')}</div>
                  <div className="item-sub">
                    {g.via === 'share' ? 'Through your share code' : `Records from ${company(db, g.sourceCompanyId)?.name}`} · ends {fromNow(g.expiresAt)}
                  </div>
                </div>
                <Badge tone={daysUntil(g.expiresAt) <= 7 ? 'warn' : 'neutral'}>{fmtDate(g.expiresAt)}</Badge>
                <Button variant="danger-ghost" size="sm" onClick={() => setRevoke(g)}>
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState compact icon={ShieldCheck} body={`${co.name} cannot see any of your restricted records.`} />
        )}
      </Card>
      {revoke && (
        <ConfirmModal
          title={`End ${co.name}'s access?`}
          body={`${co.name} will immediately lose access to your ${revoke.scopes.map(scopeShort).join(', ').toLowerCase()} records. They will be told access was withdrawn.`}
          confirmLabel="End access"
          onClose={() => setRevoke(null)}
          onConfirm={() =>
            act({
              key: revoke.id,
              pending: 'Ending access…',
              success: `${co.name} can no longer see your restricted records`,
              touches: ['grants'],
              undo: true,
              apply: (d, t) => {
                d.grants.find((g) => g.id === revoke.id).revokedAt = t.now;
                t.log('Revoked access', `${co.name} — ${revoke.scopes.map(scopeShort).join(', ')}`, { guardId: me });
                t.notify(`company:${co.id}`, { title: 'Access withdrawn', body: `${t.actor.name} ended your access to their released records.`, link: { name: 'guard', params: { id: me } } });
              },
            })
          }
        />
      )}
    </div>
  );
}

function ClientView({ co }) {
  const { db, session } = useStore();
  const sites = db.sites.filter((s) => s.companyId === co.id && s.clientId === session.clientId && s.active);
  return (
    <Card title={`Sites ${co.name} guards for you`} icon={Buildings} flush>
      <DataTable
        rows={sites}
        columns={[
          { key: 'name', header: 'Site', width: 'minmax(200px, 2fr)', mobile: 'primary', render: (s) => <SiteLabel id={s.id} /> },
          { key: 'shift', header: 'Shift', width: '120px', mobile: 'meta', render: (s) => <span className="small">{s.shift}</span> },
          { key: 'risk', header: 'Risk', width: '110px', mobile: 'meta', render: (s) => <RiskBadge risk={s.risk} /> },
          {
            key: 'cov',
            header: 'Coverage',
            width: '150px',
            mobile: 'aside',
            render: (s) => {
              const c = coverage(db, s);
              return <Meter value={c.pct} tone={c.tone} label={`${c.filled}/${c.posts}`} />;
            },
          },
        ]}
        empty={<EmptyState compact body={`${co.name} does not guard any of your sites.`} />}
      />
    </Card>
  );
}

