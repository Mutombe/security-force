import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { seed } from './seed';
import { nowISO, sleep, uid } from './util';

/*
  STORE
  const { db, session, act, mutate, toast, signIn, signOut, resetDemo } = useStore()

  db       – the whole database, kept in this tab's sessionStorage.
  session  – { kind: 'company', userId, companyId } | { kind: 'guard', guardId } | null (public visitor)

  act({ pending, success, apply, touches, undo }) – instant ("optimistic") save:
    apply(draft, tools) changes a copy of the db, the screen updates at once, a toast confirms,
    and Undo restores the `touches` collections. tools = { now, actor, log(action, detail, extra) }.
  mutate(fn) – the same without a toast (used for view logs).
*/

export const DB_KEY = 'procheq.db.v1';
const SESSION_KEY = 'procheq.session.v1';

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
    /* storage unavailable — keep working in memory */
  }
}

export function newProcheqId(db) {
  let id;
  do id = 'PQ-' + String(Math.floor(100000 + Math.random() * 899999));
  while (db.guards.some((g) => g.id === id));
  return id;
}

export function actorOf(db, session) {
  if (session?.kind === 'company') {
    const c = db.companies.find((x) => x.id === session.companyId);
    const u = db.users.find((x) => x.id === session.userId);
    return { kind: 'company', name: c?.name ?? 'Company', person: u?.name ?? '', id: session.companyId };
  }
  if (session?.kind === 'guard') {
    const g = db.guards.find((x) => x.id === session.guardId);
    return { kind: 'guard', name: g?.name ?? 'Guard', person: g?.name ?? '', id: session.guardId };
  }
  return { kind: 'public', name: 'Public check', person: '', id: null };
}

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

  const commit = useCallback((next) => {
    dbRef.current = next;
    write(DB_KEY, next);
    setDb(next);
  }, []);

  const tools = (d, added) => {
    const actor = actorOf(d, sessionRef.current);
    return {
      now: nowISO(),
      actor,
      log(action, detail, extra = {}) {
        const id = uid('A');
        added.push(id);
        d.activity.unshift({ id, at: nowISO(), actor: actor.name, person: actor.person, actorKind: actor.kind, actorId: actor.id, action, detail, guardId: null, ...extra });
      },
    };
  };

  const mutate = useCallback(
    (fn) => {
      const next = structuredClone(dbRef.current);
      fn(next, tools(next, []));
      commit(next);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [commit],
  );

  const dismissToast = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const updateToast = useCallback((id, patch) => setToasts((t) => t.map((x) => (x.id === id ? { ...x, ...patch, v: (x.v ?? 0) + 1 } : x))), []);
  const toast = useCallback((t) => {
    const id = uid('T');
    setToasts((all) => [...all.slice(-3), { kind: 'info', ...t, id, v: 0 }]);
    return id;
  }, []);

  const act = useCallback(
    async ({ pending = 'Saving…', success = 'Saved', apply, touches = [], undo = false }) => {
      const before = dbRef.current;
      const added = [];
      const next = structuredClone(before);
      apply(next, tools(next, added));
      commit(next);
      const tid = toast({ kind: 'loading', title: pending });
      await sleep(350 + Math.random() * 350);
      updateToast(tid, {
        kind: 'success',
        title: typeof success === 'function' ? success(dbRef.current) : success,
        duration: undo ? 6500 : 3500,
        action: undo
          ? {
              label: 'Undo',
              onClick: () => {
                const back = structuredClone(dbRef.current);
                touches.forEach((c) => (back[c] = structuredClone(before[c])));
                back.activity = back.activity.filter((a) => !added.includes(a.id));
                commit(back);
                toast({ kind: 'info', title: 'Change undone' });
              },
            }
          : undefined,
      });
      return true;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [commit, toast, updateToast],
  );

  const setSession = useCallback((s) => {
    write(SESSION_KEY, s);
    sessionRef.current = s;
    setSessionState(s);
  }, []);

  const signIn = useCallback(
    (s) => {
      setSession(s);
      mutate((d, t) => t.log('Signed in', `${t.actor.person || t.actor.name} signed in`, s.kind === 'guard' ? { guardId: s.guardId } : {}));
    },
    [mutate, setSession],
  );
  const signOut = useCallback(() => setSession(null), [setSession]);

  const resetDemo = useCallback(() => {
    commit(seed());
    setSession(null);
  }, [commit, setSession]);

  const value = useMemo(
    () => ({ db, session, mutate, act, toast, toasts, dismissToast, signIn, signOut, resetDemo }),
    [db, session, mutate, act, toast, toasts, dismissToast, signIn, signOut, resetDemo],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useStore = () => useContext(Ctx);
