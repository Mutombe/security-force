import { useMemo, useState } from 'react';
import { DownloadSimple, ShieldCheck } from '@phosphor-icons/react';
import { useStore } from '../../store';
import { guardById, siteById } from '../../access';
import { Badge, Button, DataTable, EmptyState, FilterSelect, PageHead, SearchInput, downloadCSV, fmtTime } from '../../ui';
import { GuardCell, SiteLabel } from '../../components';
import { RESULTS } from './results';
import './client.css';

export default function ClientHistory({ go }) {
  const { db, session } = useStore();
  const [result, setResult] = useState('');
  const [site, setSite] = useState('');
  const [q, setQ] = useState('');
  const mySites = db.sites.filter((s) => s.clientId === session.clientId);
  const rows = useMemo(
    () =>
      db.checks
        .filter((c) => c.clientId === session.clientId)
        .filter((c) => !result || (result === 'failed' ? c.result !== 'verified' : c.result === result))
        .filter((c) => !site || c.siteId === site)
        .filter((c) => {
          if (!q.trim()) return true;
          const g = c.guardId && guardById(db, c.guardId);
          return `${g?.name ?? ''} ${c.input}`.toLowerCase().includes(q.trim().toLowerCase());
        })
        .sort((a, b) => b.ts.localeCompare(a.ts)),
    [db, session.clientId, result, site, q],
  );
  const failed = rows.filter((c) => c.result !== 'verified').length;

  const exportCsv = () =>
    downloadCSV(
      'guard-checks.csv',
      rows.map((c) => ({ time: c.ts, workforce_id: c.guardId ?? c.input, guard: c.guardId ? guardById(db, c.guardId)?.name : '', site: siteById(db, c.siteId)?.name, result: RESULTS[c.result]?.label ?? c.result, method: c.method ?? '', checked_by: c.by })),
    );

  return (
    <div className="stack">
      <PageHead
        title="Check history"
        sub="Every badge check at your sites. Failed checks are also sent to the security company responsible for the site."
        actions={
          <>
            <Button variant="ghost" icon={DownloadSimple} onClick={exportCsv} disabled={!rows.length}>
              Export CSV
            </Button>
            <Button icon={ShieldCheck} onClick={() => go('verify')}>
              Check a guard
            </Button>
          </>
        }
      />
      <div className="toolbar">
        <SearchInput value={q} onChange={setQ} placeholder="Guard name or ID" />
        <FilterSelect
          label="Result"
          value={result}
          onChange={setResult}
          options={[{ value: '', label: 'All results' }, { value: 'verified', label: 'Verified' }, { value: 'failed', label: 'Any failure' }, ...Object.entries(RESULTS).filter(([k]) => k !== 'verified').map(([k, v]) => ({ value: k, label: v.label }))]}
        />
        <FilterSelect label="Site" value={site} onChange={setSite} options={[{ value: '', label: 'All sites' }, ...mySites.map((s) => ({ value: s.id, label: s.name }))]} />
        <span className="toolbar-spacer" />
        <span className="muted small">
          {rows.length} checks · {failed} failed
        </span>
      </div>
      <DataTable
        rows={rows}
        initialSort={{ key: 'time', dir: 'desc' }}
        columns={[
          { key: 'guard', header: 'Guard', width: 'minmax(200px, 1.8fr)', mobile: 'primary', render: (c) => (c.guardId ? <GuardCell id={c.guardId} size={32} /> : <span className="cell-person-text"><span className="cell-name mono">{c.input}</span><span className="cell-sub">Not recognised</span></span>) },
          { key: 'site', header: 'Site', width: 'minmax(160px, 1.4fr)', mobile: 'secondary', sort: (c) => siteById(db, c.siteId)?.name ?? '', render: (c) => <SiteLabel id={c.siteId} /> },
          { key: 'time', header: 'Time', width: '140px', mobile: 'meta', sort: (c) => c.ts, render: (c) => <span className="mono small">{fmtTime(c.ts)}</span> },
          { key: 'method', header: 'Method', width: '120px', mobile: 'meta', render: (c) => <span className="muted small">{c.method ?? 'ID only'}</span> },
          { key: 'by', header: 'Checked by', width: '140px', mobile: 'meta', render: (c) => <span className="muted">{c.by}</span> },
          { key: 'result', header: 'Result', width: '140px', align: 'right', mobile: 'aside', sort: (c) => c.result, render: (c) => <Badge tone={RESULTS[c.result]?.tone ?? 'neutral'} dot>{RESULTS[c.result]?.label ?? c.result}</Badge> },
        ]}
        onRowClick={(c) => c.guardId && go('verify', { id: c.guardId })}
        empty={<EmptyState icon={ShieldCheck} title="No checks match" body="Change the filters, or check a guard to start the log." />}
      />
    </div>
  );
}
