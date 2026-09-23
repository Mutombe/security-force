/*
  SHARED CRUD MODALS — used from several screens.
    <RecordModal guardIds={[...]} record? defaultType? onClose />          create (one or many guards) / edit
    <SeparationModal employment onClose />
    <AttendanceModal employment onClose />
    <AssignSiteModal employments={[...]} onClose />
    <RequestVerificationModal guardId defaultTo? applicantId? onClose />
    <HireModal prefill? applicantId? onClose onDone(guardId)? />           multi-step register/hire wizard
    <EditGuardModal guard onClose />                                        identity, licence, photo
*/
import { useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Buildings, Camera, CheckCircle, DeviceMobile, FileText, Flag, GraduationCap, IdentificationCard,
  Medal, SignOut, Trash, UserPlus, Warning,
} from '@phosphor-icons/react';
import { newWorkforceId, useStore } from './store';
import {
  CITIES, POSITIONS, RECORD_TYPES, SCOPES, SEPARATION_CATEGORIES, SERIOUS_SEPARATIONS, company, coverage,
  currentEmployment, employmentsOf, guardById, releasedScopes, siteById,
} from './access';
import { Avatar, Badge, Button, Field, Modal, Segmented, addDays, addHours, fileToAvatar, fmtDate, fmtMonth, uid } from './ui';
import { GuardCell, LicenceBadge, PermissionNote } from './components';

const today = () => new Date().toISOString().slice(0, 10);
const RECORD_ICON = { training: GraduationCap, commendation: Medal, incident: Flag, disciplinary: Warning };

