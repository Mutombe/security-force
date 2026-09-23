import { useMemo, useState } from 'react';
import {
  ArrowRight, ArrowsLeftRight, BellRinging, CheckCircle, ClockCountdown, Handshake, LockKey, MagnifyingGlass, Plus, ProhibitInset,
  ShieldCheck, Warning, XCircle,
} from '@phosphor-icons/react';
import { useStore } from '../../store';
import {
  SCOPES, company, currentEmployment, deniedHint, employmentsOf, grantActive, guardById, scopeLabel, scopeShort, slaStatus,
} from '../../access';
import {
  Badge, Button, ConfirmModal, DataTable, Drawer, EmptyState, Field, FilterSelect, Menu, Modal, PageHead, SearchInput, Segmented, Tabs,
  addDays, daysUntil, fmtDate, fmtMonth, fromNow, hoursUntil,
} from '../../ui';
import { CompanyCell, GuardCell, PermissionNote, RequestStatus, SlaBadge, EntityLink } from '../../components';
import { RequestVerificationModal } from '../../modals';
import { Timeline, firstName } from './shared';
import './trust.css';
import '../detail/detail.css';

const OPEN = ['pending', 'awaiting_consent'];
const CLOSED = ['approved', 'declined', 'withdrawn', 'expired'];
const DECLINE_REASONS = [
  'No matching employment record',
  'Consent could not be confirmed',
  'Request goes beyond what the guard consented to',
  'Records are under legal hold',
  'Other',
];

const CONSENT = {
  granted: { label: 'Consent given', tone: 'ok' },
  offline: { label: 'Signed form', tone: 'info' },
  pending: { label: 'Awaiting guard', tone: 'warn' },
  declined: { label: 'Guard declined', tone: 'bad' },
};

function ScopeChips({ req }) {
  const released = req.status === 'approved';
  return (
    <span className="tr-scopes">
      {req.requestedScopes.map((s) => (
        <span key={s} className={`tr-scope ${released ? (req.releasedScopes.includes(s) ? 'is-released' : 'is-withheld') : ''}`}>
          {scopeShort(s)}
        </span>
      ))}
    </span>
  );
}

const grantFor = (db, req) => db.grants.find((g) => g.refId === req.id);

function AccessBadge({ db, req }) {
  if (req.status !== 'approved') return null;
  const g = grantFor(db, req);
  if (g?.revokedAt) return <Badge tone="neutral" icon={ProhibitInset}>Access revoked</Badge>;
  const d = daysUntil(req.accessExpiresAt);
  if (d < 0) return <Badge tone="neutral" icon={LockKey}>Access expired</Badge>;
  return (
    <Badge tone={d <= 5 ? 'warn' : 'ok'} icon={ClockCountdown}>
      Access {d === 0 ? 'ends today' : `${d}d left`}
    </Badge>
  );
}

