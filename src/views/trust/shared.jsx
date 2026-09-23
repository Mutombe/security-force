// Helpers shared by the trust-network and regulator screens.
import { Check, Circle, Clock, X } from '@phosphor-icons/react';
import { RECORD_TYPES, guardById } from '../../access';
import { Badge, fmtDate, fmtTime } from '../../ui';
import { EntityLink } from '../../components';
import './trust.css';
import '../detail/detail.css';

/** What a guard response is about: the record or the separation it answers. */
export function targetOf(db, resp) {
  if (resp.targetType === 'record') {
    const r = db.records.find((x) => x.id === resp.targetId);
    return { kind: 'record', record: r, label: r ? r.title : 'Deleted record' };
  }
  const e = db.employments.find((x) => x.id === resp.targetId);
  return { kind: 'employment', employment: e, label: e?.separation ? `Separation: ${e.separation.category}` : 'Employment record' };
}

/** Full description of the original entry a response is about. */
export function TargetSummary({ db, resp }) {
  const t = targetOf(db, resp);
  if (t.kind === 'record' && t.record) {
    const r = t.record;
    const type = RECORD_TYPES[r.type];
    return (
      <div className="tr-target">
        <div className="tr-target-head">
          <Badge tone={type.tone}>{type.short}</Badge>
          {r.severity && <Badge>{r.severity}</Badge>}
          {r.retracted && <Badge tone="ok">Retracted</Badge>}
        </div>
        <div className="tr-target-title"><EntityLink kind="record" id={r.id} className="dt2-inline-link">{r.title}</EntityLink></div>
        {r.detail && <p className="tr-target-detail">{r.detail}</p>}
        <dl className="tr-kv">
          <div><dt>Date</dt><dd>{fmtDate(r.date)}</dd></div>
          <div><dt>Evidence</dt><dd className="mono">{r.evidence || '—'}</dd></div>
          <div><dt>Recorded by</dt><dd>{r.createdBy || 'Employer'}</dd></div>
        </dl>
      </div>
    );
  }
  if (t.kind === 'employment' && t.employment) {
    const e = t.employment;
    const s = e.separation;
    return (
      <div className="tr-target">
        <div className="tr-target-head">
          <Badge tone="warn">Separation</Badge>
          {s && <Badge tone={s.rehire === 'Eligible' ? 'ok' : s.rehire === 'Conditional' ? 'warn' : 'bad'}>Rehire: {s.rehire}</Badge>}
        </div>
        <div className="tr-target-title">
          {e.position} · {s?.category ?? 'Current employment'}
        </div>
        {s?.note && <p className="tr-target-detail">{s.note}</p>}
        <dl className="tr-kv">
          <div><dt>Last day</dt><dd>{s ? fmtDate(s.date) : '—'}</dd></div>
          <div><dt>Evidence</dt><dd className="mono">{s?.evidence || '—'}</dd></div>
          <div><dt>Recorded by</dt><dd>{s?.by || 'Employer'}</dd></div>
        </dl>
      </div>
    );
  }
  return <p className="muted">The original entry is no longer available.</p>;
}

/**
 * Vertical timeline. steps: [{ label, at?, by?, note?, state: 'done'|'current'|'todo'|'bad' }]
 */
export function Timeline({ steps }) {
  return (
    <ol className="tr-timeline">
      {steps.map((s, i) => (
        <li key={i} className={`tr-step tr-step-${s.state}`}>
          <span className="tr-step-dot">
            {s.state === 'done' ? <Check size={11} weight="bold" /> : s.state === 'bad' ? <X size={11} weight="bold" /> : s.state === 'current' ? <Clock size={11} weight="bold" /> : <Circle size={8} weight="fill" />}
          </span>
          <div className="tr-step-body">
            <div className="tr-step-label">{s.label}</div>
            {(s.at || s.by) && (
              <div className="tr-step-meta">
                {s.at && <span className="mono">{fmtTime(s.at)}</span>}
                {s.at && s.by && ' · '}
                {s.by}
              </div>
            )}
            {s.note && <p className="tr-step-note">{s.note}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

export const guardName = (db, id) => guardById(db, id)?.name ?? 'Unknown guard';
export const firstName = (n = '') => n.split(' ')[0];