// ---------------------------------------------------------------- records
export function RecordModal({ guardIds, record, defaultType = 'training', onClose }) {
  const { db, session, act } = useStore();
  const editing = !!record;
  const [f, setF] = useState(
    record
      ? { type: record.type, title: record.title, date: record.date, detail: record.detail, severity: record.severity ?? 'Minor', expires: record.expires ?? '', evidence: record.evidence ?? '' }
      : { type: defaultType, title: '', date: today(), detail: '', severity: 'Minor', expires: '', evidence: '' },
  );
  const [touched, setTouched] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const conduct = f.type === 'incident' || f.type === 'disciplinary';
  const ids = editing ? [record.guardId] : guardIds;
  const errors = {
    title: !f.title.trim() ? 'Give the record a title.' : null,
    date: !f.date ? 'Pick a date.' : f.date > today() ? "Records can't be dated in the future." : null,
    evidence: conduct && !f.evidence.trim() ? 'Incidents and disciplinary actions need an evidence reference.' : null,
  };
  const valid = !Object.values(errors).some(Boolean);

  const save = () => {
    setTouched(true);
    if (!valid) return;
    const clean = { ...f, title: f.title.trim(), detail: f.detail.trim(), evidence: f.evidence.trim(), severity: conduct ? f.severity : null, expires: f.type === 'training' && f.expires ? f.expires : null };
    act({
      key: editing ? record.id : `records:${ids.join(',')}`,
      pending: editing ? 'Updating record…' : `Adding record${ids.length > 1 ? ` for ${ids.length} guards` : ''}…`,
      success: editing ? 'Record updated' : ids.length > 1 ? `Record added for ${ids.length} guards` : 'Record added',
      touches: ['records'],
      undo: true,
      apply: (d, t) => {
        if (editing) {
          const r = d.records.find((x) => x.id === record.id);
          Object.assign(r, clean, { editedAt: t.now, editedBy: t.actor.user });
          t.log('Edited record', `${RECORD_TYPES[r.type].short}: ${r.title} — ${guardById(d, r.guardId).name}`, { guardId: r.guardId });
        } else {
          ids.forEach((gid) => {
            d.records.push({ id: uid('R'), guardId: gid, companyId: session.companyId, ...clean, retracted: false, createdAt: t.now, createdBy: t.actor.user });
            t.log('Added record', `${RECORD_TYPES[f.type].short}: ${clean.title} — ${guardById(d, gid).name}`, { guardId: gid });
            t.notify(`guard:${gid}`, { title: `New ${RECORD_TYPES[f.type].short.toLowerCase()} on your record`, body: `${t.actor.name} added “${clean.title}”.`, link: { name: 'passport' } });
          });
        }
      },
    });
    onClose();
  };

  return (
    <Modal
      title={editing ? 'Edit record' : 'Add record'}
      subtitle={ids.length === 1 ? guardById(db, ids[0])?.name : `${ids.length} guards selected`}
      icon={FileText}
      size="md"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={touched && !valid}>
            {editing ? 'Save changes' : 'Add record'}
          </Button>
        </>
      }
    >
      {!editing && (
        <Segmented
          className="seg-4"
          value={f.type}
          onChange={(type) => setF({ ...f, type })}
          options={Object.entries(RECORD_TYPES).map(([k, v]) => ({ value: k, label: v.short, icon: RECORD_ICON[k] }))}
        />
      )}
      <Field label="Title" error={touched && errors.title}>
        <input value={f.title} onChange={set('title')} autoFocus placeholder={conduct ? 'e.g. Unauthorised absence from post' : f.type === 'training' ? 'e.g. First Aid Level 1' : 'e.g. Prevented perimeter break-in'} />
      </Field>
      <div className="form-grid">
        <Field label="Date" error={touched && errors.date}>
          <input type="date" value={f.date} max={today()} onChange={set('date')} />
        </Field>
        {conduct && (
          <Field label="Severity">
            <select value={f.severity} onChange={set('severity')}>
              <option>Minor</option>
              <option>Moderate</option>
              <option>Serious</option>
            </select>
          </Field>
        )}
        {f.type === 'training' && (
          <Field label="Expires" optional hint="We'll flag it 60 days before expiry.">
            <input type="date" value={f.expires} onChange={set('expires')} />
          </Field>
        )}
      </div>
      {(conduct || f.type === 'training') && (
        <Field label={conduct ? 'Evidence reference' : 'Certificate number'} optional={!conduct} error={touched && errors.evidence} hint={conduct ? 'Occurrence book entry, CCTV reference or HR file number.' : undefined}>
          <input value={f.evidence} onChange={set('evidence')} placeholder={conduct ? 'e.g. OB entry 118/26' : 'e.g. FA1-7781'} />
        </Field>
      )}
      <Field label={conduct ? 'What happened (facts only)' : 'Details'} optional={!conduct}>
        <textarea rows={3} value={f.detail} onChange={set('detail')} />
      </Field>
      {conduct && (
        <div className="notice notice-warn">
          <Warning size={16} />
          <span>Record facts, not opinions. The guard sees this entry and can respond. It stays with your company unless released through consented verification.</span>
        </div>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------- separation
export function SeparationModal({ employment, onClose }) {
  const { db, act } = useStore();
  const g = guardById(db, employment.guardId);
  const [f, setF] = useState({ date: today(), category: 'Resignation', rehire: 'Eligible', note: '', evidence: '' });
  const [step, setStep] = useState(1);
  const [typed, setTyped] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const serious = SERIOUS_SEPARATIONS.includes(f.category);
  const surname = g.name.split(' ').pop();
  const valid = f.date && f.note.trim().length >= 10 && (!serious || f.evidence.trim());

  const save = () =>
    act({
      key: employment.id,
      pending: 'Recording separation…',
      success: `${g.name} separated — ${f.category.toLowerCase()}`,
      touches: ['employments'],
      undo: true,
      apply: (d, t) => {
        const e = d.employments.find((x) => x.id === employment.id);
        e.end = f.date;
        e.separation = { category: f.category, rehire: f.rehire, note: f.note.trim(), evidence: f.evidence.trim(), date: f.date, by: t.actor.user };
        t.log('Recorded separation', `${g.name} (${g.id}) — ${f.category}, rehire ${f.rehire}`, { guardId: g.id });
        t.notify(`guard:${g.id}`, { title: 'Your employment has ended', body: `${t.actor.name} recorded: ${f.category}. You can add a response.`, link: { name: 'passport' } });
      },
    }).then(onClose);

  return (
    <Modal
      title="Record separation"
      subtitle={`${g.name} · ${employment.position}`}
      icon={SignOut}
      onClose={onClose}
      footer={
        step === 1 ? (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => setStep(2)} disabled={!valid} iconRight={ArrowRight}>
              Review
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" icon={ArrowLeft} onClick={() => setStep(1)}>
              Back
            </Button>
            <Button variant="danger" disabled={serious && typed.trim().toLowerCase() !== surname.toLowerCase()} onClick={save}>
              Confirm separation
            </Button>
          </>
        )
      }
    >
      {step === 1 ? (
        <>
          <div className="form-grid">
            <Field label="Last working day">
              <input type="date" value={f.date} min={employment.start} max={today()} onChange={set('date')} />
            </Field>
            <Field label="Reason">
              <select value={f.category} onChange={set('category')}>
                {SEPARATION_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Rehire eligibility">
            <Segmented value={f.rehire} onChange={(rehire) => setF({ ...f, rehire })} options={['Eligible', 'Conditional', 'Not eligible']} />
          </Field>
          {serious && (
            <Field label="Evidence reference" hint="Required for dismissals and absconding: hearing minutes, OB entry or HR file.">
              <input value={f.evidence} onChange={set('evidence')} placeholder="e.g. Hearing minutes HR-26-114" />
            </Field>
          )}
          <Field label="Factual note" hint="At least 10 characters. The guard can read this and respond.">
            <textarea rows={3} value={f.note} onChange={set('note')} />
          </Field>
        </>
      ) : (
        <>
          <dl className="review-list">
            <div><dt>Guard</dt><dd>{g.name}</dd></div>
            <div><dt>Last day</dt><dd>{fmtDate(f.date)}</dd></div>
            <div><dt>Reason</dt><dd>{f.category}</dd></div>
            <div><dt>Rehire</dt><dd>{f.rehire}</dd></div>
            {f.evidence && <div><dt>Evidence</dt><dd>{f.evidence}</dd></div>}
          </dl>
          <p className="quote">{f.note}</p>
          <div className="notice">
            <IdentificationCard size={16} />
            <span>{g.name.split(' ')[0]} keeps their Workforce ID and verified history. The reason is shared with other employers only with their consent.</span>
          </div>
          {serious && (
            <Field label={<>This is a serious separation. Type <b>{surname}</b> to confirm.</>}>
              <input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus autoComplete="off" />
            </Field>
          )}
        </>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------- attendance
export function AttendanceModal({ employment, onClose }) {
  const { db, act } = useStore();
  const g = guardById(db, employment.guardId);
  const [v, setV] = useState(employment.attendance);
  const [source, setSource] = useState('Manual correction');
  const save = () =>
    act({
      key: employment.id,
      pending: 'Updating attendance…',
      success: `Attendance set to ${v}%`,
      touches: ['employments'],
      undo: true,
      apply: (d, t) => {
        d.employments.find((e) => e.id === employment.id).attendance = Number(v);
        t.log('Updated attendance', `${g.name} (${g.id}) → ${v}% (${source})`, { guardId: g.id });
      },
    }).then(onClose);
  return (
    <Modal
      title="Update attendance"
      subtitle={g.name}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={Number(v) === employment.attendance}>
            Save
          </Button>
        </>
      }
    >
      <div className="big-number">
        {v}
        <span>%</span>
      </div>
      <input type="range" min="0" max="100" value={v} onChange={(e) => setV(e.target.value)} aria-label="Attendance rate" />
      <Field label="Source">
        <select value={source} onChange={(e) => setSource(e.target.value)}>
          <option>Manual correction</option>
          <option>Roster reconciliation</option>
          <option>Payroll import</option>
        </select>
      </Field>
      <p className="field-hint">Most companies sync this from payroll through an API key (Settings → Integrations).</p>
    </Modal>
  );
}

// ---------------------------------------------------------------- site assignment
export function AssignSiteModal({ employments, onClose }) {
  const { db, session, act } = useStore();
  const sites = db.sites.filter((s) => s.companyId === session.companyId && s.active);
  const [siteId, setSiteId] = useState(employments.length === 1 ? employments[0].siteId : sites[0]?.id);
  const save = () =>
    act({
      key: `assign:${employments.map((e) => e.id).join(',')}`,
      pending: 'Reassigning…',
      success: `${employments.length === 1 ? guardById(db, employments[0].guardId).name : `${employments.length} guards`} assigned to ${siteById(db, siteId).name}`,
      touches: ['employments'],
      undo: true,
      apply: (d, t) => {
        employments.forEach((emp) => {
          const e = d.employments.find((x) => x.id === emp.id);
          e.siteId = siteId;
          const g = guardById(d, e.guardId);
          t.log('Reassigned guard', `${g.name} → ${siteById(d, siteId).name}`, { guardId: g.id });
          t.notify(`guard:${g.id}`, { title: 'New site assignment', body: `You are now posted to ${siteById(d, siteId).name}.`, link: { name: 'passport' } });
        });
      },
    }).then(onClose);
  return (
    <Modal
      title="Assign to site"
      subtitle={employments.length === 1 ? guardById(db, employments[0].guardId).name : `${employments.length} guards`}
      icon={Buildings}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!siteId}>
            Assign
          </Button>
        </>
      }
    >
      <div className="option-list">
        {sites.map((s) => {
          const c = coverage(db, s);
          return (
            <label key={s.id} className={`option option-rich ${siteId === s.id ? 'on' : ''}`}>
              <input type="radio" name="site" checked={siteId === s.id} onChange={() => setSiteId(s.id)} />
              <span className="grow">
                <b>{s.name}</b>
                <span className="option-sub">
                  {s.city} · {s.risk} risk · {s.shift}
                </span>
              </span>
              <Badge tone={c.tone} dot>
                {c.filled}/{c.posts}
              </Badge>
            </label>
          );
        })}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- verification request
export function RequestVerificationModal({ guardId, defaultTo, applicantId, onClose }) {
  const { db, session, act } = useStore();
  const g = guardById(db, guardId);
  const me = session.companyId;
  const policy = company(db, me).policy;
  const employers = [...new Set(employmentsOf(db, guardId).map((e) => e.companyId))].filter((c) => c !== me);
  const [targets, setTargets] = useState(defaultTo ? [defaultTo] : employers);
  const [scopes, setScopes] = useState(policy.defaultScopes);
  const [purpose, setPurpose] = useState('');
  const [consentMode, setConsentMode] = useState('app');
  const [attest, setAttest] = useState(false);
  const toggle = (arr, set, k) => set(arr.includes(k) ? arr.filter((x) => x !== k) : [...arr, k]);
  const open = db.requests.filter((r) => r.guardId === guardId && r.fromCompanyId === me && ['pending', 'awaiting_consent'].includes(r.status)).map((r) => r.toCompanyId);
  const valid = company(db, me).status === 'active' && targets.length && scopes.length && purpose.trim().length >= 8 && (consentMode === 'app' || attest);

  const send = () =>
    act({
      key: `request:${guardId}`,
      pending: 'Sending verification request…',
      success: consentMode === 'app' ? `Consent request sent to ${g.name.split(' ')[0]}` : `Request sent to ${targets.length} employer${targets.length > 1 ? 's' : ''}`,
      touches: ['requests', 'applicants'],
      undo: true,
      apply: (d, t) => {
        targets.forEach((to) => {
          const createdAt = t.now;
          d.requests.unshift({
            id: uid('VR'), guardId, fromCompanyId: me, toCompanyId: to, requestedScopes: scopes, releasedScopes: [], purpose: purpose.trim(),
            consent: consentMode === 'app' ? 'pending' : 'offline', consentAt: consentMode === 'app' ? null : createdAt,
            status: consentMode === 'app' ? 'awaiting_consent' : 'pending', createdAt, dueAt: addHours(createdAt, company(d, to).policy.slaHours),
            createdBy: t.actor.user, respondedAt: null, respondedBy: null, responseNote: '', accessExpiresAt: null,
          });
          t.log('Requested verification', `${g.name} (${g.id}) from ${company(d, to).name}${consentMode === 'app' ? ' — awaiting consent' : ' — offline consent on file'}`, { guardId });
          if (consentMode !== 'app') t.notify(`company:${to}`, { title: 'New verification request', body: `${t.actor.name} asked about ${g.name}.`, link: { name: 'verification' } });
        });
        if (consentMode === 'app') t.notify(`guard:${guardId}`, { title: 'Consent needed', body: `${t.actor.name} wants to verify your history with ${targets.map((x) => company(d, x).name).join(', ')}.`, link: { name: 'consents' } });
        if (applicantId) {
          const a = d.applicants.find((x) => x.id === applicantId);
          if (a && ['applied', 'screening'].includes(a.stage)) Object.assign(a, { stage: 'verification', updatedAt: t.now });
        }
      },
    }).then(onClose);

  return (
    <Modal
      title="Request verification"
      subtitle={`${g.name} · ${g.id}`}
      icon={IdentificationCard}
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={send} disabled={!valid}>
            Send request{targets.length > 1 ? `s (${targets.length})` : ''}
          </Button>
        </>
      }
    >
      {company(db, me).status !== 'active' ? (
        <PermissionNote>Your company is awaiting regulator approval. You can request records from other employers once it is approved.</PermissionNote>
      ) : !employers.length ? (
        <PermissionNote>This guard has no other employers in the network, so there is nothing to verify.</PermissionNote>
      ) : (
        <>
          <Field label="Ask these previous employers">
            <div className="option-list">
              {employers.map((c) => {
                const co = company(db, c);
                const rel = releasedScopes(db, me, guardId, c);
                const emps = db.employments.filter((e) => e.guardId === guardId && e.companyId === c);
                return (
                  <label key={c} className={`option option-rich ${targets.includes(c) ? 'on' : ''}`}>
                    <input type="checkbox" checked={targets.includes(c)} onChange={() => toggle(targets, setTargets, c)} />
                    <span className="grow">
                      <b>{co.name}</b>
                      <span className="option-sub">
                        {emps.map((e) => `${e.position}, ${fmtMonth(e.start)} – ${fmtMonth(e.end)}`).join(' · ')}
                      </span>
                    </span>
                    {open.includes(c) ? <Badge tone="warn">Already open</Badge> : rel.size > 0 ? <Badge tone="ok">{rel.size} released</Badge> : null}
                  </label>
                );
              })}
            </div>
          </Field>
          <Field label="Information requested" hint={`Your company default is set in Settings. Access lasts ${policy.accessDays} days after release.`}>
            <div className="options">
              {SCOPES.map((s) => (
                <label key={s.key} className={`option ${scopes.includes(s.key) ? 'on' : ''}`}>
                  <input type="checkbox" checked={scopes.includes(s.key)} onChange={() => toggle(scopes, setScopes, s.key)} />
                  <span>{s.label}</span>
                </label>
              ))}
            </div>
          </Field>
          <Field label="Purpose" hint="Shown to the guard and the employer. Be specific.">
            <input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. Applicant for 24h post at Town House (City Hall)" />
          </Field>
          <Field label="Consent">
            <Segmented
              value={consentMode}
              onChange={setConsentMode}
              options={[
                { value: 'app', label: 'Ask in the app', icon: DeviceMobile },
                { value: 'offline', label: 'Signed form on file', icon: FileText },
              ]}
            />
          </Field>
          {consentMode === 'app' ? (
            <div className="notice">
              <DeviceMobile size={16} />
              <span>{g.name.split(' ')[0]} gets a consent request on their phone. The employer only sees your request after they approve it.</span>
            </div>
          ) : (
            <label className={`option consent ${attest ? 'on' : ''}`}>
              <input type="checkbox" checked={attest} onChange={(e) => setAttest(e.target.checked)} />
              <span>I confirm we hold a signed consent form from {g.name} for this request. The guard will be notified and can see what is shared.</span>
            </label>
          )}
        </>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------- hire wizard
export function HireModal({ prefill = {}, applicantId, onClose, onDone }) {
  const { db, session, act } = useStore();
  const me = session.companyId;
  const sites = db.sites.filter((s) => s.companyId === me && s.active);
  const [step, setStep] = useState(0);
  const [f, setF] = useState({
    nationalId: prefill.nationalId ?? '', name: prefill.name ?? '', dob: '', gender: 'M', city: 'Harare', phone: prefill.phone ?? '',
    licenceNumber: '', licenceExpiry: '', identity: true, qualifications: false, employment: false, references: false,
    position: prefill.position ?? 'Security Officer', siteId: prefill.siteId ?? sites[0]?.id ?? '', start: today(),
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const nid = f.nationalId.trim().toUpperCase();
  const existing = nid.length >= 8 ? db.guards.find((g) => g.nationalId.toUpperCase() === nid) : null;
  const lookalike = !existing && f.name.trim().length > 4 && f.dob ? db.guards.find((g) => g.name.toLowerCase() === f.name.trim().toLowerCase() && g.dob === f.dob) : null;
  const cur = existing && currentEmployment(db, existing.id);
  const blocked = cur && cur.companyId !== me;
  const already = cur && cur.companyId === me;
  const steps = ['Identity', existing ? 'Passport' : 'Details', 'Assignment', 'Review'];

  const canNext = [
    nid.length >= 8 && !blocked && !already,
    existing ? true : f.name.trim() && f.dob && f.phone.trim() && !lookalike,
    f.position && f.siteId && f.start,
    true,
  ][step];

  const finish = () => {
    const guardId = existing?.id ?? newWorkforceId(db);
    const site = siteById(db, f.siteId);
    act({
      key: `hire:${guardId}`,
      pending: existing ? `Hiring ${existing.name}…` : 'Registering and issuing a Workforce ID…',
      success: existing ? `${existing.name} hired` : `${f.name.trim()} registered as ${guardId}`,
      touches: ['guards', 'employments', 'applicants'],
      apply: (d, t) => {
        if (!existing) {
          d.guards.push({
            id: guardId, name: f.name.trim(), nationalId: nid, dob: f.dob, gender: f.gender, city: f.city, phone: f.phone.trim(),
            verification: { identity: f.identity, qualifications: f.qualifications, employment: f.employment, references: f.references },
            licence: { number: f.licenceNumber.trim() || 'Pending', expiry: f.licenceExpiry || addDays(t.now, 30).slice(0, 10) },
            avatar: null, createdAt: t.now,
          });
          t.log('Registered guard', `${f.name.trim()} — issued Workforce ID ${guardId}`, { guardId });
        }
        d.employments.push({ id: uid('E'), guardId, companyId: me, position: f.position, siteId: f.siteId, start: f.start, end: null, attendance: 100, separation: null });
        const gname = existing?.name ?? f.name.trim();
        t.log('Started employment', `${gname} as ${f.position} at ${site.name}`, { guardId });
        t.notify(`guard:${guardId}`, { title: `Welcome to ${t.actor.name}`, body: `You start as ${f.position} at ${site.name} on ${fmtDate(f.start)}.`, link: { name: 'passport' } });
        const a = applicantId ? d.applicants.find((x) => x.id === applicantId) : d.applicants.find((x) => x.companyId === me && x.nationalId.toUpperCase() === nid && x.stage !== 'hired');
        if (a) Object.assign(a, { stage: 'hired', guardId, updatedAt: t.now });
      },
    });
    onClose();
    onDone?.(guardId);
  };

  return (
    <Modal
      title={existing ? 'Hire from the network' : 'Register and hire'}
      icon={UserPlus}
      size="lg"
      onClose={onClose}
      footer={
        <>
          {step > 0 ? (
            <Button variant="ghost" icon={ArrowLeft} onClick={() => setStep(step - 1)}>
              Back
            </Button>
          ) : (
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          )}
          {step < 3 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canNext} iconRight={ArrowRight}>
              Continue
            </Button>
          ) : (
            <Button onClick={finish} icon={CheckCircle}>
              {existing ? 'Hire' : 'Register and issue ID'}
            </Button>
          )}
        </>
      }
    >
      <ol className="wizard-steps">
        {steps.map((s, i) => (
          <li key={s} className={i === step ? 'on' : i < step ? 'done' : ''}>
            <span>{i < step ? '✓' : i + 1}</span>
            {s}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <>
          <Field label="National ID number" hint="We check the network first so nobody gets two Workforce IDs. Try 63-5528134-Z-42 or 63-1184520-K-42.">
            <input className="mono input-lg" value={f.nationalId} onChange={set('nationalId')} autoFocus placeholder="00-0000000-X-00" autoComplete="off" />
          </Field>
          {existing && (
            <div className={`match ${blocked || already ? 'match-bad' : 'match-ok'}`}>
              <GuardCell guard={existing} size={44} />
              <div className="match-text">
                {blocked ? (
                  <>
                    Currently employed by <b>{company(db, cur.companyId).name}</b>. They must record a separation before another employment can start.
                  </>
                ) : already ? (
                  <>Already works for your company.</>
                ) : (
                  <>In the network with {employmentsOf(db, existing.id).length} verified employment(s). Hiring adds a new employment to their existing passport.</>
                )}
              </div>
            </div>
          )}
          {!existing && nid.length >= 8 && (
            <div className="match match-new">
              <IdentificationCard size={22} />
              <div className="match-text">Not in the network yet. You'll register them and issue a new Workforce ID.</div>
            </div>
          )}
        </>
      )}

      {step === 1 && existing && (
        <div className="stack-s">
          <GuardCell guard={existing} size={48} />
          <div className="row gap-s wrap">
            <LicenceBadge guard={existing} />
            {Object.entries(existing.verification).map(([k, v]) => (
              <Badge key={k} tone={v ? 'ok' : 'neutral'}>
                {v ? '✓' : '–'} {k}
              </Badge>
            ))}
          </div>
          <ul className="mini-timeline">
            {employmentsOf(db, existing.id).map((e) => (
              <li key={e.id}>
                <b>{e.position}</b> · {company(db, e.companyId).name}
                <span className="muted"> · {fmtMonth(e.start)} – {fmtMonth(e.end)}</span>
              </li>
            ))}
          </ul>
          <div className="notice">
            <IdentificationCard size={16} />
            <span>Before you hire, consider requesting verification from previous employers. You can do this from the applicant or the passport.</span>
          </div>
        </div>
      )}

      {step === 1 && !existing && (
        <>
          <div className="form-grid">
            <Field label="Full name">
              <input value={f.name} onChange={set('name')} autoFocus autoComplete="off" />
            </Field>
            <Field label="Date of birth">
              <input type="date" value={f.dob} max={addDays(new Date().toISOString(), -18 * 365).slice(0, 10)} onChange={set('dob')} />
            </Field>
            <Field label="Gender">
              <select value={f.gender} onChange={set('gender')}>
                <option value="M">Male</option>
                <option value="F">Female</option>
              </select>
            </Field>
            <Field label="Home city">
              <select value={f.city} onChange={set('city')}>
                {CITIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Mobile number" hint="Used for sign-in codes and consent requests.">
              <input type="tel" value={f.phone} onChange={set('phone')} placeholder="+263 7…" />
            </Field>
            <Field label="Security licence number" optional>
              <input value={f.licenceNumber} onChange={set('licenceNumber')} placeholder="PSL-000000" />
            </Field>
            <Field label="Licence expiry" optional>
              <input type="date" value={f.licenceExpiry} onChange={set('licenceExpiry')} />
            </Field>
          </div>
          {lookalike && (
            <div className="match match-bad">
              <GuardCell guard={lookalike} size={40} />
              <div className="match-text">
                Someone with the same name and date of birth already exists under national ID <span className="mono">{lookalike.nationalId}</span>. Check the ID before creating a duplicate.
              </div>
            </div>
          )}
          <Field label="Documents checked at onboarding">
            <div className="options options-4">
              {['identity', 'qualifications', 'employment', 'references'].map((k) => (
                <label key={k} className={`option ${f[k] ? 'on' : ''}`}>
                  <input type="checkbox" checked={f[k]} onChange={set(k)} />
                  <span>{k === 'employment' ? 'Prior employment' : k[0].toUpperCase() + k.slice(1)}</span>
                </label>
              ))}
            </div>
          </Field>
        </>
      )}

      {step === 2 && (
        <>
          <div className="form-grid">
            <Field label="Position">
              <select value={f.position} onChange={set('position')}>
                {POSITIONS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </Field>
            <Field label="Start date">
              <input type="date" value={f.start} onChange={set('start')} />
            </Field>
          </div>
          <Field label="Site">
            <div className="option-list">
              {sites.map((s) => {
                const c = coverage(db, s);
                return (
                  <label key={s.id} className={`option option-rich ${f.siteId === s.id ? 'on' : ''}`}>
                    <input type="radio" name="hire-site" checked={f.siteId === s.id} onChange={() => setF({ ...f, siteId: s.id })} />
                    <span className="grow">
                      <b>{s.name}</b>
                      <span className="option-sub">
                        {s.risk} risk · {s.shift}
                      </span>
                    </span>
                    <Badge tone={c.tone} dot>
                      {c.filled}/{c.posts}
                    </Badge>
                  </label>
                );
              })}
            </div>
          </Field>
        </>
      )}

      {step === 3 && (
        <dl className="review-list">
          <div><dt>Person</dt><dd>{existing?.name ?? f.name}</dd></div>
          <div><dt>National ID</dt><dd className="mono">{nid}</dd></div>
          <div><dt>Workforce ID</dt><dd className="mono">{existing ? existing.id : 'Issued on save'}</dd></div>
          <div><dt>Position</dt><dd>{f.position}</dd></div>
          <div><dt>Site</dt><dd>{siteById(db, f.siteId)?.name}</dd></div>
          <div><dt>Start</dt><dd>{fmtDate(f.start)}</dd></div>
        </dl>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------- edit guard
export function EditGuardModal({ guard, onClose }) {
  const { session, act } = useStore();
  const self = session.kind === 'guard';
  const fileRef = useRef(null);
  const [f, setF] = useState({
    phone: guard.phone, city: guard.city, licenceNumber: guard.licence.number, licenceExpiry: guard.licence.expiry,
    avatar: guard.avatar, ...guard.verification,
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const [err, setErr] = useState('');
  const pick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return setErr('Choose an image file.');
    if (file.size > 8 * 1024 * 1024) return setErr('That image is over 8 MB.');
    setErr('');
    setF({ ...f, avatar: await fileToAvatar(file) });
  };
  const dirty = useMemo(
    () => f.phone !== guard.phone || f.city !== guard.city || f.avatar !== guard.avatar || f.licenceNumber !== guard.licence.number || f.licenceExpiry !== guard.licence.expiry || Object.keys(guard.verification).some((k) => f[k] !== guard.verification[k]),
    [f, guard],
  );
  const save = () =>
    act({
      key: guard.id,
      pending: 'Saving profile…',
      success: 'Profile updated',
      touches: ['guards'],
      undo: true,
      apply: (d, t) => {
        const g = d.guards.find((x) => x.id === guard.id);
        g.phone = f.phone.trim();
        g.city = f.city;
        g.avatar = f.avatar;
        if (!self) {
          g.licence = { number: f.licenceNumber.trim(), expiry: f.licenceExpiry };
          g.verification = { identity: f.identity, qualifications: f.qualifications, employment: f.employment, references: f.references };
        }
        t.log('Updated profile', `${g.name} (${g.id})`, { guardId: g.id });
      },
    }).then(onClose);
  return (
    <Modal
      title="Edit profile"
      subtitle={`${guard.name} · ${guard.id}`}
      size="md"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!dirty}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="photo-edit">
        <Avatar name={guard.name} seed={guard.id} src={f.avatar} size={72} />
        <div className="stack-xs">
          <div className="row gap-s">
            <Button variant="ghost" size="sm" icon={Camera} onClick={() => fileRef.current?.click()}>
              Upload photo
            </Button>
            {f.avatar && (
              <Button variant="subtle" size="sm" icon={Trash} onClick={() => setF({ ...f, avatar: null })}>
                Remove
              </Button>
            )}
          </div>
          <span className="field-hint">{err || 'A clear, front-facing photo helps clients recognise the guard at the gate.'}</span>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={pick} />
        </div>
      </div>
      <div className="form-grid">
        <Field label="Mobile number">
          <input type="tel" value={f.phone} onChange={set('phone')} />
        </Field>
        <Field label="Home city">
          <select value={f.city} onChange={set('city')}>
            {CITIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        {!self && (
          <>
            <Field label="Security licence number">
              <input value={f.licenceNumber} onChange={set('licenceNumber')} />
            </Field>
            <Field label="Licence expiry">
              <input type="date" value={f.licenceExpiry} onChange={set('licenceExpiry')} />
            </Field>
          </>
        )}
      </div>
      {!self && (
        <Field label="Verified documents">
          <div className="options options-4">
            {['identity', 'qualifications', 'employment', 'references'].map((k) => (
              <label key={k} className={`option ${f[k] ? 'on' : ''}`}>
                <input type="checkbox" checked={f[k]} onChange={set(k)} />
                <span>{k === 'employment' ? 'Prior employment' : k[0].toUpperCase() + k.slice(1)}</span>
              </label>
            ))}
          </div>
        </Field>
      )}
    </Modal>
  );
}
