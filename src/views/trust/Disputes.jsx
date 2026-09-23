import { useMemo, useState } from 'react';
import { ArrowRight, ChatCircleText, CheckCircle, PencilSimple, Scales, ShieldCheck, Warning } from '@phosphor-icons/react';
import { useStore } from '../../store';
import { RECORD_TYPES, deniedHint, guardById } from '../../access';
import { Badge, Button, DataTable, Drawer, EmptyState, Field, Menu, Modal, PageHead, SearchInput, Segmented, Tabs, daysUntil, fmtDate, fromNow, hoursUntil } from '../../ui';
import { GuardCell, PermissionNote, ResponseStatus, EntityLink } from '../../components';
import { TargetSummary, Timeline, firstName, targetOf } from './shared';
import './trust.css';
import '../detail/detail.css';

const RESOLVED = ['maintained', 'amended', 'escalated', 'upheld', 'overturned'];

function DueBadge({ resp }) {
  if (resp.status !== 'open') return <span className="muted small">{resp.resolvedAt ? `Answered ${fromNow(resp.resolvedAt)}` : '—'}</span>;
  const d = daysUntil(resp.dueAt);
  if (hoursUntil(resp.dueAt) < 0) return <Badge tone="bad">Overdue {-d}d</Badge>;
  return <Badge tone={d <= 3 ? 'warn' : 'neutral'}>Due {d === 0 ? 'today' : `in ${d}d`}</Badge>;
}

export default function Disputes({ go, id }) {
  const { db, session } = useStore();
  const me = session.companyId;
  const [tab, setTab] = useState('open');
  const [q, setQ] = useState('');
  const all = db.responses.filter((r) => r.companyId === me);
  const openList = all.filter((r) => r.status === 'open');
  const resolved = all.filter((r) => RESOLVED.includes(r.status));
  const overdue = openList.filter((r) => hoursUntil(r.dueAt) < 0).length;
  const base = { open: openList, resolved, all }[tab];

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return base
      .filter((r) => !t || guardById(db, r.guardId).name.toLowerCase().includes(t) || targetOf(db, r).label.toLowerCase().includes(t))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [base, q, db]);

  const open = id ? all.find((r) => r.id === id) : null;

  const columns = [
    { key: 'guard', header: 'Guard', width: 'minmax(0, 1.4fr)', mobile: 'primary', sort: (r) => guardById(db, r.guardId).name, render: (r) => <GuardCell id={r.guardId} /> },
    {
      key: 'target',
      header: 'Responding to',
      width: 'minmax(0, 1.6fr)',
      mobile: 'secondary',
      render: (r) => {
        const t = targetOf(db, r);
        return (
          <span className="stack-xs" style={{ minWidth: 0 }}>
            <span className="clamp-1">{t.label}</span>
            <span className="tr-sub clamp-1">“{r.text}”</span>
          </span>
        );
      },
    },
    { key: 'submitted', header: 'Submitted', width: '120px', mobile: 'meta', sort: (r) => r.createdAt, render: (r) => <span className="small">{fmtDate(r.createdAt)}</span> },
    { key: 'due', header: 'Deadline', width: '140px', mobile: 'meta', sort: (r) => r.dueAt, render: (r) => <DueBadge resp={r} /> },
    { key: 'status', header: 'Status', width: '170px', mobile: 'aside', sort: (r) => r.status, render: (r) => <ResponseStatus resp={r} /> },
    { key: 'actions', header: '', width: '40px', render: (r) => <RowMenu resp={r} go={go} /> },
  ];

  return (
    <div className="stack">
      <PageHead
        title="Guard responses"
        sub="Guards can answer any record you hold about them. Review each response within 14 days: keep the record with a written reason, or correct it. Unresolved disputes can go to the regulator."
      />
      {overdue > 0 && (
        <div className="notice notice-bad">
          <Warning size={16} />
          <span>
            <b>{overdue}</b> response{overdue > 1 ? 's are' : ' is'} past the 14-day review deadline. Until you respond, the record shows as disputed wherever it is shared.
          </span>
        </div>
      )}
      <div className="tr-toolbar">
        <Tabs
          value={tab}
          onChange={setTab}
          tabs={[
            { key: 'open', label: 'Open', count: openList.length, alert: overdue > 0 },
            { key: 'resolved', label: 'Resolved', count: resolved.length },
            { key: 'all', label: 'All', count: all.length },
          ]}
        />
        <span className="toolbar-spacer" />
        <SearchInput value={q} onChange={setQ} placeholder="Search guard or record" />
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        onRowClick={(r) => go('disputes', { id: r.id })}
        rowClass={(r) => (r.status === 'open' && hoursUntil(r.dueAt) < 0 ? 'tr-overdue-row' : '')}
        empty={<EmptyState icon={ChatCircleText} title={tab === 'open' ? 'No responses waiting' : 'Nothing here yet'} body="When a guard responds to a record you hold, it appears here for review." />}
      />
      {open && <ResponseDrawer resp={open} onClose={() => go('disputes')} go={go} />}
    </div>
  );
}

