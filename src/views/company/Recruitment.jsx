import { useMemo, useState } from 'react';
import {
  ArrowRight, Eye, Handshake, IdentificationCard, Kanban, ListBullets, PencilSimple, Plus, Trash, UploadSimple, UserPlus, Warning, XCircle,
} from '@phosphor-icons/react';
import { useStore } from '../../store';
import {
  POSITIONS, REQUEST_STATUS, STAGES, company, currentEmployment, deniedHint, employmentsOf, guardById, licenceStatus, siteById,
} from '../../access';
import {
  Avatar, Badge, Button, ConfirmModal, DataTable, Drawer, EmptyState, Field, FilterSelect, Menu, Modal, PageHead, SearchInput,
  Segmented, Tabs, daysUntil, fmtDate, fmtMonth, fromNow, parseCSV, plural, uid, useIsMobile,
} from '../../ui';
import { CompanyCell, GuardCell, LicenceBadge, SiteLabel, SlaBadge } from '../../components';
import { HireModal, RequestVerificationModal } from '../../modals';
import './company.css';

const OPEN = ['applied', 'screening', 'verification', 'offer'];
const stageLabel = (k) => STAGES.find((s) => s.key === k)?.label ?? k;
const daysIn = (a) => Math.max(0, -daysUntil(a.updatedAt ?? a.createdAt));

/** Everything the network knows about an applicant, from this company's point of view. */
function networkInfo(db, a, me) {
  const guard = a.guardId ? guardById(db, a.guardId) : db.guards.find((g) => g.nationalId.toUpperCase() === a.nationalId.toUpperCase());
  if (!guard) return { guard: null };
  const cur = currentEmployment(db, guard.id);
  const emps = employmentsOf(db, guard.id);
  const requests = db.requests.filter((r) => r.guardId === guard.id && r.fromCompanyId === me).sort((x, y) => y.createdAt.localeCompare(x.createdAt));
  return {
    guard,
    cur,
    emps,
    elsewhere: cur && cur.companyId !== me,
    ours: cur && cur.companyId === me,
    lic: licenceStatus(guard),
    requests,
    others: [...new Set(emps.map((e) => e.companyId))].filter((c) => c !== me),
  };
}

function NetworkBadges({ info }) {
  const { db } = useStore();
  if (!info.guard) return <Badge>New to network</Badge>;
  const last = info.requests[0];
  return (
    <>
      <Badge tone="info" icon={IdentificationCard}>
        In network
      </Badge>
      {info.elsewhere && (
        <Badge tone="warn" title={`Employed by ${company(db, info.cur.companyId).name}`}>
          Employed elsewhere
        </Badge>
      )}
      {info.lic.tone !== 'ok' && <Badge tone={info.lic.tone}>Licence {info.lic.tone === 'bad' ? 'expired' : 'expiring'}</Badge>}
      {last && <Badge tone={REQUEST_STATUS[last.status]?.tone}>{REQUEST_STATUS[last.status]?.label}</Badge>}
    </>
  );
}

