// Company home: check a guard.
import { useMemo, useState } from 'react';
import { ArrowRight, ClockCounterClockwise, Handshake, MagnifyingGlass } from '@phosphor-icons/react';
import { useStore } from '../store';
import { company, currentJob, findGuard, isActive } from '../access';
import { Badge, Card, EmptyState, PageHead, SearchInput, fromNow } from '../ui';
import { GuardCell, LicenceBadge, RequestBadge } from '../components';

export default function Check({ go }) {
  const { db, session } = useStore();
  const me = session.companyId;
  const [q, setQ] = useState('');
  const t = q.trim().toLowerCase();

  const results = useMemo(() => {
    if (t.length < 2) return [];
    const exact = findGuard(db, q);
    const byName = db.guards.filter((g) => g.name.toLowerCase().includes(t) || g.id.toLowerCase().includes(t));
    return [...new Set([exact, ...byName].filter(Boolean))].slice(0, 8);
  }, [db, q, t]);

  const myRequests = db.requests.filter((r) => r.companyId === me).sort((a, b) => b.askedAt.localeCompare(a.askedAt));
  const recent = [...new Map(db.activity.filter((a) => a.actorId === me && a.action === 'Checked profile' && a.guardId).map((a) => [a.guardId, a])).values()].slice(0, 6);
  const waiting = myRequests.filter((r) => r.status === 'pending').length;
  const approved = myRequests.filter(isActive).length;

  return (
    <div className="stack">
      <PageHead title="Check a guard" sub="Search by ProCheQ ID, national ID or name to see their verified career before you hire." />

      <div className="card check-box">
        <SearchInput big autoFocus value={q} onChange={setQ} placeholder="PQ-048392, 63-1184520-K-42 or a name" />
        {t.length >= 2 && (
          <ul className="results">
            {results.map((g) => {
              const job = currentJob(db, g.id);
              return (
                <li key={g.id}>
                  <a href={`#/guard/${g.id}`} className="result">
                    <GuardCell guard={g} size={40} link={false} />
                    <span className="result-meta">
                      {job ? <Badge tone={job.companyId === me ? 'info' : 'ok'} dot>{job.companyId === me ? 'Your guard' : company(db, job.companyId).name}</Badge> : <Badge dot>Available</Badge>}
                      <LicenceBadge guard={g} />
                    </span>
                    <ArrowRight size={16} className="chev" />
                  </a>
                </li>
              );
            })}
            {!results.length && <EmptyState compact icon={MagnifyingGlass} body={`Nobody on ProCheQ matches “${q}”. If they're new, add them from Your guards.`} />}
          </ul>
        )}
      </div>

      <div className="grid-2">
        <Card title="Your requests" subtitle={`${waiting} waiting for a guard · ${approved} approved`} icon={Handshake}>
          <ul className="list-rows">
            {myRequests.map((r) => (
              <li key={r.id}>
                <GuardCell id={r.guardId} sub={`${r.reason} · ${fromNow(r.askedAt)}`} />
                <RequestBadge req={r} />
              </li>
            ))}
            {!myRequests.length && <EmptyState compact body="When you ask a guard to see their full record, it shows here." />}
          </ul>
        </Card>
        <Card title="Recently checked" icon={ClockCounterClockwise}>
          <ul className="list-rows">
            {recent.map((a) => (
              <li key={a.id}>
                <GuardCell id={a.guardId} sub={`Checked ${fromNow(a.at)}`} />
                <button type="button" className="link-btn" onClick={() => go('guard', { id: a.guardId })}>Open</button>
              </li>
            ))}
            {!recent.length && <EmptyState compact body="Guards you check appear here." />}
          </ul>
        </Card>
      </div>
    </div>
  );
}