function RowMenu({ resp, go }) {
  const { session, can } = useStore();
  const [modal, setModal] = useState(null);
  const hint = deniedHint(session, 'dispute.resolve');
  return (
    <>
      <Menu
        label="Response actions"
        items={[
          { label: 'Open details', icon: ArrowRight, onClick: () => go('disputes', { id: resp.id }) },
          resp.status === 'open' && { label: 'Maintain record', icon: ShieldCheck, onClick: () => setModal('maintain'), disabled: !can('dispute.resolve'), hint },
          resp.status === 'open' && { label: 'Amend or retract', icon: PencilSimple, onClick: () => setModal('amend'), disabled: !can('dispute.resolve'), hint },
          { label: 'Open passport', icon: ArrowRight, onClick: () => go('guard', { id: resp.guardId }) },
        ]}
      />
      {modal === 'maintain' && <MaintainModal resp={resp} onClose={() => setModal(null)} />}
      {modal === 'amend' && <AmendModal resp={resp} onClose={() => setModal(null)} />}
    </>
  );
}

function ResponseDrawer({ resp, onClose, go }) {
  const { db, session } = useStore();
  const [modal, setModal] = useState(null);
  const g = guardById(db, resp.guardId);
  const hint = deniedHint(session, 'dispute.resolve');
  const steps = [
    { label: `${firstName(g.name)} responded`, at: resp.createdAt, by: g.name, state: 'done' },
    resp.status === 'open'
      ? { label: `Your review is due ${fmtDate(resp.dueAt)}`, note: hoursUntil(resp.dueAt) < 0 ? 'Overdue — the record shows as disputed until you respond.' : undefined, state: hoursUntil(resp.dueAt) < 0 ? 'bad' : 'current' }
      : { label: resp.status === 'amended' ? 'Record amended by employer' : 'Record maintained by employer', at: resp.resolvedAt, by: resp.resolvedBy, note: resp.companyNote, state: 'done' },
  ];
  if (resp.escalatedAt) steps.push({ label: `${firstName(g.name)} escalated to the regulator`, at: resp.escalatedAt, state: 'done' });
  if (resp.status === 'escalated') steps.push({ label: 'Awaiting regulator ruling', state: 'current' });
  if (['upheld', 'overturned'].includes(resp.status)) steps.push({ label: resp.status === 'upheld' ? 'Regulator upheld the record' : 'Regulator overturned the record', at: resp.decidedAt, note: resp.regulatorNote, state: resp.status === 'upheld' ? 'done' : 'bad' });

  return (
    <Drawer
      title={`Response from ${g.name}`}
      subtitle={`Submitted ${fromNow(resp.createdAt)}`}
      onClose={onClose}
      headerExtra={<ResponseStatus resp={resp} />}
      footer={
        resp.status === 'open' ? (
          <>
            <Button variant="ghost" icon={PencilSimple} onClick={() => setModal('amend')} disabledReason={hint}>
              Amend or retract
            </Button>
            <Button icon={ShieldCheck} onClick={() => setModal('maintain')} disabledReason={hint}>
              Maintain record
            </Button>
          </>
        ) : null
      }
    >
      <section className="tr-section">
        <div className="tr-section-title">Guard</div>
        <GuardCell guard={g} size={42} />
      </section>
      <section className="tr-section">
        <div className="tr-section-title">Original entry</div>
        <TargetSummary db={db} resp={resp} />
      </section>
      <section className="tr-section">
        <div className="tr-section-title">Their response</div>
        <div className="tr-voice">
          <div className="tr-voice-head">
            <span>
              <ChatCircleText size={14} /> <EntityLink kind="guard" id={g.id} className="dt2-inline-link">{g.name}</EntityLink>
            </span>
            <span className="mono">{fmtDate(resp.createdAt)}</span>
          </div>
          <p>{resp.text}</p>
        </div>
        {resp.companyNote && (
          <div className="tr-voice tr-voice-company">
            <div className="tr-voice-head">
              <span>Your company's reply</span>
            </div>
            <p>{resp.companyNote}</p>
          </div>
        )}
        {resp.regulatorNote && (
          <div className="tr-voice tr-voice-reg">
            <div className="tr-voice-head">
              <span>
                <Scales size={14} /> Regulator ruling
              </span>
            </div>
            <p>{resp.regulatorNote}</p>
          </div>
        )}
      </section>
      <section className="tr-section">
        <div className="tr-section-title">History</div>
        <Timeline steps={steps} />
      </section>
      {resp.status === 'open' && session.kind === 'staff' && !hint && (
        <div className="notice">
          <Scales size={16} />
          <span>If you keep the record, {firstName(g.name)} may ask the regulator to rule on it. Give reasons you'd be comfortable defending.</span>
        </div>
      )}
      {hint && resp.status === 'open' && <PermissionNote>{hint} Ask an HR or owner colleague to review this response.</PermissionNote>}
      {modal === 'maintain' && <MaintainModal resp={resp} onClose={() => setModal(null)} />}
      {modal === 'amend' && <AmendModal resp={resp} onClose={() => setModal(null)} />}
    </Drawer>
  );
}

