// The guard's ProCheQ profile. Used by companies checking a guard (#/guard/:id)
// and by the guard viewing their own record (#/me).
import { useEffect, useState } from 'react';
import { ChatCircleText, CheckCircle, FilePlus, Handshake, LockSimple, SealCheck, SignOut, UserPlus } from '@phosphor-icons/react';
import { useStore } from '../store';
import {
  RECORD_TYPES, canSeePersonal, canSeePrivate, careerOf, company, currentJob, guardById, maskId, maskPhone, recordsOf, requestFor, rehireTone,
} from '../access';
import { Avatar, Badge, Button, Card, EmptyState, fmtDate, fmtMonth } from '../ui';
import { CompanyCell, LicenceBadge, RequestBadge } from '../components';
import { AddGuardModal, AskModal, ExitModal, RecordModal, ReplyModal } from '../forms';

function Reply({ reply, name }) {
  if (!reply) return null;
  return (
    <div className="reply">
      <div className="reply-head">
        <ChatCircleText size={15} /> {name}'s reply · {fmtDate(reply.at)}
      </div>
      <p>{reply.text}</p>
    </div>
  );
}

export default function Profile({ id, go }) {
  const { db, session, mutate } = useStore();
  const guard = guardById(db, id);
  const [modal, setModal] = useState(null);
  const self = session.kind === 'guard' && session.guardId === id;
  const me = session.kind === 'company' ? session.companyId : null;

  // Every company look is logged, so the guard can see who checked them.
  useEffect(() => {
    if (guard && me) mutate((d, t) => t.log('Checked profile', guard.name, { guardId: guard.id }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!guard) return <EmptyState title="No guard with that ProCheQ ID" body="Check the ID and try again." />;

  const first = guard.name.split(' ')[0];
  const career = careerOf(db, id);
  const job = currentJob(db, id);
  const records = recordsOf(db, id);
  const personal = canSeePersonal(db, session, id);
  const fullAccess = canSeePrivate(db, session, id, null);
  const req = me ? requestFor(db, me, id) : null;
  const employsNow = me && job?.companyId === me;
  const everEmployed = me && career.some((e) => e.companyId === me);
  const pub = records.filter((r) => !RECORD_TYPES[r.type].private);
  const priv = records.filter((r) => RECORD_TYPES[r.type].private);
  const privVisible = priv.filter((r) => canSeePrivate(db, session, id, r.companyId));
  const privHidden = priv.length - privVisible.length;
  const exitsHidden = career.some((e) => e.end && !canSeePrivate(db, session, id, e.companyId));
  // Is there anything written by *other* employers that this company can't see yet?
  const othersHold = career.some((e) => e.companyId !== me) || records.some((r) => r.companyId !== me && RECORD_TYPES[r.type].private);

  return (
    <div className="stack profile">
      {/* Identity */}
      <section className="card id-card">
        <div className="id-main">
          <Avatar name={guard.name} seed={guard.id} src={guard.avatar} size={96} square />
          <div className="grow">
            <div className="eyebrow">ProCheQ ID · <span className="mono">{guard.id}</span></div>
            <h1>{guard.name}</h1>
            <div className="chips mt-10">
              {job ? (
                <Badge tone="ok" dot>{job.role} · {company(db, job.companyId).name}</Badge>
              ) : (
                <Badge dot>Available · not employed</Badge>
              )}
              <LicenceBadge guard={guard} />
              <Badge tone={guard.verified.identity ? 'info' : 'neutral'} icon={SealCheck}>Identity verified</Badge>
              {guard.verified.qualifications && <Badge tone="info" icon={SealCheck}>Qualifications verified</Badge>}
            </div>
          </div>
        </div>
        <dl className="id-facts">
          <div><dt>National ID</dt><dd className="mono">{personal ? guard.nationalId : maskId(guard.nationalId)}</dd></div>
          <div><dt>Date of birth</dt><dd>{personal ? fmtDate(guard.dob) : 'Private'}</dd></div>
          <div><dt>Mobile</dt><dd>{personal ? guard.phone : maskPhone(guard.phone)}</dd></div>
          <div><dt>Licence</dt><dd><span className="mono">{guard.licence.number}</span> · {fmtDate(guard.licence.expiry)}</dd></div>
        </dl>

        {me && (
          <div className="id-actions">
            {employsNow && (
              <>
                <Button icon={FilePlus} onClick={() => setModal({ kind: 'record' })}>Add a record</Button>
                <Button variant="ghost" icon={SignOut} onClick={() => setModal({ kind: 'exit', emp: job })}>End employment</Button>
              </>
            )}
            {!job && <Button icon={UserPlus} onClick={() => setModal({ kind: 'hire' })}>Employ {first}</Button>}
          </div>
        )}
      </section>

      {/* Access to the private record (companies) */}
      {me && !employsNow && !(everEmployed && !othersHold) && (
        <div className={`access-bar ${fullAccess ? 'is-open' : ''}`}>
          <span className="access-icon">{fullAccess ? <CheckCircle size={22} weight="fill" /> : <LockSimple size={22} weight="fill" />}</span>
          <div className="grow">
            <b>{fullAccess ? 'You can see the full record' : everEmployed ? 'You see what your company recorded' : "You're seeing the network profile"}</b>
            <p>
              {!fullAccess && everEmployed
                ? `What other employers recorded is private until ${first} approves your request.`
                : fullAccess
                ? `${first} approved your request. Access ends ${fmtDate(db.requests.filter((r) => r.companyId === me && r.guardId === id && r.status === 'approved').sort((a, b) => b.expiresAt.localeCompare(a.expiresAt))[0]?.expiresAt)}.`
                : `Incidents, discipline and why ${first} left each job are private until ${first} approves your request.`}
            </p>
          </div>
          {!fullAccess && (req?.status === 'pending' ? <RequestBadge req={req} /> : (
            <div className="row gap-s wrap">
              {req && <RequestBadge req={req} />}
              <Button icon={Handshake} onClick={() => setModal({ kind: 'ask' })}>{req ? 'Ask again' : `Ask ${first}`}</Button>
            </div>
          ))}
        </div>
      )}

      {self && (
        <div className="access-bar is-self">
          <span className="access-icon"><SealCheck size={22} weight="fill" /></span>
          <div className="grow">
            <b>This is your ProCheQ record</b>
            <p>Companies see your career, training and commendations. The rest is private until you approve a request. You can reply to anything an employer wrote.</p>
          </div>
          <Button variant="ghost" onClick={() => go('access')}>Requests and access</Button>
        </div>
      )}

      <div className="profile-grid">
        {/* Career */}
        <Card title="Career" subtitle={`${career.length} ${career.length === 1 ? 'job' : 'jobs'} confirmed by employers`}>
          <ol className="career">
            {career.map((e) => {
              const seeExit = e.end && canSeePrivate(db, session, id, e.companyId);
              return (
                <li key={e.id}>
                  <CompanyCell id={e.companyId} size={40} sub={`${e.role} · ${fmtMonth(e.start)} – ${e.end ? fmtMonth(e.end) : 'now'}`} />
                  <div className="career-body">
                    {!e.end ? (
                      <Badge tone="ok" dot>Current job</Badge>
                    ) : seeExit ? (
                      <>
                        <div className="chips">
                          <Badge tone={/Dismissed|Absconded/.test(e.exit.reason) ? 'bad' : 'neutral'}>{e.exit.reason}</Badge>
                          <Badge tone={rehireTone(e.exit.rehire)}>Would rehire: {e.exit.rehire}</Badge>
                        </div>
                        {e.exit.note && <p className="note">{e.exit.note}</p>}
                        <Reply reply={e.reply} name={first} />
                        {self && (
                          <Button size="sm" variant="ghost" icon={ChatCircleText} onClick={() => setModal({ kind: 'reply', target: e, type: 'exit' })}>
                            {e.reply ? 'Edit my reply' : 'Reply'}
                          </Button>
                        )}
                      </>
                    ) : (
                      <span className="locked"><LockSimple size={13} /> Exit reason is private</span>
                    )}
                  </div>
                </li>
              );
            })}
            {!career.length && <EmptyState compact body="No jobs recorded yet." />}
          </ol>
        </Card>

        <div className="stack">
          {/* Training and commendations: visible to every member company */}
          <Card title="Training and commendations" subtitle="Visible to every member company">
            <ul className="recs">
              {pub.map((r) => (
                <li key={r.id}>
                  <Badge tone={RECORD_TYPES[r.type].tone}>{RECORD_TYPES[r.type].label}</Badge>
                  <div className="grow">
                    <b>{r.title}</b>
                    <span className="recs-sub">
                      {fmtDate(r.date)} · {company(db, r.companyId).name}
                      {r.expires && <> · {new Date(r.expires) < new Date() ? <span className="bad-text">expired {fmtDate(r.expires)}</span> : `valid to ${fmtDate(r.expires)}`}</>}
                    </span>
                  </div>
                </li>
              ))}
              {!pub.length && <EmptyState compact body="None recorded yet." />}
            </ul>
          </Card>

          {/* Incidents and discipline: private */}
          <Card title="Incidents and discipline" subtitle={self ? 'Private: only you and companies you approve' : 'Private record'}>
            <ul className="recs">
              {privVisible.map((r) => (
                <li key={r.id} className="recs-private">
                  <Badge tone={RECORD_TYPES[r.type].tone}>{RECORD_TYPES[r.type].label}</Badge>
                  <div className="grow">
                    <b>{r.title}</b>
                    <span className="recs-sub">
                      {r.severity} · {fmtDate(r.date)} · {company(db, r.companyId).name} · <span className="mono">{r.evidence}</span>
                    </span>
                    {r.detail && <p className="note">{r.detail}</p>}
                    <Reply reply={r.reply} name={first} />
                    {self && (
                      <Button size="sm" variant="ghost" icon={ChatCircleText} onClick={() => setModal({ kind: 'reply', target: r, type: 'record' })}>
                        {r.reply ? 'Edit my reply' : 'Reply'}
                      </Button>
                    )}
                  </div>
                </li>
              ))}
              {!privVisible.length && !privHidden && <EmptyState compact body="Nothing recorded. A clean record." />}
            </ul>
            {(privHidden > 0 || exitsHidden) && !fullAccess && (
              <div className="locked-panel">
                <LockSimple size={18} />
                <span className="grow">{everEmployed ? 'Other employers’ entries are private.' : 'This part of the record is private.'} {first} decides who sees it.</span>
                {me && req?.status !== 'pending' && <Button size="sm" onClick={() => setModal({ kind: 'ask' })}>Ask {first}</Button>}
              </div>
            )}
          </Card>
        </div>
      </div>

      {modal?.kind === 'record' && <RecordModal guardId={id} onClose={() => setModal(null)} />}
      {modal?.kind === 'exit' && <ExitModal employment={modal.emp} onClose={() => setModal(null)} />}
      {modal?.kind === 'ask' && <AskModal guardId={id} onClose={() => setModal(null)} />}
      {modal?.kind === 'hire' && <AddGuardModal prefillId={guard.nationalId} onClose={() => setModal(null)} />}
      {modal?.kind === 'reply' && <ReplyModal target={modal.target} kind={modal.type} onClose={() => setModal(null)} />}
    </div>
  );
}