export default function Verification({ go, id }) {
  const { db, session, can } = useStore();
  const me = session.companyId;
  const [tab, setTab] = useState('received');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [sla, setSla] = useState('');
  const [newReq, setNewReq] = useState(false);

  const mine = db.requests.filter((r) => r.toCompanyId === me || r.fromCompanyId === me);
  const received = mine.filter((r) => r.toCompanyId === me && r.status === 'pending');
  const sent = mine.filter((r) => r.fromCompanyId === me && OPEN.includes(r.status));
  const closed = mine.filter((r) => CLOSED.includes(r.status));
  const overdueIn = received.filter((r) => hoursUntil(r.dueAt) < 0).length;
  const base = { received, sent, closed }[tab];

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return base
      .filter((r) => !status || r.status === status)
      .filter((r) => !sla || (sla === 'overdue' ? hoursUntil(r.dueAt) < 0 && OPEN.includes(r.status) : hoursUntil(r.dueAt) < 24 && OPEN.includes(r.status)))
      .filter((r) => {
        if (!t) return true;
        const g = guardById(db, r.guardId);
        return g.name.toLowerCase().includes(t) || g.id.toLowerCase().includes(t);
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [base, q, status, sla, db]);

  const open = id ? mine.find((r) => r.id === id) : null;
  const co = company(db, me);
  const statusOpts = tab === 'closed' ? ['approved', 'declined', 'withdrawn', 'expired'] : tab === 'sent' ? ['pending', 'awaiting_consent'] : ['pending'];
  const STATUS_LABEL = { pending: 'Pending', awaiting_consent: 'Awaiting consent', approved: 'Released', declined: 'Declined', withdrawn: 'Withdrawn', expired: 'Expired' };

  const columns = [
    { key: 'guard', header: 'Guard', width: 'minmax(0, 1.6fr)', mobile: 'primary', sort: (r) => guardById(db, r.guardId).name, render: (r) => <GuardCell id={r.guardId} /> },
    {
      key: 'counterpart',
      header: tab === 'received' ? 'Requested by' : tab === 'sent' ? 'Asked' : 'Counterpart',
      width: 'minmax(0, 1.3fr)',
      mobile: 'secondary',
      sort: (r) => company(db, r.fromCompanyId === me ? r.toCompanyId : r.fromCompanyId).name,
      render: (r) => <CompanyCell id={r.fromCompanyId === me ? r.toCompanyId : r.fromCompanyId} size={24} sub={r.fromCompanyId === me ? 'You asked' : 'Asked you'} />,
    },
    { key: 'scopes', header: 'Scope', width: 'minmax(0, 1.4fr)', mobile: 'meta', render: (r) => <ScopeChips req={r} /> },
    { key: 'consent', header: 'Consent', width: '130px', mobile: 'meta', render: (r) => <Badge tone={CONSENT[r.consent]?.tone}>{CONSENT[r.consent]?.label ?? r.consent}</Badge> },
    {
      key: 'due',
      header: tab === 'closed' ? 'Access' : 'Response due',
      width: '140px',
      mobile: 'meta',
      sort: (r) => (tab === 'closed' ? r.accessExpiresAt ?? '' : r.dueAt),
      render: (r) => (tab === 'closed' ? <AccessBadge db={db} req={r} /> : <SlaBadge req={r} />),
    },
    { key: 'status', header: 'Status', width: '140px', mobile: 'aside', sort: (r) => r.status, render: (r) => <RequestStatus req={r} /> },
    { key: 'actions', header: '', width: '40px', render: (r) => <RowMenu req={r} go={go} /> },
  ];

  return (
    <div className="stack">
      <PageHead
        title="Verification"
        sub="Employers release restricted records to each other only with the guard's consent, and only for a limited time. Every step is logged and visible to the guard."
        actions={
          <Button icon={Plus} onClick={() => setNewReq(true)} disabledReason={deniedHint(session, 'verification.request')}>
            New request
          </Button>
        }
      />

      {overdueIn > 0 && (
        <div className="notice notice-bad">
          <Warning size={16} />
          <span>
            <b>{overdueIn}</b> request{overdueIn > 1 ? 's are' : ' is'} past your {co.policy.slaHours}-hour response target. Overdue answers count against your company's
            standing with the regulator.
          </span>
        </div>
      )}

      <Tabs
        value={tab}
        onChange={(t) => {
          setTab(t);
          setStatus('');
          setSla('');
        }}
        tabs={[
          { key: 'received', label: 'Received', count: received.length, alert: overdueIn > 0 },
          { key: 'sent', label: 'Sent', count: sent.length },
          { key: 'closed', label: 'Closed', count: closed.length },
        ]}
      />

      <div className="tr-toolbar">
        <SearchInput value={q} onChange={setQ} placeholder="Search by guard name or ID" />
        <FilterSelect label={status ? STATUS_LABEL[status] : 'Status'} value={status} onChange={setStatus} options={[{ value: '', label: 'Any status' }, ...statusOpts.map((s) => ({ value: s, label: STATUS_LABEL[s] }))]} />
        {tab !== 'closed' && (
          <FilterSelect
            label={sla === 'overdue' ? 'Overdue' : sla === 'soon' ? 'Due within 24h' : 'Deadline'}
            value={sla}
            onChange={setSla}
            options={[{ value: '', label: 'Any deadline' }, { value: 'overdue', label: 'Overdue only' }, { value: 'soon', label: 'Due within 24h or overdue' }]}
          />
        )}
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        onRowClick={(r) => go('verification', { id: r.id })}
        rowClass={(r) => (OPEN.includes(r.status) && hoursUntil(r.dueAt) < 0 ? 'tr-overdue-row' : '')}
        empty={
          <EmptyState
            icon={Handshake}
            title={tab === 'received' ? 'No requests waiting on you' : tab === 'sent' ? 'No open requests' : 'Nothing closed yet'}
            body={tab === 'sent' ? 'Ask a guard’s previous employers to verify their record before you hire.' : 'Requests appear here once the guard has consented.'}
            action={tab === 'sent' && <Button variant="ghost" icon={Plus} onClick={() => setNewReq(true)} disabledReason={deniedHint(session, 'verification.request')}>New request</Button>}
          />
        }
      />

      {open && <RequestDrawer req={open} onClose={() => go('verification')} go={go} />}
      {newReq && <NewRequestModal onClose={() => setNewReq(false)} />}
    </div>
  );
}

// ------------------------------------------------------------------ row menu
function RowMenu({ req, go }) {
  const { db, session, can } = useStore();
  const me = session.companyId;
  const [modal, setModal] = useState(null);
  const isSource = req.toCompanyId === me;
  const isRequester = req.fromCompanyId === me;
  const g = grantFor(db, req);
  const items = [
    { label: 'Open details', icon: ArrowRight, onClick: () => go('verification', { id: req.id }) },
    isSource && req.status === 'pending' && { label: 'Release records', icon: CheckCircle, onClick: () => setModal('release'), disabled: !can('verification.release'), hint: deniedHint(session, 'verification.release') },
    isSource && req.status === 'pending' && { label: 'Decline', icon: XCircle, onClick: () => setModal('decline'), disabled: !can('verification.release'), hint: deniedHint(session, 'verification.release') },
    isRequester && OPEN.includes(req.status) && { label: 'Send reminder', icon: BellRinging, onClick: () => setModal('remind'), disabled: !can('verification.request'), hint: deniedHint(session, 'verification.request') },
    isRequester && OPEN.includes(req.status) && { divider: true },
    isRequester && OPEN.includes(req.status) && { label: 'Withdraw request', icon: ProhibitInset, danger: true, onClick: () => setModal('withdraw'), disabled: !can('verification.request'), hint: deniedHint(session, 'verification.request') },
    isSource && req.status === 'approved' && g && grantActive(g) && { label: 'Revoke access early', icon: LockKey, danger: true, onClick: () => setModal('revoke'), disabled: !can('verification.release'), hint: deniedHint(session, 'verification.release') },
  ];
  return (
    <>
      <Menu items={items} label="Request actions" />
      <RequestModals req={req} modal={modal} setModal={setModal} />
    </>
  );
}

// ------------------------------------------------------------------ action modals (shared by row menu + drawer)
function RequestModals({ req, modal, setModal }) {
  const close = () => setModal(null);
  if (modal === 'release') return <ReleaseModal req={req} onClose={close} />;
  if (modal === 'decline') return <DeclineModal req={req} onClose={close} />;
  if (modal === 'withdraw') return <WithdrawConfirm req={req} onClose={close} />;
  if (modal === 'revoke') return <RevokeConfirm req={req} onClose={close} />;
  if (modal === 'remind') return <RemindConfirm req={req} onClose={close} />;
  return null;
}

/** Everything the source company holds that a request touches, computed live. */
function sharePreview(db, req) {
  const recs = db.records.filter((r) => r.guardId === req.guardId && r.companyId === req.toCompanyId && !r.retracted);
  const emps = db.employments.filter((e) => e.guardId === req.guardId && e.companyId === req.toCompanyId);
  const responses = db.responses.filter((x) => x.guardId === req.guardId && x.companyId === req.toCompanyId);
  const openFor = (scope) =>
    responses.filter((x) => {
      if (x.status !== 'open' && x.status !== 'escalated') return false;
      if (scope === 'separation') return x.targetType === 'employment';
      const r = recs.find((y) => y.id === x.targetId);
      return x.targetType === 'record' && r?.type === scope;
    });
  return {
    attendance: { value: emps.map((e) => `${e.attendance}%`).join(', ') || '—', sub: emps.map((e) => `${fmtMonth(e.start)} – ${fmtMonth(e.end)}`).join(', ') || 'No employment on file' },
    incident: { value: recs.filter((r) => r.type === 'incident').length, sub: 'incident reports' },
    disciplinary: { value: recs.filter((r) => r.type === 'disciplinary').length, sub: 'disciplinary actions' },
    separation: {
      value: emps.find((e) => e.separation)?.separation.category ?? 'Current',
      sub: emps.find((e) => e.separation) ? `Rehire: ${emps.find((e) => e.separation).separation.rehire}` : 'Still employed',
    },
    openFor,
    responses,
  };
}

function ReleaseModal({ req, onClose }) {
  const { db, session, act } = useStore();
  const me = session.companyId;
  const policy = company(db, me).policy;
  const g = guardById(db, req.guardId);
  const requester = company(db, req.fromCompanyId);
  const [scopes, setScopes] = useState(req.requestedScopes);
  const durations = [7, 14, 30, 60].filter((d) => d <= policy.accessDays);
  const [days, setDays] = useState(String(durations[durations.length - 1] ?? policy.accessDays));
  const [note, setNote] = useState('');
  const prev = sharePreview(db, req);
  const disputed = scopes.flatMap((s) => prev.openFor(s));
  const toggle = (k) => setScopes((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));

  const release = () =>
    act({
      key: req.id,
      pending: 'Releasing records…',
      success: `Released ${scopes.length} of ${req.requestedScopes.length} to ${requester.name}`,
      touches: ['requests', 'grants'],
      undo: true,
      apply: (d, t) => {
        const r = d.requests.find((x) => x.id === req.id);
        const expiresAt = addDays(t.now, Number(days));
        Object.assign(r, { status: 'approved', releasedScopes: scopes, accessExpiresAt: expiresAt, respondedAt: t.now, respondedBy: t.actor.user, responseNote: note.trim() });
        d.grants.unshift({ id: `G-${r.id}`, guardId: r.guardId, viewerCompanyId: r.fromCompanyId, sourceCompanyId: r.toCompanyId, scopes, via: 'request', refId: r.id, createdAt: t.now, expiresAt, revokedAt: null });
        t.log('Approved verification', `Released ${scopes.map(scopeShort).join(', ')} of ${g.name} to ${requester.name} for ${days} days`, { guardId: g.id });
        t.notify(`company:${r.fromCompanyId}`, { title: 'Records released', body: `${t.actor.name} released ${scopes.length} item(s) about ${g.name}. Access lasts ${days} days.`, link: { name: 'guard', params: { id: g.id } } });
        t.notify(`guard:${g.id}`, { title: 'Your records were shared', body: `${t.actor.name} shared ${scopes.map(scopeShort).join(', ').toLowerCase()} with ${requester.name} until ${fmtDate(expiresAt)}.`, link: { name: 'access' } });
      },
    }).then(onClose);

  return (
    <Modal
      title="Release records"
      subtitle={`${g.name} → ${requester.name}`}
      icon={CheckCircle}
      size="md"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={release} disabled={!scopes.length}>
            Release {scopes.length} of {req.requestedScopes.length}
          </Button>
        </>
      }
    >
      <p className="muted small">You can only release what was requested and consented to. Any response the guard has added travels with the record it answers.</p>
      <div className="option-list">
        {req.requestedScopes.map((s) => (
          <label key={s} className={`option option-rich ${scopes.includes(s) ? 'on' : ''}`}>
            <input type="checkbox" checked={scopes.includes(s)} onChange={() => toggle(s)} />
            <span className="grow">
              <b>{scopeLabel(s)}</b>
              <span className="option-sub">
                {typeof prev[s].value === 'number' ? `${prev[s].value} ${prev[s].sub}` : `${prev[s].value} · ${prev[s].sub}`}
              </span>
            </span>
            {prev.openFor(s).length > 0 && <Badge tone="warn">Disputed</Badge>}
          </label>
        ))}
      </div>
      <Field label="Access lasts" hint={`Your policy allows up to ${policy.accessDays} days. ${firstName(g.name)} can revoke access sooner.`}>
        <Segmented value={days} onChange={setDays} options={durations.map((d) => ({ value: String(d), label: `${d} days` }))} />
      </Field>
      <Field label="Note to requester" optional>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Released per applicant consent." />
      </Field>
      {disputed.length > 0 && (
        <div className="notice notice-warn">
          <Warning size={16} />
          <span>
            {firstName(g.name)} has {disputed.length} unresolved response{disputed.length > 1 ? 's' : ''} on what you're releasing. {requester.name} will see the
            response alongside the record and that the dispute is still open.
          </span>
        </div>
      )}
    </Modal>
  );
}

