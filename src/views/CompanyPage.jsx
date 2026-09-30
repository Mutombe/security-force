// A member company's page.
import { Envelope, MapPin, Phone, SealCheck } from '@phosphor-icons/react';
import { useStore } from '../store';
import { company, isActive, myGuards } from '../access';
import { Badge, Card, EmptyState, OrgMark, fmtDate, fmtMonth } from '../ui';
import { GuardCell, RequestBadge } from '../components';

export default function CompanyPage({ id }) {
  const { db, session } = useStore();
  const co = company(db, id);
  if (!co) return <EmptyState title="Company not found" />;
  const employed = myGuards(db, id).length;
  const everyone = new Set(db.employments.filter((e) => e.companyId === id).map((e) => e.guardId)).size;
  const guardJobs = session.kind === 'guard' ? db.employments.filter((e) => e.companyId === id && e.guardId === session.guardId) : [];
  const guardReqs = session.kind === 'guard' ? db.requests.filter((r) => r.companyId === id && r.guardId === session.guardId) : [];
  const shared = session.kind === 'company' && session.companyId !== id
    ? [...new Set(db.employments.filter((e) => e.companyId === id).map((e) => e.guardId))].filter((g) => db.employments.some((e) => e.guardId === g && e.companyId === session.companyId))
    : [];

  return (
    <div className="stack">
      <section className="card id-card">
        <div className="id-main">
          <OrgMark company={co} size={96} />
          <div className="grow">
            <div className="eyebrow">ProCheQ member since {fmtMonth(co.since)}</div>
            <h1>{co.name}</h1>
            <div className="chips mt-10">
              <Badge tone="info" icon={SealCheck}>Licensed security company</Badge>
              <Badge><span className="mono">{co.reg}</span></Badge>
            </div>
          </div>
        </div>
        <dl className="id-facts">
          <div><dt><MapPin size={13} /> Head office</dt><dd>{co.city}</dd></div>
          <div><dt><Phone size={13} /> Phone</dt><dd>{co.phone}</dd></div>
          <div><dt><Envelope size={13} /> Email</dt><dd>{co.email}</dd></div>
          <div><dt>Guards</dt><dd>{employed} employed now · {everyone} on record</dd></div>
        </dl>
      </section>

      {session.kind === 'guard' && (
        <Card title="You and this company">
          <ul className="list-rows">
            {guardJobs.map((e) => (
              <li key={e.id}>
                <span><b>{e.role}</b> <span className="muted">· {fmtMonth(e.start)} – {e.end ? fmtMonth(e.end) : 'now'}</span></span>
                {e.end ? <Badge>{e.exit.reason}</Badge> : <Badge tone="ok" dot>Current job</Badge>}
              </li>
            ))}
            {guardReqs.map((r) => (
              <li key={r.id}>
                <span>Asked to see your full record · {fmtDate(r.askedAt)}</span>
                <RequestBadge req={r} />
              </li>
            ))}
            {!guardJobs.length && !guardReqs.length && <EmptyState compact body="You have not worked for this company and they have not asked about you." />}
          </ul>
          {guardReqs.some(isActive) && <p className="small muted mt-10">They can see your full record until the date shown. You can withdraw it under Requests and access.</p>}
        </Card>
      )}

      {shared.length > 0 && (
        <Card title="Guards who worked for both of you">
          <ul className="list-rows">
            {shared.map((gid) => (
              <li key={gid}><GuardCell id={gid} /></li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
