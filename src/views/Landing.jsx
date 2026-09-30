import { useState } from 'react';
import { ArrowRight, Buildings, CheckCircle, Handshake, IdentificationBadge, MagnifyingGlass, ShieldCheck, WarningCircle } from '@phosphor-icons/react';
import { useStore } from '../store';
import { company, currentJob, findGuard, licenceStatus } from '../access';
import { Avatar, Badge, Button, OrgMark, Wordmark, fmtMonth, fmtTime } from '../ui';
import { ThemeToggle } from '../theme-ui';
import { SignInModal } from '../auth';

/** The public check: anyone at a gate can confirm a guard is real, employed and licensed. */
export function PublicCheck({ compact }) {
  const { db, mutate } = useStore();
  const [q, setQ] = useState('');
  const [res, setRes] = useState(null);
  const check = (e) => {
    e.preventDefault();
    const g = findGuard(db, q);
    setRes({ q: q.trim(), g, at: new Date().toISOString() });
    if (g) mutate((d, t) => t.log('Checked at the gate', g.name, { guardId: g.id }));
  };
  const g = res?.g;
  const job = g && currentJob(db, g.id);
  const lic = g && licenceStatus(g);
  const good = g && job && lic.tone !== 'bad';
  return (
    <div className={`pcheck ${compact ? 'pcheck-compact' : ''}`}>
      <form className="pcheck-form" onSubmit={check}>
        <div className="pcheck-input">
          <MagnifyingGlass size={20} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ProCheQ ID, e.g. PQ-048392" aria-label="ProCheQ ID" autoComplete="off" />
        </div>
        <Button type="submit" size="lg" disabled={!q.trim()}>Check</Button>
      </form>
      {!res && <p className="pcheck-hint">Ask the guard for the ProCheQ ID on their badge. Try <button type="button" className="link-btn" onClick={() => setQ('PQ-048392')}>PQ-048392</button> or <button type="button" className="link-btn" onClick={() => setQ('PQ-051207')}>PQ-051207</button>.</p>}
      {res && (
        <div className={`pcheck-result ${good ? 'good' : 'bad'}`} aria-live="polite">
          <div className="pcheck-band">
            {good ? <CheckCircle size={20} weight="fill" /> : <WarningCircle size={20} weight="fill" />}
            {!g ? 'No guard with that ID' : good ? 'Verified guard' : !job ? 'Not currently employed' : 'Licence expired'}
          </div>
          {g ? (
            <div className="pcheck-body">
              <Avatar name={g.name} seed={g.id} src={g.avatar} size={64} />
              <div className="grow">
                <div className="pcheck-name">{g.name}</div>
                <div className="mono muted">{g.id}</div>
                <div className="pcheck-facts">
                  {job ? (
                    <span className="pcheck-co">
                      <OrgMark company={company(db, job.companyId)} size={22} />
                      {job.role} at <b>{company(db, job.companyId).name}</b> since {fmtMonth(job.start)}
                    </span>
                  ) : (
                    <span>Not employed by a ProCheQ member company right now. Do not let them on duty.</span>
                  )}
                  <Badge tone={lic.tone} icon={ShieldCheck}>{lic.label}</Badge>
                </div>
              </div>
            </div>
          ) : (
            <p className="pcheck-body">
              <span><b>{res.q}</b> is not a ProCheQ ID. Do not grant access. Call the security company on a number you already have.</span>
            </p>
          )}
          <div className="pcheck-foot">Checked {fmtTime(res.at)}. The guard can see that this check happened.</div>
        </div>
      )}
    </div>
  );
}

export default function Landing() {
  const { db } = useStore();
  const [signIn, setSignIn] = useState(null);
  const onNetwork = db.guards.length;
  return (
    <div className="landing">
      <header className="land-nav">
        <Wordmark height={36} />
        <div className="row gap-s">
          <ThemeToggle />
          <Button variant="ghost" onClick={() => setSignIn('guard')} className="hide-sm">I'm a guard</Button>
          <Button onClick={() => setSignIn('choose')}>Sign in</Button>
        </div>
      </header>

      <section className="land-hero">
        <div className="land-hero-copy">
          <h1>Know who you're hiring. Know who's at the gate.</h1>
          <p className="lead">
            ProCheQ is a shared, verified record of every security guard's career, confirmed by the companies that employed them. Guards own it and approve who sees it.
          </p>
          <div className="land-cta">
            <Button size="lg" iconRight={ArrowRight} onClick={() => setSignIn('company')}>Check a guard before you hire</Button>
            <Button size="lg" variant="ghost" onClick={() => setSignIn('guard')}>See my record</Button>
          </div>
        </div>
        <div className="land-check card">
          <div className="land-check-head">
            <span className="land-check-icon"><ShieldCheck size={22} weight="fill" /></span>
            <div>
              <h2>Is this guard real?</h2>
              <p className="muted">Anyone can check. No account needed.</p>
            </div>
          </div>
          <PublicCheck />
        </div>
      </section>

      <section className="land-section">
        <h2 className="land-h2">How ProCheQ works</h2>
        <ol className="land-steps">
          <li>
            <span className="land-step-icon"><MagnifyingGlass size={24} /></span>
            <span className="land-step-no">01 · Verify</span>
            <b>Check any guard</b>
            <p>Type their ProCheQ ID and see every employer that confirmed them, their training and their licence.</p>
          </li>
          <li>
            <span className="land-step-icon"><Handshake size={24} /></span>
            <span className="land-step-no">02 · Connect</span>
            <b>Ask for the full record</b>
            <p>The guard approves on their phone. Then you see incidents, discipline, why they left and whether each employer would rehire them.</p>
          </li>
          <li>
            <span className="land-step-icon"><ShieldCheck size={24} /></span>
            <span className="land-step-no">03 · Secure</span>
            <b>Record what happens</b>
            <p>When you employ a guard, you add the facts. The guard sees every entry and can reply. Nobody gets a star rating.</p>
          </li>
        </ol>
      </section>

      <section className="land-section land-two">
        <div className="land-card">
          <Buildings size={26} />
          <b>For security companies</b>
          <p>Stop hiring blind. See a verified career in seconds instead of chasing references for weeks.</p>
          <Button variant="ghost" iconRight={ArrowRight} onClick={() => setSignIn('company')}>Company sign in</Button>
        </div>
        <div className="land-card">
          <IdentificationBadge size={26} />
          <b>For guards</b>
          <p>Your good record travels with you. You decide who sees the private parts, and you can always reply.</p>
          <Button variant="ghost" iconRight={ArrowRight} onClick={() => setSignIn('guard')}>Guard sign in</Button>
        </div>
      </section>

      <footer className="land-foot">
        <span>ProCheQ · Verify | Connect | Secure</span>
        <span className="muted">{db.companies.length} member companies · {onNetwork} guards · demo data kept in this browser tab</span>
      </footer>

      {signIn && <SignInModal initial={signIn} onClose={() => setSignIn(null)} />}
    </div>
  );
}
