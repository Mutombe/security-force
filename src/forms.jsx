// The five forms in ProCheQ. All are centred modals and all saves are instant with a toast.
import { useState } from 'react';
import { ChatCircleText, FileText, Handshake, SignOut, UserPlus } from '@phosphor-icons/react';
import { newProcheqId, useStore } from './store';
import { ACCESS_DAYS, CITIES, EXIT_REASONS, RECORD_TYPES, REHIRE, ROLES, company, currentJob, findGuard, guardById, isSeriousExit } from './access';
import { Button, Field, Modal, Segmented, uid } from './ui';
import { GuardCell } from './components';

const today = () => new Date().toISOString().slice(0, 10);

// ------------------------------------------------------------------ add a guard (hire)
export function AddGuardModal({ onClose, onDone, prefillId = '' }) {
  const { db, session, act } = useStore();
  const [nid, setNid] = useState(prefillId);
  const [f, setF] = useState({ name: '', dob: '', gender: 'M', city: 'Harare', phone: '', licenceNumber: '', licenceExpiry: '', role: 'Security Officer', start: today() });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const found = nid.trim().length >= 6 ? findGuard(db, nid) : null;
  const job = found && currentJob(db, found.id);
  const mine = job && job.companyId === session.companyId;
  const elsewhere = job && !mine;
  const isNew = !found && /^\d{2}-\d{6,7}-[A-Z]-\d{2}$/i.test(nid.trim());
  const ready = found ? !job && f.role && f.start : isNew && f.name.trim() && f.dob && f.phone.trim() && f.role && f.start;

  const save = () => {
    const id = found?.id ?? newProcheqId(db);
    act({
      pending: found ? `Adding ${found.name}…` : 'Creating ProCheQ profile…',
      success: found ? `${found.name} added to your guards` : `${f.name.trim()} added · ${id}`,
      touches: ['guards', 'employments'],
      undo: true,
      apply: (d, t) => {
        if (!found) {
          d.guards.push({
            id, name: f.name.trim(), nationalId: nid.trim().toUpperCase(), dob: f.dob, gender: f.gender, city: f.city, phone: f.phone.trim(),
            licence: { number: f.licenceNumber.trim() || 'Pending', expiry: f.licenceExpiry || today() },
            verified: { identity: true, qualifications: false }, avatar: null,
          });
          t.log('Created profile', `${f.name.trim()} · ${id}`, { guardId: id });
        }
        d.employments.push({ id: uid('E'), guardId: id, companyId: session.companyId, role: f.role, start: f.start, end: null, exit: null, reply: null });
        t.log('Employed guard', `${found?.name ?? f.name.trim()} as ${f.role}`, { guardId: id });
      },
    });
    onClose();
    onDone?.(id);
  };

  return (
    <Modal
      title="Add a guard"
      subtitle="Start with their national ID. If they're already on ProCheQ, their verified history comes with them."
      icon={UserPlus}
      size="md"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={!ready}>{found ? 'Add to my guards' : 'Create profile and add'}</Button>
        </>
      }
    >
      <Field label="National ID" hint="Format 00-0000000-X-00. Try 63-5528134-Z-42 (on ProCheQ, available) or 63-1184520-K-42 (employed elsewhere).">
        <input className="mono input-lg" value={nid} onChange={(e) => setNid(e.target.value)} autoFocus autoComplete="off" placeholder="63-0000000-X-42" />
      </Field>

      {found && (
        <div className={`match ${elsewhere || mine ? 'match-bad' : 'match-ok'}`}>
          <GuardCell guard={found} size={44} link={false} />
          <p className="match-text">
            {mine
              ? 'Already one of your guards.'
              : elsewhere
                ? `Currently employed by ${company(db, job.companyId).name}. They need to be released there first.`
                : 'Already on ProCheQ and not currently employed. Their career history, training and licence come with them.'}
          </p>
        </div>
      )}

      {isNew && (
        <>
          <div className="match match-new">
            <p className="match-text">New to ProCheQ. We'll create their profile and give them a ProCheQ ID.</p>
          </div>
          <div className="form-grid">
            <Field label="Full name"><input value={f.name} onChange={set('name')} autoComplete="off" /></Field>
            <Field label="Date of birth"><input type="date" value={f.dob} onChange={set('dob')} /></Field>
            <Field label="Mobile number" hint="Used to sign in and to approve requests."><input type="tel" value={f.phone} onChange={set('phone')} placeholder="+263 7…" /></Field>
            <Field label="Home city">
              <select value={f.city} onChange={set('city')}>{CITIES.map((c) => <option key={c}>{c}</option>)}</select>
            </Field>
            <Field label="Security licence number" optional><input value={f.licenceNumber} onChange={set('licenceNumber')} placeholder="PSL-000000" /></Field>
            <Field label="Licence expiry" optional><input type="date" value={f.licenceExpiry} onChange={set('licenceExpiry')} /></Field>
          </div>
        </>
      )}

      {(isNew || (found && !job)) && (
        <div className="form-grid">
          <Field label="Role">
            <select value={f.role} onChange={set('role')}>{ROLES.map((r) => <option key={r}>{r}</option>)}</select>
          </Field>
          <Field label="Start date"><input type="date" value={f.start} onChange={set('start')} /></Field>
        </div>
      )}
    </Modal>
  );
}

