import { useMemo, useRef, useState } from 'react';
import {
  ArrowsClockwise, Buildings, CheckCircle, DownloadSimple, Envelope, FileArrowUp, Key, MapPin, PaperPlaneTilt, PencilSimple, Phone, Plugs, Plus,
  ShieldCheck, Trash, UploadSimple, Warning, WebhooksLogo,
} from '@phosphor-icons/react';
import { useStore } from '../../store';
import { SCOPES, activeEmployments, company, deniedHint, expiryStatus, guardById, scopeShort } from '../../access';
import {
  Badge, Button, Card, ConfirmModal, CopyButton, DataTable, EmptyState, Field, Menu, Modal, NavTabs, OrgMark, PageHead, Segmented, Toggle,
  downloadCSV, fmtDate, fmtTime, fromNow, parseCSV, randomSecret, uid,
} from '../../ui';
import { LogoUpload, PermissionNote } from '../../components';
import './admin.css';

const TABS = [
  { key: 'profile', label: 'Company profile' },
  { key: 'policy', label: 'Sharing policy' },
  { key: 'integrations', label: 'Integrations' },
  { key: 'import', label: 'Data import' },
];
const KEY_SCOPES = [
  { key: 'guards:read', label: 'Read guards' },
  { key: 'sites:read', label: 'Read sites' },
  { key: 'employments:write', label: 'Write employments' },
  { key: 'attendance:write', label: 'Write attendance' },
  { key: 'records:write', label: 'Write records' },
  { key: 'verification:read', label: 'Read verification status' },
];
const EVENTS = [
  { key: 'verification.requested', label: 'A verification request arrives' },
  { key: 'verification.released', label: 'Records are released to you' },
  { key: 'response.submitted', label: 'A guard responds to a record' },
  { key: 'licence.expiring', label: 'A licence or certificate is expiring' },
  { key: 'guard.separated', label: 'A separation is recorded' },
];
const COLORS = ['#b7791f', '#2c5d8f', '#6a4c93', '#2f7d57', '#9b2c2c', '#2d6a6a', '#4a5568', '#8a4b2c'];

export default function Settings({ go, id }) {
  const tab = TABS.some((t) => t.key === id) ? id : 'profile';
  return (
    <div className="stack">
      <PageHead title="Settings & integrations" sub="Your company's profile in the network, how you share records, and how Security Force connects to your payroll, rostering and ERP systems." />
      <NavTabs tabs={TABS} value={tab} onChange={(k) => go('settings', { id: k === 'profile' ? undefined : k })} />
      {tab === 'profile' && <ProfileTab />}
      {tab === 'policy' && <PolicyTab />}
      {tab === 'integrations' && <IntegrationsTab />}
      {tab === 'import' && <ImportTab />}
    </div>
  );
}

