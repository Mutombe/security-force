// Company: the guards you employ now and have employed before.
import { useState } from 'react';
import { FilePlus, SignOut, UserPlus, Users } from '@phosphor-icons/react';
import { useStore } from '../store';
import { guardById, licenceStatus, rehireTone } from '../access';
import { Badge, Button, DataTable, EmptyState, Menu, PageHead, SearchInput, Tabs, fmtMonth } from '../ui';
import { GuardCell, LicenceBadge } from '../components';
import { AddGuardModal, ExitModal, RecordModal } from '../forms';

export default function Guards({ go }) {
  const { db, session } = useStore();
  const me = session.companyId;
  const [tab, setTab] = useState('current');
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(null);
  const mine = db.employments.filter((e) => e.companyId === me);
  const current = mine.filter((e) => !e.end);
  const past = mine.filter((e) => e.end);
  const expired = current.filter((e) => licenceStatus(guardById(db, e.guardId)).tone === 'bad').length;
  const rows = (tab === 'current' ? current : past)
    .map((e) => ({ ...e, g: guardById(db, e.guardId) }))
    .filter((r) => `${r.g.name} ${r.g.id} ${r.role}`.toLowerCase().includes(q.trim().toLowerCase()));

  const columns = [
    { key: 'guard', header: 'Guard', width: 'minmax(200px, 2fr)', mobile: 'primary', sort: (r) => r.g.name, render: (r) => <GuardCell guard={r.g} /> },
    { key: 'role', header: 'Role', width: 'minmax(140px, 1.3fr)', mobile: 'secondary', sort: (r) => r.role, render: (r) => r.role },
    {
      key: 'dates', header: tab === 'current' ? 'Since' : 'Employed', width: '170px', mobile: 'meta', sort: (r) => r.start,
      render: (r) => <span className="muted">{tab === 'current' ? fmtMonth(r.start) : `${fmtMonth(r.start)} – ${fmtMonth(r.end)}`}</span>,
    },
    {
      key: 'status', header: tab === 'current' ? 'Licence' : 'Exit', width: '200px', mobile: 'meta',
      render: (r) => (tab === 'current' ? <LicenceBadge guard={r.g} /> : <Badge tone={rehireTone(r.exit.rehire)}>{r.exit.reason}</Badge>),
    },
    {
      key: 'actions', header: '', width: '44px',
      render: (r) =>
        tab === 'current' ? (
          <Menu
            label={`Actions for ${r.g.name}`}
            items={[
              { label: 'Add a record', icon: FilePlus, onClick: () => setModal({ kind: 'record', guardId: r.guardId }) },
              { label: 'End employment', icon: SignOut, danger: true, onClick: () => setModal({ kind: 'exit', emp: r }) },
            ]}
          />
        ) : null,
    },
  ];

  return (
    <div className="stack">
      <PageHead
        title="Your guards"
        sub={`${current.length} employed now${expired ? ` · ${expired} with an expired licence` : ''}. What you record here stays with each guard's ProCheQ profile.`}
        actions={<Button icon={UserPlus} onClick={() => setModal({ kind: 'add' })}>Add a guard</Button>}
      />
      <div className="toolbar">
        <Tabs value={tab} onChange={setTab} tabs={[{ key: 'current', label: 'Employed now', count: current.length }, { key: 'past', label: 'Past guards', count: past.length }]} />
        <SearchInput value={q} onChange={setQ} placeholder="Search your guards" />
      </div>
      <DataTable
        columns={columns}
        rows={rows}
        onRowClick={(r) => go('guard', { id: r.guardId })}
        initialSort={{ key: 'guard', dir: 'asc' }}
        empty={<EmptyState icon={Users} title={tab === 'current' ? 'No guards yet' : 'No past guards'} body="Add a guard with their national ID to get started." />}
      />
      {modal?.kind === 'add' && <AddGuardModal onClose={() => setModal(null)} onDone={(id) => go('guard', { id })} />}
      {modal?.kind === 'record' && <RecordModal guardId={modal.guardId} onClose={() => setModal(null)} />}
      {modal?.kind === 'exit' && <ExitModal employment={modal.emp} onClose={() => setModal(null)} />}
    </div>
  );
}
