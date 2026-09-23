import { useState } from 'react';
import { ArrowCounterClockwise, CheckCircle, Phone, ShieldCheck, ShieldWarning, XCircle } from '@phosphor-icons/react';
import { useStore } from '../../store';
import { company, currentEmployment, guardById, licenceStatus, siteById } from '../../access';
import { Avatar, Badge, Button, Card, Field, OrgMark, PageHead, badgeCode, badgeSecondsLeft, checkBadgeCode, fmtDate, fmtTime, sleep, uid, useNow } from '../../ui';
import { OtpInput } from '../../auth';
import { RESULTS, normaliseWid } from './results';
import './client.css';

export default function ClientVerify({ id }) {
  const { db, session, act } = useStore();
  const sites = db.sites.filter((s) => s.clientId === session.clientId && s.active);
  const prefill = id ? guardById(db, id) : null;
  const defaultSite = (prefill && sites.find((s) => currentEmployment(db, prefill.id)?.siteId === s.id)?.id) ?? sites[0]?.id ?? '';
  const [wid, setWid] = useState(id ?? '');
  const [code, setCode] = useState('');
  const [siteId, setSiteId] = useState(defaultSite);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [helper, setHelper] = useState(false);
  const now = useNow(1000);
  const normalised = normaliseWid(wid);
  const known = guardById(db, normalised);
  const recent = db.checks.filter((c) => c.clientId === session.clientId).sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 4);

  const check = async (e) => {
    e?.preventDefault();
    setBusy(true);
    setResult(null);
    await sleep(700);
    const g = guardById(db, normalised);
    const cur = g && currentEmployment(db, g.id);
    const site = siteById(db, siteId);
    let res;
    if (!g) res = 'invalid';
    else if (!cur) res = 'unemployed';
    else if (code && !checkBadgeCode(g.id, code)) res = 'bad_code';
    else if (licenceStatus(g).tone === 'bad') res = 'licence_expired';
    else if (cur.siteId !== siteId) res = 'unassigned';
    else res = 'verified';
    const method = code ? 'ID + live code' : 'ID only';
    const out = { res, g, cur, site, method, at: new Date().toISOString() };
    setResult(out);
    setBusy(false);
    act({
      key: `check:${normalised}`,
      pending: 'Recording the check…',
      success: res === 'verified' ? 'Check recorded' : 'Failed check recorded. The security company has been told.',
      touches: ['checks'],
      failable: false,
      apply: (d, t) => {
        d.checks.unshift({ id: uid('CK'), clientId: session.clientId, siteId, guardId: g?.id ?? null, input: wid.trim(), result: res, method, ts: t.now, by: t.actor.user });
        t.log('Client verification check', `${g ? `${g.name} (${g.id})` : normalised} — ${RESULTS[res].label.toLowerCase()} at ${site?.name} (${method})`, { guardId: g?.id ?? null });
        if (g) t.notify(`guard:${g.id}`, { title: `Badge checked at ${site?.name}`, body: `${t.actor.name}: ${RESULTS[res].label}.`, link: { name: 'access' } });
        if (res !== 'verified' && site) t.notify(`company:${site.companyId}`, { title: `Failed check at ${site.name}`, body: `${t.actor.name} checked ${g ? g.name : normalised}: ${RESULTS[res].title.toLowerCase()}.`, link: { name: 'sites', params: { id: site.id } } });
      },
    });
  };

  const reset = () => {
    setResult(null);
    setWid('');
    setCode('');
  };

  const r = result && RESULTS[result.res];
  const co = result?.cur && company(db, result.cur.companyId);
  const siteCo = result?.site && company(db, result.site.companyId);

  return (
    <div className="cl-verify">
      <PageHead
        title="Check a guard"
        sub="Ask for the Workforce ID and the 6-digit live code on the guard's phone. You'll see whether they are employed, licensed and rostered at your site. Their private records stay private."
      />

      <div className="cl-verify-grid">
        <form className="card cl-form" onSubmit={check}>
          <Field label="Workforce ID" hint={known ? `Found: ${known.name}` : wid && normalised.length >= 11 ? 'No match yet. Check the ID on the badge.' : 'On the badge, for example SG-00048392.'}>
            <input className="mono input-lg cl-wid" value={wid} onChange={(e) => { setWid(e.target.value); setResult(null); }} placeholder="SG-00048392" autoCapitalize="characters" autoComplete="off" autoFocus={!id} />
          </Field>
          <Field label="Live code from their phone" hint="Strongly recommended. It proves the badge is real and current, not a screenshot.">
            <OtpInput value={code} onChange={(v) => { setCode(v); setResult(null); }} autoFocus={!!id} />
          </Field>
          <Field label="At site">
            <select value={siteId} onChange={(e) => { setSiteId(e.target.value); setResult(null); }}>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Button type="submit" size="lg" icon={ShieldCheck} loading={busy} disabled={!wid.trim() || !siteId || (code && code.length !== 6)} className="block">
            Check guard
          </Button>
          <div className="cl-helper">
            <button type="button" className="link-btn" onClick={() => setHelper((h) => !h)}>
              {helper ? 'Hide' : 'Show'} demo helper
            </button>
            {helper && (
              <p className="small muted">
                {known ? (
                  <>
                    In real use this code is on {known.name.split(' ')[0]}'s phone. Current code for <span className="mono">{known.id}</span>: <b className="mono">{badgeCode(known.id, now)}</b> ({badgeSecondsLeft(now)}s left).{' '}
                    <button type="button" className="link-btn" onClick={() => setCode(badgeCode(known.id, now))}>
                      Use it
                    </button>
                  </>
                ) : (
                  'Type a valid Workforce ID to see its current live code.'
                )}
              </p>
            )}
          </div>
        </form>

        <div className="stack-s">
          {busy && (
            <div className="card cl-checking">
              <span className="skel" style={{ width: 64, height: 64, borderRadius: 14 }} />
              <div className="grow">
                <span className="skel" style={{ width: '60%', height: 16 }} />
                <span className="skel mt-10" style={{ width: '40%', height: 12 }} />
              </div>
            </div>
          )}
          {result && (
            <section className={`cl-result tone-${r.tone}`} aria-live="assertive">
              <div className="cl-result-band">
                {r.tone === 'ok' ? <CheckCircle size={26} weight="fill" /> : <XCircle size={26} weight="fill" />}
                <div className="grow">
                  <b>{r.title}</b>
                  <span>{r.advice}</span>
                </div>
              </div>
              {result.g ? (
                <div className="cl-result-body">
                  <div className="cl-person">
                    <Avatar name={result.g.name} seed={result.g.id} src={result.g.avatar} size={84} square />
                    <div className="grow">
                      <div className="cl-person-name">{result.g.name}</div>
                      <div className="mono muted">{result.g.id}</div>
                      <p className="small muted mt-6">Compare the face with the person in front of you.</p>
                    </div>
                  </div>
                  <dl className="cl-facts">
                    <div>
                      <dt>Employer</dt>
                      <dd>{co ? co.name : 'None in network'}</dd>
                    </div>
                    <div>
                      <dt>Role</dt>
                      <dd>{result.cur?.position ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>Rostered at</dt>
                      <dd>{result.cur ? (result.cur.siteId === result.site?.id ? result.site.name : sites.some((s) => s.id === result.cur.siteId) ? siteById(db, result.cur.siteId).name : 'Another site') : '—'}</dd>
                    </div>
                    <div>
                      <dt>Licence</dt>
                      <dd>
                        <Badge tone={licenceStatus(result.g).tone} icon={licenceStatus(result.g).tone === 'bad' ? ShieldWarning : ShieldCheck}>
                          {licenceStatus(result.g).tone === 'bad' ? licenceStatus(result.g).label : `Valid to ${fmtDate(result.g.licence.expiry)}`}
                        </Badge>
                      </dd>
                    </div>
                    <div>
                      <dt>Method</dt>
                      <dd>{result.method === 'ID only' ? <Badge tone="warn">ID only · ask for the live code</Badge> : <Badge tone="ok">ID + live code</Badge>}</dd>
                    </div>
                  </dl>
                </div>
              ) : (
                <div className="cl-result-body">
                  <p className="muted">
                    You entered <span className="mono">{normalised || '—'}</span>.
                  </p>
                </div>
              )}
              {r.tone !== 'ok' && siteCo && (
                <div className="cl-result-call">
                  <OrgMark company={siteCo} size={28} />
                  <span className="grow">
                    Your contractor for {result.site.name}: <b>{siteCo.name}</b>
                  </span>
                  <a className="btn btn-ghost btn-sm" href={`tel:${siteCo.phone.replace(/\s/g, '')}`}>
                    <Phone size={15} /> {siteCo.phone}
                  </a>
                </div>
              )}
              <div className="cl-result-foot">
                <span>
                  Checked {fmtTime(result.at)} · logged and visible to the guard{r.tone !== 'ok' ? ' and the security company' : ''}
                </span>
                <Button variant="ghost" size="sm" icon={ArrowCounterClockwise} onClick={reset}>
                  Check another
                </Button>
              </div>
            </section>
          )}
          {!busy && !result && (
            <Card title="Recent checks" subtitle="At your sites">
              {recent.length ? (
                <ul className="items">
                  {recent.map((c) => {
                    const g = c.guardId && guardById(db, c.guardId);
                    return (
                      <li key={c.id}>
                        {g ? <Avatar name={g.name} seed={g.id} src={g.avatar} size={34} /> : <span className="item-icon"><ShieldWarning size={16} /></span>}
                        <div className="grow">
                          <div className="item-title">{g ? g.name : <span className="mono">{c.input}</span>}</div>
                          <div className="item-sub">
                            {siteById(db, c.siteId)?.name} · {fmtTime(c.ts)}
                          </div>
                        </div>
                        <Badge tone={RESULTS[c.result]?.tone ?? 'neutral'} dot>
                          {RESULTS[c.result]?.label ?? c.result}
                        </Badge>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="muted small">No checks yet.</p>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