function DeclineModal({ req, onClose }) {
  const { db, act } = useStore();
  const g = guardById(db, req.guardId);
  const requester = company(db, req.fromCompanyId);
  const [reason, setReason] = useState(DECLINE_REASONS[0]);
  const [detail, setDetail] = useState('');
  const valid = reason !== 'Other' || detail.trim().length >= 10;
  const decline = () =>
    act({
      key: req.id,
      pending: 'Declining request…',
      success: 'Request declined',
      touches: ['requests'],
      undo: true,
      apply: (d, t) => {
        const r = d.requests.find((x) => x.id === req.id);
        const note = reason === 'Other' ? detail.trim() : `${reason}${detail.trim() ? ` — ${detail.trim()}` : ''}`;
        Object.assign(r, { status: 'declined', respondedAt: t.now, respondedBy: t.actor.user, responseNote: note });
        t.log('Declined verification', `${g.name} — request from ${requester.name}: ${note}`, { guardId: g.id });
        t.notify(`company:${r.fromCompanyId}`, { title: 'Verification declined', body: `${t.actor.name} declined your request about ${g.name}: ${note}`, link: { name: 'verification', params: { id: r.id } } });
        t.notify(`guard:${g.id}`, { title: 'A request about you was declined', body: `${t.actor.name} did not release records to ${requester.name}.`, link: { name: 'access' } });
      },
    }).then(onClose);
  return (
    <Modal
      title="Decline request"
      subtitle={`${g.name} · from ${requester.name}`}
      icon={XCircle}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={decline} disabled={!valid}>
            Decline
          </Button>
        </>
      }
    >
      <Field label="Reason">
        <select value={reason} onChange={(e) => setReason(e.target.value)}>
          {DECLINE_REASONS.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </Field>
      <Field label={reason === 'Other' ? 'Explain' : 'Additional detail'} optional={reason !== 'Other'} hint="Shared with the requesting company and the guard.">
        <textarea rows={3} value={detail} onChange={(e) => setDetail(e.target.value)} />
      </Field>
    </Modal>
  );
}

