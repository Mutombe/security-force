import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Bell, Buildings, CaretDown, CaretUpDown, ChartBar, ChatCircleText, Checks, ClockCounterClockwise,
  Database, DotsThreeOutline, DownloadSimple, Eye, GearSix, Handshake, IdentificationCard, Kanban, Key, Lightning,
  MagnifyingGlass, QrCode, Scales, ShareNetwork, ShieldCheck, SignOut, SquaresFour, UserCircle, UserPlus, Users, UsersThree,
  WifiHigh, WifiSlash, X, Desktop, Sun, Moon,
} from '@phosphor-icons/react';
import { useTheme } from './theme';
import { DB_KEY, actorOf, useStore } from './store';
import { useRouter } from './router';
import { ROLES, company, currentEmployment, guardById, siteById, slaStatus } from './access';
import {
  Avatar, Badge, Button, DetailHost, IconButton, Kbd, Logo, Wordmark, Modal, OrgMark, PageSkeleton, Segmented, Tabs, Toaster, fromNow, useIsMobile,
  useOutside,
} from './ui';
import { AccountModal, AuthModal, LockScreen, WorkspaceModal } from './auth';
import { EditGuardModal, HireModal } from './modals';

import CompanyDashboard from './views/company/Dashboard';
import Workforce from './views/company/Workforce';
import Sites from './views/company/Sites';
import Recruitment from './views/company/Recruitment';
import Verification from './views/trust/Verification';
import Disputes from './views/trust/Disputes';
import Team from './views/admin/Team';
import Settings from './views/admin/Settings';
import AuditTrail from './views/admin/Audit';
import RegulatorOverview from './views/regulator/Overview';
import Companies from './views/regulator/Companies';
import Escalations from './views/regulator/Escalations';
import GuardProfile from './views/profile/GuardProfile';
import Search from './views/registry/Search';
import Passport from './views/guard/Passport';
import LiveBadge from './views/guard/Badge';
import Consents from './views/guard/Consents';
import Sharing from './views/guard/Sharing';
import Responses from './views/guard/Responses';
import AccessLog from './views/guard/Access';
import ClientSites from './views/client/ClientSites';
import ClientVerify from './views/client/ClientVerify';
import ClientHistory from './views/client/ClientHistory';
import CompanyProfile from './views/detail/CompanyProfile';
import RecordDetail from './views/detail/RecordDetail';