// ------------------------------------------------------------------ profile
function ProfileTab() {
  const { db, session } = useStore();
  const co = company(db, session.companyId);
  const [edit, setEdit] = useState(false);
  const lic = expiryStatus(co.licenceExpiry, 90);
  return (
    <>
      <Card
        className="ad-profile"
        actions={
          <Button variant="ghost" icon={PencilSimple} onClick={() => setEdit(true)} disabledReason={deniedHint(session, 'company.manage')}>
            Edit profile
          </Button>
        }
        title={
          <span className="ad-profile-head">
            <OrgMark company={co} size={52} />
            <span>
              <span className="ad-profile-name">{co.name}</span>
              <span className="mono muted small">{co.reg}</span>
            </span>
          </span>
        }
      >
        <dl className="ad-facts">
          <div>
            <dt>Network status</dt>
            <dd>
              <Badge tone={co.status === 'active' ? 'ok' : co.status === 'pending' ? 'warn' : 'bad'} dot>
                {co.status === 'active' ? 'Approved member' : co.status === 'pending' ? 'Awaiting regulator approval' : 'Suspended'}
              </Badge>
            </dd>
          </div>
          <div>
            <dt>Operating licence</dt>
            <dd>{co.licenceExpiry ? <Badge tone={lic.tone} icon={ShieldCheck}>{lic.tone === 'ok' ? `Valid to ${fmtDate(co.licenceExpiry)}` : lic.label}</Badge> : <span className="muted">Not provided</span>}</dd>
          </div>
          <div>
            <dt>Head office</dt>
            <dd className="ad-icon-line"><MapPin size={14} /> {co.address || co.city}</dd>
          </div>
          <div>
            <dt>Phone</dt>
            <dd className="ad-icon-line"><Phone size={14} /> {co.phone || '—'}</dd>
          </div>
          <div>
            <dt>Contact email</dt>
            <dd className="ad-icon-line"><Envelope size={14} /> {co.email || '—'}</dd>
          </div>
          <div>
            <dt>Member since</dt>
            <dd>{co.joinedAt ? fmtDate(co.joinedAt) : '—'}</dd>
          </div>
        </dl>
        {lic.tone !== 'ok' && co.licenceExpiry && (
          <div className="notice notice-warn mt">
            <Warning size={16} />
            <span>Your operating licence {lic.tone === 'bad' ? 'has expired' : 'expires soon'}. Upload the renewal so clients and the regulator see you as licensed.</span>
          </div>
        )}
      </Card>
      {edit && <EditCompanyModal co={co} onClose={() => setEdit(false)} />}
    </>
  );
}

function EditCompanyModal({ co, onClose }) {
  const { act } = useStore();
  const [f, setF] = useState({ name: co.name, address: co.address ?? '', phone: co.phone ?? '', email: co.email ?? '', licenceExpiry: co.licenceExpiry ?? '', color: co.color, logo: co.logo ?? null });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const valid = f.name.trim().length > 2 && (!f.email || /.+@.+\..+/.test(f.email));
  const save = () =>
    act({
      key: co.id,
      pending: 'Saving company profile…',
      success: 'Company profile updated',
      touches: ['companies'],
      undo: true,
      apply: (d, t) => {
        Object.assign(d.companies.find((c) => c.id === co.id), { name: f.name.trim(), address: f.address.trim(), phone: f.phone.trim(), email: f.email.trim(), licenceExpiry: f.licenceExpiry, color: f.color, logo: f.logo });
        t.log('Updated company profile', f.name.trim());
      },
    }).then(onClose);
  return (
    <Modal
      title="Edit company profile"
      icon={Buildings}
      size="md"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!valid}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="field">
        <span className="field-label">Logo</span>
        <LogoUpload company={{ name: f.name, color: f.color }} value={f.logo} onChange={(logo) => setF({ ...f, logo })} />
      </div>
      <Field label="Registered name">
        <input value={f.name} onChange={set('name')} />
      </Field>
      <Field label="Head office address">
        <input value={f.address} onChange={set('address')} />
      </Field>
      <div className="form-grid">
        <Field label="Phone">
          <input type="tel" value={f.phone} onChange={set('phone')} />
        </Field>
        <Field label="Contact email" error={f.email && !/.+@.+\..+/.test(f.email) ? 'Enter a valid email.' : null}>
          <input type="email" value={f.email} onChange={set('email')} />
        </Field>
        <Field label="Operating licence expiry">
          <input type="date" value={f.licenceExpiry} onChange={set('licenceExpiry')} />
        </Field>
      </div>
      <Field label="Brand colour" hint="Used for your company's accents, and as the mark when no logo is uploaded.">
        <div className="swatches">
          {COLORS.map((c) => (
            <button key={c} type="button" className={`swatch ${f.color === c ? 'on' : ''}`} style={{ background: c }} onClick={() => setF({ ...f, color: c })} aria-label={`Colour ${c}`} />
          ))}
        </div>
      </Field>
    </Modal>
  );
}

