// Every authentication step is a modal: sign in, SMS code, workspace choice,
// company registration, password reset, lock screen and account settings.
import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Buildings, Camera, CheckCircle, DeviceMobile, Envelope, Eye, EyeSlash, Fingerprint, GoogleLogo,
  IdentificationBadge, Key, LockKey, MicrosoftOutlookLogo, Scales, ShieldCheck, SignOut, Storefront, Trash, UserCircle, Warning,
} from '@phosphor-icons/react';
import { useStore } from './store';
import { LogoUpload } from './components';
import { CITIES, ROLES, company, guardById, maskPhone } from './access';
import { Avatar, Badge, Button, Field, Modal, OrgMark, Tabs, Wordmark, Toggle, fileToAvatar, fmtTime, fromNow, sleep, uid } from './ui';

const KINDS = [
  { key: 'staff', label: 'Security company', desc: 'HR, operations and compliance staff', icon: Buildings },
  { key: 'guard', label: 'Security professional', desc: 'Your passport, badge and consents', icon: IdentificationBadge },
  { key: 'client', label: 'Client or site owner', desc: 'Check the guards at your sites', icon: Storefront },
  { key: 'regulator', label: 'Regulator', desc: 'Authorised oversight', icon: Scales },
];

const DEMO = {
  staff: [
    { email: 'rufaro@gemak.co.zw', who: 'Owner · GEMAK' },
    { email: 'tariro@complyzw.co.zw', who: 'Consultant · 3 companies' },
    { email: 'kelvin@gemak.co.zw', who: 'Supervisor · GEMAK' },
    { email: 'themba@jpsecurity.co.zw', who: 'Owner · JP Security' },
    { email: 'grace@sentinel.co.zw', who: 'Owner · Sentinel' },
    { email: 'peter@vssecurity.co.zw', who: 'Owner · VS Security' },
  ],
  client: [
    { email: 'facilities@hararecity.co.zw', who: 'Harare City Council' },
    { email: 'security@zcb.co.zw', who: 'Zim Commercial Bank' },
  ],
  regulator: [{ email: 'inspector@psra.gov.zw', who: 'Chief Inspector' }],
  guard: [
    { id: 'SG-00048392', who: 'John Moyo' },
    { id: 'SG-00049925', who: 'Simba Makoni · consent waiting' },
    { id: 'SG-00051207', who: 'Tendai Chikwanha · open dispute' },
  ],
};

export function OtpInput({ value, onChange, autoFocus = true, error }) {
  const refs = useRef([]);
  const digits = value.padEnd(6, ' ').slice(0, 6).split('');
  const setAt = (i, ch) => {
    const arr = value.padEnd(6, ' ').split('');
    arr[i] = ch;
    onChange(arr.join('').replace(/\s+$/, '').replace(/ /g, ''));
  };
  return (
    <div className={`otp ${error ? 'has-error' : ''}`} onPaste={(e) => {
      const t = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
      if (t) {
        e.preventDefault();
        onChange(t);
        refs.current[Math.min(5, t.length)]?.focus();
      }
    }}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          autoFocus={autoFocus && i === 0}
          value={d.trim()}
          aria-label={`Digit ${i + 1}`}
          onChange={(e) => {
            const ch = e.target.value.replace(/\D/g, '').slice(-1);
            if (!ch) return;
            setAt(i, ch);
            refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace') {
              e.preventDefault();
              if (d.trim()) setAt(i, ' ');
              else if (i > 0) {
                refs.current[i - 1]?.focus();
                setAt(i - 1, ' ');
              }
            }
            if (e.key === 'ArrowLeft') refs.current[i - 1]?.focus();
            if (e.key === 'ArrowRight') refs.current[i + 1]?.focus();
          }}
        />
      ))}
    </div>
  );
}

function PasswordInput({ value, onChange, autoFocus, placeholder, autoComplete = 'current-password' }) {
  const [show, setShow] = useState(false);
  return (
    <div className="input-affix">
      <input type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoFocus={autoFocus} placeholder={placeholder} autoComplete={autoComplete} />
      <button type="button" className="affix-btn" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? <EyeSlash size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
}

export function passwordStrength(p) {
  let s = 0;
  if (p.length >= 8) s++;
  if (p.length >= 12) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p)) s++;
  return { score: Math.min(4, s), label: ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'][Math.min(4, s)] };
}
function StrengthMeter({ password }) {
  const s = passwordStrength(password);
  if (!password) return null;
  return (
    <div className={`strength strength-${s.score}`}>
      <span className="strength-bars">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={i < s.score ? 'on' : ''} />
        ))}
      </span>
      {s.label}
    </div>
  );
}

