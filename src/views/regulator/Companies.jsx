import { useMemo, useState } from 'react';
import { ArrowCounterClockwise, Buildings, CheckCircle, Envelope, MapPin, Phone, Prohibit, ShieldCheck, Warning } from '@phosphor-icons/react';
import { useStore } from '../../store';
import { company, companyMembers, complianceIssues, expiryStatus } from '../../access';
import { Badge, Button, ConfirmModal, DataTable, Drawer, EmptyState, Field, FilterSelect, Modal, OrgMark, PageHead, SearchInput, fmtDate, fromNow } from '../../ui';
import { CompanyCell } from '../../components';
import { STATUS, companyMetrics } from './Overview';
import './regulator.css';

export default function Companies({ go, id }) {
  const { db } = useStore();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return db.companies
      .filter((c) => (!status || c.status === status) && (!t || c.name.toLowerCase().includes(t) || c.reg.toLowerCase().includes(t) || c.city.toLowerCase().includes(t)))
      .map((c) => companyMetrics(db, c));
  }, [db, q, status]);
  const open = id ? company(db, id) : null;

  const columns = [
    { key: 'co', header: 'Company', width: 'minmax(0, 1.8fr)', mobile: 'primary', sort: (m) => m.c.name, render: (m) => <CompanyCell company={m.c} size={32} sub={`${m.c.city} · ${m.c.reg}`} /> },
    {
      key: 'licence',
      header: 'Operating licence',
      width: '170px',
      mobile: 'meta',
      sort: (m) => m.c.licenceExpiry || '9999',
      render: (m) => {
        if (!m.c.licenceExpiry) return <Badge tone="warn">Not provided</Badge>;
        const s = expiryStatus(m.c.licenceExpiry, 90);
        return <Badge tone={s.tone}>{s.tone === 'ok' ? `To ${fmtDate(m.c.licenceExpiry)}` : s.label}</Badge>;
      },
    },
    { key: 'deployed', header: 'Deployed', width: '90px', align: 'right', mobile: 'meta', sort: (m) => m.deployed, render: (m) => <span className="rg-num" data-label="Deployed">{m.deployed}</span> },
    { key: 'sites', header: 'Sites', width: '70px', align: 'right', mobile: 'meta', sort: (m) => m.sites, render: (m) => <span className="rg-num" data-label="Sites">{m.sites}</span> },
    { key: 'sla', header: 'On time', width: '90px', align: 'right', mobile: 'meta', sort: (m) => m.slaRate ?? -1, render: (m) => <span className="rg-num" data-label="On time">{m.slaRate == null ? '—' : `${m.slaRate}%`}</span> },
    { key: 'joined', header: 'Joined', width: '120px', mobile: 'hidden', sort: (m) => m.c.joinedAt, render: (m) => <span className="small muted">{m.c.joinedAt ? fmtDate(m.c.joinedAt) : '—'}</span> },
    { key: 'status', header: 'Status', width: '160px', mobile: 'aside', sort: (m) => m.c.status, render: (m) => <Badge tone={STATUS[m.c.status][0]} dot>{STATUS[m.c.status][1]}</Badge> },
  ];

  const counts = (s) => db.companies.filter((c) => c.status === s).length;

  return (
    <div className="stack rg-page">
      <PageHead title="Companies" sub="Every security company in the network. Approve new members, review standing, and suspend a company that breaks the code of conduct." />
      <div className="toolbar">
        <SearchInput value={q} onChange={setQ} placeholder="Name, licence number or city" />
        <FilterSelect
          label={status ? STATUS[status][1] : 'Status'}
          value={status}
          onChange={setStatus}
          options={[{ value: '', label: 'Any status' }, { value: 'active', label: `Active (${counts('active')})` }, { value: 'pending', label: `Awaiting approval (${counts('pending')})` }, { value: 'suspended', label: `Suspended (${counts('suspended')})` }]}
        />
      </div>
      <DataTable columns={columns} rows={rows} rowKey={(m) => m.c.id} onRowClick={(m) => go('companies', { id: m.c.id })} empty={<EmptyState icon={Buildings} title="No companies match" />} />
      {open && <CompanyDrawer co={open} onClose={() => go('companies')} go={go} />}
    </div>
  );
}