// ------------------------------------------------------------------ navigation
function navFor(db, session) {
  const me = session.companyId;
  if (session.kind === 'staff') {
    const incoming = db.requests.filter((r) => r.toCompanyId === me && r.status === 'pending').length;
    const disputes = db.responses.filter((r) => r.companyId === me && r.status === 'open').length;
    return [
      { group: 'Operations' },
      { key: 'dashboard', label: 'Overview', icon: SquaresFour, tab: true, skel: 'dashboard', page: CompanyDashboard },
      { key: 'workforce', label: 'Workforce', icon: Users, tab: true, page: Workforce },
      { key: 'sites', label: 'Sites & coverage', short: 'Sites', icon: Buildings, page: Sites },
      { key: 'recruitment', label: 'Recruitment', icon: Kanban, page: Recruitment },
      { group: 'Trust network' },
      { key: 'verification', label: 'Verification', icon: ArrowsIcon, tab: true, count: incoming, page: Verification },
      { key: 'disputes', label: 'Guard responses', short: 'Responses', icon: ChatCircleText, count: disputes, page: Disputes },
      { key: 'search', label: 'Network search', short: 'Search', icon: MagnifyingGlass, tab: true, page: Search },
      { group: 'Administration' },
      { key: 'team', label: 'Team & roles', short: 'Team', icon: UsersThree, page: Team },
      { key: 'settings', label: 'Settings & integrations', short: 'Settings', icon: GearSix, page: Settings },
      { key: 'audit', label: 'Audit trail', short: 'Audit', icon: ClockCounterClockwise, page: AuditTrail },
      { key: 'guard', hidden: true, label: 'Passport', skel: 'profile', page: GuardProfile },
      { key: 'company', hidden: true, label: 'Company', skel: 'profile', page: CompanyProfile },
      { key: 'record', hidden: true, label: 'Record', skel: 'profile', page: RecordDetail },
    ];
  }
  if (session.kind === 'guard') {
    const consents = db.requests.filter((r) => r.guardId === session.guardId && r.status === 'awaiting_consent').length;
    return [
      { key: 'passport', label: 'My passport', short: 'Passport', icon: IdentificationCard, tab: true, skel: 'profile', page: Passport },
      { key: 'badge', label: 'Live badge', short: 'Badge', icon: QrCode, tab: true, page: LiveBadge, noSkel: true },
      { key: 'consents', label: 'Consent requests', short: 'Consents', icon: Handshake, tab: true, count: consents, page: Consents },
      { key: 'sharing', label: 'Share my passport', short: 'Sharing', icon: ShareNetwork, page: Sharing },
      { key: 'responses', label: 'My responses', short: 'Responses', icon: ChatCircleText, page: Responses },
      { key: 'access', label: 'Who saw my record', short: 'Access log', icon: Eye, tab: true, page: AccessLog },
      { key: 'company', hidden: true, label: 'Company', skel: 'profile', page: CompanyProfile },
      { key: 'record', hidden: true, label: 'Record', skel: 'profile', page: RecordDetail },
    ];
  }
  if (session.kind === 'client') {
    return [
      { key: 'sites', label: 'My sites', short: 'Sites', icon: Buildings, tab: true, page: ClientSites },
      { key: 'verify', label: 'Check a guard', short: 'Check', icon: ShieldCheck, tab: true, page: ClientVerify, noSkel: true },
      { key: 'history', label: 'Check history', short: 'History', icon: ClockCounterClockwise, tab: true, page: ClientHistory },
      { key: 'company', hidden: true, label: 'Company', skel: 'profile', page: CompanyProfile },
    ];
  }
  const esc = db.responses.filter((r) => r.status === 'escalated').length;
  const pendingCo = db.companies.filter((c) => c.status === 'pending').length;
  return [
    { key: 'overview', label: 'Overview', icon: ChartBar, tab: true, skel: 'dashboard', page: RegulatorOverview },
    { key: 'companies', label: 'Companies', icon: Buildings, tab: true, count: pendingCo, page: Companies },
    { key: 'escalations', label: 'Escalations', icon: Scales, tab: true, count: esc, page: Escalations },
    { key: 'search', label: 'Registry', icon: MagnifyingGlass, tab: true, page: Search },
    { key: 'audit', label: 'Audit trail', short: 'Audit', icon: ClockCounterClockwise, page: AuditTrail },
    { key: 'guard', hidden: true, label: 'Passport', skel: 'profile', page: GuardProfile },
    { key: 'record', hidden: true, label: 'Record', skel: 'profile', page: RecordDetail },
    { key: 'company', hidden: true, label: 'Company', noSkel: true, page: RegulatorCompanyRedirect },
  ];
}
// Regulators see companies in their admin view; send shared company links there.
function RegulatorCompanyRedirect({ id }) {
  const { replace } = useRouter();
  useEffect(() => replace('companies', { id }), [id, replace]);
  return null;
}
function ArrowsIcon(props) {
  return <Handshake {...props} />;
}

