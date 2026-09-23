import { useState } from 'react';
import { ArrowRight, Check, Handshake, LockSimpleOpen, ShieldCheck, X } from '@phosphor-icons/react';
import { useStore } from '../../store';
import { SCOPES, company, grantActive, scopeShort } from '../../access';
import { Badge, Button, Card, ConfirmModal, DataTable, EmptyState, OrgMark, PageHead, addHours, daysUntil, fmtDate, fmtTime, fromNow } from '../../ui';
import { CompanyCell, EntityLink, RequestStatus } from '../../components';
import './guard.css';
import '../detail/detail.css';

export default function Consents() {
  const { db, session } = useStore();
  const me = session.guardId;
  const pending = db.requests.filter((r) => r.guardId === me && r.status === 'awaiting_consent');
  const history = db.requests.filter((r) => r.guardId === me && r.status !== 'awaiting_consent').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const grants = db.grants.filter((g) => g.guardId === me && grantActive(g)).sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));
  const [revoke, setRevoke] = useState(null);

  return (
    <div className="stack">
      <PageHead
        title="Consent requests"
        sub="Employers can only see your restricted records (attendance, incidents, disciplinary actions and separation details) when you agree. You choose exactly what they get."
      />

      <section className="stack-s">
        <h2 className="gd-h">Waiting for you {pending.length > 0 && <Badge tone="hivis">{pending.length}</Badge>}</h2>
        {pending.map((r) => (
          <ConsentCard key={r.id} req={r} />
        ))}
        {!pending.length && (
          <div className="card">
            <EmptyState compact icon={Handshake} title="Nothing to approve" body="When an employer asks to verify your history, the request appears here and on your phone." />
          </div>
        )}
      </section>

      <Card title="Who can see my restricted records now" subtitle="Access ends automatically on the date shown. You can end it sooner." icon={LockSimpleOpen}>
        {grants.length ? (
          <ul className="items">
            {grants.map((g) => (
              <li key={g.id} className="gd-grant">
                <OrgMark company={company(db, g.viewerCompanyId)} size={36} />
                <div className="grow">
                  <div className="item-title"><EntityLink kind="company" id={g.viewerCompanyId} className="dt2-inline-link">{company(db, g.viewerCompanyId).name}</EntityLink></div>
                  <div className="item-sub">
                    {g.via === 'share' ? 'Through your share code' : `Records from ${company(db, g.sourceCompanyId).name}`} · {g.scopes.map(scopeShort).join(', ')}
                  </div>
                </div>
                <Badge tone={daysUntil(g.expiresAt) <= 7 ? 'warn' : 'neutral'}>Ends {fromNow(g.expiresAt)}</Badge>
                <Button variant="danger-ghost" size="sm" onClick={() => setRevoke(g)}>
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState compact icon={ShieldCheck} body="No employer can see your restricted records right now." />
        )}
      </Card>

      <section className="stack-s">
        <h2 className="gd-h">Past requests</h2>
        <DataTable
          rows={history}
          columns={[
            { key: 'from', header: 'Asked by', width: 'minmax(180px, 1.4fr)', mobile: 'primary', sort: (r) => company(db, r.fromCompanyId).name, render: (r) => <CompanyCell id={r.fromCompanyId} sub={fmtDate(r.createdAt)} size={28} /> },
            { key: 'to', header: 'Records from', width: 'minmax(140px, 1fr)', mobile: 'secondary', render: (r) => <span className="gd-arrow"><ArrowRight size={13} /> <EntityLink kind="company" id={r.toCompanyId} className="dt2-inline-link">{company(db, r.toCompanyId).name}</EntityLink></span> },
            { key: 'scopes', header: 'Scope', width: 'minmax(180px, 1.4fr)', mobile: 'meta', render: (r) => <span className="muted small">{(r.status === 'approved' ? r.releasedScopes : r.requestedScopes).map(scopeShort).join(', ')}</span> },
            { key: 'consent', header: 'Your consent', width: '130px', mobile: 'meta', render: (r) => <Badge tone={r.consent === 'declined' ? 'bad' : 'ok'}>{r.consent === 'offline' ? 'Signed form' : r.consent === 'declined' ? 'Declined' : 'Given'}</Badge> },
            { key: 'status', header: 'Outcome', width: '120px', align: 'right', mobile: 'aside', sort: (r) => r.status, render: (r) => <RequestStatus req={r} /> },
          ]}
          empty={<EmptyState compact body="No past requests." />}
        />
      </section>

      {revoke && <RevokeModal grant={revoke} onClose={() => setRevoke(null)} />}
    </div>
  );
}

function ConsentCard({ req }) {
  const { db, act } = useStore();
  const [scopes, setScopes] = useState(req.requestedScopes);
  const from = company(db, req.fromCompanyId);
  const to = company(db, req.toCompanyId);
  const toggle = (k) => setScopes((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));

  const approve = () =>
    act({
      key: req.id,
      pending: 'Sending your consent…',
      success: `Consent given. ${to.name} has been asked to reply.`,
      touches: ['requests'],
      undo: true,
      apply: (d, t) => {
        const r = d.requests.find((x) => x.id === req.id);
        // The previous employer's reply clock starts when the guard consents.
        Object.assign(r, { consent: 'granted', consentAt: t.now, status: 'pending', requestedScopes: scopes, dueAt: addHours(t.now, to.policy?.slaHours ?? 72) });
        t.log('Gave consent', `${from.name} may request ${scopes.map(scopeShort).join(', ')} from ${to.name}`, { guardId: req.guardId });
        t.notify(`company:${to.id}`, { title: 'New verification request', body: `${from.name} asked about ${d.guards.find((g) => g.id === req.guardId).name}. The guard has consented.`, link: { name: 'verification' } });
        t.notify(`company:${from.id}`, { title: 'Consent given', body: `${t.actor.name} agreed to share ${scopes.map(scopeShort).join(', ').toLowerCase()} from ${to.name}.`, link: { name: 'verification' } });
      },
    });

  const decline = () =>
    act({
      key: req.id,
      pending: 'Declining…',
      success: 'Request declined. Nothing was shared.',
      touches: ['requests'],
      undo: true,
      apply: (d, t) => {
        Object.assign(d.requests.find((x) => x.id === req.id), { consent: 'declined', status: 'declined', respondedAt: t.now, responseNote: 'Declined by the guard.' });
        t.log('Declined consent', `${from.name} asked for records from ${to.name}`, { guardId: req.guardId });
        t.notify(`company:${from.id}`, { title: 'Consent declined', body: `${t.actor.name} did not agree to the verification request.`, link: { name: 'verification' } });
      },
    });

  return (
    <article className="card gd-consent">
      <div className="gd-consent-parties">
        <div className="gd-party">
          <OrgMark company={from} size={40} />
          <div>
            <span className="gd-party-label">Asking</span>
            <b><EntityLink kind="company" id={from.id} className="dt2-inline-link">{from.name}</EntityLink></b>
          </div>
        </div>
        <ArrowRight size={18} className="gd-party-arrow" />
        <div className="gd-party">
          <OrgMark company={to} size={40} />
          <div>
            <span className="gd-party-label">Wants your records from</span>
            <b><EntityLink kind="company" id={to.id} className="dt2-inline-link">{to.name}</EntityLink></b>
          </div>
        </div>
      </div>
      <p className="gd-purpose">
        <span className="muted">Purpose:</span> {req.purpose}
      </p>
      <div>
        <div className="gd-party-label">Choose what to share</div>
        <div className="options gd-scopes">
          {SCOPES.map((s) => {
            const asked = req.requestedScopes.includes(s.key);
            return (
              <label key={s.key} className={`option ${scopes.includes(s.key) ? 'on' : ''} ${asked ? '' : 'is-off'}`}>
                <input type="checkbox" disabled={!asked} checked={scopes.includes(s.key)} onChange={() => toggle(s.key)} />
                <span className="grow">{s.label}</span>
                {!asked && <span className="muted small">Not asked</span>}
              </label>
            );
          })}
        </div>
      </div>
      <p className="muted small">
        Sent {fmtTime(req.createdAt)} by {req.createdBy}. If you agree, {to.name} has {to.policy?.slaHours ?? 72} hours to reply, and access ends {company(db, req.fromCompanyId).policy?.accessDays ?? 30} days after release. Any responses you have added travel with your records.
      </p>
      <div className="gd-consent-actions">
        <Button variant="ghost" icon={X} onClick={decline}>
          Decline
        </Button>
        <Button icon={Check} onClick={approve} disabled={!scopes.length}>
          Share {scopes.length} of {req.requestedScopes.length}
        </Button>
      </div>
    </article>
  );
}

function RevokeModal({ grant, onClose }) {
  const { db, act } = useStore();
  const viewer = company(db, grant.viewerCompanyId);
  return (
    <ConfirmModal
      title={`End ${viewer.name}'s access?`}
      body={`${viewer.name} will immediately lose access to your ${grant.scopes.map(scopeShort).join(', ').toLowerCase()} records. They will be told access was withdrawn.`}
      confirmLabel="End access"
      onClose={onClose}
      onConfirm={() =>
        act({
          key: grant.id,
          pending: 'Ending access…',
          success: `${viewer.name} can no longer see your restricted records`,
          touches: ['grants'],
          undo: true,
          apply: (d, t) => {
            d.grants.find((g) => g.id === grant.id).revokedAt = t.now;
            t.log('Revoked access', `${viewer.name} — ${grant.scopes.map(scopeShort).join(', ')}`, { guardId: grant.guardId });
            t.notify(`company:${viewer.id}`, { title: 'Access withdrawn', body: `${t.actor.name} ended your access to their released records.`, link: { name: 'guard', params: { id: grant.guardId } } });
          },
        })
      }
    />
  );
}
