import { useMemo, useState } from 'react';
import {
  ArrowRight, Buildings, ChartLineUp, ChatCircleText, ClockCounterClockwise, Handshake, Kanban, MapPin, Plus, ShieldWarning,
  UserPlus, Users, Warning,
} from '@phosphor-icons/react';
import { useStore } from '../../store';
import {
  STAGES, activeEmployments, company, companyReputation, complianceIssues, coverage, deniedHint, guardById, slaStatus,
} from '../../access';
import { Avatar, Badge, Button, Card, EmptyState, PageHead, Stat, fmtDate, fromNow, plural } from '../../ui';
import { GuardCell, RiskBadge, SlaBadge, EntityLink } from '../../components';
import { HireModal } from '../../modals';
import { SiteModal } from './Sites';
import './company.css';
import '../detail/detail.css';

export default function CompanyDashboard({ go }) {
  const { db, session, can } = useStore();
  const me = session.companyId;
  const co = company(db, me);
  const [modal, setModal] = useState(null);

  const data = useMemo(() => {
    const active = activeEmployments(db, me);
    const sites = db.sites.filter((s) => s.companyId === me && s.active);
    const cov = sites.map((s) => ({ s, c: coverage(db, s) }));
    const posts = cov.reduce((a, x) => a + x.c.posts, 0);
    const filled = cov.reduce((a, x) => a + Math.min(x.c.filled, x.c.posts), 0);
    const gaps = cov.filter((x) => x.c.filled < x.c.posts);
    const issues = complianceIssues(db, me);
    const incoming = db.requests.filter((r) => r.toCompanyId === me && r.status === 'pending');
    const overdue = incoming.filter((r) => slaStatus(r)?.tone === 'bad');
    const disputes = db.responses.filter((r) => r.companyId === me && r.status === 'open');
    const applicants = db.applicants.filter((a) => a.companyId === me);
    const activity = db.audit.filter((a) => a.actorId === me && !['Signed in', 'Signed out', 'Viewed profile'].includes(a.action)).slice(0, 8);
    return { active, sites, cov, posts, filled, gaps, issues, incoming, overdue, disputes, applicants, activity };
  }, [db, me]);

  const rep = companyReputation(db, me);
  const covPct = data.posts ? Math.round((data.filled / data.posts) * 100) : 100;
  const critGaps = data.gaps.filter((x) => x.s.risk === 'Critical');
  const expiredLic = data.issues.filter((i) => i.kind === 'licence' && i.tone === 'bad');

  // Needs attention, most urgent first
  const attention = [
    ...data.incoming
      .map((r) => ({ key: r.id, tone: slaStatus(r)?.tone === 'bad' ? 'bad' : 'warn', icon: Handshake, rank: slaStatus(r)?.hours ?? 0,
        title: `${company(db, r.fromCompanyId).name} asks about ${guardById(db, r.guardId).name}`,
        sub: `${r.requestedScopes.length} items requested · received ${fromNow(r.createdAt)}`, badge: <SlaBadge req={r} />, href: `#/verification/${r.id}`, go: () => go('verification', { id: r.id }) })),
    ...data.disputes.map((r) => ({ key: r.id, tone: 'warn', icon: ChatCircleText, rank: (new Date(r.dueAt) - Date.now()) / 3600000,
      title: `${guardById(db, r.guardId).name} responded to a record`, sub: r.text, badge: <Badge tone="warn">Due {fmtDate(r.dueAt)}</Badge>, href: `#/disputes/${r.id}`, go: () => go('disputes', { id: r.id }) })),
    ...data.gaps.map(({ s, c }) => ({ key: s.id, tone: s.risk === 'Critical' ? 'bad' : 'warn', icon: MapPin, rank: s.risk === 'Critical' ? -1000 : 100,
      title: `${s.name} is short ${plural(c.posts - c.filled, 'post')}`, sub: `${s.risk} risk · ${s.shift} · ${c.filled} of ${c.posts} filled`, badge: <RiskBadge risk={s.risk} />, href: `#/sites/${s.id}`, go: () => go('sites', { id: s.id }) })),
    ...expiredLic.map((i) => ({ key: `lic-${i.guard.id}`, tone: 'bad', icon: ShieldWarning, rank: -500,
      title: `${i.guard.name} is working without a valid licence`, sub: i.label, badge: <Badge tone="bad">Expired</Badge>, href: `#/guard/${i.guard.id}`, go: () => go('guard', { id: i.guard.id }) })),
  ].sort((a, b) => a.rank - b.rank);

  const stages = STAGES.map((st) => ({ ...st, n: data.applicants.filter((a) => a.stage === st.key).length }));
  const maxStage = Math.max(1, ...stages.map((s) => s.n));

  return (
    <div className="stack">
      <PageHead
        eyebrow={`${co.reg} · ${co.city}`}
        title={co.name}
        sub={`${plural(data.active.length, 'guard')} deployed across ${plural(data.sites.length, 'active site')}.`}
        actions={
          <>
            <Button variant="ghost" icon={Plus} onClick={() => setModal('site')} disabledReason={deniedHint(session, 'site.manage')}>
              Add site
            </Button>
            <Button icon={UserPlus} onClick={() => setModal('hire')} disabledReason={deniedHint(session, 'guard.hire')}>
              Register or hire
            </Button>
          </>
        }
      />

      {critGaps.length > 0 && (
        <div className="notice notice-bad">
          <Warning size={16} />
          <span>
            <b>{critGaps.map((x) => x.s.name).join(', ')}</b> {critGaps.length === 1 ? 'is a Critical site' : 'are Critical sites'} without full cover tonight. Assign guards before the shift starts.
          </span>
        </div>
      )}

      <div className="stats">
        <Stat label="Guards deployed" value={data.active.length} icon={Users} hint={`${data.sites.length} active sites`} onClick={() => go('workforce')} />
        <Stat
          label="Site coverage"
          value={`${covPct}%`}
          icon={Buildings}
          tone={covPct < 80 ? 'bad' : covPct < 100 ? 'warn' : 'ok'}
          hint={data.gaps.length ? `${plural(data.gaps.length, 'site')} short · ${data.filled}/${data.posts} posts` : `All ${data.posts} posts filled`}
          onClick={() => go('sites')}
        />
        <Stat
          label="Compliance issues"
          value={data.issues.length}
          icon={ShieldWarning}
          tone={data.issues.some((i) => i.tone === 'bad') ? 'bad' : data.issues.length ? 'warn' : undefined}
          hint={`${data.issues.filter((i) => i.tone === 'bad').length} expired · ${data.issues.filter((i) => i.tone === 'warn').length} expiring`}
          onClick={() => go('workforce')}
        />
        <Stat
          label="Requests to answer"
          value={data.incoming.length}
          icon={Handshake}
          tone={data.overdue.length ? 'bad' : data.incoming.length ? 'warn' : undefined}
          hint={data.overdue.length ? `${data.overdue.length} past the ${co.policy.slaHours}h target` : `Target ${co.policy.slaHours}h`}
          onClick={() => go('verification')}
        />
      </div>

      <div className="co-grid">
        <Card
          className="co-span-2"
          title="Needs attention"
          subtitle="Most urgent first"
          icon={Warning}
          actions={attention.length > 0 && <span className="count">{attention.length}</span>}
        >
          {attention.length ? (
            <ul className="items co-attn">
              {attention.slice(0, 7).map((a) => (
                <li key={a.key} onClick={a.go} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && a.go()}>
                  <span className={`item-icon ${a.tone}`}>
                    <a.icon size={17} />
                  </span>
                  <div className="grow">
                    <a href={a.href} className="item-title clamp-1 dt2-card-link" onClick={(e) => e.stopPropagation()}>
                      {a.title}
                    </a>
                    <div className="item-sub clamp-1">{a.sub}</div>
                  </div>
                  {a.badge}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact title="Nothing waiting on you" body="Requests, guard responses, coverage gaps and licence problems will appear here." />
          )}
        </Card>

        <Card title="Network reputation" icon={ChartLineUp}>
          <dl className="co-rep">
            <div>
              <dt>Average response</dt>
              <dd>{rep.avgHours == null ? '—' : `${rep.avgHours}h`}</dd>
            </div>
            <div>
              <dt>Answered on time</dt>
              <dd className={rep.slaRate != null && rep.slaRate < 80 ? 'bad' : 'ok'}>{rep.slaRate == null ? '—' : `${rep.slaRate}%`}</dd>
            </div>
            <div>
              <dt>Overdue now</dt>
              <dd className={rep.overdue ? 'bad' : ''}>{rep.overdue}</dd>
            </div>
            <div>
              <dt>Records amended</dt>
              <dd>
                {rep.amended}/{rep.disputes}
              </dd>
            </div>
          </dl>
          <p className="co-note">Other employers and the regulator see how quickly you answer verification requests and how often guard disputes lead to corrections.</p>
        </Card>

        <Card title="Coverage by site" icon={Buildings} actions={<Button variant="subtle" size="sm" iconRight={ArrowRight} onClick={() => go('sites')}>All sites</Button>}>
          {data.cov.length ? (
            <div className="co-cov">
              {[...data.cov]
                .sort((a, b) => a.c.pct - b.c.pct)
                .map(({ s, c }) => (
                  <a key={s.id} href={`#/sites/${s.id}`} className="co-cov-row dt2-row-link">
                    <span className="co-cov-name">
                      <b>{s.name}</b>
                      <span>
                        {s.risk} · {s.shift}
                      </span>
                    </span>
                    <span className={`co-bar ${c.tone}`}>
                      <span style={{ width: `${Math.min(100, c.pct)}%` }} />
                    </span>
                    <span className="mono small">
                      {c.filled}/{c.posts}
                    </span>
                  </a>
                ))}
            </div>
          ) : (
            <EmptyState compact title="No sites yet" body="Add a site to track coverage." />
          )}
        </Card>

        <Card title="Compliance watchlist" icon={ShieldWarning} actions={data.issues.length > 0 && <span className="count">{data.issues.length}</span>}>
          {data.issues.length ? (
            <ul className="items co-attn">
              {data.issues.slice(0, 6).map((i, n) => (
                <li key={n} onClick={() => go('guard', { id: i.guard.id })}>
                  <GuardCell guard={i.guard} size={32} sub={i.label} />
                  <span className="grow" />
                  <Badge tone={i.tone}>{i.tone === 'bad' ? 'Expired' : `${i.days}d`}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact title="Everyone is compliant" body="Licences and certificates expiring in the next 60 days will show here." />
          )}
        </Card>

        <Card title="Recruitment pipeline" icon={Kanban} actions={<Button variant="subtle" size="sm" iconRight={ArrowRight} onClick={() => go('recruitment')}>Open</Button>}>
          <div className="co-funnel">
            {stages.map((st) => (
              <a key={st.key} href="#/recruitment" className={`co-funnel-row dt2-row-link ${st.key === 'rejected' ? 'rej' : st.key === 'hired' ? 'hired' : ''}`}>
                <span>{st.label}</span>
                <span className="co-funnel-bar">
                  <span style={{ width: `${(st.n / maxStage) * 100}%`, opacity: st.n ? undefined : 0 }} />
                </span>
                <b>{st.n}</b>
              </a>
            ))}
          </div>
        </Card>

        <Card title="Recent activity" icon={ClockCounterClockwise} actions={<Button variant="subtle" size="sm" iconRight={ArrowRight} onClick={() => go('audit')}>Audit trail</Button>}>
          {data.activity.length ? (
            <ol className="co-activity">
              {data.activity.map((a) => {
                const u = db.users.find((x) => x.name === a.actorUser);
                return (
                  <li key={a.id}>
                    <Avatar name={a.actorUser || a.actor} seed={u?.id} src={u?.avatar} size={28} />
                    <div className="co-activity-text grow">
                      <b>
                        {u ? (
                          <EntityLink kind="user" id={u.id} className="dt2-inline-link">
                            {a.actorUser}
                          </EntityLink>
                        ) : (
                          a.actorUser || a.actor
                        )}
                      </b>{' '}
                      {a.action.toLowerCase()}
                      <span className="co-activity-detail">
                        {a.guardId ? (
                          <EntityLink kind="guard" id={a.guardId} className="dt2-inline-link">
                            {a.detail}
                          </EntityLink>
                        ) : (
                          a.detail
                        )}
                      </span>
                    </div>
                    <span className="co-time">{fromNow(a.ts)}</span>
                  </li>
                );
              })}
            </ol>
          ) : (
            <EmptyState compact title="No activity yet" />
          )}
        </Card>
      </div>

      {modal === 'hire' && can('guard.hire') && <HireModal onClose={() => setModal(null)} onDone={(id) => go('guard', { id })} />}
      {modal === 'site' && can('site.manage') && <SiteModal onClose={() => setModal(null)} />}
    </div>
  );
}