// ------------------------------------------------------------------ app
export default function App() {
  const { session, toasts, dismissToast } = useStore();
  return (
    <>
      {session ? <Shell key={`${session.kind}:${session.companyId ?? session.guardId ?? session.clientId ?? ''}`} /> : <Landing />}
      <Toaster toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}

// ------------------------------------------------------------------ shell
function Shell() {
  const { db, session, signOut, toast } = useStore();
  const { route, go, back, replace } = useRouter();
  const mobile = useIsMobile();
  const nav = useMemo(() => navFor(db, session), [db, session]);
  const pages = nav.filter((n) => n.key);
  const home = pages[0].key;
  const current = pages.find((n) => n.key === route.name);
  const [overlay, setOverlay] = useState(null); // 'palette' | 'notifications' | 'account' | 'workspace' | 'db' | 'more' | 'hire' | 'editSelf'
  const [locked, setLocked] = useState(false);
  const actor = actorOf(db, session);
  const user = session.userId ? db.users.find((u) => u.id === session.userId) : null;
  const co = session.kind === 'staff' ? company(db, session.companyId) : null;
  const unread = db.notifications.filter((n) => n.to === actor.address && !n.read).length;

  useEffect(() => {
    if (!current) replace(home);
  }, [current, home, replace]);

  // ⌘K / Ctrl+K opens the command palette; "/" too when not typing.
  useEffect(() => {
    const k = (e) => {
      const typing = /input|textarea|select/i.test(document.activeElement?.tagName);
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault();
        setOverlay('palette');
      }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  // Idle lock
  useEffect(() => {
    const mins = db.settings.idleLockMinutes;
    if (!mins) return;
    let t;
    const reset = () => {
      clearTimeout(t);
      t = setTimeout(() => setLocked(true), mins * 60000);
    };
    const evs = ['mousemove', 'keydown', 'touchstart', 'scroll'];
    evs.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(t);
      evs.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [db.settings.idleLockMinutes]);

  const tabs = pages.filter((n) => n.tab && !n.hidden).slice(0, 4);
  const overflow = pages.filter((n) => !n.hidden && !tabs.includes(n));
  const isDetail = current?.hidden || (route.id && current);
  const Page = current?.page;
  const network = db.settings.network;

  return (
    <div className={`shell ${tabs.length > 1 ? 'has-tabbar' : ''}`}>
      <aside className="sidebar">
        <div className="brand">
          <Wordmark height={30} />
        </div>

        {session.kind === 'staff' ? (
          <button type="button" className="workspace" onClick={() => user.memberships.length > 1 && setOverlay('workspace')} disabled={user.memberships.length < 2}>
            <OrgMark company={co} size={40} />
            <span className="grow">
              <span className="workspace-name">{co.name}</span>
              <span className="workspace-role">
                {user.name} · {ROLES[session.role].label}
                {co.status === 'pending' && ' · awaiting approval'}
              </span>
            </span>
            {user.memberships.length > 1 && <CaretUpDown size={15} className="chev" />}
          </button>
        ) : (
          <div className="workspace static">
            <Avatar name={actor.user || actor.name} seed={actor.avatarSeed} src={actor.avatar} size={40} />
            <span className="grow">
              <span className="workspace-name">{session.kind === 'client' ? actor.name : actor.user || actor.name}</span>
              <span className="workspace-role">{{ guard: 'Security professional', client: user?.name, regulator: 'Regulator' }[session.kind]}</span>
            </span>
          </div>
        )}

        <button type="button" className="search-trigger" onClick={() => setOverlay('palette')}>
          <MagnifyingGlass size={16} />
          <span className="grow">Search…</span>
          <Kbd>Ctrl K</Kbd>
        </button>

        <nav className="side-nav">
          {nav.map((n, i) =>
            n.group ? (
              <div key={i} className="nav-group">
                {n.group}
              </div>
            ) : n.hidden ? null : (
              <button key={n.key} type="button" className={`nav-item ${route.name === n.key ? 'active' : ''}`} onClick={() => go(n.key)}>
                <n.icon size={18} weight={route.name === n.key ? 'fill' : 'regular'} />
                <span className="grow">{n.label}</span>
                {n.count > 0 && <span className="nav-count">{n.count}</span>}
              </button>
            ),
          )}
        </nav>

        <div className="side-foot">
          <button type="button" className="nav-item" onClick={() => setOverlay('db')}>
            <Database size={18} />
            <span className="grow">Session database</span>
            {network !== 'normal' ? <Badge tone="warn">{network}</Badge> : <span className="live-dot" />}
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-left">
            {mobile ? (
              isDetail ? (
                <IconButton icon={ArrowLeft} label="Back" onClick={back} />
              ) : (
                <span className="appbar-logo">
                  <Logo size={28} />
                </span>
              )
            ) : (
              isDetail && (current?.hidden || !route.id) && (
                <Button variant="subtle" size="sm" icon={ArrowLeft} onClick={back}>
                  Back
                </Button>
              )
            )}
            <div className="topbar-title">{current?.short ?? current?.label}</div>
          </div>
          <div className="topbar-right">
            {network !== 'normal' && !mobile && (
              <Badge tone={network === 'flaky' ? 'bad' : 'warn'} icon={network === 'flaky' ? WifiSlash : WifiHigh}>
                Simulated {network} network
              </Badge>
            )}
            {mobile && <IconButton icon={MagnifyingGlass} label="Search" onClick={() => setOverlay('palette')} />}
            <NotificationBell unread={unread} open={overlay === 'notifications'} setOpen={(o) => setOverlay(o ? 'notifications' : null)} />
            <AccountMenu
              actor={actor}
              user={user}
              onAccount={() => (session.kind === 'guard' ? setOverlay('editSelf') : setOverlay('account'))}
              onWorkspace={user?.memberships?.length > 1 ? () => setOverlay('workspace') : null}
              onDb={() => setOverlay('db')}
              onLock={() => setLocked(true)}
              onSignOut={() => {
                signOut();
                toast({ kind: 'info', title: 'Signed out', body: 'Your session data stays in this tab until you close it.' });
              }}
            />
          </div>
        </header>

        {co?.status === 'pending' && (
          <div className="banner">
            <ShieldCheck size={16} />
            <span>
              <b>{co.name}</b> is awaiting regulator approval. You can set up sites and your team, but you can't request records from other employers yet.
            </span>
          </div>
        )}

        <main className="content" id="main">
          <DetailHost key={`${route.name}:${route.id ?? ''}`}>
            {Page && (
              <PageLoader variant={route.id && !current.hidden ? 'profile' : current.skel} skip={current.noSkel}>
                <Page go={go} id={route.id} />
              </PageLoader>
            )}
          </DetailHost>
        </main>
      </div>

      {tabs.length > 1 && (
        <nav className="tabbar" aria-label="Primary">
          {tabs.map((n) => (
            <button key={n.key} type="button" className={`tabbar-item ${route.name === n.key ? 'active' : ''}`} onClick={() => go(n.key)}>
              <span className="tabbar-icon">
                <n.icon size={23} weight={route.name === n.key ? 'fill' : 'regular'} />
                {n.count > 0 && <span className="tabbar-badge">{n.count}</span>}
              </span>
              <span>{n.short ?? n.label}</span>
            </button>
          ))}
          {overflow.length > 0 && (
            <button type="button" className={`tabbar-item ${overflow.some((n) => n.key === route.name) ? 'active' : ''}`} onClick={() => setOverlay('more')}>
              <span className="tabbar-icon">
                <DotsThreeOutline size={23} weight={overflow.some((n) => n.key === route.name) ? 'fill' : 'regular'} />
                {overflow.some((n) => n.count > 0) && <span className="tabbar-dot" />}
              </span>
              <span>More</span>
            </button>
          )}
        </nav>
      )}

      {overlay === 'more' && (
        <Modal title="More" size="sm" onClose={() => setOverlay(null)}>
          <div className="menu-list">
            {overflow.map((n) => (
              <button key={n.key} type="button" className="menu-item big" onClick={() => { setOverlay(null); go(n.key); }}>
                <n.icon size={20} />
                <span className="grow">{n.label}</span>
                {n.count > 0 && <span className="nav-count">{n.count}</span>}
              </button>
            ))}
          </div>
        </Modal>
      )}
      {overlay === 'palette' && <CommandPalette pages={pages.filter((p) => !p.hidden)} onClose={() => setOverlay(null)} onHire={() => setOverlay('hire')} />}
      {overlay === 'notifications' && mobile && <NotificationsSheet onClose={() => setOverlay(null)} />}
      {overlay === 'account' && <AccountModal onClose={() => setOverlay(null)} />}
      {overlay === 'editSelf' && <EditGuardModal guard={guardById(db, session.guardId)} onClose={() => setOverlay(null)} />}
      {overlay === 'workspace' && <WorkspaceModal onClose={() => setOverlay(null)} />}
      {overlay === 'db' && <DbInspector onClose={() => setOverlay(null)} />}
      {overlay === 'hire' && <HireModal onClose={() => setOverlay(null)} onDone={(id) => go('guard', { id })} />}
      {locked && <LockScreen onUnlock={() => setLocked(false)} />}
    </div>
  );
}

function PageLoader({ variant = 'table', skip, children }) {
  const [ready, setReady] = useState(skip);
  useEffect(() => {
    if (skip) return;
    const t = setTimeout(() => setReady(true), 380 + Math.random() * 260);
    return () => clearTimeout(t);
  }, [skip]);
  return ready ? <div className="page-enter">{children}</div> : <PageSkeleton variant={variant} />;
}

// ------------------------------------------------------------------ appearance
const THEME_OPTIONS = [
  { value: 'system', label: 'System', icon: Desktop },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
];

function AppearanceControl() {
  const { pref, setTheme } = useTheme();
  return (
    <div className="appearance">
      <span className="appearance-label">Appearance</span>
      <Segmented value={pref} onChange={setTheme} options={THEME_OPTIONS} className="appearance-seg" />
    </div>
  );
}

/** Compact button that cycles System → Light → Dark (used where there is no account menu). */
function ThemeCycleButton() {
  const { pref, setTheme } = useTheme();
  const i = THEME_OPTIONS.findIndex((o) => o.value === pref);
  const cur = THEME_OPTIONS[i < 0 ? 0 : i];
  const next = THEME_OPTIONS[(i + 1) % THEME_OPTIONS.length];
  return <IconButton icon={cur.icon} label={`Appearance: ${cur.label}. Switch to ${next.label.toLowerCase()}`} onClick={() => setTheme(next.value)} />;
}

// ------------------------------------------------------------------ account menu
function AccountMenu({ actor, user, onAccount, onWorkspace, onDb, onLock, onSignOut }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const mobile = useIsMobile();
  useOutside(ref, () => setOpen(false), open && !mobile);
  const items = (
    <div className="menu-list">
      <div className="menu-header">
        <Avatar name={actor.user || actor.name} seed={actor.avatarSeed} src={actor.avatar} size={40} />
        <div className="grow">
          <b>{actor.user || actor.name}</b>
          <span>{user?.email ?? actor.id}</span>
        </div>
      </div>
      <div className="menu-divider" />
      <button type="button" className="menu-item" onClick={() => { setOpen(false); onAccount(); }}>
        <UserCircle size={18} />
        <span className="grow">{user ? 'Account & security' : 'Edit my profile'}</span>
      </button>
      {onWorkspace && (
        <button type="button" className="menu-item" onClick={() => { setOpen(false); onWorkspace(); }}>
          <Buildings size={18} />
          <span className="grow">Switch workspace</span>
        </button>
      )}
      <button type="button" className="menu-item" onClick={() => { setOpen(false); onDb(); }}>
        <Database size={18} />
        <span className="grow">Session database</span>
      </button>
      <button type="button" className="menu-item" onClick={() => { setOpen(false); onLock(); }}>
        <Key size={18} />
        <span className="grow">Lock session</span>
      </button>
      <div className="menu-divider" />
      <AppearanceControl />
      <div className="menu-divider" />
      <button type="button" className="menu-item danger" onClick={() => { setOpen(false); onSignOut(); }}>
        <SignOut size={18} />
        <span className="grow">Sign out</span>
      </button>
    </div>
  );
  return (
    <div className="menu" ref={ref}>
      <button type="button" className="account-btn" onClick={() => setOpen((o) => !o)} aria-label="Account menu">
        <Avatar name={actor.user || actor.name} seed={actor.avatarSeed} src={actor.avatar} size={32} status="online" />
        {!mobile && <CaretDown size={12} weight="bold" className="chev" />}
      </button>
      {open && !mobile && <div className="menu-pop menu-right account-pop">{items}</div>}
      {open && mobile && (
        <Modal title="Account" size="sm" onClose={() => setOpen(false)}>
          {items}
        </Modal>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ notifications
function useNotifications() {
  const { db, session, mutate } = useStore();
  const addr = actorOf(db, session).address;
  const list = db.notifications.filter((n) => n.to === addr);
  const markAll = () => mutate((d) => d.notifications.forEach((n) => n.to === addr && (n.read = true)));
  const markOne = (id) => mutate((d) => { const n = d.notifications.find((x) => x.id === id); if (n) n.read = true; });
  return { list, markAll, markOne };
}

function NotificationList({ onNavigate }) {
  const { list, markAll, markOne } = useNotifications();
  const { go } = useRouter();
  const [filter, setFilter] = useState('all');
  const shown = filter === 'unread' ? list.filter((n) => !n.read) : list;
  return (
    <div className="notif">
      <div className="notif-head">
        <Segmented value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All' }, { value: 'unread', label: `Unread (${list.filter((n) => !n.read).length})` }]} />
        <button type="button" className="link-btn" onClick={markAll}>
          <Checks size={15} /> Mark all read
        </button>
      </div>
      <div className="notif-list">
        {shown.map((n) => (
          <button
            key={n.id}
            type="button"
            className={`notif-item ${n.read ? '' : 'unread'}`}
            onClick={() => {
              markOne(n.id);
              if (n.link) go(n.link.name, n.link.params ?? {});
              onNavigate?.();
            }}
          >
            <span className="notif-dot" />
            <span className="grow">
              <span className="notif-title">{n.title}</span>
              <span className="notif-body">{n.body}</span>
            </span>
            <span className="notif-time">{fromNow(n.ts)}</span>
          </button>
        ))}
        {!shown.length && <div className="notif-empty">You're all caught up.</div>}
      </div>
    </div>
  );
}

function NotificationBell({ unread, open, setOpen }) {
  const ref = useRef(null);
  const mobile = useIsMobile();
  useOutside(ref, () => setOpen(false), open && !mobile);
  return (
    <div className="menu" ref={ref}>
      <button type="button" className={`icon-btn bell ${open ? 'is-open' : ''}`} onClick={() => setOpen(!open)} aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
        <Bell size={20} weight={unread ? 'fill' : 'regular'} />
        {unread > 0 && <span className="bell-count">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && !mobile && (
        <div className="menu-pop menu-right notif-pop">
          <div className="notif-pop-title">Notifications</div>
          <NotificationList onNavigate={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}

function NotificationsSheet({ onClose }) {
  return (
    <Modal title="Notifications" size="md" onClose={onClose}>
      <NotificationList onNavigate={onClose} />
    </Modal>
  );
}

// ------------------------------------------------------------------ command palette
function CommandPalette({ pages, onClose, onHire }) {
  const { db, session, can } = useStore();
  const { go } = useRouter();
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const listRef = useRef(null);
  const t = q.trim().toLowerCase();

  const results = useMemo(() => {
    const out = [];
    pages
      .filter((p) => !t || p.label.toLowerCase().includes(t))
      .forEach((p) => out.push({ group: 'Pages', label: p.label, icon: p.icon, run: () => go(p.key) }));
    if (session.kind === 'staff' && can('guard.hire') && (!t || 'register hire guard'.includes(t)))
      out.push({ group: 'Actions', label: 'Register or hire a guard', icon: UserPlus, run: onHire });
    if (session.kind === 'staff' || session.kind === 'regulator') {
      db.guards
        .filter((g) => t && (g.name.toLowerCase().includes(t) || g.id.toLowerCase().includes(t) || g.nationalId.toLowerCase().includes(t)))
        .slice(0, 6)
        .forEach((g) => {
          const cur = currentEmployment(db, g.id);
          out.push({ group: 'Guards', label: g.name, sub: `${g.id}${cur ? ' · ' + company(db, cur.companyId).name : ' · available'}`, avatar: g, run: () => go('guard', { id: g.id }) });
        });
    }
    if (session.kind === 'staff') {
      db.sites
        .filter((s) => s.companyId === session.companyId && t && s.name.toLowerCase().includes(t))
        .slice(0, 4)
        .forEach((s) => out.push({ group: 'Sites', label: s.name, sub: `${s.city} · ${s.risk}`, icon: Buildings, run: () => go('sites', { id: s.id }) }));
      db.requests
        .filter((r) => (r.toCompanyId === session.companyId || r.fromCompanyId === session.companyId) && t && guardById(db, r.guardId).name.toLowerCase().includes(t))
        .slice(0, 3)
        .forEach((r) => out.push({ group: 'Verification requests', label: `${guardById(db, r.guardId).name}`, sub: `${company(db, r.fromCompanyId).name} → ${company(db, r.toCompanyId).name} · ${slaStatus(r)?.label ?? r.status}`, icon: Handshake, run: () => go('verification', { id: r.id }) }));
    }
    if (session.kind === 'regulator')
      db.companies
        .filter((c) => t && c.name.toLowerCase().includes(t))
        .forEach((c) => out.push({ group: 'Companies', label: c.name, sub: c.reg, icon: Buildings, run: () => go('companies', { id: c.id }) }));
    return out;
  }, [t, pages, db, session, can, go, onHire]);

  useEffect(() => setI(0), [t]);
  useEffect(() => {
    listRef.current?.querySelector('.is-active')?.scrollIntoView({ block: 'nearest' });
  }, [i]);

  const run = (r) => {
    onClose();
    r.run();
  };

  let lastGroup = null;
  return (
    <Modal size="md" onClose={onClose} className="palette">
      <div className="palette-input">
        <MagnifyingGlass size={20} />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={session.kind === 'staff' || session.kind === 'regulator' ? 'Search guards, sites, requests or pages…' : 'Jump to a page…'}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setI((x) => Math.min(results.length - 1, x + 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setI((x) => Math.max(0, x - 1)); }
            if (e.key === 'Enter' && results[i]) run(results[i]);
          }}
        />
        <IconButton icon={X} label="Close" size={32} onClick={onClose} />
      </div>
      <div className="palette-list" ref={listRef}>
        {results.map((r, idx) => {
          const head = r.group !== lastGroup ? r.group : null;
          lastGroup = r.group;
          return (
            <Fragment key={idx}>
              {head && <div className="palette-group">{head}</div>}
              <button type="button" className={`palette-item ${idx === i ? 'is-active' : ''}`} onMouseEnter={() => setI(idx)} onClick={() => run(r)}>
                {r.avatar ? <Avatar name={r.avatar.name} seed={r.avatar.id} src={r.avatar.avatar} size={28} /> : r.icon && <r.icon size={18} />}
                <span className="grow">
                  <span className="palette-label">{r.label}</span>
                  {r.sub && <span className="palette-sub">{r.sub}</span>}
                </span>
                {idx === i && <ArrowRight size={15} />}
              </button>
            </Fragment>
          );
        })}
        {!results.length && <div className="notif-empty">No matches for “{q}”.</div>}
      </div>
      <div className="palette-foot">
        <span><Kbd>↑</Kbd> <Kbd>↓</Kbd> to move</span>
        <span><Kbd>Enter</Kbd> to open</span>
        <span><Kbd>Esc</Kbd> to close</span>
      </div>
    </Modal>
  );
}

// ------------------------------------------------------------------ database inspector
function DbInspector({ onClose }) {
  const { db, mutate, resetDemo, toast } = useStore();
  const tables = Object.keys(db).filter((k) => Array.isArray(db[k]));
  const [t, setT] = useState('guards');
  const [confirm, setConfirm] = useState(false);
  let bytes = 0;
  try {
    bytes = (sessionStorage.getItem(DB_KEY) ?? '').length;
  } catch {
    /* ignore */
  }
  const exportJson = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'security-force-session-db.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <Modal size="xl" title="Session database" subtitle={`${DB_KEY} · ${(bytes / 1024).toFixed(1)} KB in sessionStorage`} icon={Database} onClose={onClose}
      footer={
        confirm ? (
          <>
            <span className="grow small">Wipe every change, sign out and reload the seed data?</span>
            <Button variant="ghost" size="sm" onClick={() => setConfirm(false)}>Keep data</Button>
            <Button variant="danger" size="sm" onClick={() => { resetDemo(); onClose(); toast({ kind: 'info', title: 'Demo data reset' }); }}>Reset</Button>
          </>
        ) : (
          <>
            <Button variant="ghost" size="sm" icon={DownloadSimple} onClick={exportJson}>Export JSON</Button>
            <span className="grow" />
            <Button variant="danger-ghost" size="sm" onClick={() => setConfirm(true)}>Reset demo data</Button>
          </>
        )
      }
    >
      <div className="db-settings">
        <div className="grow">
          <b>Network simulation</b>
          <p className="muted small">Every save is optimistic: the screen updates at once and confirms after the "server" replies. Flaky mode fails about a third of saves so you can watch the rollback.</p>
        </div>
        <Segmented
          value={db.settings.network}
          onChange={(v) => mutate((d) => (d.settings.network = v))}
          options={[{ value: 'normal', label: 'Normal', icon: Lightning }, { value: 'slow', label: 'Slow', icon: WifiHigh }, { value: 'flaky', label: 'Flaky', icon: WifiSlash }]}
        />
      </div>
      <div className="db-settings">
        <div className="grow">
          <b>Idle lock</b>
          <p className="muted small">Lock the session after a period of inactivity.</p>
        </div>
        <Segmented
          value={String(db.settings.idleLockMinutes)}
          onChange={(v) => mutate((d) => (d.settings.idleLockMinutes = Number(v)))}
          options={[{ value: '1', label: '1 min' }, { value: '15', label: '15 min' }, { value: '0', label: 'Off' }]}
        />
      </div>
      <div className="tabs-scroll">
        <Tabs value={t} onChange={setT} tabs={tables.map((k) => ({ key: k, label: k, count: db[k].length }))} />
      </div>
      <pre className="json">{JSON.stringify(db[t], null, 2)}</pre>
    </Modal>
  );
}

// ------------------------------------------------------------------ landing (signed out)
function Landing() {
  const { db } = useStore();
  const { route } = useRouter();
  const [auth, setAuth] = useState(route.name === 'signin' ? 'choose' : null);
  const open = (k = 'choose') => setAuth(k);
  const deployed = db.employments.filter((e) => !e.end).length;
  const john = guardById(db, 'SG-00048392');
  const sampleEmps = db.employments.filter((e) => e.guardId === john.id).sort((a, b) => b.start.localeCompare(a.start));

  return (
    <div className="landing">
      <header className="land-nav">
        <div className="brand">
          <Wordmark height={36} />
        </div>
        <nav className="land-links">
          <a href="#how">How it works</a>
          <a href="#who">Who it's for</a>
          <a href="#trust">Trust & privacy</a>
        </nav>
        <div className="row gap-s">
          <ThemeCycleButton />
          <Button variant="ghost" onClick={() => open('guard')} className="hide-sm">
            I'm a guard
          </Button>
          <Button onClick={() => open()}>Sign in</Button>
        </div>
      </header>

      <section className="land-hero">
        <div className="land-hero-copy">
          <div className="eyebrow">Private security · Zimbabwe</div>
          <h1>Verify the people you trust with your clients' security.</h1>
          <p className="lead">
            Security Force is a shared, consent-based record of employment, training and conduct for the private security workforce. Every guard gets one Workforce ID and a passport they keep from employer to employer.
          </p>
          <div className="row gap-s wrap">
            <Button size="lg" iconRight={ArrowRight} onClick={() => open('staff')}>
              Sign in as a company
            </Button>
            <Button size="lg" variant="ghost" onClick={() => open('client')}>
              Check a guard at my site
            </Button>
          </div>
          <dl className="land-stats">
            <div><dt>Companies</dt><dd>{db.companies.length}</dd></div>
            <div><dt>Guards deployed</dt><dd>{deployed}</dd></div>
            <div><dt>Client sites</dt><dd>{db.sites.length}</dd></div>
          </dl>
        </div>
        <div className="land-hero-art" aria-hidden="true">
          <div className="mock-doc">
            <div className="mock-top">
              <span className="mock-brand"><Logo size={16} invert /> Security Force</span>
              <span>Professional passport</span>
            </div>
            <div className="mock-body">
              <Avatar name={john.name} seed={john.id} size={84} square />
              <div className="grow">
                <div className="mock-label">Surname / given names</div>
                <div className="mock-name">MOYO <span>John</span></div>
                <div className="mock-id mono">{john.id}</div>
                <div className="row gap-s wrap mt-10">
                  <Badge tone="ok" icon={ShieldCheck}>Licensed</Badge>
                  <Badge tone="ok" dot>4/4 verified</Badge>
                </div>
              </div>
            </div>
            <ol className="mock-timeline">
              {sampleEmps.map((e) => (
                <li key={e.id}>
                  <OrgMark company={company(db, e.companyId)} size={22} />
                  <b>{e.position}</b> · {company(db, e.companyId).name}
                </li>
              ))}
            </ol>
            <div className="mock-mrz mono">P&lt;ZWEMOYO&lt;&lt;JOHN&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;</div>
          </div>
          <div className="mock-float">
            <ShieldCheck size={18} weight="fill" />
            <div>
              <b>Verified at Eastgate Bank Branch</b>
              <span>Zim Commercial Bank · 06:58</span>
            </div>
          </div>
        </div>
      </section>

      <section className="land-section" id="how">
        <div className="land-section-head">
          <div className="eyebrow">How verification works</div>
          <h2>Consent first. Facts, not ratings. Every look is logged.</h2>
        </div>
        <ol className="land-steps">
          {[
            ['Apply', 'A guard applies to a new company with their Workforce ID.'],
            ['Consent', 'The guard approves the request on their phone, scope by scope.'],
            ['Release', 'The previous employer releases exactly what was asked, within 72 hours.'],
            ['Decide', 'The new employer sees verified facts, with the guard’s own responses attached.'],
            ['Expire', 'Access expires after 30 days. The guard can revoke it sooner.'],
          ].map(([t, d], i) => (
            <li key={t}>
              <span className="land-step-no">0{i + 1}</span>
              <b>{t}</b>
              <p>{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="land-section" id="who">
        <div className="land-section-head">
          <div className="eyebrow">Who it's for</div>
          <h2>One network, four points of view.</h2>
        </div>
        <div className="land-grid">
          {[
            [Buildings, 'Security companies', 'Hire faster and safer. Track licences, coverage and conduct, and answer verification requests on time.', 'staff'],
            [IdentificationCard, 'Guards', 'Carry a verified history between jobs. Approve every request, respond to every record, and show a live badge at the gate.', 'guard'],
            [ShieldCheck, 'Clients', 'Confirm that the person at your gate works for your contractor and is assigned to your site, tonight.', 'client'],
            [Scales, 'Regulators', 'Oversee companies, rule on escalated disputes, and audit every release across the network.', 'regulator'],
          ].map(([I, t, d, k]) => (
            <button key={t} type="button" className="land-card" onClick={() => open(k)}>
              <I size={26} />
              <b>{t}</b>
              <p>{d}</p>
              <span className="land-card-cta">
                Sign in <ArrowRight size={14} />
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="land-section land-dark" id="trust">
        <div className="land-section-head">
          <div className="eyebrow">Trust & privacy</div>
          <h2>Built so it can't become a blacklist.</h2>
        </div>
        <ul className="land-principles">
          <li><b>No scores.</b> Employers record facts with evidence references. Nobody gets a star rating.</li>
          <li><b>Consent for every release.</b> Restricted records only move when the guard agrees, and only the scopes they approve.</li>
          <li><b>Right of reply.</b> Guards see every entry and can respond. Unresolved disputes go to the regulator.</li>
          <li><b>Time-limited access.</b> Released records expire. Guards can revoke access at any time.</li>
          <li><b>Full audit trail.</b> Every view, request, release and change is logged, and guards can see who looked.</li>
        </ul>
      </section>

      <footer className="land-foot">
        <span>© 2026 Security Force · demo build</span>
        <span className="muted">All data lives in this browser tab's sessionStorage.</span>
      </footer>

      {auth && <AuthModal initial={auth} onClose={() => setAuth(null)} />}
    </div>
  );
}

