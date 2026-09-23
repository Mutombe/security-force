import { useState } from 'react';
import { ArrowRight, Buildings, ChatCircleText, Clock, MapPin, ShieldCheck, UsersThree, Warning } from '@phosphor-icons/react';
import { useStore } from '../../store';
import { company, coverage, guardById, siteGuards } from '../../access';
import { Avatar, Badge, Button, Card, DataTable, Drawer, EmptyState, Field, Meter, Modal, OrgMark, PageHead, Stat, fmtTime, fromNow } from '../../ui';
import { CompanyCell, CoverageBadge, EntityLink, GuardCell, LicenceBadge, RiskBadge } from '../../components';
import { RESULTS } from './results';
import './client.css';
import '../detail/detail.css';

export default function ClientSites({ go, id }) {
  const { db, session } = useStore();
  const client = db.clients.find((c) => c.id === session.clientId);
  const sites = db.sites.filter((s) => s.clientId === session.clientId && s.active);
  const covs = sites.map((s) => coverage(db, s));
  const posts = covs.reduce((a, c) => a + c.posts, 0);
  const filled = covs.reduce((a, c) => a + Math.min(c.filled, c.posts), 0);
  const gaps = covs.filter((c) => c.filled < c.posts).length;
  const recent = db.checks.filter((c) => c.clientId === session.clientId && new Date(c.ts) > Date.now() - 7 * 86400000);
  const detail = id ? db.sites.find((s) => s.id === id && s.clientId === session.clientId) : null;

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
                    <h3>
                      <a href={`#/sites/${s.id}`} className="entity-link dt2-title-link">
                        {s.name}
                      </a>
                    </h3>
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
                  <CompanyCell company={co} size={28} sub={co.phone} />
                  <span className="grow" />
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
                            <EntityLink kind="guard" id={g.id} className="cell-name">
                              {g.name}
                            </EntityLink>
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
                  <a href={`#/sites/${s.id}`} className="dt2-more">
                    Site details <ArrowRight size={13} />
                  </a>
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

      {id && detail && <SiteDetail site={detail} go={go} onClose={() => go('sites')} />}
      {id && !detail && (
        <Drawer title="Site not found" backLabel="My sites" onClose={() => go('sites')}>
          <EmptyState icon={Buildings} title="Not one of your sites" body="This site does not belong to your organisation, or it has been closed." />
        </Drawer>
      )}
    </div>
  );
}