export default function Recruitment({ go, id }) {
  const { db, session, can, act, isPending } = useStore();
  const me = session.companyId;
  const mobile = useIsMobile();
  const [view, setView] = useState('board');
  const [q, setQ] = useState('');
  const [position, setPosition] = useState('');
  const [stageTab, setStageTab] = useState('applied');
  const [modal, setModal] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [over, setOver] = useState(null);

  const all = db.applicants.filter((a) => a.companyId === me);
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return all
      .filter((a) => !position || a.position === position)
      .filter((a) => !t || `${a.name} ${a.nationalId} ${a.phone} ${siteById(db, a.siteId)?.name ?? ''}`.toLowerCase().includes(t))
      .map((a) => ({ ...a, info: networkInfo(db, a, me) }))
      .sort((x, y) => (y.updatedAt ?? y.createdAt).localeCompare(x.updatedAt ?? x.createdAt));
  }, [all, q, position, db, me]);

  const edit = can('recruit.manage');
  const editHint = deniedHint(session, 'recruit.manage');
  const drawer = id ? all.find((a) => a.id === id) : null;
  const open = all.filter((a) => OPEN.includes(a.stage));
  const flagged = open.filter((a) => networkInfo(db, a, me).elsewhere).length;
  const stale = open.filter((a) => daysIn(a) >= 7).length;

  const move = (a, stage) => {
    if (a.stage === stage) return;
    if (stage === 'hired') return setModal({ kind: 'hire', a });
    if (stage === 'rejected') return setModal({ kind: 'reject', a });
    act({
      key: a.id,
      pending: `Moving ${a.name}…`,
      success: `${a.name} moved to ${stageLabel(stage)}`,
      touches: ['applicants'],
      undo: true,
      apply: (d, t) => {
        Object.assign(d.applicants.find((x) => x.id === a.id), { stage, updatedAt: t.now });
        t.log('Moved applicant', `${a.name}: ${stageLabel(a.stage)} → ${stageLabel(stage)}`, { guardId: a.guardId });
      },
    });
  };

  const cardMenu = (a) => (
    <Menu
      label={`Actions for ${a.name}`}
      items={[
        { label: 'Open', icon: Eye, onClick: () => go('recruitment', { id: a.id }) },
        { divider: true },
        ...STAGES.filter((s) => s.key !== a.stage).map((s) => ({
          label: `Move to ${s.label}`,
          icon: s.key === 'hired' ? UserPlus : s.key === 'rejected' ? XCircle : ArrowRight,
          onClick: () => move(a, s.key),
          disabled: s.key === 'hired' ? !can('guard.hire') || a.stage === 'hired' : !edit || a.stage === 'hired',
          hint: s.key === 'hired' ? deniedHint(session, 'guard.hire') : a.stage === 'hired' ? 'Already hired' : editHint,
        })),
        { divider: true },
        { label: 'Edit applicant', icon: PencilSimple, onClick: () => setModal({ kind: 'edit', a }), disabled: !edit, hint: editHint },
        { label: 'Delete', icon: Trash, danger: true, onClick: () => setModal({ kind: 'delete', a }), disabled: !edit, hint: editHint },
      ]}
    />
  );

  const card = (a, draggable) => (
    <article
      key={a.id}
      className={`co-card ${dragId === a.id ? 'is-dragging' : ''} ${isPending(a.id) ? 'is-pending' : ''}`}
      draggable={draggable && edit && a.stage !== 'hired'}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', a.id);
        e.dataTransfer.effectAllowed = 'move';
        setDragId(a.id);
      }}
      onDragEnd={() => {
        setDragId(null);
        setOver(null);
      }}
      onClick={() => go('recruitment', { id: a.id })}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && go('recruitment', { id: a.id })}
    >
      <div className="co-card-top">
        <Avatar name={a.name} seed={a.info.guard?.id} src={a.info.guard?.avatar} size={36} />
        <div className="grow">
          <div className="co-card-name">{a.name}</div>
          <div className="co-card-sub">{a.position}</div>
        </div>
        {cardMenu(a)}
      </div>
      <div className="chips">
        <NetworkBadges info={a.info} />
      </div>
      <div className="co-card-foot">
        <SiteLabel id={a.siteId} />
        {OPEN.includes(a.stage) && <span className={daysIn(a) >= 7 ? 'co-stale' : ''}>{daysIn(a) ? `${daysIn(a)}d in stage` : 'Today'}</span>}
      </div>
    </article>
  );

  const columns = [
    { key: 'name', header: 'Applicant', width: 'minmax(200px, 2fr)', sort: (a) => a.name, mobile: 'primary', render: (a) => (a.info.guard ? <GuardCell guard={a.info.guard} sub={a.position} /> : <span className="cell-person"><Avatar name={a.name} size={34} /><span className="cell-person-text"><span className="cell-name">{a.name}</span><span className="cell-sub">{a.position}</span></span></span>) },
    { key: 'stage', header: 'Stage', width: '120px', sort: (a) => STAGES.findIndex((s) => s.key === a.stage), mobile: 'aside', render: (a) => <Badge tone={a.stage === 'hired' ? 'ok' : a.stage === 'rejected' ? 'neutral' : 'info'}>{stageLabel(a.stage)}</Badge> },
    { key: 'site', header: 'Target site', width: 'minmax(160px, 1.4fr)', sort: (a) => siteById(db, a.siteId)?.name ?? '', mobile: 'meta', render: (a) => <SiteLabel id={a.siteId} /> },
    { key: 'network', header: 'Network', width: 'minmax(200px, 2fr)', mobile: 'secondary', render: (a) => <span className="chips"><NetworkBadges info={a.info} /></span> },
    { key: 'age', header: 'In stage', width: '90px', sort: (a) => daysIn(a), mobile: 'meta', render: (a) => <span className={daysIn(a) >= 7 && OPEN.includes(a.stage) ? 'co-stale' : 'muted'}>{daysIn(a)}d</span> },
    { key: 'actions', header: '', width: '44px', render: (a) => cardMenu(a) },
  ];

  return (
    <div className="stack">
      <PageHead
        title="Recruitment"
        sub="Screen applicants against the network before you interview. Verified history and consent requests live next to each candidate."
        meta={
          <>
            <Badge dot tone="info">{plural(open.length, 'open applicant')}</Badge>
            {flagged > 0 && <Badge tone="warn">{flagged} currently employed elsewhere</Badge>}
            {stale > 0 && <Badge tone="warn">{stale} waiting 7+ days</Badge>}
          </>
        }
        actions={
          <>
            <Button variant="ghost" icon={UploadSimple} onClick={() => setModal({ kind: 'import' })} disabledReason={editHint}>
              Import
            </Button>
            <Button icon={Plus} onClick={() => setModal({ kind: 'edit' })} disabledReason={editHint}>
              Add applicant
            </Button>
          </>
        }
      />

      <div className="toolbar">
        <SearchInput value={q} onChange={setQ} placeholder="Name, national ID, phone or site" />
        <FilterSelect label={position || 'Position'} value={position} onChange={setPosition} options={[{ value: '', label: 'All positions' }, ...POSITIONS]} />
        <span className="toolbar-spacer" />
        {!mobile && (
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: 'board', label: 'Board', icon: Kanban },
              { value: 'table', label: 'Table', icon: ListBullets },
            ]}
          />
        )}
      </div>

      {!all.length ? (
        <div className="card">
          <EmptyState icon={UserPlus} title="No applicants yet" body="Add applicants one at a time or import a list. Each one is matched against the network automatically." action={edit && <Button icon={Plus} onClick={() => setModal({ kind: 'edit' })}>Add applicant</Button>} />
        </div>
      ) : mobile ? (
        <>
          <Tabs value={stageTab} onChange={setStageTab} tabs={STAGES.map((s) => ({ key: s.key, label: s.label, count: rows.filter((a) => a.stage === s.key).length }))} />
          <div className="co-mobile-list">
            {rows.filter((a) => a.stage === stageTab).map((a) => card(a, false))}
            {!rows.some((a) => a.stage === stageTab) && <EmptyState compact title={`No one in ${stageLabel(stageTab).toLowerCase()}`} />}
          </div>
        </>
      ) : view === 'table' ? (
        <DataTable columns={columns} rows={rows} onRowClick={(a) => go('recruitment', { id: a.id })} rowClass={(a) => (isPending(a.id) ? 'is-muted' : '')} empty={<EmptyState compact title="No applicants match" />} />
      ) : (
        <div className="co-board">
          {STAGES.map((s) => {
            const lane = rows.filter((a) => a.stage === s.key);
            return (
              <section
                key={s.key}
                className={`co-lane ${over === s.key ? 'is-over' : ''}`}
                onDragOver={(e) => {
                  if (!dragId) return;
                  e.preventDefault();
                  setOver(s.key);
                }}
                onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget) && setOver(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  const a = rows.find((x) => x.id === e.dataTransfer.getData('text/plain'));
                  setOver(null);
                  setDragId(null);
                  if (a) move(a, s.key);
                }}
                aria-label={`${s.label} column`}
              >
                <header className="co-lane-head">
                  <span>{s.label}</span>
                  <span className="count">{lane.length}</span>
                </header>
                <div className="co-lane-body">
                  {lane.map((a) => card(a, true))}
                  {!lane.length && <div className="co-lane-empty">{edit ? 'Drop applicants here' : 'Empty'}</div>}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {drawer && (
        <ApplicantDrawer
          a={drawer}
          go={go}
          onClose={() => go('recruitment')}
          onEdit={() => setModal({ kind: 'edit', a: drawer })}
          onMove={(stage) => move(drawer, stage)}
          onVerify={(guardId) => setModal({ kind: 'verify', a: drawer, guardId })}
          onDelete={() => setModal({ kind: 'delete', a: drawer })}
        />
      )}
      {modal?.kind === 'edit' && <ApplicantModal applicant={modal.a} onClose={() => setModal(null)} />}
      {modal?.kind === 'import' && <ImportModal onClose={() => setModal(null)} />}
      {modal?.kind === 'reject' && <RejectModal a={modal.a} onClose={() => setModal(null)} />}
      {modal?.kind === 'verify' && <RequestVerificationModal guardId={modal.guardId} applicantId={modal.a.id} onClose={() => setModal(null)} />}
      {modal?.kind === 'hire' && (
        <HireModal
          applicantId={modal.a.id}
          prefill={{ nationalId: modal.a.nationalId, name: modal.a.name, phone: modal.a.phone, position: modal.a.position, siteId: modal.a.siteId }}
          onClose={() => setModal(null)}
          onDone={(gid) => go('guard', { id: gid })}
        />
      )}
      {modal?.kind === 'delete' && (
        <ConfirmModal
          title="Delete applicant"
          body={`${modal.a.name} will be removed from your pipeline. Their network passport is not affected.`}
          confirmLabel="Delete"
          onClose={() => setModal(null)}
          onConfirm={async () => {
            if (id === modal.a.id) go('recruitment');
            await act({
              key: modal.a.id,
              pending: 'Deleting applicant…',
              success: `${modal.a.name} removed`,
              touches: ['applicants'],
              undo: true,
              apply: (d, t) => {
                d.applicants = d.applicants.filter((x) => x.id !== modal.a.id);
                t.log('Deleted applicant', modal.a.name);
              },
            });
          }}
        />
      )}
    </div>
  );
}

function ApplicantDrawer({ a, go, onClose, onEdit, onMove, onVerify, onDelete }) {
  const { db, session, can } = useStore();
  const me = session.companyId;
  const info = networkInfo(db, a, me);
  const edit = can('recruit.manage');
  const editHint = deniedHint(session, 'recruit.manage');
  const approved = company(db, me).status === 'active';
  const done = ['hired', 'rejected'].includes(a.stage);
  const verifyHint =
    deniedHint(session, 'verification.request') ??
    (!approved ? 'Available after regulator approval.' : !info.guard ? 'Not in the network yet.' : !info.others.length ? 'No other employers to ask.' : undefined);

  return (
    <Drawer
      wide
      title={a.name}
      subtitle={`${a.position} · ${siteById(db, a.siteId)?.name ?? 'No site'} · applied ${fmtDate(a.createdAt)}`}
      onClose={onClose}
      headerExtra={
        <Menu
          label="Applicant actions"
          items={[
            { label: 'Edit applicant', icon: PencilSimple, onClick: onEdit, disabled: !edit, hint: editHint },
            { label: 'Delete', icon: Trash, danger: true, onClick: onDelete, disabled: !edit, hint: editHint },
          ]}
        />
      }
      footer={
        !done && (
          <>
            <Button variant="danger-ghost" icon={XCircle} onClick={() => onMove('rejected')} disabledReason={editHint}>
              Reject
            </Button>
            <Button variant="ghost" icon={Handshake} onClick={() => onVerify(info.guard.id)} disabledReason={verifyHint}>
              Request verification
            </Button>
            <Button icon={UserPlus} onClick={() => onMove('hired')} disabledReason={deniedHint(session, 'guard.hire') ?? (info.elsewhere ? 'Currently employed by another company.' : undefined)}>
              Hire
            </Button>
          </>
        )
      }
    >
      <div className="chips">
        <Badge tone={a.stage === 'hired' ? 'ok' : a.stage === 'rejected' ? 'neutral' : 'info'} dot>
          {stageLabel(a.stage)}
        </Badge>
        <NetworkBadges info={info} />
        {OPEN.includes(a.stage) && <Badge tone={daysIn(a) >= 7 ? 'warn' : 'neutral'}>{daysIn(a)}d in stage</Badge>}
      </div>

      {!done && (
        <Field label="Stage">
          <Segmented value={a.stage} onChange={(s) => edit && onMove(s)} options={STAGES.filter((s) => OPEN.includes(s.key)).map((s) => ({ value: s.key, label: s.label }))} />
        </Field>
      )}

      {info.elsewhere && (
        <div className="notice notice-warn">
          <Warning size={16} />
          <span>
            Currently employed by <b>{company(db, info.cur.companyId).name}</b> as {info.cur.position}. They need to record a separation before you can hire. Ask the applicant about their notice period.
          </span>
        </div>
      )}

      <section>
        <div className="co-section-title">Network profile</div>
        {info.guard ? (
          <div className="stack-s">
            <div className="row between wrap gap-s">
              <GuardCell guard={info.guard} size={44} onClick={() => go('guard', { id: info.guard.id })} />
              <Button variant="ghost" size="sm" iconRight={ArrowRight} onClick={() => go('guard', { id: info.guard.id })}>
                Open passport
              </Button>
            </div>
            <div className="chips">
              <LicenceBadge guard={info.guard} />
              {Object.entries(info.guard.verification).map(([k, v]) => (
                <Badge key={k} tone={v ? 'ok' : 'neutral'}>
                  {v ? '✓' : '–'} {k === 'employment' ? 'prior employment' : k}
                </Badge>
              ))}
            </div>
            <ul className="items">
              {info.emps.map((e) => (
                <li key={e.id}>
                  <CompanyCell id={e.companyId} sub={`${e.position} · ${fmtMonth(e.start)} – ${fmtMonth(e.end)}`} />
                  <span className="grow" />
                  {!e.end ? <Badge tone="ok" dot>Current</Badge> : <Badge>Verified</Badge>}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="co-lookup">
            <IdentificationCard size={22} />
            <span className="co-lookup-text">
              No passport for <span className="mono">{a.nationalId}</span>. This person is new to the network. Check their ID documents and references in person; hiring will issue their first Workforce ID.
            </span>
          </div>
        )}
      </section>

      {info.guard && (
        <section>
          <div className="co-section-title">Verification requests you sent</div>
          {info.requests.length ? (
            <ul className="items">
              {info.requests.map((r) => (
                <li key={r.id} className="tap" onClick={() => go('verification', { id: r.id })}>
                  <CompanyCell id={r.toCompanyId} sub={`${r.requestedScopes.length} items · ${fromNow(r.createdAt)}`} />
                  <span className="grow" />
                  <span className="chips">
                    <Badge tone={REQUEST_STATUS[r.status]?.tone} dot>
                      {REQUEST_STATUS[r.status]?.label}
                    </Badge>
                    <SlaBadge req={r} />
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact title="Nothing requested yet" body={info.others.length ? 'Ask previous employers to release attendance, incidents and separation details, with the applicant’s consent.' : 'This guard has no other employers in the network.'} />
          )}
        </section>
      )}

      <section>
        <div className="co-section-title">Notes</div>
        {a.notes ? <p className="co-notes">{a.notes}</p> : <p className="muted small">No notes yet.</p>}
      </section>

      <section>
        <div className="co-section-title">Timeline</div>
        <ol className="co-timeline">
          <li className="now">
            {stageLabel(a.stage)}
            <span>since {fmtDate(a.updatedAt ?? a.createdAt)}</span>
          </li>
          {info.requests.map((r) => (
            <li key={r.id}>
              Verification requested from {company(db, r.toCompanyId).name}
              <span>{fmtDate(r.createdAt)}</span>
            </li>
          ))}
          <li>
            Applied for {a.position}
            <span>{fmtDate(a.createdAt)}</span>
          </li>
        </ol>
      </section>
    </Drawer>
  );
}

export function ApplicantModal({ applicant, onClose }) {
  const { db, session, act } = useStore();
  const me = session.companyId;
  const editing = !!applicant;
  const sites = db.sites.filter((s) => s.companyId === me && s.active);
  const [f, setF] = useState(
    applicant
      ? { name: applicant.name, nationalId: applicant.nationalId, phone: applicant.phone, position: applicant.position, siteId: applicant.siteId ?? '', notes: applicant.notes }
      : { name: '', nationalId: '', phone: '', position: 'Security Officer', siteId: sites[0]?.id ?? '', notes: '' },
  );
  const [touched, setTouched] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const nid = f.nationalId.trim().toUpperCase();
  const match = nid.length >= 8 ? db.guards.find((g) => g.nationalId.toUpperCase() === nid) : null;
  const cur = match && currentEmployment(db, match.id);
  const dupe = nid && db.applicants.find((a) => a.companyId === me && a.id !== applicant?.id && a.nationalId.toUpperCase() === nid && OPEN.includes(a.stage));
  const errors = {
    name: !f.name.trim() && !match ? 'Enter the applicant’s name.' : null,
    nationalId: nid.length < 8 ? 'Enter a valid national ID.' : dupe ? `Already in your pipeline (${stageLabel(dupe.stage)}).` : null,
  };
  const valid = !Object.values(errors).some(Boolean);

  const save = () => {
    setTouched(true);
    if (!valid) return;
    const aid = applicant?.id ?? uid('AP');
    const data = { name: match?.name ?? f.name.trim(), nationalId: nid, guardId: match?.id ?? null, phone: f.phone.trim() || match?.phone || '', position: f.position, siteId: f.siteId || null, notes: f.notes.trim() };
    act({
      key: aid,
      pending: editing ? 'Saving applicant…' : 'Adding applicant…',
      success: editing ? 'Applicant updated' : `${data.name} added to Applied`,
      touches: ['applicants'],
      undo: true,
      apply: (d, t) => {
        if (editing) Object.assign(d.applicants.find((x) => x.id === aid), data);
        else d.applicants.push({ id: aid, companyId: me, stage: 'applied', createdAt: t.now, updatedAt: t.now, ...data });
        t.log(editing ? 'Updated applicant' : 'Added applicant', `${data.name} for ${data.position}`, { guardId: data.guardId });
      },
    });
    onClose();
  };

  return (
    <Modal
      title={editing ? 'Edit applicant' : 'Add applicant'}
      subtitle="We match the national ID against the network as you type."
      icon={UserPlus}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={touched && !valid}>
            {editing ? 'Save changes' : 'Add applicant'}
          </Button>
        </>
      }
    >
      <Field label="National ID" error={touched && errors.nationalId} hint="Try 63-5528134-Z-42 or 08-2291034-P-27">
        <input className="mono" value={f.nationalId} onChange={set('nationalId')} autoFocus placeholder="00-0000000-X-00" autoComplete="off" />
      </Field>
      {match && (
        <div className={`co-lookup ${cur && cur.companyId !== me ? 'bad' : 'ok'}`}>
          <GuardCell guard={match} size={40} />
          <span className="co-lookup-text">
            In the network with {plural(employmentsOf(db, match.id).length, 'verified employment')}.
            {cur && cur.companyId !== me && <> Currently employed by <b>{company(db, cur.companyId).name}</b>.</>}
            {cur && cur.companyId === me && <> Already works for you.</>}
          </span>
        </div>
      )}
      {!match && nid.length >= 8 && (
        <div className="co-lookup">
          <IdentificationCard size={20} />
          <span className="co-lookup-text">Not in the network yet.</span>
        </div>
      )}
      <div className="form-grid">
        <Field label="Full name" error={touched && errors.name}>
          <input value={match ? match.name : f.name} onChange={set('name')} disabled={!!match} />
        </Field>
        <Field label="Mobile number" optional>
          <input type="tel" value={f.phone} onChange={set('phone')} placeholder={match ? 'On file in the network' : '+263 7…'} />
        </Field>
        <Field label="Position">
          <select value={f.position} onChange={set('position')}>
            {POSITIONS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </Field>
        <Field label="Target site">
          <select value={f.siteId} onChange={set('siteId')}>
            <option value="">Not decided</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Notes" optional>
        <textarea rows={3} value={f.notes} onChange={set('notes')} placeholder="Interview notes, referrals, availability" />
      </Field>
    </Modal>
  );
}

function ImportModal({ onClose }) {
  const { db, session, act } = useStore();
  const me = session.companyId;
  const sites = db.sites.filter((s) => s.companyId === me && s.active);
  const [text, setText] = useState('Fadzai Mutero, 63-6612094-M-42, +263 77 661 2094\nJohn Moyo, 63-1184520-K-42, +263 77 214 5580\nKuda Chimbwanda, 63-8012233-C-42, +263 78 801 2233');
  const [position, setPosition] = useState('Security Officer');
  const [siteId, setSiteId] = useState(sites[0]?.id ?? '');

  const parsed = useMemo(() => {
    const lines = text.trim();
    if (!lines) return [];
    const rows = /^name\s*,/i.test(lines) ? parseCSV(lines).map((r) => [r.name, r['national id'] ?? r.national_id ?? r.nationalid, r.phone]) : lines.split(/\r?\n/).map((l) => l.split(',').map((x) => x.trim()));
    return rows
      .filter((r) => r.some(Boolean))
      .map(([name = '', nationalId = '', phone = '']) => {
        const nid = nationalId.toUpperCase();
        const guard = nid ? db.guards.find((g) => g.nationalId.toUpperCase() === nid) : null;
        const cur = guard && currentEmployment(db, guard.id);
        const dupe = db.applicants.some((a) => a.companyId === me && a.nationalId.toUpperCase() === nid && OPEN.includes(a.stage));
        const bad = !name || nid.length < 8;
        return { name: guard?.name ?? name, nationalId: nid, phone, guard, cur, dupe, bad };
      });
  }, [text, db, me]);
  const importable = parsed.filter((p) => !p.bad && !p.dupe);

  const run = () => {
    act({
      key: 'import-applicants',
      pending: `Importing ${plural(importable.length, 'applicant')}…`,
      success: `${plural(importable.length, 'applicant')} added to Applied`,
      touches: ['applicants'],
      undo: true,
      apply: (d, t) => {
        importable.forEach((p) =>
          d.applicants.push({ id: uid('AP'), companyId: me, name: p.name, nationalId: p.nationalId, guardId: p.guard?.id ?? null, phone: p.phone || p.guard?.phone || '', position, siteId: siteId || null, stage: 'applied', notes: 'Imported from list.', createdAt: t.now, updatedAt: t.now }),
        );
        t.log('Imported applicants', `${importable.length} applicants for ${position}`);
      },
    });
    onClose();
  };

  return (
    <Modal
      size="lg"
      title="Import applicants"
      subtitle="Paste one applicant per line: name, national ID, phone. A CSV with a header row works too."
      icon={UploadSimple}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={run} disabled={!importable.length}>
            Import {importable.length || ''}
          </Button>
        </>
      }
    >
      <Field label="Applicants">
        <textarea rows={5} className="mono" value={text} onChange={(e) => setText(e.target.value)} />
      </Field>
      <div className="form-grid">
        <Field label="Position">
          <select value={position} onChange={(e) => setPosition(e.target.value)}>
            {POSITIONS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </Field>
        <Field label="Target site">
          <select value={siteId} onChange={(e) => setSiteId(e.target.value)}>
            <option value="">Not decided</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {parsed.length > 0 && (
        <div>
          <div className="co-section-title">
            Preview · {parsed.length} rows · {parsed.filter((p) => p.guard).length} in network
          </div>
          <ul className="co-import-preview">
            {parsed.map((p, i) => (
              <li key={i}>
                <Avatar name={p.name || '?'} seed={p.guard?.id} size={28} />
                <span className="grow">
                  <b>{p.name || 'Missing name'}</b> <span className="mono muted small">{p.nationalId || 'no ID'}</span>
                </span>
                {p.bad ? (
                  <Badge tone="bad">Invalid row</Badge>
                ) : p.dupe ? (
                  <Badge>Already in pipeline</Badge>
                ) : p.cur ? (
                  <Badge tone="warn">Employed elsewhere</Badge>
                ) : p.guard ? (
                  <Badge tone="info">In network</Badge>
                ) : (
                  <Badge>New</Badge>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  );
}

function RejectModal({ a, onClose }) {
  const { act } = useStore();
  const [reason, setReason] = useState('');
  const [preset, setPreset] = useState('');
  const text = [preset, reason.trim()].filter(Boolean).join(' — ');
  return (
    <Modal
      size="sm"
      title="Reject applicant"
      subtitle={a.name}
      icon={XCircle}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            disabled={!text}
            onClick={() => {
              act({
                key: a.id,
                pending: 'Rejecting…',
                success: `${a.name} rejected`,
                touches: ['applicants'],
                undo: true,
                apply: (d, t) => {
                  const x = d.applicants.find((y) => y.id === a.id);
                  Object.assign(x, { stage: 'rejected', updatedAt: t.now, notes: `${x.notes ? x.notes + '\n' : ''}Rejected ${fmtDate(t.now)}: ${text}` });
                  t.log('Rejected applicant', `${a.name}: ${text}`, { guardId: a.guardId });
                },
              });
              onClose();
            }}
          >
            Reject
          </Button>
        </>
      }
    >
      <Field label="Reason">
        <select value={preset} onChange={(e) => setPreset(e.target.value)}>
          <option value="">Choose a reason</option>
          <option>Did not attend interview</option>
          <option>Position filled</option>
          <option>Does not meet requirements</option>
          <option>Withdrew application</option>
          <option>Verification not completed</option>
        </select>
      </Field>
      <Field label="Details" optional hint="Kept in your notes. Not shared with the network.">
        <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
      </Field>
    </Modal>
  );
}