function WithdrawConfirm({ req, onClose }) {
  const { db, act } = useStore();
  const g = guardById(db, req.guardId);
  const target = company(db, req.toCompanyId);
  return (
    <ConfirmModal
      title="Withdraw request?"
      body={`${target.name} will no longer be asked about ${g.name}. You can send a new request later.`}
      confirmLabel="Withdraw"
      onClose={onClose}
      onConfirm={() =>
        act({
          key: req.id,
          pending: 'Withdrawing…',
          success: 'Request withdrawn',
          touches: ['requests'],
          undo: true,
          apply: (d, t) => {
            const r = d.requests.find((x) => x.id === req.id);
            const wasPending = r.status === 'pending';
            Object.assign(r, { status: 'withdrawn', respondedAt: t.now, respondedBy: t.actor.user, responseNote: 'Withdrawn by requester.' });
            t.log('Withdrew verification', `${g.name} — request to ${target.name}`, { guardId: g.id });
            if (wasPending) t.notify(`company:${r.toCompanyId}`, { title: 'Request withdrawn', body: `${t.actor.name} withdrew its request about ${g.name}.`, link: { name: 'verification' } });
            t.notify(`guard:${g.id}`, { title: 'Request withdrawn', body: `${t.actor.name} withdrew its verification request.`, link: { name: 'consents' } });
          },
        })
      }
    />
  );
}

