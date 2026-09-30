// Sign in: two doors — a company (email + password) or a guard (ProCheQ ID + SMS code).
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Buildings, DeviceMobile, Eye, EyeSlash, IdentificationBadge, Warning } from '@phosphor-icons/react';
import { useStore } from './store';
import { company, findGuard, maskPhone } from './access';
import { Button, Field, Modal, OrgMark, Wordmark, sleep } from './ui';

const DEMO_GUARDS = [
  { id: 'PQ-051207', who: 'Tendai · 1 company waiting for approval' },
  { id: 'PQ-049925', who: 'Simba · 1 waiting, 1 approved' },
  { id: 'PQ-048392', who: 'John · three employers' },
];

function OtpInput({ value, onChange }) {
  const refs = useRef([]);
  const cells = value.padEnd(6, ' ').slice(0, 6).split('');
  const put = (i, ch) => {
    const a = value.padEnd(6, ' ').split('');
    a[i] = ch;
    onChange(a.join('').replace(/\s/g, ''));
  };
  return (
    <div
      className="otp"
      onPaste={(e) => {
        const t = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (t) {
          e.preventDefault();
          onChange(t);
        }
      }}
    >
      {cells.map((c, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          autoFocus={i === 0}
          value={c.trim()}
          aria-label={`Digit ${i + 1}`}
          onChange={(e) => {
            const ch = e.target.value.replace(/\D/g, '').slice(-1);
            if (!ch) return;
            put(i, ch);
            refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !c.trim() && i > 0) refs.current[i - 1]?.focus();
          }}
        />
      ))}
    </div>
  );
}

export function SignInModal({ initial = 'choose', onClose }) {
  const { db, signIn, toast } = useStore();
  const [step, setStep] = useState(initial);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [ident, setIdent] = useState('');
  const [sent, setSent] = useState(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const fail = (m) => {
    setError(m);
    setBusy(false);
  };

  const companySignIn = async (e) => {
    e?.preventDefault();
    setBusy(true);
    setError('');
    await sleep(500);
    const u = db.users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase());
    if (!u) return fail('No company account uses that email.');
    if (u.password !== password) return fail('That password is incorrect.');
    signIn({ kind: 'company', userId: u.id, companyId: u.companyId });
    onClose();
  };

  const sendCode = async (e) => {
    e?.preventDefault();
    setError('');
    const g = findGuard(db, ident) ?? db.guards.find((x) => x.phone.replace(/\s/g, '') === ident.replace(/\s/g, ''));
    if (!g) return fail('No guard matches that ProCheQ ID, national ID or phone number.');
    setBusy(true);
    await sleep(600);
    const c = String(Math.floor(100000 + Math.random() * 900000));
    setSent({ guardId: g.id, phone: g.phone, code: c });
    setStep('code');
    setBusy(false);
    toast({ kind: 'info', title: `SMS to ${maskPhone(g.phone)}`, body: `Your ProCheQ code is ${c}.`, action: { label: 'Autofill', onClick: () => setCode(c) }, duration: 15000 });
  };

  useEffect(() => {
    if (step !== 'code' || code.length !== 6) return;
    if (code !== sent.code) {
      setError("That code isn't right. Check the SMS.");
      return;
    }
    signIn({ kind: 'guard', guardId: sent.guardId });
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const back = (
    <button type="button" className="auth-back" onClick={() => { setError(''); setCode(''); setStep(step === 'code' ? 'guard' : 'choose'); }}>
      <ArrowLeft size={14} /> Back
    </button>
  );

  return (
    <Modal size="sm" title={step === 'choose' ? <Wordmark height={34} /> : step === 'company' ? 'Company sign in' : step === 'guard' ? 'Guard sign in' : 'Enter your code'} onClose={onClose}>
      <div className="auth">
        {step === 'choose' && (
          <>
            <p className="auth-lede">How do you use ProCheQ?</p>
            <div className="kind-list">
              <button type="button" className="kind" onClick={() => setStep('company')}>
                <span className="kind-icon"><Buildings size={22} /></span>
                <span className="grow"><b>I'm a security company</b><span>Check guards before you hire them</span></span>
                <ArrowRight size={16} className="chev" />
              </button>
              <button type="button" className="kind" onClick={() => setStep('guard')}>
                <span className="kind-icon"><IdentificationBadge size={22} /></span>
                <span className="grow"><b>I'm a security guard</b><span>See your record and approve requests</span></span>
                <ArrowRight size={16} className="chev" />
              </button>
            </div>
          </>
        )}

        {step === 'company' && (
          <form className="auth-form" onSubmit={companySignIn}>
            {back}
            <Field label="Work email">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus autoComplete="username" placeholder="you@company.co.zw" />
            </Field>
            <Field label="Password">
              <div className="input-affix">
                <input type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
                <button type="button" className="affix-btn" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>
                  {show ? <EyeSlash size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </Field>
            {error && <div className="form-error" role="alert"><Warning size={16} /> {error}</div>}
            <Button type="submit" size="lg" className="block" loading={busy} disabled={!email || !password}>Sign in</Button>
            <div className="demo-accounts">
              <div className="demo-label">Demo companies · password demo1234</div>
              <div className="demo-list">
                {db.users.map((u) => (
                  <button key={u.id} type="button" className="demo-chip" onClick={() => { setEmail(u.email); setPassword('demo1234'); setError(''); }}>
                    <OrgMark company={company(db, u.companyId)} size={24} />
                    <span className="grow">{company(db, u.companyId).name}</span>
                  </button>
                ))}
              </div>
            </div>
          </form>
        )}

        {step === 'guard' && (
          <form className="auth-form" onSubmit={sendCode}>
            {back}
            <p className="auth-lede">We'll text a 6-digit code to the phone on your ProCheQ profile.</p>
            <Field label="ProCheQ ID, national ID or phone">
              <input className="mono input-lg" value={ident} onChange={(e) => setIdent(e.target.value)} autoFocus placeholder="PQ-048392" />
            </Field>
            {error && <div className="form-error" role="alert"><Warning size={16} /> {error}</div>}
            <Button type="submit" size="lg" className="block" icon={DeviceMobile} loading={busy} disabled={!ident.trim()}>Send code</Button>
            <div className="demo-accounts">
              <div className="demo-label">Demo guards</div>
              <div className="demo-list">
                {DEMO_GUARDS.map((d) => (
                  <button key={d.id} type="button" className="demo-chip" onClick={() => { setIdent(d.id); setError(''); }}>
                    <span className="mono">{d.id}</span>
                    <span className="grow muted">{d.who}</span>
                  </button>
                ))}
              </div>
            </div>
          </form>
        )}

        {step === 'code' && sent && (
          <div className="auth-form">
            {back}
            <p className="auth-lede">Sent to <b>{maskPhone(sent.phone)}</b>. Use Autofill in the message at the corner of the screen.</p>
            <OtpInput value={code} onChange={(v) => { setCode(v); setError(''); }} />
            {error && <div className="form-error" role="alert"><Warning size={16} /> {error}</div>}
          </div>
        )}
      </div>
    </Modal>
  );
}
