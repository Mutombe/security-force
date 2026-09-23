import { useEffect, useState } from 'react';

// Appearance preference: 'system' (default — follows the device), 'light' or 'dark'.
// Stored per browser in localStorage; applied as <html data-theme> (absent for system).
const KEY = 'securityforce.theme';
const media = () => window.matchMedia('(prefers-color-scheme: dark)');

export function getTheme() {
  try {
    return localStorage.getItem(KEY) || 'system';
  } catch {
    return 'system';
  }
}

export const effectiveTheme = (pref = getTheme()) => (pref === 'system' ? (media().matches ? 'dark' : 'light') : pref);

export function applyTheme(pref = getTheme()) {
  const root = document.documentElement;
  if (pref === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', pref);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', effectiveTheme(pref) === 'dark' ? '#0e1014' : '#f6f5f1');
}

export function setTheme(pref) {
  try {
    localStorage.setItem(KEY, pref);
  } catch {
    /* private mode — still apply for this page */
  }
  applyTheme(pref);
  window.dispatchEvent(new CustomEvent('sf-theme', { detail: pref }));
}

export function useTheme() {
  const [pref, setPref] = useState(getTheme);
  const [dark, setDark] = useState(() => effectiveTheme() === 'dark');
  useEffect(() => {
    const sync = () => {
      const p = getTheme();
      setPref(p);
      setDark(effectiveTheme(p) === 'dark');
      applyTheme(p);
    };
    const mq = media();
    mq.addEventListener('change', sync);
    window.addEventListener('sf-theme', sync);
    window.addEventListener('storage', sync);
    return () => {
      mq.removeEventListener('change', sync);
      window.removeEventListener('sf-theme', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  return { pref, dark, setTheme };
}
