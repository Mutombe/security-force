import { Desktop, Moon, Sun } from '@phosphor-icons/react';
import { useTheme } from './theme';
import { IconButton, Segmented } from './ui';

const OPTIONS = [
  { value: 'system', label: 'System', icon: Desktop },
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
];

/** One button that cycles System → Light → Dark. */
export function ThemeToggle() {
  const { pref, setTheme } = useTheme();
  const i = Math.max(0, OPTIONS.findIndex((o) => o.value === pref));
  const cur = OPTIONS[i];
  const next = OPTIONS[(i + 1) % OPTIONS.length];
  return <IconButton icon={cur.icon} label={`Appearance: ${cur.label}. Switch to ${next.label.toLowerCase()}`} onClick={() => setTheme(next.value)} />;
}

export function AppearanceControl() {
  const { pref, setTheme } = useTheme();
  return (
    <div className="appearance">
      <span className="appearance-label">Appearance</span>
      <Segmented value={pref} onChange={setTheme} options={OPTIONS} className="appearance-seg" />
    </div>
  );
}