// ------------------------------------------------------------------ policy
function PolicyTab() {
  const { db, session } = useStore();
  const co = company(db, session.companyId);
  const p = co.policy;
  const [edit, setEdit] = useState(false);
  const rows = [
    ['Response target', `${p.slaHours} hours`, 'How quickly you commit to answering verification requests from other employers. The regulator tracks this.'],
    ['Access period', `${p.accessDays} days`, 'The longest time another employer can see records you release. Guards can revoke sooner.'],
    ['Default request scope', p.defaultScopes.map(scopeShort).join(', '), 'Pre-selected when your team requests records about an applicant. Ask only for what you need.'],
    ['Consent in the app', p.requireInAppConsent ? 'Required' : 'Signed forms accepted', 'Whether your team must use in-app consent, or may attest to a signed paper form.'],
    ['Close stale requests', p.autoExpireRequests ? 'On' : 'Off', 'Automatically expire your outgoing requests that nobody answers within 14 days.'],
  ];
  return (
    <>
      <Card
        title="How you share records"
        subtitle="These defaults apply to your whole company."
        actions={
          <Button variant="ghost" icon={PencilSimple} onClick={() => setEdit(true)} disabledReason={deniedHint(session, 'company.manage')}>
            Edit policy
          </Button>
        }
      >
        <div className="ad-policy">
          {rows.map(([k, v, d]) => (
            <div key={k} className="setting-row">
              <div className="grow">
                <b>{k}</b>
                <p className="muted small">{d}</p>
              </div>
              <span className="ad-policy-val">{v}</span>
            </div>
          ))}
        </div>
      </Card>
      {edit && <PolicyModal co={co} onClose={() => setEdit(false)} />}
    </>
  );
}

