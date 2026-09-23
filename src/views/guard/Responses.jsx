import { useState } from 'react';
import { ArrowRight, ChatCircleText, Eye, Plus, Scales } from '@phosphor-icons/react';
import { useStore } from '../../store';
import { RESPONSE_STATUS, company } from '../../access';
import { Badge, Button, DataTable, EmptyState, Field, Menu, Modal, PageHead, fmtDate, fromNow } from '../../ui';
import { CompanyCell, ResponseStatus } from '../../components';
import { RespondModal, respondable, responseTarget } from '../profile/parts';
import './guard.css';

const canEscalate = (r) => r.status === 'maintained' || (r.status === 'open' && new Date(r.dueAt) < new Date());

export default function Responses() {
  const { db, session } = useStore();
  const me = session.guardId;
  const rows = db.responses.filter((r) => r.guardId === me).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const options = respondable(db, me);
  const [modal, setModal] = useState(null);

  return (
    <div className="stack">
      <PageHead
        title="My responses"
        sub="You can respond to any incident, disciplinary action or separation on your record. Employers have 14 days to review. If they keep the record unchanged, or don't reply in time, you can ask the regulator to decide."
        actions={
          <Button icon={Plus} disabledReason={options.length ? undefined : 'Everything on your record already has a response.'} onClick={() => setModal({ k: 'new' })}>
            New response
          </Button>
        }
      />

      <ol className="gd-steps">
        <li><span>1</span><b>You respond</b><p>Your account is attached to the record wherever it is shared.</p></li>
        <li><span>2</span><b>Employer reviews</b><p>They amend, retract or keep the record within 14 days.</p></li>
        <li><span>3</span><b>Regulator decides</b><p>If you disagree, escalate. The regulator can overturn the record.</p></li>
      </ol>

      <DataTable
        rows={rows}
        onRowClick={(r) => setModal({ k: 'view', resp: r })}
        columns={[
          {
            key: 'what', header: 'Responding to', width: 'minmax(220px, 2fr)', mobile: 'primary', sort: (r) => responseTarget(db, r).title,
            render: (r) => {
              const t = responseTarget(db, r);
              return (
                <span className="cell-person-text">
                  <span className="cell-name">{t.title}</span>
                  <span className="cell-sub">{t.kind}</span>
                </span>
              );
            },
          },
          { key: 'company', header: 'Employer', width: 'minmax(160px, 1.3fr)', mobile: 'secondary', render: (r) => <CompanyCell id={r.companyId} sub={false} size={24} /> },
          { key: 'sent', header: 'Sent', width: '120px', mobile: 'meta', sort: (r) => r.createdAt, render: (r) => <span className="muted">{fmtDate(r.createdAt)}</span> },
          {
            key: 'due', header: 'Employer due', width: '130px', mobile: 'meta',
            render: (r) => (r.status === 'open' ? <Badge tone={new Date(r.dueAt) < new Date() ? 'bad' : 'neutral'}>{new Date(r.dueAt) < new Date() ? `Overdue ${fromNow(r.dueAt).replace(' ago', '')}` : `Due ${fromNow(r.dueAt)}`}</Badge> : <span className="muted">—</span>),
          },
          { key: 'status', header: 'Status', width: '170px', mobile: 'aside', sort: (r) => r.status, render: (r) => <ResponseStatus resp={r} /> },
          {
            key: 'actions', header: '', width: '44px',
            render: (r) => (
              <Menu
                items={[
                  { label: 'View', icon: Eye, onClick: () => setModal({ k: 'view', resp: r }) },
                  { label: 'Escalate to regulator', icon: Scales, disabled: !canEscalate(r), hint: canEscalate(r) ? undefined : 'Available once the employer keeps the record or misses the 14-day deadline.', onClick: () => setModal({ k: 'escalate', resp: r }) },
                ]}
              />
            ),
          },
        ]}
        empty={<EmptyState icon={ChatCircleText} title="No responses yet" body="If something on your record is wrong or missing context, add your side of the story." />}
      />

      {modal?.k === 'new' && <NewResponseModal options={options} onPick={(target) => setModal({ k: 'write', target })} onClose={() => setModal(null)} />}
      {modal?.k === 'write' && <RespondModal guardId={me} target={modal.target} onClose={() => setModal(null)} />}
      {modal?.k === 'view' && <ViewModal resp={modal.resp} onEscalate={() => setModal({ k: 'escalate', resp: modal.resp })} onClose={() => setModal(null)} />}
      {modal?.k === 'escalate' && <EscalateModal resp={modal.resp} onClose={() => setModal(null)} />}
    </div>
  );
}

