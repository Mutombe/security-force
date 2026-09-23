import { Buildings, Clock, MapPin, ShieldCheck, UsersThree, Warning } from '@phosphor-icons/react';
import { useStore } from '../../store';
import { company, coverage, siteGuards } from '../../access';
import { Avatar, Badge, Button, EmptyState, OrgMark, PageHead, Stat, fromNow } from '../../ui';
import { CoverageBadge, LicenceBadge, RiskBadge } from '../../components';
import { RESULTS } from './results';
import './client.css';

export default function ClientSites({ go }) {
  const { db, session } = useStore();
  const client = db.clients.find((c) => c.id === session.clientId);
  const sites = db.sites.filter((s) => s.clientId === session.clientId && s.active);
  const covs = sites.map((s) => coverage(db, s));
  const posts = covs.reduce((a, c) => a + c.posts, 0);
  const filled = covs.reduce((a, c) => a + Math.min(c.filled, c.posts), 0);
  const gaps = covs.filter((c) => c.filled < c.posts).length;
  const recent = db.checks.filter((c) => c.clientId === session.clientId && new Date(c.ts) > Date.now() - 7 * 86400000);

  return (
    <div className="stack">
      <PageHead
        eyebrow={client.name}
        title="My sites"
        sub="Who your security contractors have rostered at each site, and whether every post is filled. Check each guard's live badge when they arrive."
        actions={
          <Button icon={ShieldCheck} onClick={() => go('verify')}>
            Check a guard
          </Button>
        }
      />
      <div className="stats">
        <Stat label="Sites" value={sites.length} icon={Buildings} />
        <Stat label="Posts filled" value={`${filled}/${posts}`} tone={filled < posts ? 'warn' : 'ok'} hint={posts ? `${Math.round((filled / posts) * 100)}% coverage` : undefined} icon={UsersThree} />
        <Stat label="Sites with gaps" value={gaps} tone={gaps ? 'bad' : undefined} icon={Warning} />
        <Stat label="Checks this week" value={recent.length} hint={`${recent.filter((c) => c.result !== 'verified').length} failed`} icon={ShieldCheck} onClick={() => go('history')} />
      </div>

      {sites.length ? (
        <div className="cl-sites">
          {sites.map((s) => {
            const co = company(db, s.companyId);
            const c = coverage(db, s);
            const onDuty = siteGuards(db, s.id);
            const last = db.checks.filter((k) => k.siteId === s.id && k.clientId === session.clientId).sort((a, b) => b.ts.localeCompare(a.ts))[0];
            return (
              <article key={s.id} className={`card cl-site ${c.filled < c.posts ? 'is-short' : ''}`}>
                <header className="cl-site-head">
                  <div className="grow">
                    <h3>{s.name}</h3>
                    <div className="cl-site-meta">
                      <span>
                        <MapPin size={13} /> {s.city}
                      </span>
                      <span>
                        <Clock size={13} /> {s.shift}
                      </span>
                    </div>
                  </div>
                  <RiskBadge risk={s.risk} />
                </header>
                <div className="cl-site-co">
                  <OrgMark company={co} size={28} />
                  <div className="grow">
                    <b>{co.name}</b>
                    <span>{co.phone}</span>
                  </div>
                  <CoverageBadge site={s} />
                </div>
                {c.filled < c.posts && (
                  <div className="notice notice-bad">
                    <Warning size={16} />
                    <span>
                      {c.posts - c.filled} of {c.posts} posts have no guard assigned. Raise it with {co.name}.
                    </span>
                  </div>
                )}
                <div>
                  <div className="cl-label">Expected on duty</div>
                  {onDuty.length ? (
                    <ul className="cl-duty">
                      {onDuty.map(({ e, g }) => (
                        <li key={e.id}>
                          <Avatar name={g.name} seed={g.id} src={g.avatar} size={40} />
                          <div className="grow">
                            <div className="cell-name">{g.name}</div>
                            <div className="cl-duty-sub">
                              {e.position} · <LicenceBadge guard={g} compact />
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" icon={ShieldCheck} onClick={() => go('verify', { id: g.id })}>
                            Check
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyState compact body="No guards are assigned to this site." />
                  )}
                </div>
                <footer className="cl-site-foot">
                  {last ? (
                    <>
                      <Badge tone={RESULTS[last.result]?.tone ?? 'neutral'} dot>
                        {RESULTS[last.result]?.label ?? last.result}
                      </Badge>
                      <span className="muted small">
                        Last check {fromNow(last.ts)} by {last.by}
                      </span>
                    </>
                  ) : (
                    <span className="muted small">No checks recorded at this site yet.</span>
                  )}
                </footer>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="card">
          <EmptyState icon={Buildings} title="No sites yet" body="Your security company adds your sites. Ask them to link your organisation in Security Force." />
        </div>
      )}
    </div>
  );
}
