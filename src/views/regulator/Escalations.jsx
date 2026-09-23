import { useState } from 'react';
import { ArrowRight, Buildings, ChatCircleText, Gavel, Scales } from '@phosphor-icons/react';
import { useStore } from '../../store';
import { company, guardById } from '../../access';
import { Badge, Button, DataTable, Drawer, EmptyState, Field, Modal, PageHead, Segmented, Tabs, fmtDate, fromNow } from '../../ui';
import { CompanyCell, GuardCell, ResponseStatus, EntityLink } from '../../components';
import { TargetSummary, Timeline, firstName, targetOf } from '../trust/shared';
import './regulator.css';
import '../detail/detail.css';

export default function Escalations({ go, id }) {
  const { db } = useStore();
  const [tab, setTab] = useState('open');
  const open = db.responses.filter((r) => r.status === 'escalated');
  const decided = db.responses.filter((r) => ['upheld', 'overturned'].includes(r.status));
  const rows = (tab === 'open' ? open : decided).sort((a, b) => (b.escalatedAt ?? '').localeCompare(a.escalatedAt ?? ''));
  const current = id ? db.responses.find((r) => r.id === id) : null;

  const columns = [
    { key: 'guard', header: 'Guard', width: 'minmax(0, 1.4fr)', mobile: 'primary', sort: (r) => guardById(db, r.guardId).name, render: (r) => <GuardCell id={r.guardId} /> },
    { key: 'co', header: 'Company', width: 'minmax(0, 1.3fr)', mobile: 'secondary', sort: (r) => company(db, r.companyId).name, render: (r) => <CompanyCell id={r.companyId} size={24} sub={false} /> },
    { key: 'about', header: 'Disputed entry', width: 'minmax(0, 1.6fr)', mobile: 'meta', render: (r) => <span className="clamp-1">{targetOf(db, r).label}</span> },
    { key: 'when', header: tab === 'open' ? 'Escalated' : 'Decided', width: '130px', mobile: 'meta', sort: (r) => (tab === 'open' ? r.escalatedAt : r.decidedAt) ?? '', render: (r) => <span className="small">{fromNow(tab === 'open' ? r.escalatedAt : r.decidedAt ?? r.escalatedAt)}</span> },
    { key: 'status', header: 'Status', width: '200px', mobile: 'aside', render: (r) => <ResponseStatus resp={r} /> },
  ];

  return (
    <div className="stack rg-page">
      <PageHead
        title="Escalations"
        sub="Disputes a guard took further after their employer kept a record. Rule on the evidence: uphold the record, or overturn it and correct what other employers will see."
      />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'open', label: 'Awaiting ruling', count: open.length, alert: open.length > 0 },
          { key: 'decided', label: 'Decided', count: decided.length },
        ]}
      />
      <DataTable
        columns={columns}
        rows={rows}
        onRowClick={(r) => go('escalations', { id: r.id })}
        empty={<EmptyState icon={Scales} title={tab === 'open' ? 'Nothing awaiting a ruling' : 'No rulings yet'} body="Guards can escalate a dispute after their employer maintains a record." />}
      />
      {current && <EscalationDrawer resp={current} onClose={() => go('escalations')} go={go} />}
    </div>
  );
}

function EscalationDrawer({ resp, onClose, go }) {
  const { db } = useStore();
  const [ruling, setRuling] = useState(false);
  const g = guardById(db, resp.guardId);
  const co = company(db, resp.companyId);
  const steps = [
    { label: `${firstName(g.name)} responded to the record`, at: resp.createdAt, by: g.name, state: 'done' },
    { label: `${co.name} maintained the record`, at: resp.resolvedAt, by: resp.resolvedBy, note: resp.companyNote, state: 'done' },
    { label: `${firstName(g.name)} escalated to the regulator`, at: resp.escalatedAt, state: 'done' },
    resp.status === 'escalated'
      ? { label: 'Awaiting your ruling', state: 'current' }
      : { label: resp.status === 'upheld' ? 'Record upheld' : 'Record overturned', at: resp.decidedAt, by: resp.decidedBy, note: resp.regulatorNote, state: resp.status === 'upheld' ? 'done' : 'bad' },
  ];
  return (
    <Drawer
      title={`${g.name} v ${co.name}`}
      subtitle={`Escalated ${fromNow(resp.escalatedAt)} · ${targetOf(db, resp).label}`}
      onClose={onClose}
      wide
      headerExtra={<ResponseStatus resp={resp} />}
      footer={
        resp.status === 'escalated' ? (
          <Button icon={Gavel} onClick={() => setRuling(true)}>
            Make a ruling
          </Button>
        ) : null
      }
    >
      <div className="tr-parties">
        <div>
          <span className="tr-party-label">Guard</span>
          <GuardCell guard={g} size={34} />
        </div>
        <Scales size={20} />
        <div>
          <span className="tr-party-label">Employer</span>
          <CompanyCell company={co} size={34} />
        </div>
      </div>

      <section className="tr-section">
        <div className="tr-section-title">Disputed entry</div>
        <TargetSummary db={db} resp={resp} />
      </section>

      <div className="rg-sides">
        <section className="tr-section">
          <div className="tr-section-title">Guard's account</div>
          <div className="tr-voice">
            <div className="tr-voice-head">
              <span>
                <ChatCircleText size={14} /> <EntityLink kind="guard" id={g.id} className="dt2-inline-link">{g.name}</EntityLink>
              </span>
              <span className="mono">{fmtDate(resp.createdAt)}</span>
            </div>
            <p>{resp.text}</p>
          </div>
        </section>
        <section className="tr-section">
          <div className="tr-section-title">Employer's reason</div>
          <div className="tr-voice tr-voice-company">
            <div className="tr-voice-head">
              <span>
                <Buildings size={14} /> <EntityLink kind="company" id={co.id} className="dt2-inline-link">{co.name}</EntityLink>
              </span>
              {resp.resolvedAt && <span className="mono">{fmtDate(resp.resolvedAt)}</span>}
            </div>
            <p>{resp.companyNote || 'No reason was recorded.'}</p>
          </div>
        </section>
      </div>

      {resp.regulatorNote && (
        <div className="tr-voice tr-voice-reg">
          <div className="tr-voice-head">
            <span>
              <Gavel size={14} /> Ruling
            </span>
            <Badge tone={resp.status === 'overturned' ? 'ok' : 'neutral'}>{resp.status === 'overturned' ? 'Overturned' : 'Upheld'}</Badge>
          </div>
          <p>{resp.regulatorNote}</p>
        </div>
      )}

      <section className="tr-section">
        <div className="tr-section-title">History</div>
        <Timeline steps={steps} />
      </section>

      <Button variant="subtle" iconRight={ArrowRight} onClick={() => go('guard', { id: g.id })}>
        Open {firstName(g.name)}'s full passport
      </Button>

      {ruling && <RulingModal resp={resp} onClose={() => setRuling(false)} />}
    </Drawer>
  );
}

