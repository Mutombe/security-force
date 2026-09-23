import { createContext, useCallback, useContext, useEffect, useState } from 'react';

/*
  ROUTER CONTRACT
  const { route, go, back } = useRouter()
  route = { name, id }        e.g. #/guard/SG-00048392 → { name:'guard', id:'SG-00048392' }
  go(name, params?)           params.id becomes the second path segment: go('guard', { id })
  back()                      browser history back (falls back to the home page)
*/

function parse() {
  const h = window.location.hash.replace(/^#\/?/, '');
  const [name = '', ...rest] = h.split('/');
  return { name, id: rest.length ? decodeURIComponent(rest.join('/')) : undefined };
}

const Ctx = createContext(null);

export function RouterProvider({ children }) {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => {
      setRoute(parse());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  const go = useCallback((name, params = {}) => {
    const next = `#/${name}${params.id ? '/' + encodeURIComponent(params.id) : ''}`;
    if (window.location.hash === next) return;
    window.location.hash = next;
  }, []);

  const replace = useCallback((name, params = {}) => {
    const next = `#/${name}${params.id ? '/' + encodeURIComponent(params.id) : ''}`;
    window.history.replaceState(null, '', next);
    setRoute(parse());
  }, []);

  const back = useCallback(() => {
    if (window.history.length > 1) window.history.back();
    else go('');
  }, [go]);

  return <Ctx.Provider value={{ route, go, back, replace }}>{children}</Ctx.Provider>;
}

export const useRouter = () => useContext(Ctx);
