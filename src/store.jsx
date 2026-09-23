import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { seed } from './seed';
import { can as canDo } from './access';
import { nowISO, sleep, uid } from './util';

/*
  STORE CONTRACT (used by every screen)
  ------------------------------------
  const { db, session, can, act, mutate, toast, isPending, go } = useStore()   // `go` comes from useRouter()

  db        – the whole database (plain object of arrays), persisted to sessionStorage.
  session   – { kind:'staff', userId, companyId, role } | { kind:'guard', guardId }
              | { kind:'client', userId, clientId } | { kind:'regulator', userId }

  act({ key, pending, success, apply, touches, undo, failable }) → Promise<boolean>
      Optimistic write. `apply(d, tools)` mutates a draft immediately; the UI updates at once,
      a "saving" toast shows, and after simulated network latency it either confirms
      (success toast, optional Undo) or — when the network is set to "flaky" — rolls back.
        key      – string id of the entity being changed; isPending(key) is true while syncing
        pending  – toast text while syncing, e.g. 'Releasing records…'
        success  – toast text on success (string or (d) => string)
        touches  – collections that apply() changes, e.g. ['requests','grants'] (used for rollback/undo)
        undo     – true to offer Undo for ~6s
      tools = { log(action, detail, extra?), notify(to, { title, body, link }), now, actor }
        notify `to`: 'company:C-AEG' | 'guard:SG-…' | 'client:CL-…' | 'regulator'

  mutate(fn)  – synchronous write with the same (d, tools) signature, no toast. Use for reads-that-log
                (e.g. "Viewed profile") and UI prefs.
  toast({ kind:'success'|'error'|'info'|'loading', title, body?, action?: { label, onClick }, duration? }) → id
*/

export const DB_KEY = 'securityforce.db.v4';
const SESSION_KEY = 'securityforce.session.v3';

