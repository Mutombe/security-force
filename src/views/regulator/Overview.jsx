import { useMemo } from 'react';
import { ArrowRight, Buildings, Clock, ClockCounterClockwise, Handshake, IdentificationCard, Scales, ShieldCheck, Users } from '@phosphor-icons/react';
import { useStore } from '../../store';
import { activeEmployments, company, companyReputation, complianceIssues, guardById } from '../../access';
import { Badge, Button, Card, DataTable, EmptyState, OrgMark, PageHead, Stat, fmtDate, fromNow } from '../../ui';
import { CompanyCell, GuardCell, EntityLink } from '../../components';
import { targetOf } from '../trust/shared';
import './regulator.css';
import '../detail/detail.css';

export const STATUS = { active: ['ok', 'Active'], pending: ['warn', 'Awaiting approval'], suspended: ['bad', 'Suspended'] };

export function companyMetrics(db, c) {
  const rep = companyReputation(db, c.id);
  return {
    c,
    deployed: activeEmployments(db, c.id).length,
    sites: db.sites.filter((s) => s.companyId === c.id && s.active).length,
    issues: complianceIssues(db, c.id).length,
    ...rep,
  };
}

export default function Overview({ go }) {
  const { db } = useStore();
  const since30 = Date.now() - 30 * 86400000;
  const released30 = db.requests.filter((r) => r.status === 'approved' && new Date(r.respondedAt).getTime() >= since30).length;
  const overdue = db.requests.filter((r) => r.status === 'pending' && new Date(r.dueAt) < new Date());
  const escalated = db.responses.filter((r) => r.status === 'escalated');
  const pending = db.companies.filter((c) => c.status === 'pending');
  const deployed = db.employments.filter((e) => !e.end).length;
  const rows = useMemo(() => db.companies.map((c) => companyMetrics(db, c)), [db]);

  const columns = [
    { key: 'co', header: 'Company', width: 'minmax(0, 1.8fr)', mobile: 'primary', sort: (m) => m.c.name, render: (m) => <CompanyCell company={m.c} size={30} sub={`${m.c.city} · ${m.c.reg}`} /> },
    { key: 'deployed', header: 'Deployed', width: '90px', align: 'right', mobile: 'meta', sort: (m) => m.deployed, render: (m) => <span className="rg-num" data-label="Deployed">{m.deployed}</span> },
    {
      key: 'sla',
      header: 'On-time answers',
      width: '130px',
      align: 'right',
      mobile: 'meta',
      sort: (m) => m.slaRate ?? -1,
      render: (m) => <span className={`rg-num ${m.slaRate != null && m.slaRate < 80 ? 'is-bad' : ''}`} data-label="On time">{m.slaRate == null ? '—' : `${m.slaRate}%`}</span>,
    },
    { key: 'avg', header: 'Avg response', width: '110px', align: 'right', mobile: 'meta', sort: (m) => m.avgHours ?? 1e9, render: (m) => <span className="rg-num" data-label="Avg">{m.avgHours == null ? '—' : `${m.avgHours}h`}</span> },
    { key: 'overdue', header: 'Overdue', width: '90px', align: 'right', mobile: 'meta', sort: (m) => m.overdue, render: (m) => <span className={`rg-num ${m.overdue ? 'is-bad' : ''}`} data-label="Overdue">{m.overdue}</span> },
    { key: 'amended', header: 'Records corrected', width: '140px', align: 'right', mobile: 'meta', sort: (m) => m.amended, render: (m) => <span className="rg-num" data-label="Corrected">{m.amended}/{m.disputes}</span> },
    { key: 'issues', header: 'Compliance', width: '120px', align: 'right', mobile: 'meta', sort: (m) => m.issues, render: (m) => (m.issues ? <Badge tone="warn">{m.issues} issue{m.issues > 1 ? 's' : ''}</Badge> : <Badge tone="ok">Clear</Badge>) },
    { key: 'status', header: 'Status', width: '150px', mobile: 'aside', sort: (m) => m.c.status, render: (m) => <Badge tone={STATUS[m.c.status][0]} dot>{STATUS[m.c.status][1]}</Badge> },
  ];

  return (
    <div className="stack rg-page">
      <PageHead eyebrow="Authorised oversight" title="Network oversight" sub="How companies in the network treat guards' records: how fast they answer, how often records are corrected, and what is waiting for a ruling." />
      <div className="rg-kpis">
        <Stat label="Registered guards" value={db.guards.length} icon={IdentificationCard} hint={`${deployed} deployed now`} onClick={() => go('search')} />
        <Stat label="Companies" value={db.companies.length} icon={Buildings} hint={pending.length ? `${pending.length} awaiting approval` : 'All approved'} tone={pending.length ? 'warn' : undefined} onClick={() => go('companies')} />
        <Stat label="Released, last 30 days" value={released30} icon={Handshake} hint={`${db.requests.length} requests all time`} />
        <Stat label="Awaiting a ruling" value={escalated.length} icon={Scales} tone={escalated.length ? 'warn' : undefined} hint="escalated disputes" onClick={() => go('escalations')} />
        <Stat label="Overdue requests" value={overdue.length} icon={Clock} tone={overdue.length ? 'bad' : undefined} hint="past company response targets" />
        <Stat label="Client checks, 7 days" value={db.checks.filter((c) => Date.now() - new Date(c.ts).getTime() < 7 * 86400000).length} icon={ShieldCheck} hint={`${db.checks.filter((c) => c.result !== 'verified').length} failed all time`} />
      </div>

      <Card title="Company standing" subtitle="Sort by any column. Click a company to review it." icon={Users} flush>
        <DataTable columns={columns} rows={rows} onRowClick={(m) => go('companies', { id: m.c.id })} initialSort={{ key: 'overdue', dir: 'desc' }} />
      </Card>

      <div className="grid-3">
        <Card title="Needs a ruling" icon={Scales} actions={escalated.length > 0 && <Button variant="subtle" size="sm" iconRight={ArrowRight} onClick={() => go('escalations')}>All</Button>}>
          {escalated.length ? (
            <ul className="items">
              {escalated.map((r) => (
                <li key={r.id} className="tap" onClick={() => go('escalations', { id: r.id })}>
                  <GuardCell id={r.guardId} size={32} sub={`${company(db, r.companyId).name} · ${targetOf(db, r).label}`} />
                  <span className="grow" />
                  <Badge tone="info">{fromNow(r.escalatedAt)}</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact icon={Scales} body="No disputes are waiting for a ruling." />
          )}
        </Card>
        <Card title="Awaiting approval" icon={Buildings}>
          {pending.length ? (
            <ul className="items">
              {pending.map((c) => (
                <li key={c.id} className="tap" onClick={() => go('companies', { id: c.id })}>
                  <OrgMark company={c} size={32} />
                  <span className="grow">
                    <span className="item-title"><EntityLink kind="company" id={c.id} className="dt2-inline-link">{c.name}</EntityLink></span>
                    <span className="item-sub mono">{c.reg}</span>
                  </span>
                  <Badge tone="warn">Review</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact icon={Buildings} body="No companies are waiting for approval." />
          )}
        </Card>
        <Card title="Overdue requests" icon={Clock}>
          {overdue.length ? (
            <ul className="items">
              {overdue.map((r) => (
                <li key={r.id}>
                  <OrgMark company={company(db, r.toCompanyId)} size={32} />
                  <span className="grow">
                    <span className="item-title"><EntityLink kind="company" id={r.toCompanyId} className="dt2-inline-link">{company(db, r.toCompanyId).name}</EntityLink></span>
                    <span className="item-sub">
                      About <EntityLink kind="guard" id={r.guardId} className="dt2-inline-link">{guardById(db, r.guardId).name}</EntityLink> · due {fmtDate(r.dueAt)}
                    </span>
                  </span>
                  <Badge tone="bad">{fromNow(r.dueAt).replace(' ago', '')} late</Badge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact icon={Clock} body="Every company is answering on time." />
          )}
        </Card>
      </div>

      <Card title="Recent activity" icon={ClockCounterClockwise} actions={<Button variant="subtle" size="sm" iconRight={ArrowRight} onClick={() => go('audit')}>Audit trail</Button>}>
        <ul className="items">
          {db.audit.slice(0, 8).map((a) => (
            <li key={a.id}>
              <span className="grow">
                <span className="item-title">
                  {a.actorUser || a.actor} <span className="muted">· {a.action.toLowerCase()}</span>
                </span>
                <span className="item-sub clamp-1">{a.detail}</span>
              </span>
              <span className="mono small faint nowrap">{fromNow(a.ts)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