function RulingModal({ resp, onClose }) {
  const { db, act } = useStore();
  const g = guardById(db, resp.guardId);
  const co = company(db, resp.companyId);
  const target = targetOf(db, resp);
  const [decision, setDecision] = useState('upheld');
  const [note, setNote] = useState('');
  const ok = note.trim().length >= 20;
  const save = () =>
    act({
      key: resp.id,
      pending: 'Recording ruling…',
      success: decision === 'upheld' ? 'Ruling recorded: record upheld' : 'Ruling recorded: record overturned',
      touches: ['responses', 'records', 'employments'],
      undo: true,
      apply: (d, t) => {
        const r = d.responses.find((x) => x.id === resp.id);
        Object.assign(r, { status: decision, regulatorNote: note.trim(), decidedAt: t.now, decidedBy: t.actor.user });
        if (decision === 'overturned') {
          if (target.kind === 'record' && target.record) Object.assign(d.records.find((x) => x.id === target.record.id), { retracted: true, retractedAt: t.now, retractedReason: `Overturned by regulator: ${note.trim()}` });
          if (target.kind === 'employment' && target.employment?.separation) {
            const e = d.employments.find((x) => x.id === target.employment.id);
            e.separation = { ...e.separation, rehire: 'Eligible', note: `${e.separation.note} [Amended by regulator ruling, ${t.now.slice(0, 10)}]` };
          }
        }
        t.log(decision === 'upheld' ? 'Upheld record' : 'Overturned record', `${g.name} v ${co.name} — ${target.label}: ${note.trim()}`, { guardId: g.id });
        const body = decision === 'upheld' ? `The regulator upheld “${target.label}”.` : `The regulator overturned “${target.label}”. It has been corrected.`;
        t.notify(`guard:${g.id}`, { title: 'The regulator has ruled', body, link: { name: 'responses' } });
        t.notify(`company:${co.id}`, { title: 'The regulator has ruled', body: `${body} (${g.name})`, link: { name: 'disputes', params: { id: resp.id } } });
      },
    }).then(onClose);
  return (
    <Modal
      title="Make a ruling"
      subtitle={`${g.name} v ${co.name}`}
      icon={Gavel}
      size="md"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={decision === 'overturned' ? 'danger' : 'primary'} onClick={save} disabled={!ok}>
            {decision === 'upheld' ? 'Uphold record' : 'Overturn record'}
          </Button>
        </>
      }
    >
      <Segmented
        value={decision}
        onChange={setDecision}
        options={[
          { value: 'upheld', label: 'Uphold the record' },
          { value: 'overturned', label: 'Overturn it' },
        ]}
      />
      <div className={`notice ${decision === 'overturned' ? 'notice-warn' : ''}`}>
        <Scales size={16} />
        <span>
          {decision === 'upheld'
            ? `The record stays as ${co.name} wrote it, with ${firstName(g.name)}'s response and your ruling attached.`
            : target.kind === 'record'
              ? `“${target.label}” is retracted and will no longer be shared with any employer.`
              : `Rehire eligibility becomes Eligible and the separation note is marked as amended by your ruling.`}
        </span>
      </div>
      <Field label="Written ruling" hint="At least 20 characters. Shared with both parties and attached to the record.">
        <textarea rows={5} value={note} onChange={(e) => setNote(e.target.value)} autoFocus placeholder="Summarise the evidence you relied on and why." />
      </Field>
    </Modal>
  );
}
