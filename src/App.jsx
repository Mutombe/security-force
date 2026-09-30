import { useEffect, useRef, useState } from 'react';
import { ArrowCounterClockwise, ArrowLeft, CaretDown, Handshake, IdentificationBadge, MagnifyingGlass, SignOut, Users } from '@phosphor-icons/react';
import { actorOf, useStore } from './store';
import { useRouter } from './router';
import { company, guardById } from './access';
import { Avatar, IconButton, Modal, OrgMark, PageSkeleton, Toaster, Wordmark, useIsMobile, useOutside } from './ui';
import { AppearanceControl, ThemeToggle } from './theme-ui';
import Landing from './views/Landing';
import Check from './views/Check';
import Guards from './views/Guards';
import Profile from './views/Profile';
import Access from './views/Access';
import CompanyPage from './views/CompanyPage';

function MyRecord({ go }) {
  const { session } = useStore();
  return <Profile id={session.guardId} go={go} />;
}

function navFor(db, session) {
  if (session.kind === 'company')
    return [
      { key: 'check', label: 'Check a guard', short: 'Check', icon: MagnifyingGlass, page: Check },
      { key: 'guards', label: 'Your guards', short: 'Guards', icon: Users, page: Guards },
      { key: 'guard', hidden: true, label: 'Guard', page: Profile, skel: 'profile' },
      { key: 'company', hidden: true, label: 'Company', page: CompanyPage, skel: 'profile' },
    ];
  const waiting = db.requests.filter((r) => r.guardId === session.guardId && r.status === 'pending').length;
  return [
    { key: 'me', label: 'My record', short: 'Record', icon: IdentificationBadge, page: MyRecord, skel: 'profile' },
    { key: 'access', label: 'Requests and access', short: 'Requests', icon: Handshake, page: Access, count: waiting },
    { key: 'company', hidden: true, label: 'Company', page: CompanyPage, skel: 'profile' },
  ];
}

export default function App() {
  const { session, toasts, dismissToast } = useStore();
  return (
    <>
      {session ? <Shell key={`${session.kind}:${session.companyId ?? session.guardId}`} /> : <Landing />}
      <Toaster toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}

function Shell() {
  const { db, session } = useStore();
  const { route, go, back, replace } = useRouter();
  const mobile = useIsMobile();
  const nav = navFor(db, session);
  const tabs = nav.filter((n) => !n.hidden);
  const current = nav.find((n) => n.key === route.name);

  useEffect(() => {
    if (!current) replace(tabs[0].key);
  }, [current, tabs, replace]);

  const Page = current?.page;
  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-inner">
          {mobile && current?.hidden ? <IconButton icon={ArrowLeft} label="Back" onClick={back} /> : <a href="#/" className="brand-link" aria-label="ProCheQ home"><Wordmark height={mobile ? 24 : 28} /></a>}
          {!mobile && (
            <nav className="topnav" aria-label="Main">
              {tabs.map((n) => (
                <a key={n.key} href={`#/${n.key}`} className={`topnav-item ${route.name === n.key ? 'active' : ''}`}>
                  <n.icon size={18} weight={route.name === n.key ? 'fill' : 'regular'} />
                  {n.label}
                  {n.count > 0 && <span className="nav-count">{n.count}</span>}
                </a>
              ))}
            </nav>
          )}
          <div className="topbar-right">
            {!mobile && <ThemeToggle />}
            <AccountMenu />
          </div>
        </div>
      </header>

      <main className="content">
        {!mobile && current?.hidden && (
          <button type="button" className="back-link" onClick={back}>
            <ArrowLeft size={16} /> Back
          </button>
        )}
        {Page && (
          <PageLoader key={`${route.name}:${route.id ?? ''}`} variant={current.skel}>
            <Page go={go} id={route.id} />
          </PageLoader>
        )}
      </main>

      {mobile && (
        <nav className="tabbar" aria-label="Main">
          {tabs.map((n) => (
            <a key={n.key} href={`#/${n.key}`} className={`tabbar-item ${route.name === n.key ? 'active' : ''}`}>
              <span className="tabbar-icon">
                <n.icon size={24} weight={route.name === n.key ? 'fill' : 'regular'} />
                {n.count > 0 && <span className="tabbar-badge">{n.count}</span>}
              </span>
              <span>{n.short}</span>
            </a>
          ))}
        </nav>
      )}
    </div>
  );
}

function PageLoader({ variant = 'table', children }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 260 + Math.random() * 200);
    return () => clearTimeout(t);
  }, []);
  return ready ? <div className="page-enter">{children}</div> : <PageSkeleton variant={variant} />;
}

function AccountMenu() {
  const { db, session, signOut, resetDemo, toast } = useStore();
  const [open, setOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const ref = useRef(null);
  const mobile = useIsMobile();
  useOutside(ref, () => setOpen(false), open && !mobile);
  const actor = actorOf(db, session);
  const co = session.kind === 'company' ? company(db, session.companyId) : null;
  const g = session.kind === 'guard' ? guardById(db, session.guardId) : null;
  const badge = co ? <OrgMark company={co} size={34} /> : <Avatar name={g.name} seed={g.id} src={g.avatar} size={34} />;

  const panel = (
    <div className="menu-list">
      <div className="menu-header">
        {co ? <OrgMark company={co} size={42} /> : <Avatar name={g.name} seed={g.id} size={42} />}
        <div className="grow">
          <b>{actor.person}</b>
          <span>{co ? co.name : <span className="mono">{g.id}</span>}</span>
        </div>
      </div>
      <div className="menu-divider" />
      <AppearanceControl />
      <div className="menu-divider" />
      {confirmReset ? (
        <div className="menu-confirm">
          <span>Reset all demo data and sign out?</span>
          <div className="row gap-s">
            <button type="button" className="link-btn" onClick={() => setConfirmReset(false)}>Keep</button>
            <button type="button" className="link-btn danger" onClick={() => { resetDemo(); toast({ kind: 'info', title: 'Demo data reset' }); }}>Reset</button>
          </div>
        </div>
      ) : (
        <button type="button" className="menu-item" onClick={() => setConfirmReset(true)}>
          <ArrowCounterClockwise size={18} />
          <span className="grow">Reset demo data</span>
        </button>
      )}
      <button type="button" className="menu-item danger" onClick={signOut}>
        <SignOut size={18} />
        <span className="grow">Sign out</span>
      </button>
    </div>
  );

  return (
    <div className="menu" ref={ref}>
      <button type="button" className="account-btn" onClick={() => setOpen((o) => !o)} aria-label="Account menu">
        {badge}
        {!mobile && (
          <span className="account-text">
            <b>{actor.person}</b>
            <span>{co ? co.name : 'Security guard'}</span>
          </span>
        )}
        {!mobile && <CaretDown size={12} weight="bold" className="chev" />}
      </button>
      {open && !mobile && <div className="menu-pop menu-right account-pop">{panel}</div>}
      {open && mobile && (
        <Modal title="Account" size="sm" onClose={() => setOpen(false)}>
          {panel}
        </Modal>
      )}
    </div>
  );
}
