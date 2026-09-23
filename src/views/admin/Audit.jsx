import { useMemo, useState } from 'react';
import { ClockCounterClockwise, DownloadSimple, LockKey } from '@phosphor-icons/react';
import { useStore } from '../../store';
import { deniedHint } from '../../access';
import { Avatar, Button, DataTable, EmptyState, FilterSelect, PageHead, SearchInput, downloadCSV, fmtTime, fromNow } from '../../ui';
import { EntityLink } from '../../components';
import './admin.css';
import '../detail/detail.css';

const RANGES = { '': null, '24h': 1, '7d': 7, '30d': 30 };
const ROLE_LABEL = { staff: 'Company staff', guard: 'Guard', client: 'Client', regulator: 'Regulator', integration: 'Integration', system: 'System' };

function tone(action) {
  if (/declin|revok|retract|suspend|removed|deactivat|withdrew/i.test(action)) return 'bad';
  if (/approv|released|register|started|reinstat|amend|overturn|gave consent/i.test(action)) return 'ok';
  if (/request|escalat|response|separation|reminder/i.test(action)) return 'warn';
  if (/viewed|signed|check/i.test(action)) return 'info';
  return 'neutral';
}

export default function Audit({ go }) {
  const { db, session, can } = useStore();
  const regulator = session.kind === 'regulator';
  const [q, setQ] = useState('');
  const [action, setAction] = useState('');
  const [role, setRole] = useState('');
  const [range, setRange] = useState('');

  const scoped = useMemo(() => (regulator ? db.audit : db.audit.filter((a) => a.actorId === session.companyId)), [db.audit, regulator, session.companyId]);
  const actions = useMemo(() => [...new Set(scoped.map((a) => a.action))].sort(), [scoped]);
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    const days = RANGES[range];
    const since = days ? Date.now() - days * 86400000 : 0;
    return scoped.filter(
      (a) =>
        (!action || a.action === action) &&
        (!role || a.actorRole === role) &&
        (!since || new Date(a.ts).getTime() >= since) &&
        (!t || `${a.actor} ${a.actorUser ?? ''} ${a.action} ${a.detail}`.toLowerCase().includes(t)),
    );
  }, [scoped, q, action, role, range]);

  const canExport = regulator || can('audit.export');
  const exportCsv = () =>
    downloadCSV(
      `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`,
      rows.map((a) => ({ time: a.ts, organisation: a.actor, person: a.actorUser ?? '', role: a.actorRole, action: a.action, detail: a.detail, guard_id: a.guardId ?? '' })),
    );

  const avatarFor = (a) => {
    if (a.actorRole === 'guard') return db.guards.find((g) => g.id === a.actorId);
    return db.users.find((u) => u.name === a.actorUser);
  };
  const openable = session.kind === 'staff' || regulator;

  const columns = [
    { key: 'time', header: 'Time', width: '140px', mobile: 'meta', sort: (a) => a.ts, render: (a) => <span className="mono small" title={fromNow(a.ts)}>{fmtTime(a.ts)}</span> },
    {
      key: 'actor',
      header: 'Who',
      width: 'minmax(0, 1.3fr)',
      mobile: 'primary',
      sort: (a) => a.actorUser || a.actor,
      render: (a) => {
        const p = avatarFor(a);
        return (
          <span className="cell-person">
            <Avatar name={a.actorUser || a.actor} seed={p?.id} src={p?.avatar} size={30} />
            <span className="cell-person-text">
              {a.actorRole === 'guard' ? (
                <EntityLink kind="guard" id={a.actorId} className="cell-name dt2-card-link">
                  {a.actor}
                </EntityLink>
              ) : a.actorRole === 'staff' && p && !regulator ? (
                <EntityLink kind="user" id={p.id} className="cell-name dt2-card-link">
                  {a.actorUser}
                </EntityLink>
              ) : (
                <span className="cell-name">{a.actorUser || a.actor}</span>
              )}
              <span className="cell-sub">
                {a.actorRole === 'staff' || a.actorRole === 'integration' ? (
                  <EntityLink kind="company" id={a.actorId} className="dt2-inline-link">
                    {a.actor}
                  </EntityLink>
                ) : a.actorUser && a.actorUser !== a.actor ? (
                  a.actor
                ) : (
                  ROLE_LABEL[a.actorRole] ?? a.actorRole
                )}
              </span>
            </span>
          </span>
        );
      },
    },
    { key: 'action', header: 'Action', width: '190px', mobile: 'aside', sort: (a) => a.action, render: (a) => <span className={`ad-action ad-action-${tone(a.action)}`}>{a.action}</span> },
    {
      key: 'detail',
      header: 'Detail',
      width: 'minmax(0, 2.4fr)',
      mobile: 'secondary',
      render: (a) =>
        a.guardId && openable ? (
          <EntityLink kind="guard" id={a.guardId} className="link-btn ad-detail">
            {a.detail}
          </EntityLink>
        ) : (
          <span className="ad-detail">{a.detail}</span>
        ),
    },
  ];

  return (
    <div className="stack">
      <PageHead
        title="Audit trail"
        sub={
          regulator
            ? 'Every view, request, release and change across the network. Entries are append-only and kept for seven years.'
            : "Everything your company's people and integrations have done. Entries are append-only, kept for seven years, and visible to the regulator."
        }
        actions={
          <Button variant="ghost" icon={DownloadSimple} onClick={exportCsv} disabled={!rows.length} disabledReason={canExport ? undefined : deniedHint(session, 'audit.export')}>
            Export CSV
          </Button>
        }
      />
      <div className="toolbar">
        <SearchInput value={q} onChange={setQ} placeholder="Search people, actions or details" />
        <FilterSelect label={action || 'Action'} value={action} onChange={setAction} options={[{ value: '', label: 'All actions' }, ...actions]} />
        <FilterSelect label={role ? ROLE_LABEL[role] : 'Actor'} value={role} onChange={setRole} options={[{ value: '', label: 'Anyone' }, ...Object.entries(ROLE_LABEL).filter(([k]) => regulator || ['staff', 'integration'].includes(k)).map(([value, label]) => ({ value, label }))]} />
        <FilterSelect label={range ? `Last ${range}` : 'Any time'} value={range} onChange={setRange} options={[{ value: '', label: 'Any time' }, { value: '24h', label: 'Last 24 hours' }, { value: '7d', label: 'Last 7 days' }, { value: '30d', label: 'Last 30 days' }]} />
        <span className="toolbar-spacer" />
        <span className="muted small">
          <LockKey size={13} /> {rows.length} of {scoped.length} entries
        </span>
      </div>
      <DataTable columns={columns} rows={rows} pageSize={25} dense empty={<EmptyState icon={ClockCounterClockwise} title="No entries match" body="Try a wider date range or clear the filters." />} />
    </div>
  );
}