function MaintainModal({ resp, onClose }) {
  const { db, act } = useStore();
  const g = guardById(db, resp.guardId);
  const [reason, setReason] = useState('');
  const ok = reason.trim().length >= 20;
  const save = () =>
    act({
      key: resp.id,
      pending: 'Saving decision…',
      success: 'Record maintained. The guard has been told why.',
      touches: ['responses'],
      undo: true,
      apply: (d, t) => {
        const r = d.responses.find((x) => x.id === resp.id);
        Object.assign(r, { status: 'maintained', companyNote: reason.trim(), resolvedAt: t.now, resolvedBy: t.actor.user });
        t.log('Maintained record', `${g.name} — ${targetOf(d, r).label}: ${reason.trim()}`, { guardId: g.id });
        t.notify(`guard:${g.id}`, { title: 'Your employer kept the record', body: `${t.actor.name}: “${reason.trim()}” You can escalate this to the regulator.`, link: { name: 'responses' } });
      },
    }).then(onClose);
  return (
    <Modal
      title="Maintain record"
      subtitle={`${g.name} · ${targetOf(db, resp).label}`}
      icon={ShieldCheck}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!ok}>
            Keep record
          </Button>
        </>
      }
    >
      <div className="tr-voice">
        <p>“{resp.text}”</p>
      </div>
      <Field label="Your reason" hint={`At least 20 characters. ${firstName(g.name)} sees this, and so does the regulator if they escalate.`}>
        <textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus placeholder="e.g. CCTV and the patrol log show the post was unmanned from 01:05 to 03:10. No call was logged." />
      </Field>
      <div className="notice">
        <Scales size={16} />
        <span>The response stays attached to the record and is shared with it. The guard may escalate to the regulator, who can overturn the record.</span>
      </div>
    </Modal>
  );
}

