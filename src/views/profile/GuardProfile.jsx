import { useEffect, useMemo, useState } from 'react';
import {
  Briefcase, CalendarCheck, GraduationCap, Medal, ChartLineUp, ChatCircleText, Handshake, IdentificationCard, LockSimple, MapPin, PencilSimple, Plus,
  QrCode, SignOut, Trash, UserPlus, Warning,
} from '@phosphor-icons/react';
import { useStore } from '../../store';
import {
  RECORD_TYPES, SCOPES, canSee, canSeePII, company, currentEmployment, deniedHint, employmentsOf, expiryStatus, grantActive,
  guardById, licenceStatus, maskId, releasedScopes, siteById,
} from '../../access';
import {
  Avatar, Badge, Button, Card, Check, ConfirmModal, EmptyState, Locked, Menu, Meter, NavTabs, OrgMark, daysUntil, fmtDate, fmtMonth,
  fromNow, useIsMobile,
} from '../../ui';
import { CompanyCell, ExpiryBadge, LicenceBadge, ResponseStatus, SiteLabel } from '../../components';
import { AssignSiteModal, AttendanceModal, EditGuardModal, HireModal, RecordModal, RequestVerificationModal, SeparationModal } from '../../modals';
import { ActivityTimeline, RespondModal, monthsBetween, mrz } from './parts';
import './profile.css';