// ------------------------------------------------------------------ add a record
export function RecordModal({ guardId, onClose }) {
  const { db, session, act } = useStore();
  const g = guardById(db, guardId);
  const [f, setF] = useState({ type: 'training', title: '', date: today(), severity: 'Minor', evidence: '', expires: '', detail: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const priv = RECORD_TYPES[f.type].private;
  const ready = f.title.trim() && f.date && (!priv || f.evidence.trim());
  const save = () => {
    act({
      pending: 'Saving record…',
      success: 'Record added',
      touches: ['records'],
      undo: true,
      apply: (d, t) => {
        d.records.push({
          id: uid('R'), guardId, companyId: session.companyId, type: f.type, title: f.title.trim(), date: f.date, detail: f.detail.trim(),
          severity: priv ? f.severity : null, evidence: f.evidence.trim(), expires: f.type === 'training' && f.expires ? f.expires : null, reply: null,
        });
        t.log('Added record', `${RECORD_TYPES[f.type].label}: ${f.title.trim()} · ${g.name}`, { guardId });
      },
    });
    onClose();
  };
  return (
    <Modal
      title="Add a record"
      subtitle={g.name}
      icon={FileText}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={!ready}>Add record</Button>
        </>
      }
    >
      <Segmented className="seg-4" value={f.type} onChange={(type) => setF({ ...f, type })} options={Object.entries(RECORD_TYPES).map(([k, v]) => ({ value: k, label: v.label }))} />
      <p className="form-note">
        {priv
          ? 'Private: only you, the guard, and companies the guard approves can see this.'
          : 'Visible to every member company that checks this guard.'}
      </p>
      <Field label="Title"><input value={f.title} onChange={set('title')} autoFocus placeholder={priv ? 'e.g. Post left unmanned' : 'e.g. First Aid Level 1'} /></Field>
      <div className="form-grid">
        <Field label="Date"><input type="date" value={f.date} max={today()} onChange={set('date')} /></Field>
        {priv && (
          <Field label="Severity">
            <select value={f.severity} onChange={set('severity')}><option>Minor</option><option>Moderate</option><option>Serious</option></select>
          </Field>
        )}
        {f.type === 'training' && <Field label="Expires" optional><input type="date" value={f.expires} onChange={set('expires')} /></Field>}
      </div>
      {priv && (
        <Field label="Evidence reference" hint="Occurrence book entry, CCTV reference or HR file. Records must be factual.">
          <input value={f.evidence} onChange={set('evidence')} placeholder="e.g. OB entry 118/26" />
        </Field>
      )}
      <Field label="Details" optional><textarea rows={3} value={f.detail} onChange={set('detail')} /></Field>
    </Modal>
  );
}

// ------------------------------------------------------------------ end employment
export function ExitModal({ employment, onClose }) {
  const { db, act } = useStore();
  const g = guardById(db, employment.guardId);
  const [f, setF] = useState({ date: today(), reason: 'Resigned', rehire: 'Yes', note: '' });
  const [factual, setFactual] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const serious = isSeriousExit(f.reason);
  const ready = f.date && f.note.trim().length >= 10 && (!serious || factual);
  const save = () => {
    act({
      pending: 'Ending employment…',
      success: `${g.name} released · ${f.reason.toLowerCase()}`,
      touches: ['employments'],
      undo: true,
      apply: (d, t) => {
        const e = d.employments.find((x) => x.id === employment.id);
        e.end = f.date;
        e.exit = { reason: f.reason, rehire: f.rehire, note: f.note.trim() };
        t.log('Ended employment', `${g.name} · ${f.reason} · rehire: ${f.rehire}`, { guardId: g.id });
      },
    });
    onClose();
  };
  return (
    <Modal
      title="End employment"
      subtitle={`${g.name} · ${employment.role}`}
      icon={SignOut}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant={serious ? 'danger' : 'primary'} onClick={save} disabled={!ready}>End employment</Button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Last working day"><input type="date" value={f.date} min={employment.start} max={today()} onChange={set('date')} /></Field>
        <Field label="Reason">
          <select value={f.reason} onChange={set('reason')}>{EXIT_REASONS.map((r) => <option key={r}>{r}</option>)}</select>
        </Field>
      </div>
      <Field label="Would you employ them again?">
        <Segmented value={f.rehire} onChange={(rehire) => setF({ ...f, rehire })} options={REHIRE} />
      </Field>
      <Field label="What happened" hint="Facts only, at least 10 characters. The guard will see this and can reply.">
        <textarea rows={3} value={f.note} onChange={set('note')} />
      </Field>
      {serious && (
        <label className={`option consent ${factual ? 'on' : ''}`}>
          <input type="checkbox" checked={factual} onChange={(e) => setFactual(e.target.checked)} />
          <span>This is a serious exit reason. We confirm it is accurate and that we hold evidence for it.</span>
        </label>
      )}
      <p className="form-note">The exit reason is private. Other companies see it only if {g.name.split(' ')[0]} approves.</p>
    </Modal>
  );
}

// ------------------------------------------------------------------ ask to see the full record
export function AskModal({ guardId, onClose }) {
  const { db, session, act } = useStore();
  const g = guardById(db, guardId);
  const [reason, setReason] = useState('');
  const save = () => {
    act({
      pending: 'Sending request…',
      success: `Request sent to ${g.name.split(' ')[0]}`,
      touches: ['requests'],
      undo: true,
      apply: (d, t) => {
        d.requests.push({ id: uid('RQ'), companyId: session.companyId, guardId, reason: reason.trim(), status: 'pending', askedAt: t.now, decidedAt: null, expiresAt: null });
        t.log('Asked to see full record', g.name, { guardId });
      },
    });
    onClose();
  };
  return (
    <Modal
      title="Ask to see the full record"
      subtitle={g.name}
      icon={Handshake}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={reason.trim().length < 8}>Send request</Button>
        </>
      }
    >
      <ol className="steps">
        <li><b>{g.name.split(' ')[0]} gets your request on their phone.</b> Nothing private is shared until they approve.</li>
        <li><b>If they approve,</b> you see incidents, disciplinary actions, why they left each job and whether each employer would rehire them, with their replies.</li>
        <li><b>Access lasts {ACCESS_DAYS} days.</b> They can withdraw it sooner, and they can see that you looked.</li>
      </ol>
      <Field label="Why are you asking?" hint="The guard sees this.">
        <input value={reason} onChange={(e) => setReason(e.target.value)} autoFocus placeholder="e.g. Applied for a security officer post" />
      </Field>
    </Modal>
  );
}

// ------------------------------------------------------------------ guard's reply to a record or exit
export function ReplyModal({ target, kind, onClose }) {
  const { db, act } = useStore();
  const [text, setText] = useState(target.reply?.text ?? '');
  const title = kind === 'exit' ? `Exit from ${company(db, target.companyId).name}: ${target.exit.reason}` : target.title;
  const save = () => {
    act({
      pending: 'Saving your reply…',
      success: 'Your reply is attached',
      touches: ['employments', 'records'],
      undo: true,
      apply: (d, t) => {
        const list = kind === 'exit' ? d.employments : d.records;
        list.find((x) => x.id === target.id).reply = { text: text.trim(), at: t.now };
        t.log('Replied', title, { guardId: target.guardId });
      },
    });
    onClose();
  };
  return (
    <Modal
      title={target.reply ? 'Edit your reply' : 'Add your reply'}
      subtitle={title}
      icon={ChatCircleText}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={text.trim().length < 10}>Save reply</Button>
        </>
      }
    >
      <p className="form-note">Your reply is always shown next to this record, to everyone who can see it.</p>
      <Field label="Your side of the story">
        <textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
      </Field>
    </Modal>
  );
}