function NewResponseModal({ options, onPick, onClose }) {
  const { db } = useStore();
  const [sel, setSel] = useState(0);
  return (
    <Modal
      title="What are you responding to?"
      icon={ChatCircleText}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button iconRight={ArrowRight} onClick={() => onPick(options[sel])}>
            Continue
          </Button>
        </>
      }
    >
      <div className="option-list">
        {options.map((o, i) => (
          <label key={`${o.type}:${o.item.id}`} className={`option option-rich ${sel === i ? 'on' : ''}`}>
            <input type="radio" name="respond-target" checked={sel === i} onChange={() => setSel(i)} />
            <span className="grow">
              <b>{o.label}</b>
              <span className="option-sub">
                {company(db, o.companyId).name} · {o.sub}
              </span>
            </span>
          </label>
        ))}
      </div>
    </Modal>
  );
}

function ViewModal({ resp, onEscalate, onClose }) {
  const { db } = useStore();
  const t = responseTarget(db, resp);
  return (
    <Modal
      title={t.title}
      subtitle={`${company(db, resp.companyId).name} · ${RESPONSE_STATUS[resp.status]?.label}`}
      onClose={onClose}
      footer={
        canEscalate(resp) ? (
          <Button icon={Scales} onClick={onEscalate}>
            Escalate to regulator
          </Button>
        ) : (
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        )
      }
    >
      <div className="gd-thread">
        <div className="gd-msg mine">
          <span className="gd-msg-who">You · {fmtDate(resp.createdAt)}</span>
          <p>{resp.text}</p>
        </div>
        {resp.companyNote && (
          <div className="gd-msg">
            <span className="gd-msg-who">{company(db, resp.companyId).name}</span>
            <p>{resp.companyNote}</p>
          </div>
        )}
        {resp.escalatedAt && (
          <div className="gd-msg reg">
            <span className="gd-msg-who">Escalated {fmtDate(resp.escalatedAt)}</span>
            {resp.escalationReason && <p>{resp.escalationReason}</p>}
          </div>
        )}
        {resp.regulatorNote && (
          <div className="gd-msg reg">
            <span className="gd-msg-who">Regulator</span>
            <p>{resp.regulatorNote}</p>
          </div>
        )}
        {resp.status === 'open' && <p className="muted small">Waiting for {company(db, resp.companyId).name}. They are due to reply {fromNow(resp.dueAt)}.</p>}
      </div>
    </Modal>
  );
}

function EscalateModal({ resp, onClose }) {
  const { db, act } = useStore();
  const [reason, setReason] = useState('');
  const co = company(db, resp.companyId);
  const t = responseTarget(db, resp);
  const send = () =>
    act({
      key: resp.id,
      pending: 'Sending to the regulator…',
      success: 'Escalated. The regulator will review your case.',
      touches: ['responses'],
      undo: true,
      apply: (d, tools) => {
        Object.assign(d.responses.find((x) => x.id === resp.id), { status: 'escalated', escalatedAt: tools.now, escalationReason: reason.trim() });
        tools.log('Escalated dispute', `${t.title} — ${co.name}`, { guardId: resp.guardId });
        tools.notify('regulator', { title: 'Dispute escalated', body: `${tools.actor.name} escalated “${t.title}” with ${co.name}.`, link: { name: 'escalations' } });
        tools.notify(`company:${co.id}`, { title: 'Dispute escalated to the regulator', body: `${tools.actor.name} asked the regulator to review “${t.title}”.`, link: { name: 'disputes' } });
      },
    }).then(onClose);
  return (
    <Modal
      title="Escalate to the regulator"
      subtitle={`${t.title} · ${co.name}`}
      icon={Scales}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={send} disabled={reason.trim().length < 20}>
            Escalate
          </Button>
        </>
      }
    >
      <p className="muted small">
        An inspector reviews the record, the employer's evidence and your response. They can keep the record or order it overturned. Both sides are told the outcome.
      </p>
      <Field label="Why do you disagree with the employer's decision?" hint="At least 20 characters. Mention any documents you can provide.">
        <textarea rows={5} value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
      </Field>
    </Modal>
  );
}