function SiteDetail({ site: s, go, onClose }) {
  const { db, session } = useStore();
  const [report, setReport] = useState(false);
  const co = company(db, s.companyId);
  const c = coverage(db, s);
  const onDuty = siteGuards(db, s.id);
  const checks = db.checks.filter((k) => k.siteId === s.id && k.clientId === session.clientId).sort((a, b) => b.ts.localeCompare(a.ts));
  const failed = checks.filter((k) => k.result !== 'verified').length;

  return (
    <Drawer
      title={s.name}
      subtitle={`${s.city} · ${s.shift} · guarded by ${co.name}`}
      backLabel="My sites"
      onClose={onClose}
      headerExtra={<RiskBadge risk={s.risk} />}
      footer={
        <>
          <Button variant="ghost" icon={ChatCircleText} onClick={() => setReport(true)}>
            Report a problem
          </Button>
          <Button icon={ShieldCheck} onClick={() => go('verify')}>
            Check a guard
          </Button>
        </>
      }
    >
      <div className="stats">
        <Stat label="Posts filled" value={`${c.filled}/${c.posts}`} tone={c.tone === 'ok' ? 'ok' : c.tone === 'bad' ? 'bad' : 'warn'} icon={UsersThree} />
        <Stat label="Risk level" value={s.risk} icon={Warning} />
        <Stat label="Checks recorded" value={checks.length} hint={`${failed} failed`} icon={ShieldCheck} />
        <Stat label="Last check" value={checks[0] ? fromNow(checks[0].ts) : '—'} hint={checks[0]?.by} icon={Clock} />
      </div>

      {c.filled < c.posts && (
        <div className="notice notice-bad">
          <Warning size={16} />
          <span>
            {c.posts - c.filled} of {c.posts} posts have no guard assigned tonight. Use “Report a problem” to tell {co.name}.
          </span>
        </div>
      )}

      <div className="grid-main">
        <div className="stack">
          <Card title="Expected on duty" subtitle="Guards the company has rostered at this site" icon={UsersThree}>
            <div className="dt2-cov">
              <Meter value={c.pct} tone={c.tone} label={`${c.filled} of ${c.posts} posts`} />
            </div>
            {onDuty.length ? (
              <ul className="items dt2-duty">
                {onDuty.map(({ e, g }) => (
                  <li key={e.id}>
                    <GuardCell guard={g} size={40} sub={e.position} />
                    <span className="grow" />
                    <LicenceBadge guard={g} compact />
                    <Button variant="ghost" size="sm" icon={ShieldCheck} onClick={() => go('verify', { id: g.id })}>
                      Check
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState compact body="No guards are assigned to this site." />
            )}
          </Card>
          <Card title="Check history" subtitle="Every badge check your team has done at this site" icon={ShieldCheck} flush>
            <DataTable
              rows={checks}
              pageSize={8}
              columns={[
                { key: 'ts', header: 'When', width: '140px', mobile: 'meta', sort: (k) => k.ts, render: (k) => <span className="small mono">{fmtTime(k.ts)}</span> },
                {
                  key: 'guard',
                  header: 'Guard',
                  width: 'minmax(180px, 2fr)',
                  mobile: 'primary',
                  render: (k) => (k.guardId && guardById(db, k.guardId) ? <GuardCell id={k.guardId} size={30} /> : <span className="mono small">{k.input}</span>),
                },
                { key: 'by', header: 'Checked by', width: 'minmax(120px, 1fr)', mobile: 'meta', render: (k) => <span className="small">{k.by}</span> },
                { key: 'res', header: 'Result', width: '150px', align: 'right', mobile: 'aside', render: (k) => <Badge tone={RESULTS[k.result]?.tone ?? 'neutral'} dot>{RESULTS[k.result]?.label ?? k.result}</Badge> },
              ]}
              empty={<EmptyState compact body="No checks recorded at this site yet." />}
            />
          </Card>
        </div>
        <div className="stack">
          <Card title="Security company">
            <CompanyCell company={co} size={44} sub={co.city} />
            <dl className="dt2-facts mt-10">
              <div>
                <dt>Phone</dt>
                <dd>{co.phone || '—'}</dd>
              </div>
              <div>
                <dt>Email</dt>
                <dd>{co.email || '—'}</dd>
              </div>
            </dl>
          </Card>
          <Card title="Site">
            <dl className="dt2-facts">
              <div>
                <dt>City</dt>
                <dd>{s.city}</dd>
              </div>
              <div>
                <dt>Shift</dt>
                <dd>{s.shift}</dd>
              </div>
              <div>
                <dt>Required posts</dt>
                <dd>{s.posts}</dd>
              </div>
              <div>
                <dt>Risk level</dt>
                <dd>{s.risk}</dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>

      {report && <ReportModal site={s} co={co} onClose={() => setReport(false)} />}
    </Drawer>
  );
}

const TOPICS = ['Post not covered', 'Guard arrived late', 'Guard could not show a live badge', 'Conduct concern', 'Other'];

function ReportModal({ site, co, onClose }) {
  const { act } = useStore();
  const [topic, setTopic] = useState(TOPICS[0]);
  const [text, setText] = useState('');
  const ok = text.trim().length >= 10;
  const send = () =>
    act({
      key: `report:${site.id}`,
      pending: 'Sending your report…',
      success: `${co.name} has been notified`,
      touches: [],
      apply: (d, t) => {
        t.log('Reported a site problem', `${site.name} — ${topic}: ${text.trim()}`);
        t.notify(`company:${co.id}`, { title: `${t.actor.name}: ${topic.toLowerCase()}`, body: `${site.name} — ${text.trim()}`, link: { name: 'sites', params: { id: site.id } } });
      },
    }).then(onClose);
  return (
    <Modal
      title="Report a problem"
      subtitle={`${site.name} · ${co.name}`}
      icon={ChatCircleText}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={send} disabled={!ok}>
            Send to {co.name}
          </Button>
        </>
      }
    >
      <div className="field">
        <span className="field-label">What is the problem?</span>
        <div className="option-list">
          {TOPICS.map((x) => (
            <label key={x} className={`option ${topic === x ? 'on' : ''}`}>
              <input type="radio" name="topic" checked={topic === x} onChange={() => setTopic(x)} />
              <span>{x}</span>
            </label>
          ))}
        </div>
      </div>
      <Field label="Details" hint="At least 10 characters. Include times and names if you have them.">
        <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} />
      </Field>
      <p className="muted small">
        <OrgMark company={co} size={18} /> {co.name} gets this straight away in their notifications. It is also kept in your audit trail.
      </p>
    </Modal>
  );
}
