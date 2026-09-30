// Guard: requests to see your full record, who can see it now, and who checked you.
import { useState } from 'react';
import { Check, Eye, Handshake, ShieldCheck, X } from '@phosphor-icons/react';
import { useStore } from '../store';
import { ACCESS_DAYS, company, guardById, isActive } from '../access';
import { Badge, Button, Card, ConfirmModal, EmptyState, OrgMark, PageHead, addDays, fmtDate, fromNow } from '../ui';
import { CompanyCell, RequestBadge } from '../components';

export default function Access() {
  const { db, session, act } = useStore();
  const me = session.guardId;
  const guard = guardById(db, me);
  const [confirm, setConfirm] = useState(null);
  const mine = db.requests.filter((r) => r.guardId === me).sort((a, b) => b.askedAt.localeCompare(a.askedAt));
  const pending = mine.filter((r) => r.status === 'pending');
  const active = mine.filter(isActive);
  const past = mine.filter((r) => r.status !== 'pending' && !isActive(r));
  // One line per company, action and day (the newest), so repeat visits don't flood the list.
  const seen = new Set();
  const checks = db.activity
    .filter((a) => a.guardId === me && ['Checked profile', 'Checked at the gate', 'Asked to see full record'].includes(a.action))
    .sort((x, y) => y.at.localeCompare(x.at))
    .filter((a) => {
      const k = `${a.actorId}|${a.action}|${a.at.slice(0, 10)}`;
      return seen.has(k) ? false : seen.add(k);
    });

  const decide = (r, approve) =>
    act({
      pending: approve ? 'Approving…' : 'Declining…',
      success: approve ? `${company(db, r.companyId).name} can see your full record for ${ACCESS_DAYS} days` : 'Request declined',
      touches: ['requests'],
      undo: true,
      apply: (d, t) => {
        const x = d.requests.find((y) => y.id === r.id);
        x.status = approve ? 'approved' : 'declined';
        x.decidedAt = t.now;
        x.expiresAt = approve ? addDays(t.now, ACCESS_DAYS) : null;
        t.log(approve ? 'Approved full record' : 'Declined request', `${company(d, r.companyId).name}${approve ? ` for ${ACCESS_DAYS} days` : ''}`, { guardId: me });
      },
    });

  const withdraw = (r) =>
    act({
      pending: 'Withdrawing access…',
      success: `${company(db, r.companyId).name} can no longer see your full record`,
      touches: ['requests'],
      undo: true,
      apply: (d, t) => {
        const x = d.requests.find((y) => y.id === r.id);
        x.status = 'revoked';
        x.decidedAt = t.now;
        t.log('Withdrew access', company(d, r.companyId).name, { guardId: me });
      },
    });

  return (
    <div className="stack">
      <PageHead title="Requests and access" sub={`You decide who sees the private part of your record, ${guard.name.split(' ')[0]}.`} />

      <Card title="Waiting for you" subtitle={pending.length ? 'A company wants to see your full record' : 'No requests right now'} icon={Handshake}>
        <div className="req-cards">
          {pending.map((r) => {
            const co = company(db, r.companyId);
            return (
              <article className="req-card" key={r.id}>
                <div className="req-card-top">
                  <OrgMark company={co} size={48} />
                  <div className="grow">
                    <b>{co.name}</b>
                    <span className="muted small">asked {fromNow(r.askedAt)}</span>
                  </div>
                </div>
                <p className="req-reason">“{r.reason}”</p>
                <p className="small muted">
                  If you approve, they see your incidents, disciplinary actions, why you left each job and whether each employer would rehire you, with your replies. Access lasts {ACCESS_DAYS} days and you can withdraw it any time.
                </p>
                <div className="req-actions">
                  <Button variant="ghost" icon={X} onClick={() => decide(r, false)}>Decline</Button>
                  <Button icon={Check} onClick={() => decide(r, true)}>Approve</Button>
                </div>
              </article>
            );
          })}
          {!pending.length && <EmptyState compact icon={Handshake} body="When a company asks to see your full record, you'll approve or decline it here." />}
        </div>
      </Card>

      <div className="grid-2">
        <Card title="Who can see your full record" icon={ShieldCheck}>
          <ul className="list-rows">
            {active.map((r) => (
              <li key={r.id}>
                <CompanyCell id={r.companyId} sub={`Until ${fmtDate(r.expiresAt)}`} />
                <Button size="sm" variant="danger-ghost" onClick={() => setConfirm(r)}>Withdraw</Button>
              </li>
            ))}
            {!active.length && <EmptyState compact body="Nobody outside your employers can see your private record." />}
          </ul>
          {past.length > 0 && (
            <>
              <div className="sub-head">Earlier requests</div>
              <ul className="list-rows">
                {past.map((r) => (
                  <li key={r.id}>
                    <CompanyCell id={r.companyId} sub={fmtDate(r.askedAt)} />
                    <RequestBadge req={r} />
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        <Card title="Who checked you" subtitle="Every look at your profile is recorded" icon={Eye}>
          <ul className="list-rows">
            {checks.map((a) => (
              <li key={a.id}>
                {a.actorKind === 'company' ? <CompanyCell id={a.actorId} sub={`${a.action} · ${fromNow(a.at)}`} /> : (
                  <span className="cell-person">
                    <span className="gate-icon"><ShieldCheck size={18} /></span>
                    <span className="cell-person-text"><span className="cell-name">Gate check</span><span className="cell-sub">Someone confirmed your badge · {fromNow(a.at)}</span></span>
                  </span>
                )}
                {a.action === 'Asked to see full record' && <Badge tone="info">Asked</Badge>}
              </li>
            ))}
            {!checks.length && <EmptyState compact body="No one has checked your profile yet." />}
          </ul>
        </Card>
      </div>

      {confirm && (
        <ConfirmModal
          title="Withdraw access?"
          body={`${company(db, confirm.companyId).name} will stop seeing your private record straight away.`}
          confirmLabel="Withdraw access"
          onConfirm={() => withdraw(confirm)}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