function read(key) {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function write(key, value) {
  try {
    if (value == null) sessionStorage.removeItem(key);
    else sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or unavailable — keep working in memory */
  }
}

export function newWorkforceId(db) {
  let id;
  do id = 'SG-' + String(Math.floor(10000000 + Math.random() * 89999999));
  while (db.guards.some((g) => g.id === id));
  return id;
}

export function actorOf(db, session) {
  if (!session) return { name: 'System', user: 'System', role: 'system', id: null, address: null };
  const user = session.userId ? db.users.find((u) => u.id === session.userId) : null;
  if (session.kind === 'staff') {
    const c = db.companies.find((x) => x.id === session.companyId);
    return { name: c?.name ?? 'Company', user: user?.name ?? '', role: 'staff', id: session.companyId, address: `company:${session.companyId}`, avatarSeed: user?.id, avatar: user?.avatar };
  }
  if (session.kind === 'guard') {
    const g = db.guards.find((x) => x.id === session.guardId);
    return { name: g?.name ?? 'Guard', user: g?.name ?? '', role: 'guard', id: session.guardId, address: `guard:${session.guardId}`, avatarSeed: g?.id, avatar: g?.avatar };
  }
  if (session.kind === 'client') {
    const c = db.clients.find((x) => x.id === session.clientId);
    return { name: c?.name ?? 'Client', user: user?.name ?? '', role: 'client', id: session.clientId, address: `client:${session.clientId}`, avatarSeed: user?.id, avatar: user?.avatar };
  }
  return { name: 'Security Regulator', user: user?.name ?? '', role: 'regulator', id: 'REG', address: 'regulator', avatarSeed: user?.id, avatar: user?.avatar };
}

const LATENCY = { normal: [320, 780], slow: [1600, 2600], flaky: [400, 900] };

const Ctx = createContext(null);

export function StoreProvider({ children }) {
  const dbRef = useRef(null);
  if (!dbRef.current) {
    dbRef.current = read(DB_KEY) ?? seed();
    write(DB_KEY, dbRef.current);
  }
  const [db, setDb] = useState(dbRef.current);
  const [session, setSessionState] = useState(() => read(SESSION_KEY));
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const [toasts, setToasts] = useState([]);
  const [pending, setPending] = useState(() => new Set());

  const commit = useCallback((next) => {
    dbRef.current = next;
    write(DB_KEY, next);
    setDb(next);
  }, []);

  const makeTools = (d, added) => {
    const actor = actorOf(d, sessionRef.current);
    return {
      now: nowISO(),
      actor,
      log(action, detail, extra = {}) {
        const id = uid('A');
        added.audit.push(id);
        d.audit.unshift({ id, ts: nowISO(), actor: actor.name, actorUser: actor.user, actorRole: actor.role, actorId: actor.id, action, detail, guardId: null, ...extra });
      },
      notify(to, { title, body = '', link = null }) {
        if (!to || to === actor.address) return;
        const id = uid('N');
        added.notifications.push(id);
        d.notifications.unshift({ id, to, title, body, link, ts: nowISO(), read: false });
      },
    };
  };

  const mutate = useCallback((fn) => {
    const next = structuredClone(dbRef.current);
    fn(next, makeTools(next, { audit: [], notifications: [] }));
    commit(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commit]);

  // ---------- toasts ----------
  const dismissToast = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const updateToast = useCallback((id, patch) => setToasts((t) => t.map((x) => (x.id === id ? { ...x, ...patch, v: (x.v ?? 0) + 1 } : x))), []);
  const toast = useCallback((t) => {
    const id = uid('T');
    setToasts((all) => [...all.slice(-4), { kind: 'info', ...t, id, v: 0 }]);
    return id;
  }, []);

  // ---------- optimistic actions ----------
  const rollback = (before, touches, added) => {
    const next = structuredClone(dbRef.current);
    touches.forEach((c) => (next[c] = structuredClone(before[c])));
    next.audit = next.audit.filter((a) => !added.audit.includes(a.id));
    next.notifications = next.notifications.filter((n) => !added.notifications.includes(n.id));
    commit(next);
  };

  const act = useCallback(
    async ({ key, pending: pendingText = 'Saving…', success = 'Saved', apply, touches = [], undo = false, failable = true }) => {
      const before = dbRef.current;
      const added = { audit: [], notifications: [] };
      const next = structuredClone(before);
      apply(next, makeTools(next, added));
      commit(next);

      if (key) setPending((p) => new Set(p).add(key));
      const tid = toast({ kind: 'loading', title: pendingText });
      const mode = before.settings?.network ?? 'normal';
      const [lo, hi] = LATENCY[mode] ?? LATENCY.normal;
      await sleep(lo + Math.random() * (hi - lo));
      const failed = failable && mode === 'flaky' && Math.random() < 0.35;

      if (key)
        setPending((p) => {
          const n = new Set(p);
          n.delete(key);
          return n;
        });

      if (failed) {
        rollback(before, touches, added);
        updateToast(tid, {
          kind: 'error',
          title: 'Could not reach the server',
          body: 'Your change was rolled back. Nothing was saved.',
          action: { label: 'Retry', onClick: () => act({ key, pending: pendingText, success, apply, touches, undo, failable }) },
        });
        return false;
      }
      const msg = typeof success === 'function' ? success(dbRef.current) : success;
      updateToast(tid, {
        kind: 'success',
        title: msg,
        action: undo
          ? {
              label: 'Undo',
              onClick: () => {
                rollback(before, touches, added);
                toast({ kind: 'info', title: 'Change undone' });
              },
            }
          : undefined,
        duration: undo ? 6500 : 4000,
      });
      return true;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [commit, toast, updateToast],
  );

  const isPending = useCallback((key) => pending.has(key), [pending]);

  // ---------- auth ----------
  const setSession = useCallback((s) => {
    write(SESSION_KEY, s);
    sessionRef.current = s;
    setSessionState(s);
  }, []);

  const signIn = useCallback(
    (s, how = 'password') => {
      setSession(s);
      mutate((d, t) => {
        t.log('Signed in', `${t.actor.user || t.actor.name} signed in (${how})`, { guardId: s.kind === 'guard' ? s.guardId : null });
        if (s.userId) {
          const u = d.users.find((x) => x.id === s.userId);
          if (u) u.lastActiveAt = t.now;
          d.sessions = d.sessions.map((x) => ({ ...x, current: false }));
          d.sessions.unshift({ id: uid('SS'), userId: s.userId, device: navigator.userAgent.includes('Mobile') ? 'Mobile browser' : 'This browser', ip: '196.4.80.12', location: 'Harare, ZW', createdAt: t.now, lastSeenAt: t.now, current: true });
        }
      });
    },
    [mutate, setSession],
  );

  const signOut = useCallback(() => {
    mutate((d, t) => {
      t.log('Signed out', `${t.actor.user || t.actor.name} signed out`);
      d.sessions = d.sessions.filter((x) => !x.current);
    });
    setSession(null);
  }, [mutate, setSession]);

  const switchCompany = useCallback(
    (companyId) => {
      const s = sessionRef.current;
      const u = dbRef.current.users.find((x) => x.id === s.userId);
      const m = u?.memberships.find((x) => x.companyId === companyId);
      if (!m) return;
      setSession({ ...s, companyId, role: m.role });
      mutate((d, t) => t.log('Switched workspace', `${u.name} switched to ${t.actor.name}`));
    },
    [mutate, setSession],
  );

  const resetDemo = useCallback(() => {
    const fresh = seed();
    commit(fresh);
    setSession(null);
  }, [commit, setSession]);

  const can = useCallback((perm) => canDo(session, perm), [session]);

  const value = useMemo(
    () => ({ db, session, can, mutate, act, isPending, toast, toasts, dismissToast, updateToast, signIn, signOut, switchCompany, setSession, resetDemo }),
    [db, session, can, mutate, act, isPending, toast, toasts, dismissToast, updateToast, signIn, signOut, switchCompany, setSession, resetDemo],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useStore = () => useContext(Ctx);
