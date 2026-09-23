// Pieces shared by the passport, guard portal and client portal screens.
import { useState } from 'react';
import { ChatCircleText, Plugs, Scales } from '@phosphor-icons/react';
import { useStore } from '../../store';
import { RECORD_TYPES, company, guardById } from '../../access';
import { Avatar, Button, EmptyState, Field, Modal, OrgMark, addDays, fmtClock, fmtDate } from '../../ui';

// Two-line machine-readable zone, like the bottom of a travel document.
export function mrz(guard, pii) {
  const clean = (s) => s.toUpperCase().replace(/[^A-Z0-9]/g, '<');
  const parts = guard.name.split(' ');
  const surname = parts.pop();
  const l1 = `P<ZWE${clean(surname)}<<${clean(parts.join(' '))}`;
  const dob = pii ? guard.dob.slice(2).replace(/-/g, '') : '<<<<<<';
  const l2 = `${guard.id.replace('-', '')}<ZWE${dob}${pii ? guard.gender : '<'}<<<<<<SECURITYFORCE`;
  return [l1, l2].map((l) => l.padEnd(44, '<').slice(0, 44));
}

export function monthsBetween(a, b) {
  const s = new Date(a);
  const e = b ? new Date(b) : new Date();
  const m = Math.max(0, (e.getFullYear() - s.getFullYear()) * 12 + e.getMonth() - s.getMonth());
  if (m < 12) return `${m || 1} mo`;
  const y = Math.floor(m / 12);
  return m % 12 ? `${y} yr ${m % 12} mo` : `${y} yr`;
}

/** Describe what a guard response answers: a record or a separation. */
export function responseTarget(db, resp) {
  if (resp.targetType === 'record') {
    const r = db.records.find((x) => x.id === resp.targetId);
    return { title: r?.title ?? 'Record', kind: r ? RECORD_TYPES[r.type].short : 'Record' };
  }
  const e = db.employments.find((x) => x.id === resp.targetId);
  return { title: e?.separation ? `Separation — ${e.separation.category}` : 'Separation', kind: 'Separation' };
}

/** Records and separations the guard can still respond to. */
export function respondable(db, guardId) {
  const has = (type, id) => db.responses.some((r) => r.guardId === guardId && r.targetType === type && r.targetId === id);
  const recs = db.records
    .filter((r) => r.guardId === guardId && !r.retracted && ['incident', 'disciplinary'].includes(r.type) && !has('record', r.id))
    .map((r) => ({ type: 'record', item: r, companyId: r.companyId, label: r.title, sub: `${RECORD_TYPES[r.type].short} · ${fmtDate(r.date)}` }));
  const seps = db.employments
    .filter((e) => e.guardId === guardId && e.end && e.separation && !has('employment', e.id))
    .map((e) => ({ type: 'employment', item: e, companyId: e.companyId, label: `Separation — ${e.separation.category}`, sub: `${e.position} · ${fmtDate(e.end)}` }));
  return [...recs, ...seps];
}

/** Write a guard's response to a record or separation. `target` = { type, item, companyId, label }. */
export function RespondModal({ guardId, target, onClose }) {
  const { db, act } = useStore();
  const [text, setText] = useState('');
  const g = guardById(db, guardId);
  const co = company(db, target.companyId);
  const ok = text.trim().length >= 20;
  const save = () =>
    act({
      key: `resp:${target.item.id}`,
      pending: 'Sending your response…',
      success: `Response sent to ${co.name}`,
      touches: ['responses'],
      undo: true,
      apply: (d, t) => {
        d.responses.unshift({
          id: `RS-${Date.now().toString(36).toUpperCase()}`, guardId, companyId: target.companyId, targetType: target.type, targetId: target.item.id,
          text: text.trim(), status: 'open', companyNote: '', createdAt: t.now, dueAt: addDays(t.now, 14), escalatedAt: null, regulatorNote: '',
        });
        t.log('Submitted response', `${g.name} responded to “${target.label}” at ${co.name}`, { guardId });
        t.notify(`company:${target.companyId}`, { title: 'Guard response to review', body: `${g.name} responded to “${target.label}”. Please review within 14 days.`, link: { name: 'disputes' } });
      },
    }).then(onClose);
  return (
    <Modal
      title="Add your response"
      subtitle={`${target.label} · ${co.name}`}
      icon={ChatCircleText}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!ok}>
            Send response
          </Button>
        </>
      }
    >
      <p className="muted small">
        Your response is attached to this entry wherever it is shared. {co.name} has 14 days to review it. If they keep the record unchanged, you can ask the regulator to look at it.
      </p>
      <Field label="Your account" hint={`${text.trim().length} characters · at least 20. Stick to facts: dates, names, reference numbers.`}>
        <textarea rows={6} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
      </Field>
    </Modal>
  );
}

/** Company mark, person portrait or institution icon for an audit entry. */
export function ActorMark({ entry, size = 30 }) {
  const { db } = useStore();
  if (entry.actorRole === 'staff' || entry.actorRole === 'integration') {
    const c = company(db, entry.actorId);
    if (entry.actorRole === 'integration')
      return (
        <span className="pp-actor-icon" style={{ width: size, height: size }}>
          <Plugs size={size * 0.5} />
        </span>
      );
    return c ? <OrgMark company={c} size={size} /> : <Avatar name={entry.actor} size={size} />;
  }
  if (entry.actorRole === 'guard') return <Avatar name={entry.actor} seed={entry.actorId} src={guardById(db, entry.actorId)?.avatar} size={size} />;
  if (entry.actorRole === 'regulator')
    return (
      <span className="pp-actor-icon" style={{ width: size, height: size }}>
        <Scales size={size * 0.5} />
      </span>
    );
  return <Avatar name={entry.actor} size={size} />;
}

const dayLabel = (iso) => {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date(Date.now() - 86400000);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
};

/** Audit entries grouped by day. */
export function ActivityTimeline({ entries, empty = 'No activity yet.' }) {
  if (!entries.length) return <EmptyState compact body={empty} />;
  const groups = [];
  entries.forEach((a) => {
    const k = dayLabel(a.ts);
    const last = groups[groups.length - 1];
    if (last?.k === k) last.items.push(a);
    else groups.push({ k, items: [a] });
  });
  return (
    <div className="pp-activity">
      {groups.map((g) => (
        <section key={g.k}>
          <h4 className="pp-activity-day">{g.k}</h4>
          <ol>
            {g.items.map((a) => (
              <li key={a.id}>
                <ActorMark entry={a} />
                <div className="grow">
                  <div className="pp-activity-line">
                    <b>{a.actor}</b>
                    {a.actorUser && a.actorUser !== a.actor && <span className="muted"> · {a.actorUser}</span>}
                    <span className="pp-activity-action"> {a.action.toLowerCase()}</span>
                  </div>
                  <div className="pp-activity-detail">{a.detail}</div>
                </div>
                <time className="pp-activity-time">{fmtClock(a.ts)}</time>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
