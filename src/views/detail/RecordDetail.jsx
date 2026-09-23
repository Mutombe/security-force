// Detail page for one record: training, commendation, incident or disciplinary action.
import { useState } from 'react';
import {
  ChatCircleText, ClockCounterClockwise, Eye, FileText, Flag, GraduationCap, Handshake, LockSimple, Medal, PencilSimple, Trash, Warning,
} from '@phosphor-icons/react';
import { useStore } from '../../store';
import { RECORD_TYPES, canSee, company, deniedHint, grantActive, guardById, scopeShort } from '../../access';
import { Badge, Button, Card, ConfirmModal, EmptyState, fmtDate, fmtTime, fromNow } from '../../ui';
import { CompanyCell, EntityLink, ExpiryBadge, GuardCell, ResponseStatus } from '../../components';
import { RecordModal, RequestVerificationModal } from '../../modals';
import { ActivityTimeline, RespondModal } from '../profile/parts';
import './detail.css';

const ICON = { training: GraduationCap, commendation: Medal, incident: Flag, disciplinary: Warning };
const RESTRICTED_TYPES = ['incident', 'disciplinary'];

export default function RecordDetail({ id, go }) {
  const { db, session, can, act } = useStore();
  const [modal, setModal] = useState(null);
  const r = db.records.find((x) => x.id === id);

  if (!r)
    return (
      <div className="card">
        <EmptyState icon={FileText} title="Record not found" body="This record does not exist or has been removed." />
      </div>
    );

  const g = guardById(db, r.guardId);
  const owner = company(db, r.companyId);
  const me = session.kind === 'staff' ? session.companyId : null;
  const isOwner = me === r.companyId;
  const isSelf = session.kind === 'guard' && session.guardId === r.guardId;
  const isReg = session.kind === 'regulator';
  const retractedHidden = r.retracted && !(isOwner || isSelf || isReg);
  const visible = !retractedHidden && canSee(db, session, r.guardId, r.companyId, r.type);
  const t = RECORD_TYPES[r.type];
  const Icon = ICON[r.type] ?? FileText;

  if (!visible)
    return (
      <div className="stack dt2">
        <div className="card">
          <EmptyState
            icon={LockSimple}
            title={retractedHidden ? 'This record was retracted' : 'This record is restricted'}
            body={
              retractedHidden
                ? `${owner.name} retracted this entry. It is no longer shared with other employers.`
                : `${owner.name} holds this ${t.short.toLowerCase()} for ${g?.name ?? 'this guard'}. It is released only through a verification request that the guard consents to.`
            }
            action={
              me && !retractedHidden ? (
                <div className="row gap-s wrap">
                  <Button icon={Handshake} disabledReason={company(db, me).status !== 'active' ? 'Available once the regulator approves your company.' : deniedHint(session, 'verification.request')} onClick={() => setModal({ k: 'request' })}>
                    Request verification
                  </Button>
                  {g && (
                    <Button variant="ghost" onClick={() => go('guard', { id: g.id })}>
                      Open passport
                    </Button>
                  )}
                </div>
              ) : null
            }
          />
        </div>
        {modal?.k === 'request' && <RequestVerificationModal guardId={r.guardId} defaultTo={r.companyId} onClose={() => setModal(null)} />}
      </div>
    );

  const resp = db.responses.find((x) => x.targetType === 'record' && x.targetId === r.id);
  const restricted = RESTRICTED_TYPES.includes(r.type);
  const releases = restricted
    ? db.grants
        .filter((x) => x.guardId === r.guardId && (x.sourceCompanyId === r.companyId || x.sourceCompanyId === '*') && x.scopes.includes(r.type) && x.viewerCompanyId !== r.companyId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : [];
  const related = db.audit.filter((a) => a.guardId === r.guardId && a.detail?.includes(r.title));
  const manage = can('record.manage');

  const retract = () =>
    act({
      key: r.id,
      pending: 'Retracting record…',
      success: 'Record retracted',
      touches: ['records', 'responses'],
      undo: true,
      apply: (d, tools) => {
        Object.assign(d.records.find((x) => x.id === r.id), { retracted: true, retractedAt: tools.now, retractedBy: tools.actor.user });
        const open = d.responses.find((x) => x.targetType === 'record' && x.targetId === r.id && x.status === 'open');
        if (open) Object.assign(open, { status: 'amended', companyNote: 'Record retracted by the employer.' });
        tools.log('Retracted record', `${r.title} — ${g.name}`, { guardId: r.guardId });
        tools.notify(`guard:${r.guardId}`, { title: 'A record was retracted', body: `${tools.actor.name} retracted “${r.title}”. It is no longer shared with anyone.`, link: { name: 'record', params: { id: r.id } } });
      },
    });

  return (
    <div className="stack dt2">
      <section className={`card dt2-record-hero ${r.retracted ? 'is-retracted' : ''}`}>
        <span className={`dt2-record-icon item-icon ${t.tone}`}>
          <Icon size={24} />
        </span>
        <div className="grow">
          <div className="eyebrow">
            {t.label} · {fmtDate(r.date)}
          </div>
          <h1 className="dt2-record-title">{r.title}</h1>
          <div className="chips mt-10">
            <Badge tone={t.tone}>{t.short}</Badge>
            {r.severity && <Badge tone={r.severity === 'Serious' ? 'bad' : r.severity === 'Moderate' ? 'warn' : 'neutral'}>{r.severity}</Badge>}
            {r.expires && <ExpiryBadge iso={r.expires} />}
            {restricted ? <Badge icon={LockSimple}>Restricted record</Badge> : <Badge tone="info" icon={Eye}>Visible across the network</Badge>}
            {r.retracted && <Badge tone="neutral">Retracted{r.retractedAt ? ` ${fromNow(r.retractedAt)}` : ''} · not shared</Badge>}
          </div>
        </div>
        <div className="dt2-hero-actions">
          {isOwner && !r.retracted && (
            <>
              <Button variant="ghost" icon={PencilSimple} disabledReason={deniedHint(session, 'record.manage')} onClick={() => setModal({ k: 'edit' })}>
                Edit
              </Button>
              <Button variant="danger-ghost" icon={Trash} disabledReason={deniedHint(session, 'record.manage')} onClick={() => setModal({ k: 'retract' })}>
                Retract
              </Button>
            </>
          )}
          {isSelf && !resp && !r.retracted && restricted && (
            <Button icon={ChatCircleText} onClick={() => setModal({ k: 'respond' })}>
              Add my response
            </Button>
          )}
        </div>
      </section>

      <div className="grid-main">
        <div className="stack">
          <Card title="What was recorded" icon={FileText}>
            {r.detail ? <p className="dt2-prose">{r.detail}</p> : <p className="muted">No further detail was recorded.</p>}
            <dl className="dt2-facts">
              <div>
                <dt>Date</dt>
                <dd>{fmtDate(r.date)}</dd>
              </div>
              <div>
                <dt>{restricted ? 'Evidence reference' : 'Certificate'}</dt>
                <dd className="mono">{r.evidence || '—'}</dd>
              </div>
              {r.severity && (
                <div>
                  <dt>Severity</dt>
                  <dd>{r.severity}</dd>
                </div>
              )}
              {r.expires && (
                <div>
                  <dt>Expires</dt>
                  <dd>{fmtDate(r.expires)}</dd>
                </div>
              )}
              <div>
                <dt>Recorded</dt>
                <dd>
                  {fmtTime(r.createdAt)}
                  {r.createdBy ? ` by ${r.createdBy}` : ''}
                </dd>
              </div>
              {r.editedAt && (
                <div>
                  <dt>Last edited</dt>
                  <dd>
                    {fmtTime(r.editedAt)}
                    {r.editedBy ? ` by ${r.editedBy}` : ''}
                  </dd>
                </div>
              )}
              {r.retracted && (
                <div>
                  <dt>Retracted</dt>
                  <dd>
                    {r.retractedAt ? fmtTime(r.retractedAt) : 'Yes'}
                    {r.retractedBy ? ` by ${r.retractedBy}` : ''}
                  </dd>
                </div>
              )}
            </dl>
          </Card>

          {restricted && (
            <Card title="Guard's response" subtitle="The guard's side of the story travels with this record wherever it is shared." icon={ChatCircleText}>
              {resp ? (
                <div className="dt2-response">
                  <div className="row between gap-s wrap">
                    <span className="small muted">Submitted {fmtDate(resp.createdAt)}</span>
                    <ResponseStatus resp={resp} />
                  </div>
                  <p className="dt2-prose">{resp.text}</p>
                  {resp.companyNote && (
                    <p className="dt2-note">
                      <b>{owner.name}:</b> {resp.companyNote}
                    </p>
                  )}
                  {resp.regulatorNote && (
                    <p className="dt2-note">
                      <b>Regulator:</b> {resp.regulatorNote}
                    </p>
                  )}
                  <EntityLink kind="response" id={resp.id} className="dt2-more">
                    Open the response
                  </EntityLink>
                </div>
              ) : (
                <EmptyState compact body={isSelf ? 'You have not responded to this record.' : 'The guard has not responded to this record.'} />
              )}
            </Card>
          )}

          <Card title="Activity" subtitle="Changes and events that mention this record" icon={ClockCounterClockwise}>
            <ActivityTimeline entries={related} empty="No activity recorded for this entry." />
          </Card>
        </div>

        <div className="stack">
          <Card title="Guard">
            {g ? <GuardCell guard={g} size={44} /> : <span className="muted">Unknown guard</span>}
          </Card>
          <Card title="Recorded by">
            <CompanyCell company={owner} size={40} sub={r.createdBy || owner.city} />
          </Card>
          {restricted && (
            <Card title="Released to" subtitle="Employers that can see this record through a consented release or share code" icon={Handshake}>
              {releases.length ? (
                <ul className="items">
                  {releases.map((x) => {
                    const live = grantActive(x);
                    return (
                      <li key={x.id}>
                        <CompanyCell id={x.viewerCompanyId} size={30} sub={`${x.via === 'share' ? 'Share code' : 'Verification'} · ${fmtDate(x.createdAt)}`} />
                        <span className="grow" />
                        <Badge tone={live ? 'ok' : 'neutral'}>{x.revokedAt ? 'Revoked' : live ? `Until ${fmtDate(x.expiresAt)}` : 'Expired'}</Badge>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <EmptyState compact body="Not released to any other employer." />
              )}
              {releases.length > 0 && <p className="small muted mt-10">Released scopes: {[...new Set(releases.flatMap((x) => x.scopes))].map(scopeShort).join(', ')}.</p>}
            </Card>
          )}
        </div>
      </div>

      {modal?.k === 'edit' && manage && <RecordModal record={r} onClose={() => setModal(null)} />}
      {modal?.k === 'retract' && (
        <ConfirmModal
          title="Retract this record?"
          body={`“${r.title}” will no longer be shared with any employer. The guard and the regulator will still see that it was retracted.`}
          confirmLabel="Retract record"
          onConfirm={retract}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.k === 'respond' && (
        <RespondModal guardId={r.guardId} target={{ type: 'record', item: r, companyId: r.companyId, label: r.title }} onClose={() => setModal(null)} />
      )}
    </div>
  );
}
