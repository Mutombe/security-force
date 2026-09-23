import { useMemo, useState } from 'react';
import {
  ArrowsClockwise, Buildings, CheckCircle, Eye, MapPin, Minus, PencilSimple, Plus, Power, ShieldCheck, Trash, Warning, XCircle,
} from '@phosphor-icons/react';
import { useStore } from '../../store';
import { CITIES, RISK_LEVELS, clientById, coverage, deniedHint, guardById, siteById, siteGuards } from '../../access';
import {
  AvatarStack, Badge, Button, ConfirmModal, Drawer, EmptyState, Field, FilterSelect, Menu, Meter, Modal, PageHead, SearchInput,
  Segmented, Toggle, fmtTime, fromNow, plural, uid,
} from '../../ui';
import { GuardCell, LicenceBadge, RiskBadge, EntityLink } from '../../components';
import { AssignSiteModal } from '../../modals';
import './company.css';
import '../detail/detail.css';

const lastCheck = (db, siteId) => db.checks.filter((c) => c.siteId === siteId).sort((a, b) => b.ts.localeCompare(a.ts))[0];
const CHECK_TONE = { verified: 'ok', mismatch: 'bad', unassigned: 'warn', invalid: 'bad', bad_code: 'bad' };
const CHECK_LABEL = { verified: 'Verified', mismatch: 'Employer mismatch', unassigned: 'Not assigned here', invalid: 'Unknown ID', bad_code: 'Wrong badge code' };