function RevokeConfirm({ req, onClose }) {
  const { db, act } = useStore();
  const g = guardById(db, req.guardId);
  const viewer = company(db, req.fromCompanyId);
  return (
    <ConfirmModal
      title="Revoke access early?"
      body={`${viewer.name} will immediately lose access to the records you released about ${g.name}. Use this if the records were released in error or the hiring decision is complete.`}
      confirmLabel="Revoke access"
      onClose={onClose}
      onConfirm={() =>
        act({
          key: req.id,
          pending: 'Revoking access…',
          success: `Access revoked for ${viewer.name}`,
          touches: ['grants', 'requests'],
          undo: true,
          apply: (d, t) => {
            const gr = d.grants.find((x) => x.refId === req.id);
            if (gr) gr.revokedAt = t.now;
            d.requests.find((x) => x.id === req.id).revokedAt = t.now;
            t.log('Revoked access', `${viewer.name} can no longer see records about ${g.name}`, { guardId: g.id });
            t.notify(`company:${viewer.id}`, { title: 'Access revoked', body: `${t.actor.name} revoked your access to records about ${g.name}.`, link: { name: 'verification', params: { id: req.id } } });
            t.notify(`guard:${g.id}`, { title: 'Access to your records ended', body: `${viewer.name} can no longer see what ${t.actor.name} released.`, link: { name: 'access' } });
          },
        })
      }
    />
  );
}

