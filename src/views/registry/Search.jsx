import { useMemo, useState } from 'react';
import { Key, LockSimple, MagnifyingGlass, Ticket, Warning } from '@phosphor-icons/react';
import { useStore } from '../../store';
import { company, currentEmployment, deniedHint, employmentsOf, licenceStatus, verificationScore } from '../../access';
import { Badge, Button, DataTable, EmptyState, Field, FilterSelect, Modal, PageHead, SearchInput, addDays, fmtDate, downloadCSV } from '../../ui';
import { CompanyCell, GuardCell, LicenceBadge } from '../../components';
import './registry.css';

const EXAMPLES = ['John Moyo', 'SG-00049925', '08-2291034-P-27'];

export default function Search({ go }) {
  const { db, session } = useStore();
  const staff = session.kind === 'staff';
  const [q, setQ] = useState('');
  const [city, setCity] = useState('');
  const [status, setStatus] = useState('');
  const [licence, setLicence] = useState('');
  const [redeem, setRedeem] = useState(false);
  const term = q.trim().toLowerCase();

  const rows = useMemo(() => {
    const matches = (g) =>
      g.name.toLowerCase().includes(term) || g.id.toLowerCase().includes(term) || g.nationalId.toLowerCase() === term || g.id.replace('SG-', '') === term;
    let list = db.guards;
    if (staff) {
      // Companies look people up; they can't browse the whole workforce.
      if (term.length < 2) return [];
      list = list.filter(matches);
    } else if (term) list = list.filter(matches);
    return list
      .map((g) => ({ ...g, _cur: currentEmployment(db, g.id), _emps: employmentsOf(db, g.id), _lic: licenceStatus(g) }))
      .filter((g) => !city || g.city === city)
      .filter((g) => !status || (status === 'employed' ? !!g._cur : !g._cur))
      .filter((g) => !licence || g._lic.tone === licence);
  }, [db, term, staff, city, status, licence]);

  const columns = [
    { key: 'guard', header: 'Security professional', width: 'minmax(220px, 2fr)', mobile: 'primary', sort: (g) => g.name, render: (g) => <GuardCell guard={g} /> },
    {
      key: 'employer', header: 'Current employer', width: 'minmax(170px, 1.5fr)', mobile: 'secondary', sort: (g) => (g._cur ? company(db, g._cur.companyId).name : 'zz'),
      render: (g) => (g._cur ? <CompanyCell id={g._cur.companyId} sub={g._cur.position} size={26} /> : <Badge dot>Available</Badge>),
    },
    { key: 'licence', header: 'Licence', width: '150px', mobile: 'meta', sort: (g) => g._lic.days, render: (g) => <LicenceBadge guard={g} compact /> },
    { key: 'history', header: 'Employers', width: '100px', mobile: 'meta', sort: (g) => g._emps.length, render: (g) => <span className="muted">{new Set(g._emps.map((e) => e.companyId)).size} on record</span> },
    { key: 'verified', header: 'Verified', width: '90px', align: 'right', mobile: 'aside', sort: (g) => verificationScore(g), render: (g) => <span className="mono rs-score">{verificationScore(g)}%</span> },
  ];

  const cities = [...new Set(db.guards.map((g) => g.city))].sort();

  return (
    <div className="stack">
      <PageHead
        eyebrow={staff ? 'Trust network' : 'Authorised oversight'}
        title={staff ? 'Network search' : 'Workforce registry'}
        sub={
          staff
            ? 'Look up an applicant by name, Workforce ID or national ID. To protect guards, the network can only be searched, not browsed, and every passport you open is logged.'
            : `${db.guards.length} registered security professionals across ${db.companies.length} companies.`
        }
        actions={
          staff ? (
            <Button variant="ghost" icon={Ticket} disabledReason={deniedHint(session, 'verification.request')} onClick={() => setRedeem(true)}>
              Redeem share code
            </Button>
          ) : (
            <Button
              variant="ghost"
              onClick={() =>
                downloadCSV(
                  'workforce-registry.csv',
                  rows.map((g) => ({ workforce_id: g.id, name: g.name, city: g.city, employer: g._cur ? company(db, g._cur.companyId).name : '', licence: g.licence.number, licence_expiry: g.licence.expiry, verified_pct: verificationScore(g) })),
                )
              }
            >
              Export CSV
            </Button>
          )
        }
      />

      <div className="rs-search">
        <SearchInput big autoFocus value={q} onChange={setQ} placeholder="Name, Workforce ID or national ID" />
        <div className="rs-examples">
          <span>Try</span>
          {EXAMPLES.map((e) => (
            <button key={e} type="button" className="rs-chip" onClick={() => setQ(e)}>
              {e}
            </button>
          ))}
        </div>
      </div>

      {!staff && (
        <div className="toolbar">
          <FilterSelect label="City" value={city} onChange={setCity} options={[{ value: '', label: 'All cities' }, ...cities]} />
          <FilterSelect label="Status" value={status} onChange={setStatus} options={[{ value: '', label: 'Any status' }, { value: 'employed', label: 'Employed' }, { value: 'available', label: 'Available' }]} />
          <FilterSelect label="Licence" value={licence} onChange={setLicence} options={[{ value: '', label: 'Any licence' }, { value: 'ok', label: 'Valid' }, { value: 'warn', label: 'Expiring soon' }, { value: 'bad', label: 'Expired' }]} />
          <span className="toolbar-spacer" />
          <span className="muted small">{rows.length} results</span>
        </div>
      )}

      {staff && term.length < 2 ? (
        <div className="card">
          <EmptyState
            icon={LockSimple}
            title="Search to find someone"
            body="Enter at least two characters. Results show identity, employer history and licence status. Conduct records stay with each employer until the guard consents."
          />
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          onRowClick={(g) => go('guard', { id: g.id })}
          pageSize={staff ? 10 : 25}
          empty={<EmptyState icon={MagnifyingGlass} title="No one matches" body={`Nobody in the network matches “${q}”. If this is a new applicant, register them from Workforce.`} />}
        />
      )}

      {redeem && <RedeemModal onClose={() => setRedeem(false)} onDone={(id) => go('guard', { id })} />}
    </div>
  );
}