function AmendModal({ resp, onClose }) {
  const { db, act } = useStore();
  const g = guardById(db, resp.guardId);
  const target = targetOf(db, resp);
  const rec = target.record;
  const emp = target.employment;
  const [f, setF] = useState({
    retract: false,
    detail: rec?.detail ?? '',
    severity: rec?.severity ?? 'Minor',
    rehire: emp?.separation?.rehire ?? 'Eligible',
    sepNote: emp?.separation?.note ?? '',
    reason: '',
  });
  const ok = f.reason.trim().length >= 10;
  const save = () =>
    act({
      key: resp.id,
      pending: f.retract ? 'Retracting record…' : 'Amending record…',
      success: f.retract ? 'Record retracted' : 'Record amended',
      touches: ['responses', 'records', 'employments'],
      undo: true,
      apply: (d, t) => {
        const r = d.responses.find((x) => x.id === resp.id);
        if (rec) {
          const x = d.records.find((y) => y.id === rec.id);
          if (f.retract) Object.assign(x, { retracted: true, retractedAt: t.now, retractedReason: f.reason.trim() });
          else Object.assign(x, { detail: f.detail.trim(), severity: x.type === 'incident' || x.type === 'disciplinary' ? f.severity : x.severity, editedAt: t.now, editedBy: t.actor.user });
        }
        if (emp?.separation) {
          const x = d.employments.find((y) => y.id === emp.id);
          x.separation = { ...x.separation, rehire: f.rehire, note: f.sepNote.trim() };
        }
        Object.assign(r, { status: 'amended', companyNote: f.reason.trim(), resolvedAt: t.now, resolvedBy: t.actor.user });
        t.log(f.retract ? 'Retracted record' : 'Amended record', `${g.name} — ${target.label}: ${f.reason.trim()}`, { guardId: g.id });
        t.notify(`guard:${g.id}`, { title: f.retract ? 'A record was retracted' : 'A record was corrected', body: `${t.actor.name} ${f.retract ? 'retracted' : 'amended'} “${target.label}” after reviewing your response.`, link: { name: 'responses' } });
      },
    }).then(onClose);

  const conduct = rec && (rec.type === 'incident' || rec.type === 'disciplinary');
  return (
    <Modal
      title="Amend or retract"
      subtitle={`${g.name} · ${target.label}`}
      icon={PencilSimple}
      size="md"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={f.retract ? 'danger' : 'primary'} icon={CheckCircle} onClick={save} disabled={!ok}>
            {f.retract ? 'Retract record' : 'Save correction'}
          </Button>
        </>
      }
    >
      <div className="tr-voice">
        <p>“{resp.text}”</p>
      </div>
      {rec && (
        <>
          <label className={`option ${f.retract ? 'on' : ''}`}>
            <input type="checkbox" checked={f.retract} onChange={(e) => setF({ ...f, retract: e.target.checked })} />
            <span>Retract this {RECORD_TYPES[rec.type].short.toLowerCase()} entirely. It stops being shared and shows as retracted to {firstName(g.name)}.</span>
          </label>
          {!f.retract && (
            <>
              {conduct && (
                <Field label="Severity">
                  <Segmented value={f.severity} onChange={(severity) => setF({ ...f, severity })} options={['Minor', 'Moderate', 'Serious']} />
                </Field>
              )}
              <Field label="Corrected detail">
                <textarea rows={3} value={f.detail} onChange={(e) => setF({ ...f, detail: e.target.value })} />
              </Field>
            </>
          )}
        </>
      )}
      {emp?.separation && (
        <>
          <Field label="Rehire eligibility">
            <Segmented value={f.rehire} onChange={(rehire) => setF({ ...f, rehire })} options={['Eligible', 'Conditional', 'Not eligible']} />
          </Field>
          <Field label="Separation note">
            <textarea rows={3} value={f.sepNote} onChange={(e) => setF({ ...f, sepNote: e.target.value })} />
          </Field>
        </>
      )}
      <Field label="What changed and why" hint="Shared with the guard.">
        <textarea rows={3} value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} placeholder="e.g. Hospital letter confirmed the emergency; severity reduced." />
      </Field>
    </Modal>
  );
}