export default function GuardProfile({ id, go, self }) {
  const { db, session, can, act, mutate } = useStore();
  const guardId = self ? session.guardId : id;
  const guard = guardById(db, guardId);
  const mobile = useIsMobile();
  const [tab, setTab] = useState('overview');
  const [modal, setModal] = useState(null);

  // Every look at a passport by an organisation goes into the guard's access log.
  useEffect(() => {
    if (!guard || session.kind === 'guard') return;
    mutate((d, t) => t.log('Viewed profile', `${guard.name} (${guard.id})`, { guardId }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guardId]);

  const data = useMemo(() => {
    if (!guard) return null;
    const me = session.kind === 'staff' ? session.companyId : null;
    const isSelf = session.kind === 'guard' && session.guardId === guardId;
    const isReg = session.kind === 'regulator';
    const emps = employmentsOf(db, guardId);
    const current = currentEmployment(db, guardId);
    const see = (cid, scope) => canSee(db, session, guardId, cid, scope);
    const fullAccess = (cid) => isSelf || isReg || cid === me;
    const records = db.records.filter((r) => r.guardId === guardId).sort((a, b) => b.date.localeCompare(a.date));
    const visible = records.filter((r) => (r.retracted ? fullAccess(r.companyId) : true) && see(r.companyId, r.type));
    const employers = [...new Set(emps.map((e) => e.companyId))];
    const locked = me ? employers.filter((cid) => cid !== me && SCOPES.some((s) => !releasedScopes(db, me, guardId, cid).has(s.key))) : [];
    const grantFor = (cid) =>
      me
        ? db.grants
            .filter((g) => g.guardId === guardId && g.viewerCompanyId === me && (g.sourceCompanyId === cid || g.sourceCompanyId === '*') && grantActive(g))
            .sort((a, b) => b.expiresAt.localeCompare(a.expiresAt))[0]
        : null;
    const responses = db.responses.filter((r) => r.guardId === guardId);
    return {
      me, isSelf, isReg, emps, current, see, fullAccess, visible, employers, locked, grantFor, responses,
      training: visible.filter((r) => r.type === 'training'),
      commendations: visible.filter((r) => r.type === 'commendation'),
      conduct: visible.filter((r) => r.type === 'incident' || r.type === 'disciplinary'),
      pii: canSeePII(db, session, guardId),
      consentsWaiting: db.requests.filter((r) => r.guardId === guardId && r.status === 'awaiting_consent').length,
    };
  }, [db, session, guardId, guard]);

  if (!guard) return <EmptyState title="Passport not found" body={`No security professional has the Workforce ID ${guardId}.`} />;
  const { me, isSelf, isReg, emps, current, see, fullAccess, training, commendations, conduct, locked, grantFor, responses, pii } = data;
  const myCo = me ? company(db, me) : null;
  const curCo = current && company(db, current.companyId);
  const employsNow = me && current?.companyId === me;
  const employedEver = me && emps.some((e) => e.companyId === me);
  const responseFor = (type, tid) => responses.find((r) => r.targetType === type && r.targetId === tid);

  // ---------- staff actions ----------
  const actions = [];
  if (me) {
    if (employsNow) {
      actions.push({ label: 'Add record', icon: Plus, primary: true, perm: 'record.create', run: () => setModal({ k: 'record' }) });
      actions.push({ label: 'Attendance', icon: ChartLineUp, perm: 'attendance.update', run: () => setModal({ k: 'attendance' }) });
      actions.push({ label: 'Reassign site', icon: MapPin, perm: 'employment.manage', run: () => setModal({ k: 'assign' }) });
    }
    if (!current) actions.push({ label: 'Hire', icon: UserPlus, primary: true, perm: 'guard.hire', run: () => setModal({ k: 'hire' }) });
    if (locked.length)
      actions.push({
        label: 'Request verification', icon: Handshake, primary: !employsNow && !!current, perm: 'verification.request',
        blocked: myCo.status !== 'active' ? 'Available once the regulator approves your company.' : null,
        run: () => setModal({ k: 'request' }),
      });
    if (employedEver) actions.push({ label: 'Edit profile', icon: PencilSimple, perm: 'guard.hire', run: () => setModal({ k: 'edit' }) });
    if (employsNow) actions.push({ label: 'Record separation', icon: SignOut, danger: true, perm: 'employment.manage', run: () => setModal({ k: 'separate' }) });
  }
  const why = (a) => a.blocked ?? deniedHint(session, a.perm);

  const tabs = [
    { key: 'overview', label: 'Overview' },
    { key: 'employment', label: 'Employment', count: emps.length },
    { key: 'conduct', label: 'Conduct', count: conduct.length || undefined },
    { key: 'training', label: 'Training & licences', count: training.length },
    ...(isSelf || isReg ? [{ key: 'access', label: 'Access log' }] : []),
  ];

  const retract = (r) =>
    act({
      key: r.id,
      pending: 'Retracting record…',
      success: 'Record retracted',
      touches: ['records', 'responses'],
      undo: true,
      apply: (d, t) => {
        const rec = d.records.find((x) => x.id === r.id);
        Object.assign(rec, { retracted: true, retractedAt: t.now, retractedBy: t.actor.user });
        const resp = d.responses.find((x) => x.targetType === 'record' && x.targetId === r.id && x.status === 'open');
        if (resp) Object.assign(resp, { status: 'amended', companyNote: 'Record retracted by the employer.' });
        t.log('Retracted record', `${r.title} — ${guard.name}`, { guardId });
        t.notify(`guard:${guardId}`, { title: 'A record was retracted', body: `${t.actor.name} retracted “${r.title}”. It is no longer shared with anyone.`, link: { name: 'passport' } });
      },
    });

  const [m1, m2] = mrz(guard, pii);
  const names = guard.name.split(' ');
  const surname = names.pop();
  const ls = licenceStatus(guard);
  const certIssues = db.records.filter((r) => r.guardId === guardId && r.type === 'training' && r.expires && !r.retracted && expiryStatus(r.expires).tone !== 'ok');
  const checks = Object.values(guard.verification);

  return (
    <div className="stack pp">
      {isSelf && data.consentsWaiting > 0 && (
        <div className="notice notice-warn pp-banner">
          <Handshake size={18} />
          <span className="grow">
            <b>{data.consentsWaiting} employer{data.consentsWaiting > 1 ? 's are' : ' is'} waiting for your consent.</b> Nothing is shared until you approve.
          </span>
          <Button size="sm" onClick={() => go('consents')}>
            Review
          </Button>
        </div>
      )}

      {/* ---------- hero ---------- */}
      <div className="pp-hero">
        <section className="pp-doc" aria-label="Security professional passport">
          <div className="pp-doc-top">
            <span className="pp-doc-brand">Security Force</span>
            <span className="pp-doc-kind">Security professional passport</span>
            <span className="pp-doc-cc">ZWE</span>
          </div>
          <div className="pp-doc-body">
            <div className="pp-photo">
              <Avatar name={guard.name} seed={guard.id} src={guard.avatar} size={mobile ? 96 : 124} square />
            </div>
            <div className="pp-fields">
              <div className="pp-field">
                <span className="pp-label">Surname / given names</span>
                <h1 className="pp-name">
                  <span className="pp-surname">{surname}</span> <span className="pp-given">{names.join(' ')}</span>
                </h1>
              </div>
              <dl className="pp-grid">
                <div className="pp-field">
                  <dt className="pp-label">Workforce ID</dt>
                  <dd className="mono pp-strong">{guard.id}</dd>
                </div>
                <div className="pp-field">
                  <dt className="pp-label">National ID</dt>
                  <dd className="mono">{pii ? guard.nationalId : maskId(guard.nationalId)}</dd>
                </div>
                <div className="pp-field">
                  <dt className="pp-label">Date of birth</dt>
                  <dd>{pii ? fmtDate(guard.dob) : <span className="pp-redacted">Restricted</span>}</dd>
                </div>
                <div className="pp-field">
                  <dt className="pp-label">Mobile</dt>
                  <dd>{pii ? guard.phone : <span className="pp-redacted">Restricted</span>}</dd>
                </div>
                <div className="pp-field">
                  <dt className="pp-label">Home city</dt>
                  <dd>{guard.city}</dd>
                </div>
                <div className="pp-field">
                  <dt className="pp-label">Licence</dt>
                  <dd className="mono">{guard.licence.number}</dd>
                </div>
              </dl>
            </div>
            <div className="pp-verify">
              <div className="pp-verify-head">
                <span className="pp-label">Verification</span>
                <b className="mono">
                  {checks.filter(Boolean).length}/{checks.length}
                </b>
              </div>
              <Check ok={guard.verification.identity} label="Identity" />
              <Check ok={guard.verification.qualifications} label="Qualifications" />
              <Check ok={guard.verification.employment} label="Prior employment" />
              <Check ok={guard.verification.references} label="References" />
            </div>
          </div>
          <div className="pp-mrz" aria-hidden="true">
            <div>{m1}</div>
            <div>{m2}</div>
          </div>
        </section>

        <div className="pp-side">
          <Card title="Current deployment" icon={Briefcase}>
            {current ? (
              <div className="stack-s">
                <CompanyCell company={curCo} size={36} sub={current.position} />
                <dl className="pp-kv">
                  <div>
                    <dt>Site</dt>
                    <dd>{fullAccess(current.companyId) ? <SiteLabel id={current.siteId} withRisk /> : <span className="muted">Shown to the employer</span>}</dd>
                  </div>
                  <div>
                    <dt>Since</dt>
                    <dd>
                      {fmtDate(current.start)} <span className="muted">· {monthsBetween(current.start)}</span>
                    </dd>
                  </div>
                  <div>
                    <dt>Attendance</dt>
                    <dd>{see(current.companyId, 'attendance') ? <Meter value={current.attendance} /> : <Locked>Restricted</Locked>}</dd>
                  </div>
                </dl>
              </div>
            ) : (
              <div className="pp-idle">
                <span className="status-dot" />
                <div>
                  <b>Not currently deployed</b>
                  <p className="muted small">Available to hire. Their verified history stays with their Workforce ID.</p>
                </div>
              </div>
            )}
          </Card>
          <Card title="Compliance" icon={CalendarCheck}>
            <ul className="pp-compliance">
              <li>
                <span>Security licence</span>
                <LicenceBadge guard={guard} compact />
              </li>
              {certIssues.map((r) => (
                <li key={r.id}>
                  <span className="clamp-1">{r.title}</span>
                  <ExpiryBadge iso={r.expires} />
                </li>
              ))}
              {!certIssues.length && ls.tone === 'ok' && (
                <li className="muted small">No expiring licences or certificates.</li>
              )}
            </ul>
          </Card>
        </div>
      </div>

      {/* ---------- action bar ---------- */}
      {(actions.length > 0 || isSelf) && (
        <div className="pp-actions">
          {isSelf ? (
            <>
              <Button icon={QrCode} onClick={() => go('badge')}>
                Show live badge
              </Button>
              <Button variant="ghost" icon={PencilSimple} onClick={() => setModal({ k: 'edit' })}>
                Edit my profile
              </Button>
              <Button variant="ghost" icon={ChatCircleText} onClick={() => go('responses')}>
                My responses
              </Button>
            </>
          ) : mobile ? (
            <>
              {actions
                .filter((a) => a.primary)
                .slice(0, 1)
                .map((a) => (
                  <Button key={a.label} icon={a.icon} disabledReason={why(a)} onClick={a.run} className="grow">
                    {a.label}
                  </Button>
                ))}
              <Menu
                label="Passport actions"
                items={actions
                  .filter((a) => !a.primary || actions.filter((x) => x.primary).indexOf(a) > 0)
                  .map((a) => ({ label: a.label, icon: a.icon, danger: a.danger, disabled: !!why(a), hint: why(a), onClick: a.run }))}
              />
            </>
          ) : (
            actions.map((a) => (
              <Button key={a.label} icon={a.icon} variant={a.primary ? 'primary' : a.danger ? 'danger-ghost' : 'ghost'} disabledReason={why(a)} onClick={a.run}>
                {a.label}
              </Button>
            ))
          )}
          {me && !employedEver && (
            <span className="pp-actions-note">
              <LockSimple size={14} /> Personal details are visible only to employers of this guard.
            </span>
          )}
        </div>
      )}

      <NavTabs tabs={tabs} value={tab} onChange={setTab} />

      {tab === 'overview' && (
        <div className="grid-main">
          <div className="stack">
            <Card title="Career" subtitle={`${emps.length} verified employment${emps.length === 1 ? '' : 's'} across ${data.employers.length} compan${data.employers.length === 1 ? 'y' : 'ies'}`} actions={<Button variant="subtle" size="sm" onClick={() => setTab('employment')}>Details</Button>}>
              <ol className="pp-career">
                {emps.map((e) => {
                  const co = company(db, e.companyId);
                  return (
                    <li key={e.id}>
                      <OrgMark company={co} size={34} />
                      <div className="grow">
                        <b>{e.position}</b>
                        <span className="muted"> · {co.name}</span>
                      </div>
                      <span className="pp-dates">
                        {fmtMonth(e.start)} – {fmtMonth(e.end)}
                      </span>
                    </li>
                  );
                })}
                {!emps.length && <EmptyState compact body="No employment on record yet." />}
              </ol>
            </Card>
            <Card title="Open responses" subtitle="The guard's side of the story, attached to the record">
              {responses.length ? (
                <ul className="items">
                  {responses.map((r) => (
                    <li key={r.id} className="items-top">
                      <span className="item-icon">
                        <ChatCircleText size={17} />
                      </span>
                      <div className="grow">
                        <div className="item-title">{company(db, r.companyId).name}</div>
                        <p className="item-sub clamp-2">{r.text}</p>
                      </div>
                      <ResponseStatus resp={r} />
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState compact body="No responses on record." />
              )}
            </Card>
          </div>
          <div className="stack">
            <Card title="Latest training" actions={<span className="count">{training.length}</span>}>
              <RecordList items={training.slice(0, 4)} empty="No training recorded." />
            </Card>
            <Card title="Commendations" actions={<span className="count">{commendations.length}</span>}>
              <RecordList items={commendations} empty="No commendations yet." />
            </Card>
          </div>
        </div>
      )}

      {tab === 'employment' && (
        <Card flush>
          <ol className="pp-timeline">
            {emps.map((e) => {
              const co = company(db, e.companyId);
              const own = fullAccess(e.companyId);
              const sepVisible = see(e.companyId, 'separation');
              const attVisible = see(e.companyId, 'attendance');
              const grant = !own && (sepVisible || attVisible) ? grantFor(e.companyId) : null;
              const resp = responseFor('employment', e.id);
              const serious = e.separation && (e.separation.category.startsWith('Dismissal') || e.separation.category === 'Absconded');
              const isLocked = locked.includes(e.companyId);
              return (
                <li key={e.id} className="pp-tl">
                  <span className="pp-tl-logo"><OrgMark company={co} size={36} /></span>
                  <div className="pp-tl-body">
                    <div className="pp-tl-head">
                      <div className="grow">
                        <div className="pp-tl-title">{e.position}</div>
                        <div className="pp-tl-sub">{co.name}</div>
                      </div>
                      <div className="pp-tl-date">
                        <span className="mono">
                          {fmtMonth(e.start)} – {fmtMonth(e.end)}
                        </span>
                        <span className="muted small">{monthsBetween(e.start, e.end)}</span>
                      </div>
                    </div>
                    <div className="chips mt-10">
                      <Badge tone="ok" dot>
                        Verified by employer
                      </Badge>
                      {own && e.siteId && (
                        <Badge icon={MapPin}>{siteById(db, e.siteId)?.name}</Badge>
                      )}
                      {attVisible ? <Badge tone={e.attendance >= 90 ? 'ok' : e.attendance >= 80 ? 'warn' : 'bad'}>Attendance {e.attendance}%</Badge> : <Locked>Attendance</Locked>}
                      {e.end &&
                        (sepVisible ? (
                          <>
                            <Badge tone={serious ? 'bad' : 'neutral'}>{e.separation.category}</Badge>
                            <Badge tone={e.separation.rehire === 'Eligible' ? 'ok' : e.separation.rehire === 'Conditional' ? 'warn' : 'bad'}>Rehire: {e.separation.rehire}</Badge>
                          </>
                        ) : (
                          <Locked>Separation</Locked>
                        ))}
                    </div>
                    {grant && (
                      <p className="pp-grant">
                        <Handshake size={14} /> Released {grant.via === 'share' ? 'by the guard with a share code' : `by ${company(db, grant.sourceCompanyId)?.name ?? co.name}`} · access expires in {Math.max(0, daysUntil(grant.expiresAt))}d
                      </p>
                    )}
                    {e.end && sepVisible && e.separation.note && (
                      <p className="quote mt-10">
                        {e.separation.note} <span className="muted">— employer-reported{e.separation.evidence ? ` · ${e.separation.evidence}` : ''}</span>
                      </p>
                    )}
                    {sepVisible && resp && <ResponseBox resp={resp} />}
                    <div className="pp-tl-actions">
                      {isSelf && e.end && !resp && (
                        <Button variant="ghost" size="sm" icon={ChatCircleText} onClick={() => setModal({ k: 'respond', target: { type: 'employment', item: e, companyId: e.companyId, label: `Separation — ${e.separation.category}` } })}>
                          Add my response
                        </Button>
                      )}
                      {me && isLocked && (
                        <Button variant="ghost" size="sm" icon={Handshake} disabledReason={myCo.status !== 'active' ? 'Available once the regulator approves your company.' : deniedHint(session, 'verification.request')} onClick={() => setModal({ k: 'request', to: e.companyId })}>
                          Request from {co.name}
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
            {!emps.length && (
              <li className="pp-tl-empty">
                <EmptyState compact body="No employment on record." />
              </li>
            )}
          </ol>
        </Card>
      )}

      {tab === 'conduct' && (
        <div className="stack-s">
          <p className="muted small pp-lede">
            Incidents and disciplinary actions as reported by employers, each with an evidence reference. This is not a rating. The guard sees every entry and can respond.
          </p>
          {conduct.map((r) => {
            const t = RECORD_TYPES[r.type];
            const resp = responseFor('record', r.id);
            const owner = me === r.companyId;
            return (
              <article key={r.id} className={`card pp-record ${r.retracted ? 'is-retracted' : ''}`}>
                <div className="pp-record-top">
                  <span className={`item-icon ${t.tone}`}>
                    <Warning size={17} />
                  </span>
                  <div className="grow">
                    <div className="pp-record-title">{r.title}</div>
                    <div className="item-sub">
                      {t.short}
                      {r.severity && ` · ${r.severity}`} · {fmtDate(r.date)} · {company(db, r.companyId).name}
                    </div>
                  </div>
                  {owner && !r.retracted && (
                    <Menu
                      items={[
                        { label: 'Edit record', icon: PencilSimple, disabled: !can('record.manage'), hint: deniedHint(session, 'record.manage'), onClick: () => setModal({ k: 'editRecord', record: r }) },
                        { label: 'Retract record', icon: Trash, danger: true, disabled: !can('record.manage'), hint: deniedHint(session, 'record.manage'), onClick: () => setModal({ k: 'retract', record: r }) },
                      ]}
                    />
                  )}
                </div>
                {r.detail && <p className="pp-record-detail">{r.detail}</p>}
                <div className="chips mt-10">
                  {r.evidence && <Badge>Evidence: {r.evidence}</Badge>}
                  {r.createdBy && <Badge>Recorded by {r.createdBy}</Badge>}
                  {r.editedAt && <Badge>Edited {fromNow(r.editedAt)}</Badge>}
                  {r.retracted && <Badge tone="neutral">Retracted {r.retractedAt ? fromNow(r.retractedAt) : ''} · not shared</Badge>}
                </div>
                {resp && <ResponseBox resp={resp} />}
                {isSelf && !resp && !r.retracted && (
                  <div className="pp-tl-actions">
                    <Button variant="ghost" size="sm" icon={ChatCircleText} onClick={() => setModal({ k: 'respond', target: { type: 'record', item: r, companyId: r.companyId, label: r.title } })}>
                      Add my response
                    </Button>
                  </div>
                )}
              </article>
            );
          })}
          {!conduct.length && !locked.length && <EmptyState icon={IdentificationCard} title="Clean record" body="No incidents or disciplinary actions are on record for this guard." />}
          {locked.map((cid) => (
            <div className="pp-locked" key={cid}>
              <span className="item-icon">
                <LockSimple size={17} />
              </span>
              <div className="grow">
                <div className="item-title">{company(db, cid).name}</div>
                <div className="item-sub">Records from this employer are released only with the guard's consent.</div>
              </div>
              <Button variant="ghost" size="sm" disabledReason={myCo.status !== 'active' ? 'Available once the regulator approves your company.' : deniedHint(session, 'verification.request')} onClick={() => setModal({ k: 'request', to: cid })}>
                Request
              </Button>
            </div>
          ))}
        </div>
      )}

      {tab === 'training' && (
        <div className="grid-main">
          <Card title="Training & certificates" flush>
            <ul className="pp-certs">
              {training.map((r) => (
                <li key={r.id}>
                  <span className="item-icon info">
                    <GraduationCap size={17} />
                  </span>
                  <div className="grow">
                    <div className="item-title">{r.title}</div>
                    <div className="item-sub">
                      {fmtDate(r.date)} · {company(db, r.companyId).name}
                      {r.evidence && ` · ${r.evidence}`}
                    </div>
                  </div>
                  {r.expires ? <ExpiryBadge iso={r.expires} /> : <Badge>No expiry</Badge>}
                </li>
              ))}
              {!training.length && (
                <li>
                  <EmptyState compact body="No training recorded." />
                </li>
              )}
            </ul>
          </Card>
          <Card title="Security licence">
            <div className={`pp-licence tone-${ls.tone}`}>
              <span className="pp-label">Licence number</span>
              <div className="mono pp-licence-no">{guard.licence.number}</div>
              <div className="row between mt-10 wrap gap-s">
                <span className="small muted">Expires {fmtDate(guard.licence.expiry)}</span>
                <LicenceBadge guard={guard} compact />
              </div>
            </div>
            <p className="small muted mt">Clients see the licence status when they check this guard at a site. An expired licence fails the check.</p>
          </Card>
        </div>
      )}

      {tab === 'access' && (
        <Card title="Who has looked at this passport" subtitle="Every view, request, release and client check">
          <ActivityTimeline entries={db.audit.filter((a) => a.guardId === guardId)} />
        </Card>
      )}

      {modal?.k === 'record' && <RecordModal guardIds={[guardId]} onClose={() => setModal(null)} />}
      {modal?.k === 'editRecord' && <RecordModal record={modal.record} onClose={() => setModal(null)} />}
      {modal?.k === 'attendance' && <AttendanceModal employment={current} onClose={() => setModal(null)} />}
      {modal?.k === 'assign' && <AssignSiteModal employments={[current]} onClose={() => setModal(null)} />}
      {modal?.k === 'separate' && <SeparationModal employment={current} onClose={() => setModal(null)} />}
      {modal?.k === 'request' && <RequestVerificationModal guardId={guardId} defaultTo={modal.to} onClose={() => setModal(null)} />}
      {modal?.k === 'edit' && <EditGuardModal guard={guard} onClose={() => setModal(null)} />}
      {modal?.k === 'hire' && <HireModal prefill={{ nationalId: guard.nationalId, name: guard.name, phone: guard.phone }} onClose={() => setModal(null)} />}
      {modal?.k === 'respond' && <RespondModal guardId={guardId} target={modal.target} onClose={() => setModal(null)} />}
      {modal?.k === 'retract' && (
        <ConfirmModal
          title="Retract this record?"
          body={`“${modal.record.title}” will no longer be shared with any employer. The guard and the regulator will still see that it was retracted.`}
          confirmLabel="Retract record"
          onConfirm={() => retract(modal.record)}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}

function RecordList({ items, empty }) {
  const { db } = useStore();
  if (!items.length) return <EmptyState compact body={empty} />;
  return (
    <ul className="items">
      {items.map((r) => (
        <li key={r.id}>
          <span className={`item-icon ${RECORD_TYPES[r.type].tone}`}>
            {r.type === 'commendation' ? <Medal size={16} /> : <GraduationCap size={16} />}
          </span>
          <div className="grow">
            <div className="item-title">{r.title}</div>
            <div className="item-sub">
              {fmtDate(r.date)} · {company(db, r.companyId).name}
            </div>
          </div>
          {r.expires && <ExpiryBadge iso={r.expires} />}
        </li>
      ))}
    </ul>
  );
}

function ResponseBox({ resp }) {
  return (
    <div className="pp-response">
      <div className="pp-response-head">
        <span>
          <ChatCircleText size={15} /> Guard's response · {fmtDate(resp.createdAt)}
        </span>
        <ResponseStatus resp={resp} />
      </div>
      <p>{resp.text}</p>
      {resp.companyNote && <p className="pp-response-note">Employer: {resp.companyNote}</p>}
      {resp.regulatorNote && <p className="pp-response-note">Regulator: {resp.regulatorNote}</p>}
    </div>
  );
}