// ---------------------------------------------------------------- sign in
export function AuthModal({ initial = 'choose', onClose }) {
  const { db, signIn, toast } = useStore();
  const [step, setStep] = useState(initial);
  const [kind, setKind] = useState(initial === 'choose' ? null : initial);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [ident, setIdent] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(null); // { guardId, code, at }
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!cooldown) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const fail = (msg) => {
    setError(msg);
    setShake((s) => s + 1);
    setBusy(false);
  };
  const reset = () => {
    setError('');
    setCode('');
  };

  const finishUser = (u, how) => {
    if (u.kind === 'staff') {
      const live = u.memberships.filter((m) => company(db, m.companyId)?.status !== 'suspended');
      if (!live.length) return fail('Every company on this account is suspended. Contact the regulator.');
      if (u.memberships.length > 1) {
        setUser(u);
        setStep('workspace');
        setBusy(false);
        return;
      }
      signIn({ kind: 'staff', userId: u.id, companyId: live[0].companyId, role: live[0].role }, how);
    } else if (u.kind === 'client') signIn({ kind: 'client', userId: u.id, clientId: u.clientId }, how);
    else signIn({ kind: 'regulator', userId: u.id }, how);
    onClose?.();
  };

  const submitPassword = async (e) => {
    e?.preventDefault();
    setError('');
    setBusy(true);
    await sleep(650);
    const u = db.users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase() && x.kind === kind);
    if (!u) return fail(`No ${kind === 'staff' ? 'company' : kind} account uses that email.`);
    if (u.status === 'disabled') return fail('This account has been deactivated by your administrator.');
    if (u.password !== password) return fail('That password is incorrect.');
    setUser(u);
    finishUser(u, remember ? 'password, remembered device' : 'password');
  };

  const sendSms = async (e) => {
    e?.preventDefault();
    setError('');
    const q = ident.trim().toUpperCase().replace(/\s/g, '');
    const g = db.guards.find((x) => x.id === q || x.id === 'SG-' + q.replace(/^SG-?/, '') || x.nationalId.toUpperCase() === q);
    if (!g) return fail('No security professional matches that Workforce ID or national ID.');
    setBusy(true);
    await sleep(700);
    const c = String(Math.floor(100000 + Math.random() * 900000));
    setSent({ guardId: g.id, code: c, phone: g.phone });
    setStep('otp');
    setBusy(false);
    setCooldown(30);
    toast({ kind: 'info', title: `SMS to ${maskPhone(g.phone)}`, body: `Your Security Force code is ${c}. It expires in 5 minutes.`, action: { label: 'Autofill', onClick: () => setCode(c) }, duration: 15000 });
  };

  const submitOtp = async () => {
    setBusy(true);
    await sleep(500);
    if (code !== sent.code) return fail('That code is not right. Check the SMS and try again.');
    signIn({ kind: 'guard', guardId: sent.guardId }, 'SMS code');
    onClose?.();
  };

  const sso = async (provider) => {
    setBusy(true);
    toast({ kind: 'loading', title: `Redirecting to ${provider}…`, duration: 1200 });
    await sleep(1300);
    const u = db.users.find((x) => x.id === 'U-06');
    toast({ kind: 'success', title: `Signed in with ${provider}`, body: `${u.email} · SSO verified` });
    finishUser(u, `${provider} SSO`);
  };

  useEffect(() => {
    if (step === 'otp' && code.length === 6) submitOtp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const titleFor = {
    choose: 'Sign in to Security Force',
    staff: 'Company sign in',
    client: 'Client sign in',
    regulator: 'Regulator sign in',
    guard: 'Security professional sign in',
    otp: 'Enter the SMS code',
    workspace: 'Choose a workspace',
    forgot: 'Reset your password',
    register: 'Register your company',
  };

  if (step === 'register') return <RegisterCompanyModal onClose={onClose} onBack={() => setStep('staff')} />;

  const back = () => {
    reset();
    setStep(['otp'].includes(step) ? 'guard' : ['forgot'].includes(step) ? kind : 'choose');
  };

  return (
    <Modal size="sm" title={step === 'choose' ? <Wordmark height={34} /> : titleFor[step]} onClose={onClose} className="auth-modal">
      <div className="auth" key={shake}>
        {step !== 'choose' && step !== 'workspace' && (
          <button type="button" className="auth-back" onClick={back}>
            <ArrowLeft size={14} /> Back
          </button>
        )}

        {step === 'choose' && <p className="auth-lede">Choose how you use the network.</p>}
        {step === 'choose' && (
          <div className="kind-list">
            {KINDS.map((k) => (
              <button
                key={k.key}
                type="button"
                className="kind"
                onClick={() => {
                  setKind(k.key);
                  setStep(k.key);
                  setEmail('');
                  setPassword('');
                }}
              >
                <span className="kind-icon">
                  <k.icon size={22} />
                </span>
                <span className="grow">
                  <b>{k.label}</b>
                  <span>{k.desc}</span>
                </span>
                <ArrowRight size={16} className="chev" />
              </button>
            ))}
          </div>
        )}

        {['staff', 'client', 'regulator'].includes(step) && (
          <form onSubmit={submitPassword} className={`auth-form ${error ? 'shake' : ''}`}>
            {step === 'staff' && (
              <>
                <div className="sso">
                  <Button variant="ghost" icon={MicrosoftOutlookLogo} onClick={() => sso('Microsoft Entra ID')} disabled={busy}>
                    Microsoft
                  </Button>
                  <Button variant="ghost" icon={GoogleLogo} onClick={() => sso('Google Workspace')} disabled={busy}>
                    Google
                  </Button>
                </div>
                <div className="divider-label">or with email</div>
              </>
            )}
            <Field label="Work email">
              <div className="input-affix input-lead">
                <Envelope size={17} className="affix-lead" />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus autoComplete="username" placeholder="name@company.co.zw" />
              </div>
            </Field>
            <Field
              label={
                <span className="row between grow">
                  Password
                  <button type="button" className="link-btn" onClick={() => { reset(); setStep('forgot'); }}>
                    Forgot password?
                  </button>
                </span>
              }
            >
              <PasswordInput value={password} onChange={setPassword} />
            </Field>
            <label className="inline-check">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Remember this device for 30 days
            </label>
            {error && (
              <div className="form-error" role="alert">
                <Warning size={16} /> {error}
              </div>
            )}
            <Button type="submit" size="lg" loading={busy} disabled={!email || !password} className="block">
              Sign in
            </Button>
            <DemoAccounts
              items={DEMO[step]}
              onPick={(d) => {
                setEmail(d.email);
                setPassword('demo1234');
                setError('');
              }}
            />
            {step === 'staff' && (
              <p className="auth-foot">
                New to the network?{' '}
                <button type="button" className="link-btn" onClick={() => setStep('register')}>
                  Register your company
                </button>
              </p>
            )}
          </form>
        )}

        {step === 'guard' && (
          <form onSubmit={sendSms} className={`auth-form ${error ? 'shake' : ''}`}>
            <p className="auth-lede">We'll text a 6-digit code to the phone number on your passport.</p>
            <Field label="Workforce ID or national ID">
              <input className="mono input-lg" value={ident} onChange={(e) => setIdent(e.target.value)} autoFocus placeholder="SG-00048392" autoComplete="username" />
            </Field>
            {error && (
              <div className="form-error" role="alert">
                <Warning size={16} /> {error}
              </div>
            )}
            <Button type="submit" size="lg" loading={busy} disabled={!ident.trim()} className="block" icon={DeviceMobile}>
              Send code
            </Button>
            <DemoAccounts items={DEMO.guard.map((d) => ({ email: d.id, who: d.who }))} onPick={(d) => setIdent(d.email)} />
          </form>
        )}

        {step === 'otp' && sent && (
          <div className={`auth-form ${error ? 'shake' : ''}`}>
            <p className="auth-lede">
              Sent to <b>{maskPhone(sent.phone)}</b>. Enter it below. Check the notification in the corner.
            </p>
            <OtpInput value={code} onChange={(v) => { setCode(v); setError(''); }} error={error} />
            {error && (
              <div className="form-error" role="alert">
                <Warning size={16} /> {error}
              </div>
            )}
            <Button size="lg" loading={busy} disabled={code.length !== 6} className="block" onClick={submitOtp}>
              Verify and sign in
            </Button>
            <p className="auth-foot">
              {cooldown ? (
                <>Resend available in {cooldown}s</>
              ) : (
                <button type="button" className="link-btn" onClick={() => { setIdent(sent.guardId); sendSms(); }}>
                  Resend code
                </button>
              )}
            </p>
          </div>
        )}


        {step === 'workspace' && user && (
          <WorkspaceList
            user={user}
            onPick={(m) => {
              signIn({ kind: 'staff', userId: user.id, companyId: m.companyId, role: m.role }, 'password');
              onClose?.();
            }}
          />
        )}

        {step === 'forgot' && <ForgotForm defaultEmail={email} onDone={() => setStep(kind ?? 'staff')} />}
      </div>
    </Modal>
  );
}

function DemoAccounts({ items, onPick }) {
  return (
    <div className="demo-accounts">
      <div className="demo-label">Demo accounts · password demo1234</div>
      <div className="demo-list">
        {items.map((d) => (
          <button type="button" key={d.email} className="demo-chip" onClick={() => onPick(d)}>
            <span className="mono">{d.email}</span>
            <span>{d.who}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function WorkspaceList({ user, current, onPick }) {
  const { db } = useStore();
  return (
    <div className="kind-list">
      {user.memberships.map((m) => {
        const c = company(db, m.companyId);
        const off = c.status === 'suspended';
        return (
          <button key={m.companyId} type="button" className={`kind ${current === m.companyId ? 'is-current' : ''}`} disabled={off} onClick={() => onPick(m)}>
            <OrgMark company={c} size={40} />
            <span className="grow">
              <b>{c.name}</b>
              <span>
                {ROLES[m.role].label} · {c.city}
                {off && ' · Suspended'}
              </span>
            </span>
            {current === m.companyId ? <Badge tone="ok">Current</Badge> : <ArrowRight size={16} className="chev" />}
          </button>
        );
      })}
    </div>
  );
}

export function WorkspaceModal({ onClose }) {
  const { db, session, switchCompany, toast } = useStore();
  const user = db.users.find((u) => u.id === session.userId);
  return (
    <Modal size="sm" title="Switch workspace" subtitle={user.email} onClose={onClose}>
      <WorkspaceList
        user={user}
        current={session.companyId}
        onPick={(m) => {
          if (m.companyId !== session.companyId) {
            switchCompany(m.companyId);
            toast({ kind: 'success', title: `Switched to ${company(db, m.companyId).name}`, body: `You are signed in as ${ROLES[m.role].label}.` });
          }
          onClose();
        }}
      />
    </Modal>
  );
}

function ForgotForm({ defaultEmail, onDone }) {
  const [email, setEmail] = useState(defaultEmail);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  if (sent)
    return (
      <div className="auth-form center">
        <div className="auth-hero-icon ok">
          <CheckCircle size={28} />
        </div>
        <p className="auth-lede">
          If an account exists for <b>{email}</b>, a reset link is on its way. It expires in 30 minutes.
        </p>
        <Button size="lg" className="block" onClick={onDone}>
          Back to sign in
        </Button>
      </div>
    );
  return (
    <form
      className="auth-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        await sleep(800);
        setSent(true);
      }}
    >
      <p className="auth-lede">Enter your work email and we'll send a link to choose a new password.</p>
      <Field label="Work email">
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
      </Field>
      <Button type="submit" size="lg" className="block" loading={busy} disabled={!/.+@.+\..+/.test(email)}>
        Send reset link
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------- company registration
const COLORS = ['#b7791f', '#2c5d8f', '#6a4c93', '#2f7d57', '#9b2c2c', '#2d6a6a', '#4a5568', '#8a4b2c'];
export function RegisterCompanyModal({ onClose, onBack }) {
  const { db, signIn, act } = useStore();
  const [step, setStep] = useState(0);
  const [f, setF] = useState({ name: '', reg: '', city: 'Harare', phone: '', color: COLORS[5], logo: null, admin: '', title: 'Managing Director', email: '', password: '', agree: false });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const regOk = /^PSR-\d{4}-\d{4}$/.test(f.reg.trim().toUpperCase());
  const regTaken = db.companies.some((c) => c.reg === f.reg.trim().toUpperCase());
  const emailTaken = db.users.some((u) => u.email.toLowerCase() === f.email.trim().toLowerCase());
  const strong = passwordStrength(f.password).score >= 3;
  const ok0 = f.name.trim().length > 2 && regOk && !regTaken && f.phone.trim();
  const ok1 = f.admin.trim() && /.+@.+\..+/.test(f.email) && !emailTaken && strong && f.agree;

  const create = async () => {
    const cid = uid('C');
    const u = uid('U');
    await act({
      key: 'register-company',
      pending: 'Creating your workspace…',
      success: `${f.name.trim()} is registered`,
      touches: ['companies', 'users'],
      failable: false,
      apply: (d, t) => {
        d.companies.push({
          id: cid, name: f.name.trim(), city: f.city, reg: f.reg.trim().toUpperCase(), color: f.color, logo: f.logo, address: '', phone: f.phone.trim(), email: f.email.trim(),
          licenceExpiry: '', joinedAt: t.now.slice(0, 10), status: 'pending',
          policy: { slaHours: 72, accessDays: 30, defaultScopes: ['attendance', 'incident', 'disciplinary', 'separation'], requireInAppConsent: true, autoExpireRequests: true },
        });
        d.users.push({ id: u, kind: 'staff', name: f.admin.trim(), title: f.title, email: f.email.trim(), password: f.password, mfa: false, avatar: null, status: 'active', memberships: [{ companyId: cid, role: 'owner' }] });
        t.notify('regulator', { title: 'New company awaiting approval', body: `${f.name.trim()} (${f.reg.toUpperCase()}) registered.`, link: { name: 'companies', params: { id: cid } } });
      },
    });
    signIn({ kind: 'staff', userId: u, companyId: cid, role: 'owner' }, 'new registration');
    onClose();
  };

  return (
    <Modal
      size="md"
      title="Register your company"
      subtitle={['Company details', 'Your administrator account', 'Review'][step]}
      icon={Buildings}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" icon={ArrowLeft} onClick={() => (step ? setStep(step - 1) : onBack?.())}>
            Back
          </Button>
          {step < 2 ? (
            <Button iconRight={ArrowRight} disabled={step === 0 ? !ok0 : !ok1} onClick={() => setStep(step + 1)}>
              Continue
            </Button>
          ) : (
            <Button icon={CheckCircle} onClick={create}>
              Create workspace
            </Button>
          )}
        </>
      }
    >
      <ol className="wizard-steps">
        {['Company', 'Administrator', 'Review'].map((s, i) => (
          <li key={s} className={i === step ? 'on' : i < step ? 'done' : ''}>
            <span>{i < step ? '✓' : i + 1}</span>
            {s}
          </li>
        ))}
      </ol>
      {step === 0 && (
        <>
          <Field label="Registered company name">
            <input value={f.name} onChange={set('name')} autoFocus placeholder="e.g. Granite Security (Pvt) Ltd" />
          </Field>
          <div className="form-grid">
            <Field label="Regulator licence number" error={f.reg && (!regOk ? 'Format: PSR-YYYY-NNNN' : regTaken ? 'Already registered in the network.' : null)}>
              <input className="mono" value={f.reg} onChange={set('reg')} placeholder="PSR-2026-0001" />
            </Field>
            <Field label="Head office">
              <select value={f.city} onChange={set('city')}>
                {CITIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Phone">
              <input type="tel" value={f.phone} onChange={set('phone')} placeholder="+263 …" />
            </Field>
          </div>
          <div className="field">
            <span className="field-label">
              Logo <span className="field-optional">Optional</span>
            </span>
            <LogoUpload company={{ name: f.name || 'New company', color: f.color }} value={f.logo} onChange={(logo) => setF({ ...f, logo })} />
          </div>
          <Field label="Brand colour" hint="Used for accents, and as your mark if you don't upload a logo.">
            <div className="swatches">
              {COLORS.map((c) => (
                <button key={c} type="button" className={`swatch ${f.color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setF({ ...f, color: c })} aria-label={c} />
              ))}
            </div>
          </Field>
        </>
      )}
      {step === 1 && (
        <>
          <div className="form-grid">
            <Field label="Your full name">
              <input value={f.admin} onChange={set('admin')} autoFocus />
            </Field>
            <Field label="Job title">
              <input value={f.title} onChange={set('title')} />
            </Field>
          </div>
          <Field label="Work email" error={emailTaken ? 'An account already uses this email.' : null}>
            <input type="email" value={f.email} onChange={set('email')} autoComplete="username" />
          </Field>
          <Field label="Password" hint="At least 8 characters with a mix of letters, numbers and symbols.">
            <PasswordInput value={f.password} onChange={(v) => setF({ ...f, password: v })} autoComplete="new-password" />
            <StrengthMeter password={f.password} />
          </Field>
          <label className={`option consent ${f.agree ? 'on' : ''}`}>
            <input type="checkbox" checked={f.agree} onChange={set('agree')} />
            <span>We agree to the network code of conduct: records are factual, releases require the guard's consent, and guards may see and respond to what we record.</span>
          </label>
        </>
      )}
      {step === 2 && (
        <>
          <div className="review-company">
            <OrgMark company={{ name: f.name, color: f.color, logo: f.logo }} size={48} />
            <div>
              <b>{f.name}</b>
              <div className="muted mono small">{f.reg.toUpperCase()}</div>
            </div>
          </div>
          <dl className="review-list">
            <div><dt>Head office</dt><dd>{f.city}</dd></div>
            <div><dt>Administrator</dt><dd>{f.admin} · {f.email}</dd></div>
          </dl>
          <div className="notice">
            <ShieldCheck size={16} />
            <span>The regulator reviews new companies. Until you're approved you can set up sites and your team, but you can't request records from other employers.</span>
          </div>
        </>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------- lock screen
export function LockScreen({ onUnlock }) {
  const { db, session, signOut, toast } = useStore();
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const user = session.userId ? db.users.find((u) => u.id === session.userId) : null;
  const guard = session.kind === 'guard' ? guardById(db, session.guardId) : null;
  const name = user?.name ?? guard?.name;
  const unlock = async (e) => {
    e?.preventDefault();
    setBusy(true);
    await sleep(450);
    if (user && pw !== user.password) {
      setBusy(false);
      setErr('Incorrect password.');
      return;
    }
    toast({ kind: 'success', title: 'Welcome back' });
    onUnlock();
  };
  return (
    <Modal size="sm" title="Session locked" icon={LockKey} dismissable={false} onClose={() => {}}>
      <form className="auth-form center" onSubmit={unlock}>
        <Avatar name={name} seed={user?.id ?? guard?.id} src={user?.avatar ?? guard?.avatar} size={64} />
        <p className="auth-lede">
          <b>{name}</b>, your session was locked after {db.settings.idleLockMinutes} minutes without activity, to protect guard records.
        </p>
        {user ? (
          <Field label="Password">
            <PasswordInput value={pw} onChange={(v) => { setPw(v); setErr(''); }} autoFocus />
          </Field>
        ) : (
          <p className="muted small">Tap unlock to continue on this trusted device.</p>
        )}
        {err && (
          <div className="form-error">
            <Warning size={16} /> {err}
          </div>
        )}
        <Button type="submit" size="lg" className="block" loading={busy} disabled={user && !pw}>
          Unlock
        </Button>
        <button type="button" className="link-btn" onClick={signOut}>
          Sign out instead
        </button>
      </form>
    </Modal>
  );
}

// ---------------------------------------------------------------- account settings
export function AccountModal({ onClose, initialTab = 'profile' }) {
  const { db, session, act, toast, signOut } = useStore();
  const user = db.users.find((u) => u.id === session.userId);
  const [tab, setTab] = useState(initialTab);
  const [f, setF] = useState({ name: user.name, title: user.title ?? '', avatar: user.avatar });
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [err, setErr] = useState('');
  const fileRef = useRef(null);
  const mySessions = db.sessions.filter((s) => s.userId === user.id);
  const dirty = f.name !== user.name || f.title !== (user.title ?? '') || f.avatar !== user.avatar;

  const saveProfile = () =>
    act({
      key: user.id,
      pending: 'Saving profile…',
      success: 'Profile updated',
      touches: ['users'],
      undo: true,
      apply: (d, t) => {
        Object.assign(d.users.find((u) => u.id === user.id), { name: f.name.trim(), title: f.title.trim(), avatar: f.avatar });
        t.log('Updated account', `${f.name.trim()} updated their profile`);
      },
    });

  const changePassword = () => {
    if (pw.current !== user.password) return setErr('Your current password is incorrect.');
    if (passwordStrength(pw.next).score < 3) return setErr('Choose a stronger password.');
    if (pw.next !== pw.confirm) return setErr("The new passwords don't match.");
    setErr('');
    act({
      key: `${user.id}:pw`,
      pending: 'Changing password…',
      success: 'Password changed. Other sessions were signed out.',
      touches: ['users', 'sessions'],
      apply: (d, t) => {
        d.users.find((u) => u.id === user.id).password = pw.next;
        d.sessions = d.sessions.filter((s) => s.userId !== user.id || s.current);
        t.log('Changed password', `${user.name} changed their password`);
      },
    });
    setPw({ current: '', next: '', confirm: '' });
  };


  const revoke = (s) =>
    act({
      key: s.id,
      pending: 'Signing out device…',
      success: `Signed out ${s.device}`,
      touches: ['sessions'],
      undo: true,
      apply: (d, t) => {
        d.sessions = d.sessions.filter((x) => x.id !== s.id);
        t.log('Revoked session', `${user.name} signed out ${s.device} (${s.location})`);
      },
    });

  return (
    <Modal size="lg" title="Account" subtitle={user.email} icon={UserCircle} onClose={onClose}>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'profile', label: 'Profile' },
          { key: 'security', label: 'Security' },
          { key: 'sessions', label: 'Sessions', count: mySessions.length },
        ]}
      />
      {tab === 'profile' && (
        <div className="stack-s">
          <div className="photo-edit">
            <Avatar name={f.name} seed={user.id} src={f.avatar} size={72} />
            <div className="stack-xs">
              <div className="row gap-s">
                <Button variant="ghost" size="sm" icon={Camera} onClick={() => fileRef.current?.click()}>
                  Upload photo
                </Button>
                {f.avatar && (
                  <Button variant="subtle" size="sm" icon={Trash} onClick={() => setF({ ...f, avatar: null })}>
                    Remove
                  </Button>
                )}
              </div>
              <span className="field-hint">JPG or PNG. We crop it to a square.</span>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) setF({ ...f, avatar: await fileToAvatar(file) });
                }}
              />
            </div>
          </div>
          <div className="form-grid">
            <Field label="Full name">
              <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            </Field>
            <Field label="Job title">
              <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
            </Field>
          </div>
          <Field label="Email" hint="Contact your administrator to change your sign-in email.">
            <input value={user.email} disabled />
          </Field>
          <div className="row end">
            <Button onClick={saveProfile} disabled={!dirty || !f.name.trim()}>
              Save profile
            </Button>
          </div>
        </div>
      )}
      {tab === 'security' && (
        <div className="stack">
          <div className="stack-s">
            <b>Change password</b>
            <Field label="Current password">
              <PasswordInput value={pw.current} onChange={(v) => setPw({ ...pw, current: v })} />
            </Field>
            <div className="form-grid">
              <Field label="New password">
                <PasswordInput value={pw.next} onChange={(v) => setPw({ ...pw, next: v })} autoComplete="new-password" />
                <StrengthMeter password={pw.next} />
              </Field>
              <Field label="Confirm new password">
                <PasswordInput value={pw.confirm} onChange={(v) => setPw({ ...pw, confirm: v })} autoComplete="new-password" />
              </Field>
            </div>
            {err && (
              <div className="form-error">
                <Warning size={16} /> {err}
              </div>
            )}
            <div className="row end">
              <Button icon={Key} onClick={changePassword} disabled={!pw.current || !pw.next}>
                Change password
              </Button>
            </div>
          </div>
        </div>
      )}
      {tab === 'sessions' && (
        <div className="stack-s">
          <ul className="items">
            {mySessions.map((s) => (
              <li key={s.id}>
                <span className="item-icon">
                  <DeviceMobile size={17} />
                </span>
                <div className="grow">
                  <div className="item-title">
                    {s.device} {s.current && <Badge tone="ok">This device</Badge>}
                  </div>
                  <div className="item-sub">
                    {s.location} · {s.ip} · active {fromNow(s.lastSeenAt)} · signed in {fmtTime(s.createdAt)}
                  </div>
                </div>
                {s.current ? (
                  <Button variant="ghost" size="sm" icon={SignOut} onClick={signOut}>
                    Sign out
                  </Button>
                ) : (
                  <Button variant="danger-ghost" size="sm" onClick={() => revoke(s)}>
                    Revoke
                  </Button>
                )}
              </li>
            ))}
          </ul>
          {mySessions.filter((s) => !s.current).length > 1 && (
            <Button
              variant="ghost"
              onClick={() => {
                mySessions.filter((s) => !s.current).forEach(revoke);
                toast({ kind: 'info', title: 'Signing out other devices' });
              }}
            >
              Sign out all other devices
            </Button>
          )}
        </div>
      )}
    </Modal>
  );
}