export default function Sites({ go, id }) {
  const { db, session, can } = useStore();
  const me = session.companyId;
  const [q, setQ] = useState('');
  const [risk, setRisk] = useState('');
  const [show, setShow] = useState('active');
  const [modal, setModal] = useState(null);

  const mine = db.sites.filter((s) => s.companyId === me);
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    const rank = { Critical: 0, High: 1, Standard: 2 };
    return mine
      .filter((s) => (show === 'active' ? s.active : show === 'inactive' ? !s.active : true))
      .filter((s) => !risk || s.risk === risk)
      .filter((s) => !t || `${s.name} ${s.city} ${clientById(db, s.clientId)?.name ?? ''}`.toLowerCase().includes(t))
      .map((s) => ({ s, c: coverage(db, s) }))
      .sort((a, b) => (a.s.active === b.s.active ? 0 : a.s.active ? -1 : 1) || (a.c.pct >= 100) - (b.c.pct >= 100) || rank[a.s.risk] - rank[b.s.risk] || a.s.name.localeCompare(b.s.name));
  }, [mine, q, risk, show, db]);

  const active = mine.filter((s) => s.active);
  const posts = active.reduce((a, s) => a + s.posts, 0);
  const filled = active.reduce((a, s) => a + Math.min(s.posts, coverage(db, s).filled), 0);
  const gaps = active.filter((s) => coverage(db, s).filled < s.posts);
  const drawerSite = id ? siteById(db, id) : null;

  return (
    <div className="stack">
      <PageHead
        title="Sites & coverage"
        sub="Where your guards are posted, and whether every post is filled. Clients see the same roster when they check a guard at the gate."
        meta={
          <>
            <Badge tone={filled >= posts ? 'ok' : 'warn'} dot>
              {filled}/{posts} posts filled
            </Badge>
            {gaps.length > 0 && <Badge tone="bad">{plural(gaps.length, 'site')} short</Badge>}
            <Badge>{plural(active.length, 'active site')}</Badge>
          </>
        }
        actions={
          <Button icon={Plus} onClick={() => setModal({ kind: 'edit' })} disabledReason={deniedHint(session, 'site.manage')}>
            Add site
          </Button>
        }
      />

      <div className="toolbar">
        <SearchInput value={q} onChange={setQ} placeholder="Site, client or city" />
        <FilterSelect label={risk || 'Risk'} value={risk} onChange={setRisk} options={[{ value: '', label: 'All risk levels' }, ...RISK_LEVELS]} />
        <FilterSelect
          label={{ active: 'Active', inactive: 'Inactive', all: 'All sites' }[show]}
          value={show}
          onChange={setShow}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'inactive', label: 'Inactive' },
            { value: 'all', label: 'All sites' },
          ]}
        />
      </div>

      {rows.length ? (
        <div className="co-sites">
          {rows.map(({ s, c }) => {
            const people = siteGuards(db, s.id).map((x) => x.g);
            const check = lastCheck(db, s.id);
            const critGap = s.active && s.risk === 'Critical' && c.filled < c.posts;
            return (
              <article
                key={s.id}
                className={`co-site ${s.active ? '' : 'is-inactive'} ${critGap ? 'is-critical-gap' : ''}`}
                onClick={() => go('sites', { id: s.id })}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && go('sites', { id: s.id })}
              >
                <div className="co-site-top">
                  <div className="grow">
                    <a href={`#/sites/${s.id}`} className="co-site-name dt2-card-link" onClick={(e) => e.stopPropagation()}>
                      {s.name}
                    </a>
                    <div className="co-site-client">{clientById(db, s.clientId)?.name ?? 'Internal site'}</div>
                  </div>
                  <SiteMenu site={s} onEdit={() => setModal({ kind: 'edit', site: s })} onToggle={() => setModal({ kind: 'toggle', site: s })} onDelete={() => setModal({ kind: 'delete', site: s })} onOpen={() => go('sites', { id: s.id })} />
                </div>
                <div className="co-site-meta">
                  <RiskBadge risk={s.risk} />
                  <Badge icon={MapPin}>{s.city}</Badge>
                  <Badge>{s.shift}</Badge>
                  {!s.active && <Badge tone="neutral">Inactive</Badge>}
                </div>
                <div className="co-site-cov">
                  <div className="co-site-cov-top">
                    <span>Coverage</span>
                    <b>
                      {c.filled} of {c.posts} posts
                    </b>
                  </div>
                  <span className={`co-bar co-bar-lg ${c.tone}`}>
                    <span style={{ width: `${Math.min(100, c.pct)}%` }} />
                  </span>
                  {critGap && (
                    <span className="co-gap-alert">
                      <Warning size={14} weight="bold" /> Critical site under-covered
                    </span>
                  )}
                </div>
                <div className="co-site-foot">
                  {people.length ? <AvatarStack people={people} max={5} /> : <span>No guards assigned</span>}
                  <span title={check ? `${CHECK_LABEL[check.result]} · ${fmtTime(check.ts)}` : undefined}>{check ? `Client check ${fromNow(check.ts)}` : 'No client checks yet'}</span>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="card">
          <EmptyState
            icon={Buildings}
            title={mine.length ? 'No sites match' : 'No sites yet'}
            body={mine.length ? 'Try a different search or filter.' : 'Add the client sites you guard to track coverage and let clients verify guards at the gate.'}
            action={!mine.length && can('site.manage') && <Button icon={Plus} onClick={() => setModal({ kind: 'edit' })}>Add site</Button>}
          />
        </div>
      )}

      {drawerSite && drawerSite.companyId === me && (
        <SiteDrawer
          site={drawerSite}
          go={go}
          onClose={() => go('sites')}
          onEdit={() => setModal({ kind: 'edit', site: drawerSite })}
          onToggle={() => setModal({ kind: 'toggle', site: drawerSite })}
          onDelete={() => setModal({ kind: 'delete', site: drawerSite })}
        />
      )}
      {modal?.kind === 'edit' && <SiteModal site={modal.site} onClose={() => setModal(null)} />}
      {modal?.kind === 'toggle' && <ToggleSiteModal site={modal.site} onClose={() => setModal(null)} />}
      {modal?.kind === 'delete' && <DeleteSiteModal site={modal.site} onClose={() => setModal(null)} onDeleted={() => go('sites')} />}
    </div>
  );
}

function SiteMenu({ site, onEdit, onToggle, onDelete, onOpen }) {
  const { session, can } = useStore();
  const hint = deniedHint(session, 'site.manage');
  return (
    <Menu
      label={`Actions for ${site.name}`}
      items={[
        onOpen && { label: 'Open roster', icon: Eye, onClick: onOpen },
        onOpen && { divider: true },
        { label: 'Edit site', icon: PencilSimple, onClick: onEdit, disabled: !can('site.manage'), hint },
        { label: site.active ? 'Deactivate' : 'Reactivate', icon: Power, onClick: onToggle, disabled: !can('site.manage'), hint },
        { label: 'Delete site', icon: Trash, danger: true, onClick: onDelete, disabled: !can('site.manage'), hint },
      ]}
    />
  );
}

function SiteDrawer({ site, go, onClose, onEdit, onToggle, onDelete }) {
  const { db, session, can } = useStore();
  const [assign, setAssign] = useState(null);
  const c = coverage(db, site);
  const roster = siteGuards(db, site.id);
  const checks = db.checks.filter((x) => x.siteId === site.id).sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 8);
  const hint = deniedHint(session, 'site.manage');
  return (
    <Drawer
      wide
      title={site.name}
      subtitle={`${clientById(db, site.clientId)?.name ?? 'Internal site'} · ${site.city}`}
      onClose={onClose}
      headerExtra={<SiteMenu site={site} onEdit={onEdit} onToggle={onToggle} onDelete={onDelete} />}
      footer={
        <>
          <Button variant="ghost" icon={Power} onClick={onToggle} disabledReason={hint}>
            {site.active ? 'Deactivate' : 'Reactivate'}
          </Button>
          <Button icon={PencilSimple} onClick={onEdit} disabledReason={hint}>
            Edit site
          </Button>
        </>
      }
    >
      <div className="chips">
        <RiskBadge risk={site.risk} />
        <Badge>{site.shift}</Badge>
        {!site.active && <Badge>Inactive</Badge>}
      </div>
      <dl className="co-kv">
        <div>
          <dt>Posts filled</dt>
          <dd>
            {c.filled} / {c.posts}
          </dd>
        </div>
        <div>
          <dt>Coverage</dt>
          <dd style={{ color: c.tone === 'ok' ? 'var(--ok)' : c.tone === 'bad' ? 'var(--bad)' : 'var(--warn)' }}>{c.pct}%</dd>
        </div>
        <div>
          <dt>Client checks</dt>
          <dd>{db.checks.filter((x) => x.siteId === site.id).length}</dd>
        </div>
      </dl>
      <div className="co-posts" aria-label={`${c.filled} of ${c.posts} posts filled`}>
        {Array.from({ length: Math.max(c.posts, c.filled) }, (_, i) => (
          <span key={i} className={`co-post ${i < c.filled ? 'on' : ''}`} />
        ))}
      </div>
      {c.filled < c.posts && site.active && (
        <div className={`notice ${site.risk === 'Critical' ? 'notice-bad' : 'notice-warn'}`}>
          <Warning size={16} />
          <span>
            {plural(c.posts - c.filled, 'post')} unfilled. Reassign guards from other sites in Workforce, or hire through Recruitment.
          </span>
        </div>
      )}

      <section>
        <div className="co-section-title">Assigned guards</div>
        {roster.length ? (
          <ul className="items">
            {roster.map(({ e, g }) => (
              <li key={e.id}>
                <GuardCell guard={g} sub={e.position} />
                <span className="grow" />
                <span className="chips hide-sm">
                  <LicenceBadge guard={g} compact />
                  <Meter value={e.attendance} />
                </span>
                <Menu
                  label={`Actions for ${g.name}`}
                  items={[
                    { label: 'View passport', icon: Eye, onClick: () => go('guard', { id: g.id }) },
                    { label: 'Reassign site', icon: ArrowsClockwise, onClick: () => setAssign([e]), disabled: !can('employment.manage'), hint: deniedHint(session, 'employment.manage') },
                  ]}
                />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState compact title="No guards assigned" body="Reassign guards to this site from Workforce." action={<Button variant="ghost" size="sm" onClick={() => go('workforce')}>Open workforce</Button>} />
        )}
      </section>

      <section>
        <div className="co-section-title">Recent client checks at the gate</div>
        {checks.length ? (
          <ul className="items">
            {checks.map((k) => (
              <li key={k.id}>
                <span className={`item-icon ${CHECK_TONE[k.result]}`}>{k.result === 'verified' ? <CheckCircle size={17} /> : <XCircle size={17} />}</span>
                <div className="grow">
                  <div className="item-title">
                    {k.guardId ? (
                      <EntityLink kind="guard" id={k.guardId} className="dt2-inline-link">
                        {guardById(db, k.guardId)?.name}
                      </EntityLink>
                    ) : (
                      <span className="mono">{k.input}</span>
                    )}
                  </div>
                  <div className="item-sub">
                    Checked by {k.by} · {fmtTime(k.ts)}
                  </div>
                </div>
                <Badge tone={CHECK_TONE[k.result]}>{CHECK_LABEL[k.result]}</Badge>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState compact icon={ShieldCheck} title="No checks yet" body="When the client verifies a guard's badge at this site, it shows here." />
        )}
      </section>
      {assign && <AssignSiteModal employments={assign} onClose={() => setAssign(null)} />}
    </Drawer>
  );
}

export function SiteModal({ site, onClose }) {
  const { db, session, act } = useStore();
  const editing = !!site;
  const [f, setF] = useState(
    site
      ? { name: site.name, clientId: site.clientId ?? '', city: site.city, risk: site.risk, posts: site.posts, shift: site.shift, active: site.active }
      : { name: '', clientId: db.clients[0]?.id ?? '', city: 'Harare', risk: 'Standard', posts: 2, shift: '18:00–06:00', active: true },
  );
  const [newClient, setNewClient] = useState('');
  const [touched, setTouched] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const dupe = db.sites.some((s) => s.companyId === session.companyId && s.id !== site?.id && s.name.trim().toLowerCase() === f.name.trim().toLowerCase());
  const errors = {
    name: !f.name.trim() ? 'Name the site.' : dupe ? 'You already have a site with this name.' : null,
    client: f.clientId === '__new' && !newClient.trim() ? 'Enter the client name.' : null,
  };
  const valid = !Object.values(errors).some(Boolean);
  const assigned = site ? siteGuards(db, site.id).length : 0;

  const save = () => {
    setTouched(true);
    if (!valid) return;
    const sid = site?.id ?? uid('S');
    const cid = f.clientId === '__new' ? uid('CL') : f.clientId || null;
    act({
      key: sid,
      pending: editing ? 'Saving site…' : 'Adding site…',
      success: editing ? `${f.name.trim()} updated` : `${f.name.trim()} added`,
      touches: ['sites', 'clients'],
      undo: true,
      apply: (d, t) => {
        if (f.clientId === '__new') d.clients.push({ id: cid, name: newClient.trim() });
        const data = { name: f.name.trim(), clientId: cid, city: f.city, risk: f.risk, posts: Number(f.posts), shift: f.shift.trim() || '24h', active: f.active };
        if (editing) Object.assign(d.sites.find((s) => s.id === sid), data);
        else d.sites.push({ id: sid, companyId: session.companyId, ...data });
        t.log(editing ? 'Updated site' : 'Added site', `${data.name} · ${data.risk} · ${data.posts} posts`);
        if (cid && !editing) t.notify(`client:${cid}`, { title: 'New guarded site', body: `${t.actor.name} added ${data.name}. You can check guards there.`, link: { name: 'sites' } });
      },
    });
    onClose();
  };

  return (
    <Modal
      title={editing ? 'Edit site' : 'Add site'}
      subtitle={editing ? site.name : 'A client location your guards protect'}
      icon={Buildings}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={touched && !valid}>
            {editing ? 'Save changes' : 'Add site'}
          </Button>
        </>
      }
    >
      <Field label="Site name" error={touched && errors.name}>
        <input value={f.name} onChange={set('name')} autoFocus placeholder="e.g. Eastgate Bank Branch" />
      </Field>
      <div className="form-grid">
        <Field label="Client">
          <select value={f.clientId} onChange={set('clientId')}>
            <option value="">Internal site (no client)</option>
            {db.clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            <option value="__new">Add a new client…</option>
          </select>
        </Field>
        <Field label="City">
          <select value={f.city} onChange={set('city')}>
            {CITIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
      </div>
      {f.clientId === '__new' && (
        <Field label="New client name" error={touched && errors.client} hint="The client can then sign in and check guards at this site.">
          <input value={newClient} onChange={(e) => setNewClient(e.target.value)} autoFocus placeholder="e.g. Harare Central Hospital" />
        </Field>
      )}
      <Field label="Risk level" hint="Critical sites are flagged whenever a post is unfilled.">
        <Segmented value={f.risk} onChange={(risk) => setF({ ...f, risk })} options={RISK_LEVELS} />
      </Field>
      <div className="form-grid">
        <Field label="Required posts" hint={assigned > f.posts ? `${assigned} guards are assigned — more than the posts required.` : undefined}>
          <span className="co-stepper">
            <button type="button" aria-label="Fewer posts" disabled={f.posts <= 1} onClick={() => setF({ ...f, posts: f.posts - 1 })}>
              <Minus size={16} />
            </button>
            <span>{f.posts}</span>
            <button type="button" aria-label="More posts" disabled={f.posts >= 30} onClick={() => setF({ ...f, posts: f.posts + 1 })}>
              <Plus size={16} />
            </button>
          </span>
        </Field>
        <Field label="Shift pattern">
          <input value={f.shift} onChange={set('shift')} placeholder="18:00–06:00 or 24h" />
        </Field>
      </div>
      <Toggle checked={f.active} onChange={(active) => setF({ ...f, active })} label="Site is active" />
    </Modal>
  );
}

function ToggleSiteModal({ site, onClose }) {
  const { db, act } = useStore();
  const assigned = siteGuards(db, site.id).length;
  const on = !site.active;
  return (
    <ConfirmModal
      title={on ? 'Reactivate site' : 'Deactivate site'}
      tone={on ? 'primary' : 'danger'}
      confirmLabel={on ? 'Reactivate' : 'Deactivate'}
      body={
        on
          ? `${site.name} will count towards coverage again and appear in hiring and reassignment lists.`
          : assigned
            ? `${site.name} still has ${plural(assigned, 'guard')} assigned. They stay assigned until you reassign them, but the site stops counting towards coverage.`
            : `${site.name} will stop counting towards coverage. You can reactivate it at any time.`
      }
      onClose={onClose}
      onConfirm={() =>
        act({
          key: site.id,
          pending: on ? 'Reactivating…' : 'Deactivating…',
          success: `${site.name} ${on ? 'reactivated' : 'deactivated'}`,
          touches: ['sites'],
          undo: true,
          apply: (d, t) => {
            d.sites.find((s) => s.id === site.id).active = on;
            t.log(on ? 'Reactivated site' : 'Deactivated site', site.name);
          },
        })
      }
    />
  );
}

function DeleteSiteModal({ site, onClose, onDeleted }) {
  const { db, act } = useStore();
  const roster = siteGuards(db, site.id);
  const [reassign, setReassign] = useState(false);
  if (roster.length) {
    return (
      <>
        {!reassign && (
          <Modal
            size="sm"
            title="Can't delete this site yet"
            icon={Warning}
            onClose={onClose}
            footer={
              <>
                <Button variant="ghost" onClick={onClose}>
                  Close
                </Button>
                <Button icon={ArrowsClockwise} onClick={() => setReassign(true)}>
                  Reassign {plural(roster.length, 'guard')}
                </Button>
              </>
            }
          >
            <p className="confirm-body">
              {site.name} has {plural(roster.length, 'guard')} assigned. Their employment history points to this site, so move them to another site first. You can also deactivate the site instead.
            </p>
            <div className="chips">
              {roster.map(({ g }) => (
                <Badge key={g.id}>
                  <EntityLink kind="guard" id={g.id} className="dt2-inline-link">
                    {g.name}
                  </EntityLink>
                </Badge>
              ))}
            </div>
          </Modal>
        )}
        {reassign && <AssignSiteModal employments={roster.map((x) => x.e)} onClose={onClose} />}
      </>
    );
  }
  return (
    <ConfirmModal
      title="Delete site"
      requireText={site.name.split(' ')[0]}
      confirmLabel="Delete site"
      body={`${site.name} and its coverage settings will be removed. Past client checks stay in the audit trail.`}
      onClose={onClose}
      onConfirm={async () => {
        onDeleted();
        await act({
          key: site.id,
          pending: 'Deleting site…',
          success: `${site.name} deleted`,
          touches: ['sites'],
          undo: true,
          apply: (d, t) => {
            d.sites = d.sites.filter((s) => s.id !== site.id);
            t.log('Deleted site', site.name);
          },
        });
      }}
    />
  );
}
