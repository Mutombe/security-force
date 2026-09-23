import { useMemo, useState } from 'react';
import {
  Buildings, ChartBar, DownloadSimple, Eye, FilePlus, GraduationCap, Handshake, PencilSimple, SignOut, UserPlus, Users,
} from '@phosphor-icons/react';
import { useStore } from '../../store';
import { POSITIONS, company, complianceIssues, deniedHint, employmentsOf, guardById, licenceStatus, siteById } from '../../access';
import {
  Badge, BulkBar, Button, DataTable, EmptyState, FilterSelect, Menu, Meter, PageHead, SearchInput, Tabs, downloadCSV, fmtDate, fmtMonth,
} from '../../ui';
import { GuardCell, LicenceBadge, SiteLabel } from '../../components';
import {
  AssignSiteModal, AttendanceModal, EditGuardModal, HireModal, RecordModal, RequestVerificationModal, SeparationModal,
} from '../../modals';
import './company.css';

export default function Workforce({ go }) {
  const { db, session, can, isPending } = useStore();
  const me = session.companyId;
  const [status, setStatus] = useState('current');
  const [q, setQ] = useState('');
  const [site, setSite] = useState('');
  const [position, setPosition] = useState('');
  const [comp, setComp] = useState('');
  const [selected, setSelected] = useState([]);
  const [modal, setModal] = useState(null);

  const all = db.employments.filter((e) => e.companyId === me);
  const sites = db.sites.filter((s) => s.companyId === me);
  const issues = useMemo(() => complianceIssues(db, me), [db, me]);
  const certDue = new Set(issues.filter((i) => i.kind === 'cert').map((i) => i.guard.id));

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return all
      .filter((e) => (status === 'current' ? !e.end : status === 'former' ? !!e.end : true))
      .map((e) => ({ ...e, g: guardById(db, e.guardId) }))
      .filter((r) => !site || r.siteId === site)
      .filter((r) => !position || r.position === position)
      .filter((r) => {
        if (!comp) return true;
        const ls = licenceStatus(r.g);
        if (comp === 'expiring') return ls.tone === 'warn';
        if (comp === 'expired') return ls.tone === 'bad';
        if (comp === 'certs') return certDue.has(r.guardId);
        return true;
      })
      .filter((r) => !t || `${r.g.name} ${r.g.id} ${r.g.nationalId} ${siteById(db, r.siteId)?.name ?? ''} ${r.position}`.toLowerCase().includes(t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, status, site, position, comp, q, db]);

  const counts = {
    current: all.filter((e) => !e.end).length,
    former: all.filter((e) => e.end).length,
    all: all.length,
  };
  const currentRows = all.filter((e) => !e.end).map((e) => guardById(db, e.guardId));
  const expired = currentRows.filter((g) => licenceStatus(g).tone === 'bad').length;
  const expiring = currentRows.filter((g) => licenceStatus(g).tone === 'warn').length;
  const avgAtt = counts.current ? Math.round(all.filter((e) => !e.end).reduce((a, e) => a + e.attendance, 0) / counts.current) : 0;
  const filtersOn = site || position || comp || q;

  const selectedRows = rows.filter((r) => selected.includes(r.id));
  const selectedCurrent = selectedRows.filter((r) => !r.end);
  const otherEmployers = (guardId) => employmentsOf(db, guardId).some((e) => e.companyId !== me);

  const exportCsv = (list) =>
    downloadCSV(
      `${company(db, me).name.toLowerCase().replace(/\s+/g, '-')}-workforce.csv`,
      list.map((r) => ({
        workforce_id: r.g.id,
        name: r.g.name,
        national_id: r.g.nationalId,
        position: r.position,
        site: siteById(db, r.siteId)?.name ?? '',
        start: r.start,
        end: r.end ?? '',
        attendance: r.attendance,
        licence_number: r.g.licence.number,
        licence_expiry: r.g.licence.expiry,
        separation: r.separation?.category ?? '',
      })),
    );

  const columns = [
    { key: 'guard', header: 'Guard', width: 'minmax(190px, 2fr)', sort: (r) => r.g.name, mobile: 'primary', render: (r) => <GuardCell guard={r.g} /> },
    { key: 'position', header: 'Position', width: 'minmax(120px, 1.2fr)', sort: (r) => r.position, mobile: 'secondary', render: (r) => <span className="co-pos">{r.position}</span> },
    { key: 'site', header: 'Site', width: 'minmax(130px, 1.4fr)', sort: (r) => siteById(db, r.siteId)?.name ?? '', mobile: 'meta', render: (r) => <SiteLabel id={r.siteId} /> },
    {
      key: 'since', header: status === 'current' ? 'Since' : 'Period', width: '110px', sort: (r) => r.start, mobile: 'meta',
      render: (r) => <span className="co-date">{r.end ? `${fmtMonth(r.start)} – ${fmtMonth(r.end)}` : fmtDate(r.start)}</span>,
    },
    { key: 'attendance', header: 'Attendance', width: '140px', sort: (r) => r.attendance, mobile: 'aside', render: (r) => <Meter value={r.attendance} /> },
    {
      key: 'licence', header: status === 'former' ? 'Separation' : 'Licence', width: '150px', sort: (r) => (r.end ? r.separation?.category : licenceStatus(r.g).days), mobile: 'meta',
      render: (r) =>
        r.end ? (
          <Badge tone={r.separation?.rehire === 'Eligible' ? 'neutral' : r.separation?.rehire === 'Conditional' ? 'warn' : 'bad'}>{r.separation?.category}</Badge>
        ) : (
          <span className="chips">
            <LicenceBadge guard={r.g} compact />
            {certDue.has(r.guardId) && <Badge tone="warn" icon={GraduationCap}>Cert</Badge>}
          </span>
        ),
    },
    {
      key: 'actions', header: '', width: '44px', align: 'right',
      render: (r) => (
        <Menu
          label={`Actions for ${r.g.name}`}
          items={[
            { label: 'View passport', icon: Eye, onClick: () => go('guard', { id: r.guardId }) },
            { divider: true },
            !r.end && { label: 'Add record', icon: FilePlus, onClick: () => setModal({ kind: 'record', ids: [r.guardId] }), disabled: !can('record.create'), hint: deniedHint(session, 'record.create') },
            !r.end && { label: 'Update attendance', icon: ChartBar, onClick: () => setModal({ kind: 'attendance', emp: r }), disabled: !can('attendance.update'), hint: deniedHint(session, 'attendance.update') },
            !r.end && { label: 'Reassign site', icon: Buildings, onClick: () => setModal({ kind: 'assign', emps: [r] }), disabled: !can('employment.manage'), hint: deniedHint(session, 'employment.manage') },
            { label: 'Edit profile', icon: PencilSimple, onClick: () => setModal({ kind: 'edit', guard: r.g }), disabled: !can('guard.hire'), hint: deniedHint(session, 'guard.hire') },
            otherEmployers(r.guardId) && { label: 'Request verification', icon: Handshake, onClick: () => setModal({ kind: 'verify', guardId: r.guardId }), disabled: !can('verification.request') || company(db, me).status !== 'active', hint: deniedHint(session, 'verification.request') ?? (company(db, me).status !== 'active' ? 'Available after regulator approval.' : undefined) },
            !r.end && { divider: true },
            !r.end && { label: 'Record separation', icon: SignOut, danger: true, onClick: () => setModal({ kind: 'separate', emp: r }), disabled: !can('employment.manage'), hint: deniedHint(session, 'employment.manage') },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="stack">
      <PageHead
        title="Workforce"
        sub="Everyone your company employs or has employed. Records you add follow the guard's Workforce ID, not your spreadsheet."
        actions={
          <>
            <Button variant="ghost" icon={DownloadSimple} onClick={() => exportCsv(rows)} disabledReason={deniedHint(session, 'audit.export') ?? (!rows.length ? 'Nothing to export' : undefined)}>
              Export
            </Button>
            <Button icon={UserPlus} onClick={() => setModal({ kind: 'hire' })} disabledReason={deniedHint(session, 'guard.hire')}>
              Register or hire
            </Button>
          </>
        }
      />

      <div className="co-summary">
        <span>
          <b>{counts.current}</b> deployed
        </span>
        <span>
          <b>{avgAtt}%</b> average attendance
        </span>
        {expired > 0 && (
          <span className="bad">
            <b>{expired}</b> licence{expired === 1 ? '' : 's'} expired
          </span>
        )}
        {expiring > 0 && (
          <span className="warn">
            <b>{expiring}</b> expiring within 60 days
          </span>
        )}
        {certDue.size > 0 && (
          <span className="warn">
            <b>{certDue.size}</b> with certificates due
          </span>
        )}
      </div>

      <div className="toolbar">
        <Tabs
          value={status}
          onChange={(v) => {
            setStatus(v);
            setSelected([]);
          }}
          tabs={[
            { key: 'current', label: 'Current', count: counts.current },
            { key: 'former', label: 'Former', count: counts.former },
            { key: 'all', label: 'All', count: counts.all },
          ]}
        />
        <SearchInput value={q} onChange={setQ} placeholder="Name, Workforce ID, national ID or site" />
        <FilterSelect label={site ? siteById(db, site)?.name : 'Site'} value={site} onChange={setSite} options={[{ value: '', label: 'All sites' }, ...sites.map((s) => ({ value: s.id, label: s.name }))]} />
        <FilterSelect label={position || 'Position'} value={position} onChange={setPosition} options={[{ value: '', label: 'All positions' }, ...POSITIONS]} />
        <FilterSelect
          label={{ '': 'Compliance', expiring: 'Licence expiring', expired: 'Licence expired', certs: 'Certificates due' }[comp]}
          value={comp}
          onChange={setComp}
          options={[
            { value: '', label: 'All' },
            { value: 'expiring', label: 'Licence expiring' },
            { value: 'expired', label: 'Licence expired' },
            { value: 'certs', label: 'Certificates due' },
          ]}
        />
        {filtersOn && (
          <Button variant="subtle" size="sm" onClick={() => { setQ(''); setSite(''); setPosition(''); setComp(''); }}>
            Clear filters
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        onRowClick={(r) => go('guard', { id: r.guardId })}
        selectable={status !== 'former'}
        selected={selected}
        onSelectChange={setSelected}
        initialSort={{ key: 'guard', dir: 'asc' }}
        rowClass={(r) => (isPending(r.id) ? 'is-muted' : '')}
        empty={
          filtersOn ? (
            <EmptyState compact icon={Users} title="No guards match these filters" action={<Button variant="ghost" size="sm" onClick={() => { setQ(''); setSite(''); setPosition(''); setComp(''); }}>Clear filters</Button>} />
          ) : (
            <EmptyState icon={Users} title="No guards yet" body="Register a new guard or hire someone already in the network." action={can('guard.hire') && <Button icon={UserPlus} onClick={() => setModal({ kind: 'hire' })}>Register or hire</Button>} />
          )
        }
      />

      <BulkBar count={selected.length} onClear={() => setSelected([])}>
        <Button variant="ghost" size="sm" icon={Buildings} onClick={() => setModal({ kind: 'assign', emps: selectedCurrent })} disabledReason={deniedHint(session, 'employment.manage') ?? (!selectedCurrent.length ? 'Select current guards' : undefined)}>
          Assign to site
        </Button>
        <Button variant="ghost" size="sm" icon={GraduationCap} onClick={() => setModal({ kind: 'record', ids: [...new Set(selectedCurrent.map((r) => r.guardId))] })} disabledReason={deniedHint(session, 'record.create') ?? (!selectedCurrent.length ? 'Select current guards' : undefined)}>
          Add training
        </Button>
        <Button variant="ghost" size="sm" icon={DownloadSimple} onClick={() => exportCsv(selectedRows)} disabledReason={deniedHint(session, 'audit.export')}>
          Export
        </Button>
      </BulkBar>

      {modal?.kind === 'hire' && <HireModal onClose={() => setModal(null)} onDone={(id) => go('guard', { id })} />}
      {modal?.kind === 'record' && <RecordModal guardIds={modal.ids} onClose={() => { setModal(null); setSelected([]); }} />}
      {modal?.kind === 'attendance' && <AttendanceModal employment={modal.emp} onClose={() => setModal(null)} />}
      {modal?.kind === 'assign' && <AssignSiteModal employments={modal.emps} onClose={() => { setModal(null); setSelected([]); }} />}
      {modal?.kind === 'edit' && <EditGuardModal guard={modal.guard} onClose={() => setModal(null)} />}
      {modal?.kind === 'verify' && <RequestVerificationModal guardId={modal.guardId} onClose={() => setModal(null)} />}
      {modal?.kind === 'separate' && <SeparationModal employment={modal.emp} onClose={() => setModal(null)} />}
    </div>
  );
}