function CompanyDrawer({ co, onClose, go }) {
  const { db, act } = useStore();
  const [modal, setModal] = useState(null);
  const m = companyMetrics(db, co);
  const members = companyMembers(db, co.id);
  const issues = complianceIssues(db, co.id);
  const lic = co.licenceExpiry ? expiryStatus(co.licenceExpiry, 90) : null;
  const activity = db.audit.filter((a) => a.actorId === co.id).slice(0, 8);
  const openReqs = db.requests.filter((r) => r.toCompanyId === co.id && r.status === 'pending').length;

  const approve = () =>
    act({
      key: co.id,
      pending: 'Approving company…',
      success: `${co.name} approved`,
      touches: ['companies'],
      undo: true,
      apply: (d, t) => {
        Object.assign(d.companies.find((c) => c.id === co.id), { status: 'active', approvedAt: t.now, joinedAt: co.joinedAt || t.now.slice(0, 10) });
        t.log('Approved company', `${co.name} (${co.reg})`);
        t.notify(`company:${co.id}`, { title: 'Your company is approved', body: 'You can now request verification from other employers in the network.', link: { name: 'verification' } });
      },
    });

  return (
    <Drawer
      title={co.name}
      subtitle={`${co.reg} · ${co.city}`}
      onClose={onClose}
      wide
      headerExtra={<Badge tone={STATUS[co.status][0]} dot>{STATUS[co.status][1]}</Badge>}
      footer={
        co.status === 'pending' ? (
          <>
            <Button variant="danger-ghost" icon={Prohibit} onClick={() => setModal('suspend')}>
              Reject
            </Button>
            <Button icon={CheckCircle} onClick={approve}>
              Approve membership
            </Button>
          </>
        ) : co.status === 'active' ? (
          <Button variant="danger-ghost" icon={Prohibit} onClick={() => setModal('suspend')}>
            Suspend company
          </Button>
        ) : (
          <Button icon={ArrowCounterClockwise} onClick={() => setModal('reinstate')}>
            Reinstate
          </Button>
        )
      }
    >
      <div className="rg-co-head">
        <OrgMark company={co} size={56} />
        <dl className="rg-co-facts">
          <div><dt><MapPin size={13} /> Office</dt><dd>{co.address || co.city}</dd></div>
          <div><dt><Phone size={13} /> Phone</dt><dd>{co.phone || '—'}</dd></div>
          <div><dt><Envelope size={13} /> Email</dt><dd>{co.email || '—'}</dd></div>
          <div>
            <dt><ShieldCheck size={13} /> Licence</dt>
            <dd>{lic ? <Badge tone={lic.tone}>{lic.tone === 'ok' ? `Valid to ${fmtDate(co.licenceExpiry)}` : lic.label}</Badge> : <Badge tone="warn">Not provided</Badge>}</dd>
          </div>
        </dl>
      </div>

      {co.status === 'suspended' && co.suspension && (
        <div className="notice notice-bad">
          <Prohibit size={16} />
          <span>
            Suspended {fmtDate(co.suspension.at)} by {co.suspension.by}: {co.suspension.reason}
          </span>
        </div>
      )}
      {co.status === 'pending' && (
        <div className="notice notice-warn">
          <Warning size={16} />
          <span>Check the licence number against the register before approving. Until approved, this company can't request records from other employers.</span>
        </div>
      )}

      <div className="rg-metrics">
        <div><b>{m.deployed}</b><span>guards deployed</span></div>
        <div><b>{m.sites}</b><span>active sites</span></div>
        <div><b>{members.length}</b><span>staff accounts</span></div>
        <div><b>{m.slaRate == null ? '—' : `${m.slaRate}%`}</b><span>answered on time</span></div>
        <div><b>{m.avgHours == null ? '—' : `${m.avgHours}h`}</b><span>average response</span></div>
        <div className={openReqs ? 'is-warn' : ''}><b>{openReqs}</b><span>requests open</span></div>
        <div><b>{m.amended}/{m.disputes}</b><span>disputes corrected</span></div>
        <div className={issues.length ? 'is-warn' : ''}><b>{issues.length}</b><span>compliance issues</span></div>
      </div>

      {issues.length > 0 && (
        <section className="tr-section">
          <div className="tr-section-title">Compliance issues</div>
          <ul className="items">
            {issues.slice(0, 6).map((i, k) => (
              <li key={k} className="tap" onClick={() => go('guard', { id: i.guard.id })}>
                <span className={`item-icon ${i.tone}`}>
                  <Warning size={16} />
                </span>
                <span className="grow">
                  <span className="item-title">{i.guard.name}</span>
                  <span className="item-sub">{i.label}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="tr-section">
        <div className="tr-section-title">Recent activity</div>
        {activity.length ? (
          <ul className="items">
            {activity.map((a) => (
              <li key={a.id}>
                <span className="grow">
                  <span className="item-title">
                    {a.action} <span className="muted">· {a.actorUser}</span>
                  </span>
                  <span className="item-sub clamp-1">{a.detail}</span>
                </span>
                <span className="mono small faint nowrap">{fromNow(a.ts)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState compact body="No activity recorded yet." />
        )}
      </section>

      {modal === 'suspend' && <SuspendModal co={co} reject={co.status === 'pending'} onClose={() => setModal(null)} />}
      {modal === 'reinstate' && <ReinstateConfirm co={co} onClose={() => setModal(null)} />}
    </Drawer>
  );
}

function SuspendModal({ co, reject, onClose }) {
  const { act } = useStore();
  const [reason, setReason] = useState('');
  const [typed, setTyped] = useState('');
  const ok = reason.trim().length >= 15 && typed.trim().toLowerCase() === co.name.toLowerCase();
  const save = () =>
    act({
      key: co.id,
      pending: reject ? 'Rejecting…' : 'Suspending company…',
      success: reject ? `${co.name} rejected` : `${co.name} suspended`,
      touches: ['companies', 'sessions'],
      undo: true,
      apply: (d, t) => {
        const c = d.companies.find((x) => x.id === co.id);
        c.status = 'suspended';
        c.suspension = { at: t.now, by: t.actor.user, reason: reason.trim() };
        const staff = d.users.filter((u) => u.memberships?.some((m) => m.companyId === co.id)).map((u) => u.id);
        d.sessions = d.sessions.filter((s) => !staff.includes(s.userId));
        t.log(reject ? 'Rejected company' : 'Suspended company', `${co.name}: ${reason.trim()}`);
        t.notify(`company:${co.id}`, { title: reject ? 'Membership application rejected' : 'Your company has been suspended', body: reason.trim() });
      },
    }).then(onClose);
  return (
    <Modal
      title={reject ? `Reject ${co.name}?` : `Suspend ${co.name}?`}
      icon={Prohibit}
      className="confirm confirm-danger"
      size="sm"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={save} disabled={!ok}>
            {reject ? 'Reject' : 'Suspend'}
          </Button>
        </>
      }
    >
      <p className="confirm-body">
        Staff are signed out and can't sign in. Guards keep their passports and everything already recorded stays visible to them. Pending requests to this company stay
        open.
      </p>
      <Field label="Reason" hint="At least 15 characters. Sent to the company and kept in the audit trail.">
        <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
      </Field>
      <Field label={<>Type <b>{co.name}</b> to confirm</>}>
        <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
      </Field>
    </Modal>
  );
}

function ReinstateConfirm({ co, onClose }) {
  const { act } = useStore();
  return (
    <ConfirmModal
      title={`Reinstate ${co.name}?`}
      tone="info"
      icon={ArrowCounterClockwise}
      body="Staff can sign in again and the company regains full network access."
      confirmLabel="Reinstate"
      onClose={onClose}
      onConfirm={() =>
        act({
          key: co.id,
          pending: 'Reinstating…',
          success: `${co.name} reinstated`,
          touches: ['companies'],
          undo: true,
          apply: (d, t) => {
            const c = d.companies.find((x) => x.id === co.id);
            c.status = 'active';
            c.suspension = null;
            t.log('Reinstated company', co.name);
            t.notify(`company:${co.id}`, { title: 'Your company has been reinstated', body: 'Full network access is restored.' });
          },
        })
      }
    />
  );
}