function RemindConfirm({ req, onClose }) {
  const { db, act } = useStore();
  const g = guardById(db, req.guardId);
  const awaitingGuard = req.status === 'awaiting_consent';
  const target = awaitingGuard ? g.name : company(db, req.toCompanyId).name;
  const last = req.lastReminderAt && hoursUntil(req.lastReminderAt) > -24;
  if (last)
    return (
      <Modal title="Reminder already sent" size="sm" icon={BellRinging} onClose={onClose} footer={<Button onClick={onClose}>OK</Button>}>
        <p className="confirm-body">
          You reminded {target} {fromNow(req.lastReminderAt)}. To avoid pressuring anyone, reminders are limited to one every 24 hours.
        </p>
      </Modal>
    );
  return (
    <ConfirmModal
      title="Send a reminder?"
      tone="info"
      icon={BellRinging}
      body={awaitingGuard ? `${g.name} will get a notification asking them to review your consent request. They are free to decline.` : `${target} will be reminded that your request about ${g.name} is waiting. ${slaStatus(req)?.label ?? ''}.`}
      confirmLabel="Send reminder"
      onClose={onClose}
      onConfirm={() =>
        act({
          key: req.id,
          pending: 'Sending reminder…',
          success: `Reminder sent to ${target}`,
          touches: ['requests'],
          apply: (d, t) => {
            d.requests.find((x) => x.id === req.id).lastReminderAt = t.now;
            t.log('Sent reminder', `Verification of ${g.name} — reminded ${target}`, { guardId: g.id });
            if (awaitingGuard) t.notify(`guard:${g.id}`, { title: 'Reminder: consent request', body: `${t.actor.name} is waiting for your decision.`, link: { name: 'consents' } });
            else t.notify(`company:${req.toCompanyId}`, { title: 'Reminder: verification request', body: `${t.actor.name} is waiting on your answer about ${g.name}.`, link: { name: 'verification', params: { id: req.id } } });
          },
        })
      }
    />
  );
}