function PolicyModal({ co, onClose }) {
  const { act } = useStore();
  const [p, setP] = useState(co.policy);
  const toggle = (k) => setP({ ...p, defaultScopes: p.defaultScopes.includes(k) ? p.defaultScopes.filter((x) => x !== k) : [...p.defaultScopes, k] });
  const save = () =>
    act({
      key: `${co.id}:policy`,
      pending: 'Saving policy…',
      success: 'Sharing policy updated',
      touches: ['companies'],
      undo: true,
      apply: (d, t) => {
        d.companies.find((c) => c.id === co.id).policy = p;
        t.log('Updated sharing policy', `Response target ${p.slaHours}h · access ${p.accessDays} days · consent ${p.requireInAppConsent ? 'in app' : 'form or app'}`);
      },
    }).then(onClose);
  return (
    <Modal
      title="Edit sharing policy"
      icon={ShieldCheck}
      size="md"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!p.defaultScopes.length}>
            Save policy
          </Button>
        </>
      }
    >
      <Field label="Response target" hint="Shorter targets build trust across the network.">
        <Segmented value={String(p.slaHours)} onChange={(v) => setP({ ...p, slaHours: Number(v) })} options={['24', '48', '72', '120'].map((v) => ({ value: v, label: `${v}h` }))} />
      </Field>
      <Field label="Maximum access period">
        <Segmented value={String(p.accessDays)} onChange={(v) => setP({ ...p, accessDays: Number(v) })} options={['7', '14', '30', '60'].map((v) => ({ value: v, label: `${v} days` }))} />
      </Field>
      <Field label="Default request scope">
        <div className="options">
          {SCOPES.map((s) => (
            <label key={s.key} className={`option ${p.defaultScopes.includes(s.key) ? 'on' : ''}`}>
              <input type="checkbox" checked={p.defaultScopes.includes(s.key)} onChange={() => toggle(s.key)} />
              <span>{s.label}</span>
            </label>
          ))}
        </div>
      </Field>
      <div className="setting-row">
        <div className="grow">
          <b>Require in-app consent</b>
          <p className="muted small">Your team can't attest to paper forms.</p>
        </div>
        <Toggle checked={p.requireInAppConsent} onChange={(v) => setP({ ...p, requireInAppConsent: v })} />
      </div>
      <div className="setting-row">
        <div className="grow">
          <b>Close stale requests after 14 days</b>
        </div>
        <Toggle checked={p.autoExpireRequests} onChange={(v) => setP({ ...p, autoExpireRequests: v })} />
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ integrations
function IntegrationsTab() {
  const { db, session, can } = useStore();
  const me = session.companyId;
  const manage = can('integration.manage');
  const hint = deniedHint(session, 'integration.manage');
  const keys = db.apiKeys.filter((k) => k.companyId === me);
  const hooks = db.webhooks.filter((w) => w.companyId === me);
  const [modal, setModal] = useState(null);

  const keyCols = [
    { key: 'name', header: 'Name', width: 'minmax(0, 1.4fr)', mobile: 'primary', sort: (k) => k.name, render: (k) => (
      <span className="cell-person-text">
        <span className="cell-name">{k.name}</span>
        <span className="cell-sub mono">{k.prefix}••••••••</span>
      </span>
    ) },
    { key: 'scopes', header: 'Permissions', width: 'minmax(0, 1.6fr)', mobile: 'secondary', render: (k) => <span className="chips">{k.scopes.map((s) => <Badge key={s}>{s}</Badge>)}</span> },
    { key: 'created', header: 'Created', width: '150px', mobile: 'meta', sort: (k) => k.createdAt, render: (k) => <span className="small muted">{fmtDate(k.createdAt)} · {k.createdBy}</span> },
    { key: 'used', header: 'Last used', width: '110px', mobile: 'meta', sort: (k) => k.lastUsedAt ?? '', render: (k) => <span className="small">{k.lastUsedAt ? fromNow(k.lastUsedAt) : 'Never'}</span> },
    { key: 'status', header: 'Status', width: '100px', mobile: 'aside', render: (k) => (k.revokedAt ? <Badge>Revoked</Badge> : <Badge tone="ok" dot>Active</Badge>) },
    { key: 'actions', header: '', width: '40px', render: (k) => (
      <Menu label="Key actions" items={[{ label: 'Revoke key', icon: Trash, danger: true, disabled: !manage || !!k.revokedAt, hint: hint ?? (k.revokedAt ? 'Already revoked.' : undefined), onClick: () => setModal({ kind: 'revoke', key: k }) }]} />
    ) },
  ];
  const hookCols = [
    { key: 'url', header: 'Endpoint', width: 'minmax(0, 2fr)', mobile: 'primary', render: (w) => <span className="mono small clamp-1">{w.url}</span> },
    { key: 'events', header: 'Events', width: 'minmax(0, 1.4fr)', mobile: 'meta', render: (w) => <span className="small muted">{w.events.length} event{w.events.length === 1 ? '' : 's'}</span> },
    { key: 'delivery', header: 'Last delivery', width: '160px', mobile: 'meta', render: (w) => (w.lastDelivery ? <Badge tone={w.lastDelivery.status < 300 ? 'ok' : 'bad'}>{w.lastDelivery.status} · {fromNow(w.lastDelivery.at)}</Badge> : <span className="muted small">None yet</span>) },
    { key: 'active', header: 'Active', width: '80px', mobile: 'aside', render: (w) => <HookToggle hook={w} disabled={!manage} /> },
    { key: 'actions', header: '', width: '40px', render: (w) => (
      <Menu
        label="Webhook actions"
        items={[
          { label: 'Edit', icon: PencilSimple, disabled: !manage, hint, onClick: () => setModal({ kind: 'hook', hook: w }) },
          { label: 'Send test event', icon: PaperPlaneTilt, disabled: !manage || !w.active, hint: hint ?? (!w.active ? 'Turn the webhook on first.' : undefined), onClick: () => setModal({ kind: 'test', hook: w }) },
          { divider: true },
          { label: 'Delete', icon: Trash, danger: true, disabled: !manage, hint, onClick: () => setModal({ kind: 'delhook', hook: w }) },
        ]}
      />
    ) },
  ];

  return (
    <>
      {!manage && <PermissionNote>Only owners can create keys and webhooks. You can see what's connected.</PermissionNote>}
      <Card
        title="API keys"
        subtitle="Let payroll, rostering and ERP systems sync employments and attendance automatically."
        icon={Key}
        flush
        actions={
          <Button icon={Plus} size="sm" onClick={() => setModal({ kind: 'key' })} disabledReason={hint}>
            Create key
          </Button>
        }
      >
        <DataTable columns={keyCols} rows={keys} rowClass={(k) => (k.revokedAt ? 'is-muted' : '')} pageSize={5} empty={<EmptyState compact icon={Key} title="No API keys" body="Create a key to connect your payroll or rostering system." />} />
      </Card>
      <Card
        title="Webhooks"
        subtitle="Get notified in your own systems when something happens in the network."
        icon={WebhooksLogo}
        flush
        actions={
          <Button icon={Plus} size="sm" variant="ghost" onClick={() => setModal({ kind: 'hook' })} disabledReason={hint}>
            Add endpoint
          </Button>
        }
      >
        <DataTable columns={hookCols} rows={hooks} pageSize={5} empty={<EmptyState compact icon={Plugs} title="No webhooks" body="Add an HTTPS endpoint to receive events." />} />
      </Card>
      {modal?.kind === 'key' && <CreateKeyModal onClose={() => setModal(null)} />}
      {modal?.kind === 'revoke' && <RevokeKey apiKey={modal.key} onClose={() => setModal(null)} />}
      {modal?.kind === 'hook' && <HookModal hook={modal.hook} onClose={() => setModal(null)} />}
      {modal?.kind === 'test' && <TestHook hook={modal.hook} onClose={() => setModal(null)} />}
      {modal?.kind === 'delhook' && <DeleteHook hook={modal.hook} onClose={() => setModal(null)} />}
    </>
  );
}

function HookToggle({ hook, disabled }) {
  const { act } = useStore();
  return (
    <span onClick={(e) => e.stopPropagation()}>
      <Toggle
        checked={hook.active}
        disabled={disabled}
        onChange={(v) =>
          act({
            key: hook.id,
            pending: v ? 'Turning on…' : 'Pausing…',
            success: v ? 'Webhook on' : 'Webhook paused',
            touches: ['webhooks'],
            undo: true,
            apply: (d, t) => {
              d.webhooks.find((w) => w.id === hook.id).active = v;
              t.log(v ? 'Enabled webhook' : 'Paused webhook', hook.url);
            },
          })
        }
      />
    </span>
  );
}

function CreateKeyModal({ onClose }) {
  const { session, act } = useStore();
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState(['guards:read']);
  const [secret, setSecret] = useState(null);
  const toggle = (k) => setScopes((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
  const create = async () => {
    const full = `sf_live_${randomSecret(32)}`;
    const ok = await act({
      key: 'apikey:new',
      pending: 'Creating key…',
      success: 'API key created',
      touches: ['apiKeys'],
      apply: (d, t) => {
        d.apiKeys.unshift({ id: uid('K'), companyId: session.companyId, name: name.trim(), prefix: full.slice(0, 12), scopes, createdAt: t.now, createdBy: t.actor.user, lastUsedAt: null, revokedAt: null });
        t.log('Created API key', `${name.trim()} (${scopes.join(', ')})`);
      },
    });
    if (ok) setSecret(full);
  };
  if (secret)
    return (
      <Modal title="Copy your new key" icon={Key} size="md" dismissable={false} onClose={onClose} footer={<Button onClick={onClose}>I've stored it safely</Button>}>
        <div className="notice notice-warn">
          <Warning size={16} />
          <span>This is the only time the full key is shown. Store it in your system's secret manager. If you lose it, revoke it and create another.</span>
        </div>
        <div className="ad-secret">
          <code className="mono">{secret}</code>
          <CopyButton text={secret} />
        </div>
      </Modal>
    );
  return (
    <Modal
      title="Create API key"
      icon={Key}
      size="md"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={create} disabled={!name.trim() || !scopes.length}>
            Create key
          </Button>
        </>
      }
    >
      <Field label="Name" hint="Name it after the system that will use it.">
        <input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="e.g. Sage Payroll sync" />
      </Field>
      <Field label="Permissions" hint="Grant only what the integration needs.">
        <div className="options">
          {KEY_SCOPES.map((s) => (
            <label key={s.key} className={`option ${scopes.includes(s.key) ? 'on' : ''}`}>
              <input type="checkbox" checked={scopes.includes(s.key)} onChange={() => toggle(s.key)} />
              <span>
                {s.label} <span className="mono faint small">{s.key}</span>
              </span>
            </label>
          ))}
        </div>
      </Field>
    </Modal>
  );
}

function RevokeKey({ apiKey, onClose }) {
  const { act } = useStore();
  return (
    <ConfirmModal
      title={`Revoke “${apiKey.name}”?`}
      body="Any system using this key stops syncing immediately. This can't be undone; create a new key to reconnect."
      confirmLabel="Revoke key"
      requireText="REVOKE"
      onClose={onClose}
      onConfirm={() =>
        act({
          key: apiKey.id,
          pending: 'Revoking key…',
          success: 'Key revoked',
          touches: ['apiKeys'],
          apply: (d, t) => {
            d.apiKeys.find((k) => k.id === apiKey.id).revokedAt = t.now;
            t.log('Revoked API key', apiKey.name);
          },
        })
      }
    />
  );
}

function HookModal({ hook, onClose }) {
  const { session, act } = useStore();
  const [url, setUrl] = useState(hook?.url ?? 'https://');
  const [events, setEvents] = useState(hook?.events ?? ['verification.requested']);
  const toggle = (k) => setEvents((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
  let urlErr = null;
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') urlErr = 'Endpoints must use HTTPS.';
  } catch {
    urlErr = 'Enter a full URL, e.g. https://erp.example.co.zw/hooks';
  }
  const save = () =>
    act({
      key: hook?.id ?? 'webhook:new',
      pending: 'Saving webhook…',
      success: hook ? 'Webhook updated' : 'Webhook added',
      touches: ['webhooks'],
      undo: true,
      apply: (d, t) => {
        if (hook) Object.assign(d.webhooks.find((w) => w.id === hook.id), { url: url.trim(), events });
        else d.webhooks.unshift({ id: uid('WH'), companyId: session.companyId, url: url.trim(), events, active: true, createdAt: t.now, lastDelivery: null });
        t.log(hook ? 'Updated webhook' : 'Added webhook', url.trim());
      },
    }).then(onClose);
  return (
    <Modal
      title={hook ? 'Edit webhook' : 'Add webhook endpoint'}
      icon={WebhooksLogo}
      size="md"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={!!urlErr || !events.length}>
            {hook ? 'Save' : 'Add endpoint'}
          </Button>
        </>
      }
    >
      <Field label="Endpoint URL" error={url.length > 8 ? urlErr : null}>
        <input className="mono" value={url} onChange={(e) => setUrl(e.target.value)} autoFocus />
      </Field>
      <Field label="Send these events">
        <div className="option-list">
          {EVENTS.map((ev) => (
            <label key={ev.key} className={`option option-rich ${events.includes(ev.key) ? 'on' : ''}`}>
              <input type="checkbox" checked={events.includes(ev.key)} onChange={() => toggle(ev.key)} />
              <span className="grow">
                <b>{ev.label}</b>
                <span className="option-sub mono">{ev.key}</span>
              </span>
            </label>
          ))}
        </div>
      </Field>
      <p className="field-hint">Every delivery is signed with an HMAC-SHA256 header so you can verify it came from Security Force.</p>
    </Modal>
  );
}

function TestHook({ hook, onClose }) {
  const { act } = useStore();
  return (
    <ConfirmModal
      title="Send a test event?"
      tone="info"
      icon={PaperPlaneTilt}
      body={`We'll POST a sample “${hook.events[0]}” event to ${hook.url}.`}
      confirmLabel="Send test"
      onClose={onClose}
      onConfirm={() =>
        act({
          key: hook.id,
          pending: 'Delivering test event…',
          success: 'Test delivered · HTTP 200',
          touches: ['webhooks'],
          apply: (d, t) => {
            d.webhooks.find((w) => w.id === hook.id).lastDelivery = { at: t.now, status: 200 };
            t.log('Sent test webhook', hook.url);
          },
        })
      }
    />
  );
}

function DeleteHook({ hook, onClose }) {
  const { act } = useStore();
  return (
    <ConfirmModal
      title="Delete webhook?"
      body={`${hook.url} will stop receiving events.`}
      confirmLabel="Delete"
      onClose={onClose}
      onConfirm={() =>
        act({
          key: hook.id,
          pending: 'Deleting…',
          success: 'Webhook deleted',
          touches: ['webhooks'],
          undo: true,
          apply: (d, t) => {
            d.webhooks = d.webhooks.filter((w) => w.id !== hook.id);
            t.log('Deleted webhook', hook.url);
          },
        })
      }
    />
  );
}

// ------------------------------------------------------------------ data import
function ImportTab() {
  const { db, session } = useStore();
  const me = session.companyId;
  const [open, setOpen] = useState(false);
  const imports = db.imports.filter((i) => i.companyId === me).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const template = () =>
    downloadCSV(
      'attendance-template.csv',
      activeEmployments(db, me).map((e) => {
        const g = guardById(db, e.guardId);
        return { workforce_id: g.id, national_id: g.nationalId, name: g.name, attendance: e.attendance };
      }),
    );
  const cols = [
    { key: 'file', header: 'File', width: 'minmax(0, 2fr)', mobile: 'primary', render: (i) => (
      <span className="cell-person-text">
        <span className="cell-name">{i.file}</span>
        <span className="cell-sub">{i.kind} · {i.rows} rows</span>
      </span>
    ) },
    { key: 'by', header: 'By', width: 'minmax(0, 1fr)', mobile: 'meta', render: (i) => <span className="small">{i.by}</span> },
    { key: 'when', header: 'When', width: '160px', mobile: 'meta', sort: (i) => i.createdAt, render: (i) => <span className="small mono">{fmtTime(i.createdAt)}</span> },
    { key: 'status', header: 'Result', width: '150px', mobile: 'aside', render: (i) => <Badge tone={i.skipped ? 'warn' : 'ok'} dot>{i.skipped ? `${i.skipped} skipped` : 'Completed'}</Badge> },
  ];
  return (
    <>
      <Card
        title="Attendance import"
        subtitle="Upload a CSV from payroll or your rostering system. Only your current employees are updated; every change is logged."
        icon={FileArrowUp}
        actions={
          <>
            <Button variant="ghost" size="sm" icon={DownloadSimple} onClick={template}>
              Template
            </Button>
            <Button size="sm" icon={UploadSimple} onClick={() => setOpen(true)} disabledReason={deniedHint(session, 'attendance.update')}>
              Import CSV
            </Button>
          </>
        }
      >
        <p className="muted small">
          Columns: <span className="mono">workforce_id</span> or <span className="mono">national_id</span>, and <span className="mono">attendance</span> (0–100). The template comes pre-filled with your
          current workforce.
        </p>
      </Card>
      <Card title="Import history" flush>
        <DataTable columns={cols} rows={imports} pageSize={5} empty={<EmptyState compact icon={ArrowsClockwise} title="No imports yet" />} />
      </Card>
      {open && <ImportModal onClose={() => setOpen(false)} />}
    </>
  );
}

function ImportModal({ onClose }) {
  const { db, session, act } = useStore();
  const me = session.companyId;
  const [text, setText] = useState('');
  const [file, setFile] = useState('pasted-attendance.csv');
  const ref = useRef(null);
  const parsed = useMemo(() => {
    if (!text.trim()) return [];
    return parseCSV(text).map((row, i) => {
      const key = (row.workforce_id || row.national_id || '').trim().toUpperCase();
      const g = db.guards.find((x) => x.id === key || x.nationalId.toUpperCase() === key);
      const att = Number(row.attendance);
      const emp = g && db.employments.find((e) => e.guardId === g.id && e.companyId === me && !e.end);
      let status = 'ok';
      let note = '';
      if (!key) [status, note] = ['error', 'Missing ID'];
      else if (!g) [status, note] = ['error', 'Not found in the network'];
      else if (!emp) [status, note] = ['error', 'Not your current employee'];
      else if (!Number.isFinite(att) || att < 0 || att > 100) [status, note] = ['error', 'Attendance must be 0–100'];
      else if (att === emp.attendance) [status, note] = ['same', 'No change'];
      return { i, key, g, att, emp, status, note };
    });
  }, [text, db, me]);
  const ok = parsed.filter((r) => r.status === 'ok');
  const bad = parsed.filter((r) => r.status === 'error');

  const pick = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f.name);
    const reader = new FileReader();
    reader.onload = () => setText(String(reader.result));
    reader.readAsText(f);
  };

  const run = () =>
    act({
      key: 'import:attendance',
      pending: `Importing ${ok.length} rows…`,
      success: `Updated attendance for ${ok.length} guard${ok.length === 1 ? '' : 's'}`,
      touches: ['employments', 'imports'],
      undo: true,
      apply: (d, t) => {
        ok.forEach((r) => {
          d.employments.find((e) => e.id === r.emp.id).attendance = r.att;
        });
        d.imports.unshift({ id: uid('IM'), companyId: me, file, kind: 'attendance', rows: ok.length, skipped: bad.length, status: 'completed', createdAt: t.now, by: t.actor.user });
        t.log('Imported attendance', `${file} — ${ok.length} updated, ${bad.length} skipped`);
      },
    }).then(onClose);

  return (
    <Modal
      title="Import attendance"
      icon={UploadSimple}
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button icon={CheckCircle} onClick={run} disabled={!ok.length}>
            Import {ok.length || ''} row{ok.length === 1 ? '' : 's'}
          </Button>
        </>
      }
    >
      <div className="ad-upload">
        <Button variant="ghost" icon={FileArrowUp} onClick={() => ref.current?.click()}>
          Choose CSV file
        </Button>
        <span className="muted small">or paste below</span>
        <input ref={ref} type="file" accept=".csv,text/csv" onChange={pick} />
      </div>
      <Field label="CSV">
        <textarea rows={5} className="mono" value={text} onChange={(e) => setText(e.target.value)} placeholder={'workforce_id,attendance\nSG-00050581,94'} />
      </Field>
      {parsed.length > 0 && (
        <>
          <div className="row gap-s wrap">
            <Badge tone="ok" dot>{ok.length} ready</Badge>
            {bad.length > 0 && <Badge tone="bad" dot>{bad.length} will be skipped</Badge>}
            {parsed.length - ok.length - bad.length > 0 && <Badge>{parsed.length - ok.length - bad.length} unchanged</Badge>}
          </div>
          <div className="ad-preview">
            {parsed.map((r) => (
              <div key={r.i} className={`ad-preview-row is-${r.status}`}>
                <span className="mono small">{r.key || '—'}</span>
                <span className="grow clamp-1">{r.g?.name ?? ''}</span>
                <span className="mono small">{r.emp ? `${r.emp.attendance}% → ${r.att}%` : Number.isFinite(r.att) ? `${r.att}%` : ''}</span>
                <span className="ad-preview-note">{r.note || 'Update'}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  );
}