function normaliseCode(v) {
  const s = v.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return s.length > 3 ? `${s.slice(0, 3)}-${s.slice(3, 7)}` : s;
}

function RedeemModal({ onClose, onDone }) {
  const { db, session, act } = useStore();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const me = session.companyId;

  const submit = async () => {
    const c = normaliseCode(code);
    const share = db.shares.find((s) => s.code === c);
    if (!share) return setError('No passport uses that share code. Check it with the guard.');
    if (share.revokedAt) return setError('The guard has revoked this code.');
    if (new Date(share.expiresAt) < new Date()) return setError(`This code expired on ${fmtDate(share.expiresAt)}. Ask the guard for a new one.`);
    const g = db.guards.find((x) => x.id === share.guardId);
    const expiresAt = [share.expiresAt, addDays(new Date().toISOString(), 30)].sort()[0];
    onClose();
    const ok = await act({
      key: `redeem:${share.id}`,
      pending: 'Unlocking passport…',
      success: `${g.name}'s shared records are unlocked`,
      touches: ['grants', 'shares'],
      apply: (d, t) => {
        d.grants.unshift({ id: `G-${Date.now().toString(36).toUpperCase()}`, guardId: g.id, viewerCompanyId: me, sourceCompanyId: '*', scopes: share.scopes, via: 'share', refId: share.id, createdAt: t.now, expiresAt, revokedAt: null });
        d.shares.find((s) => s.id === share.id).redemptions.push({ companyId: me, at: t.now });
        t.log('Redeemed share code', `${g.name} (${g.id}) — code ${share.code}`, { guardId: g.id });
        t.notify(`guard:${g.id}`, { title: 'Your share code was used', body: `${t.actor.name} opened your shared records with code ${share.code}.`, link: { name: 'sharing' } });
      },
    });
    if (ok) onDone(g.id);
  };

  return (
    <Modal
      size="sm"
      title="Redeem a share code"
      subtitle="Guards can share their records directly with you"
      icon={Key}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={normaliseCode(code).length !== 8}>
            Unlock passport
          </Button>
        </>
      }
    >
      <Field label="Share code" hint="Eight characters, for example JM4-82QX. Codes are not case-sensitive.">
        <input
          className="mono input-lg rs-code"
          value={code}
          onChange={(e) => {
            setCode(normaliseCode(e.target.value));
            setError('');
          }}
          onKeyDown={(e) => e.key === 'Enter' && normaliseCode(code).length === 8 && submit()}
          placeholder="XXX-XXXX"
          maxLength={8}
          autoFocus
          autoComplete="off"
        />
      </Field>
      {error && (
        <div className="form-error">
          <Warning size={16} /> {error}
        </div>
      )}
      <p className="muted small">Access lasts until the code expires or 30 days, whichever is sooner. The guard is told that you used it and can revoke access at any time.</p>
    </Modal>
  );
}