// ------------------------------------------------------------------ drawer
function RequestDrawer({ req, onClose, go }) {
  const { db, session, can } = useStore();
  const me = session.companyId;
  const [modal, setModal] = useState(null);
  const g = guardById(db, req.guardId);
  const from = company(db, req.fromCompanyId);
  const to = company(db, req.toCompanyId);
  const isSource = req.toCompanyId === me;
  const isRequester = req.fromCompanyId === me;
  const grant = grantFor(db, req);
  const prev = sharePreview(db, req);
  const cur = currentEmployment(db, g.id);

  const consentStep =
    req.consent === 'granted'
      ? { label: `${firstName(g.name)} gave consent in the app`, at: req.consentAt, by: g.name, state: 'done' }
      : req.consent === 'offline'
        ? { label: 'Signed consent form on file', at: req.consentAt, by: req.createdBy, state: 'done' }
        : req.consent === 'declined'
          ? { label: `${firstName(g.name)} declined consent`, at: req.consentAt, state: 'bad' }
          : { label: `Waiting for ${firstName(g.name)} to consent`, state: req.status === 'withdrawn' ? 'todo' : 'current' };

  const answerStep =
    req.status === 'approved'
      ? { label: `Released ${req.releasedScopes.length} of ${req.requestedScopes.length} by ${to.name}`, at: req.respondedAt, by: req.respondedBy, note: req.responseNote, state: 'done' }
      : req.status === 'declined'
        ? { label: `Declined by ${to.name}`, at: req.respondedAt, by: req.respondedBy, note: req.responseNote, state: 'bad' }
        : req.status === 'withdrawn'
          ? { label: `Withdrawn by ${from.name}`, at: req.respondedAt, by: req.respondedBy, state: 'bad' }
          : req.status === 'expired'
            ? { label: 'Expired without an answer', state: 'bad' }
            : { label: `${to.name} to respond · ${slaStatus(req)?.label ?? ''}`, note: `Target: ${fmtDate(req.dueAt)}`, state: req.status === 'pending' ? 'current' : 'todo' };

  const steps = [{ label: `Requested by ${from.name}`, at: req.createdAt, by: req.createdBy, state: 'done' }, consentStep, answerStep];
  if (req.status === 'approved')
    steps.push(
      grant?.revokedAt
        ? { label: 'Access revoked early', at: grant.revokedAt, state: 'bad' }
        : daysUntil(req.accessExpiresAt) < 0
          ? { label: 'Access expired', at: req.accessExpiresAt, state: 'done' }
          : { label: `Access ends ${fmtDate(req.accessExpiresAt)} (${daysUntil(req.accessExpiresAt)} days)`, state: 'current' },
    );

  const footer = (
    <>
      {isSource && req.status === 'pending' && (
        <>
          <Button variant="danger-ghost" icon={XCircle} onClick={() => setModal('decline')} disabledReason={deniedHint(session, 'verification.release')}>
            Decline
          </Button>
          <Button icon={CheckCircle} onClick={() => setModal('release')} disabledReason={deniedHint(session, 'verification.release')}>
            Review and release
          </Button>
        </>
      )}
      {isRequester && OPEN.includes(req.status) && (
        <>
          <Button variant="danger-ghost" icon={ProhibitInset} onClick={() => setModal('withdraw')} disabledReason={deniedHint(session, 'verification.request')}>
            Withdraw
          </Button>
          <Button variant="ghost" icon={BellRinging} onClick={() => setModal('remind')} disabledReason={deniedHint(session, 'verification.request')}>
            Send reminder
          </Button>
        </>
      )}
      {isRequester && req.status === 'approved' && grant && grantActive(grant) && (
        <Button icon={ArrowRight} onClick={() => go('guard', { id: g.id })}>
          View released records
        </Button>
      )}
      {isSource && req.status === 'approved' && grant && grantActive(grant) && (
        <Button variant="danger-ghost" icon={LockKey} onClick={() => setModal('revoke')} disabledReason={deniedHint(session, 'verification.release')}>
          Revoke access early
        </Button>
      )}
    </>
  );
  const hasFooter = (isSource && (req.status === 'pending' || (req.status === 'approved' && grant && grantActive(grant)))) || (isRequester && (OPEN.includes(req.status) || (req.status === 'approved' && grant && grantActive(grant))));

  return (
    <Drawer
      title={`Verification · ${g.name}`}
      subtitle={`${req.id} · requested ${fromNow(req.createdAt)}`}
      onClose={onClose}
      headerExtra={<RequestStatus req={req} />}
      footer={hasFooter ? footer : null}
    >
      <div className="tr-parties">
        <div>
          <span className="tr-party-label">Requested by</span>
          <CompanyCell company={from} size={30} sub={req.createdBy} />
        </div>
        <ArrowsLeftRight size={18} />
        <div>
          <span className="tr-party-label">Records held by</span>
          <CompanyCell company={to} size={30} />
        </div>
      </div>

      <section className="tr-section">
        <div className="tr-section-title">About</div>
        <GuardCell guard={g} size={42} sub={`${g.id} · ${cur ? `${cur.position}, ${company(db, cur.companyId).name}` : 'Not currently employed'}`} />
        {req.purpose && <p className="tr-purpose">{req.purpose}</p>}
      </section>

      <section className="tr-section">
        <div className="tr-section-title">Progress</div>
        <Timeline steps={steps} />
      </section>

      <section className="tr-section">
        <div className="tr-section-title">Scope</div>
        <div className="tr-scope-table">
          {SCOPES.filter((s) => req.requestedScopes.includes(s.key)).map((s) => {
            const released = req.releasedScopes.includes(s.key);
            return (
              <div key={s.key} className="tr-scope-row">
                <span>{s.label}</span>
                {req.status === 'approved' ? (
                  released ? <Badge tone="ok" icon={CheckCircle}>Released</Badge> : <Badge>Withheld</Badge>
                ) : req.status === 'pending' || req.status === 'awaiting_consent' ? (
                  <Badge tone="warn">Requested</Badge>
                ) : (
                  <Badge>Not released</Badge>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {isSource && (
        <section className="tr-section">
          <div className="tr-section-title">What you hold (preview)</div>
          <div className="tr-preview">
            {SCOPES.map((s) => (
              <div key={s.key} className={`tr-preview-item ${req.requestedScopes.includes(s.key) ? '' : 'is-off'}`}>
                <b>{prev[s.key].value}</b>
                <span>{typeof prev[s.key].value === 'number' ? prev[s.key].sub : `${s.short} · ${prev[s.key].sub}`}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {isSource && prev.responses.length > 0 && (
        <section className="tr-section">
          <div className="tr-section-title">Guard responses on these records</div>
          {prev.responses.map((r) => (
            <div key={r.id} className="tr-voice">
              <div className="tr-voice-head">
                <span>
                  <Handshake size={14} /> {firstName(g.name)}'s response
                </span>
                <Badge tone={r.status === 'open' || r.status === 'escalated' ? 'warn' : 'neutral'}>{r.status === 'open' ? 'Unresolved' : r.status}</Badge>
              </div>
              <p>{r.text}</p>
            </div>
          ))}
          <p className="muted small">Responses are always shared with the record they answer.</p>
        </section>
      )}

      {isRequester && req.status === 'approved' && (
        <div className="notice notice-ok">
          <ShieldCheck size={16} />
          <span>
            Released records now appear on {firstName(g.name)}'s passport for your company. <AccessBadge db={db} req={req} />
          </span>
        </div>
      )}
      {req.status === 'pending' && isRequester && (
        <div className="notice">
          <ClockCountdown size={16} />
          <span>
            {to.name} aims to answer within {to.policy.slaHours} hours. You can send one reminder a day.
          </span>
        </div>
      )}

      <RequestModals req={req} modal={modal} setModal={setModal} />
    </Drawer>
  );
}

// ------------------------------------------------------------------ new request
function NewRequestModal({ onClose }) {
  const { db, session } = useStore();
  const me = session.companyId;
  const co = company(db, me);
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState(null);
  const t = q.trim().toLowerCase();
  const results = t.length >= 2 ? db.guards.filter((g) => g.name.toLowerCase().includes(t) || g.id.toLowerCase().includes(t) || g.nationalId.toLowerCase() === t).slice(0, 8) : [];

  if (picked) return <RequestVerificationModal guardId={picked} onClose={onClose} />;

  return (
    <Modal title="New verification request" subtitle="Find the applicant in the network" icon={MagnifyingGlass} size="md" onClose={onClose}>
      {co.status !== 'active' ? (
        <PermissionNote>
          {co.name} is awaiting regulator approval. Once approved you can request records from other employers. Until then, guards' restricted records stay private to
          you.
        </PermissionNote>
      ) : (
        <>
          <SearchInput value={q} onChange={setQ} placeholder="Name, Workforce ID or full national ID" autoFocus />
          <div className="tr-guard-results">
            {results.map((g) => {
              const others = [...new Set(employmentsOf(db, g.id).map((e) => e.companyId))].filter((c) => c !== me);
              const cur = currentEmployment(db, g.id);
              return (
                <button key={g.id} type="button" className="tr-guard-result" disabled={!others.length} onClick={() => setPicked(g.id)}>
                  <GuardCell guard={g} size={36} sub={`${g.id} · ${cur ? company(db, cur.companyId).name : 'available'}`} />
                  <span className="grow" />
                  {others.length ? <Badge tone="info">{others.length} employer{others.length > 1 ? 's' : ''}</Badge> : <Badge>No other employers</Badge>}
                </button>
              );
            })}
            {t.length >= 2 && !results.length && <EmptyState compact icon={MagnifyingGlass} title="No one matches" body="Check the spelling, or ask the applicant for their Workforce ID." />}
            {t.length < 2 && <p className="muted small">Type at least two characters. National IDs must match exactly.</p>}
          </div>
        </>
      )}
    </Modal>
  );
}
