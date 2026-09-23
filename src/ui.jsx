/*
  UI KIT — import from '../../ui' in screens.
  Icons: import Phosphor icons directly, e.g. `import { Users, Plus } from '@phosphor-icons/react'`
         and render <Users size={18} />. <Icon name="Users"/> works for the names in ICONS below.
  Buttons: <Button variant="primary|ghost|danger|danger-ghost|subtle" size="sm|md|lg" icon={Plus}
           loading disabledReason="…">  (disabledReason disables + explains in a tooltip)
  Avatars: <Avatar name seed src size ring /> (illustrated portrait from `seed`, or uploaded `src`)
           <OrgMark company size />
  Overlays: <Modal title size="sm|md|lg|xl" onClose footer> (always centred), <Drawer …> = full detail page,
            <ConfirmModal title body confirmLabel tone="danger" requireText onConfirm onClose>
  Data: <DataTable columns rows … /> — sortable, selectable, paginated, cards on mobile.
  Loading: usePageLoading(key) → boolean; <Skeleton w h/>, <SkeletonRows n/>, <PageSkeleton variant/>
*/
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { createAvatar } from '@dicebear/core';
import * as notionists from '@dicebear/notionists';
import {
  ArrowLeft, ArrowsLeftRight, Bell, Buildings, CaretDown, CaretLeft, CaretRight, CaretUp, CaretUpDown, Check as CheckIcon,
  CheckCircle, CircleNotch, ClockCounterClockwise, Copy, DotsThree, Flag, GraduationCap, IdentificationCard, Info,
  LockSimple, MagnifyingGlass, Medal, ShieldCheck, Users, Warning, WarningCircle, X, XCircle,
} from '@phosphor-icons/react';
import { initials } from './util';

export * from './util';

export const ICONS = {
  ArrowsLeftRight, Bell, Buildings, ClockCounterClockwise, Flag, GraduationCap, IdentificationCard, Info,
  LockSimple, MagnifyingGlass, Medal, ShieldCheck, Users, Warning, WarningCircle, CheckCircle, XCircle,
};
export function Icon({ name, ...rest }) {
  const C = ICONS[name] ?? Info;
  return <C {...rest} />;
}

// ---------- hooks ----------
export function useIsMobile(query = '(max-width: 860px)') {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return m;
}

/** Re-renders every `ms` — for countdowns and live codes. */
export function useNow(ms = 1000) {
  const [n, setN] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setN(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return n;
}

/** Simulated fetch on first view of a page: true for ~450ms whenever `key` changes. */
export function usePageLoading(key, ms = 450) {
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => setLoading(false), ms + Math.random() * 250);
    return () => clearTimeout(t);
  }, [key, ms]);
  return loading;
}

export function useOutside(ref, onOutside, active = true) {
  useEffect(() => {
    if (!active) return;
    const h = (e) => ref.current && !ref.current.contains(e.target) && onOutside(e);
    document.addEventListener('mousedown', h);
    document.addEventListener('touchstart', h);
    return () => {
      document.removeEventListener('mousedown', h);
      document.removeEventListener('touchstart', h);
    };
  }, [ref, onOutside, active]);
}

// ---------- brand ----------
export function Logo({ size = 30, invert }) {
  return <img src="/brand/mark.png" alt="Security Force" className={`logo-mark ${invert ? 'is-invert' : ''}`} style={{ height: size, width: 'auto' }} draggable="false" />;
}

/** Full "SECURITY FORCE" lockup. variant: 'horizontal' | 'stacked' */
export function Wordmark({ height = 34, variant = 'horizontal', invert }) {
  return (
    <img
      src={variant === 'stacked' ? '/brand/lockup-stacked.png' : '/brand/lockup.png'}
      alt="Security Force"
      className={`logo-lockup ${invert ? 'is-invert' : ''}`}
      style={{ height, width: 'auto' }}
      draggable="false"
    />
  );
}

// ---------- avatars ----------
const avatarCache = new Map();
const BG = ['e8e2d5', 'dfe7ee', 'e6e0ee', 'dcebe2', 'f1e3d6', 'e3e6ea'];
function portrait(seed) {
  if (!avatarCache.has(seed)) {
    let h = 0;
    for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    avatarCache.set(seed, createAvatar(notionists, { seed, backgroundColor: [BG[h % BG.length]], scale: 110 }).toDataUri());
  }
  return avatarCache.get(seed);
}

export function Avatar({ name = '', seed, src, size = 36, ring, status, square }) {
  const url = src || (seed ? portrait(seed) : null);
  return (
    <span
      className={`avatar ${square ? 'avatar-sq' : ''}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36), '--ring': ring ?? 'transparent' }}
      title={name}
    >
      {url ? <img src={url} alt="" draggable="false" /> : initials(name)}
      {status && <span className={`avatar-status ${status}`} />}
    </span>
  );
}

/** Company mark: the company's logo when it has one, otherwise a coloured monogram. */
export function OrgMark({ company, size = 32 }) {
  if (!company) return null;
  if (company.logo)
    return (
      <span className="orgmark orgmark-logo" style={{ width: size, height: size, padding: Math.max(2, Math.round(size * 0.1)) }} title={company.name}>
        <img src={company.logo} alt={company.name} draggable="false" />
      </span>
    );
  return (
    <span className="orgmark" style={{ width: size, height: size, fontSize: Math.round(size * 0.4), background: company.color }} title={company.name}>
      {initials(company.name)}
    </span>
  );
}

export function AvatarStack({ people, max = 4, size = 26 }) {
  const shown = people.slice(0, max);
  return (
    <span className="avatar-stack">
      {shown.map((p) => (
        <Avatar key={p.id} name={p.name} seed={p.id} src={p.avatar} size={size} />
      ))}
      {people.length > max && <span className="avatar-more" style={{ width: size, height: size }}>+{people.length - max}</span>}
    </span>
  );
}

// ---------- primitives ----------
export function Button({ variant = 'primary', size = 'md', icon: IconC, iconRight: IconR, loading, disabledReason, disabled, className = '', children, ...rest }) {
  const isDisabled = disabled || loading || !!disabledReason;
  return (
    <button
      type="button"
      className={`btn btn-${variant} btn-${size} ${loading ? 'is-loading' : ''} ${className}`}
      disabled={isDisabled}
      title={disabledReason}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <CircleNotch className="spin" size={16} weight="bold" /> : IconC && <IconC size={size === 'sm' ? 15 : 17} weight="bold" />}
      {children && <span>{children}</span>}
      {IconR && !loading && <IconR size={15} weight="bold" />}
    </button>
  );
}

export function IconButton({ icon: IconC, label, onClick, size = 36, className = '', ...rest }) {
  return (
    <button type="button" className={`icon-btn ${className}`} style={{ width: size, height: size }} onClick={onClick} aria-label={label} title={label} {...rest}>
      <IconC size={Math.round(size * 0.5)} />
    </button>
  );
}

export function Badge({ tone = 'neutral', dot, icon: IconC, children, title }) {
  return (
    <span className={`badge badge-${tone}`} title={title}>
      {dot && <span className="badge-dot" />}
      {IconC && <IconC size={12} weight="bold" />}
      {children}
    </span>
  );
}

export function Locked({ children = 'Restricted' }) {
  return (
    <span className="badge badge-locked" title="Restricted — released only through an approved verification or a share code">
      <LockSimple size={11} weight="bold" /> {children}
    </span>
  );
}

export function Spinner({ size = 16 }) {
  return <CircleNotch className="spin" size={size} weight="bold" />;
}

export function Kbd({ children }) {
  return <kbd className="kbd">{children}</kbd>;
}

export function Meter({ value, tone, max = 100, label }) {
  const t = tone ?? (value >= 90 ? 'ok' : value >= 80 ? 'warn' : 'bad');
  return (
    <span className="meter" title={label}>
      <span className={`meter-bar ${t}`}>
        <span style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
      </span>
      <span className="meter-val">{label ?? `${value}%`}</span>
    </span>
  );
}

export function Toggle({ checked, onChange, label, disabled }) {
  return (
    <label className={`toggle ${disabled ? 'is-disabled' : ''}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track">
        <span className="toggle-thumb" />
      </span>
      {label && <span className="toggle-label">{label}</span>}
    </label>
  );
}

export function CopyButton({ text, label = 'Copy' }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="copy-btn"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          /* clipboard blocked */
        }
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? <CheckIcon size={14} weight="bold" /> : <Copy size={14} />}
      {done ? 'Copied' : label}
    </button>
  );
}

// ---------- layout ----------
export function Card({ title, subtitle, actions, children, className = '', flush, icon: IconC }) {
  return (
    <section className={`card ${flush ? 'card-flush' : ''} ${className}`}>
      {(title || actions) && (
        <header className="card-head">
          <div className="card-title">
            {IconC && <IconC size={17} className="card-icon" />}
            <div>
              <h3>{title}</h3>
              {subtitle && <p className="card-sub">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="card-actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageHead({ eyebrow, title, sub, actions, meta }) {
  return (
    <div className="page-head">
      <div className="page-head-text">
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {sub && <p className="page-sub">{sub}</p>}
        {meta && <div className="page-meta">{meta}</div>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, tone, icon: IconC, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag className={`stat ${tone ? 'stat-' + tone : ''} ${onClick ? 'stat-click' : ''}`} onClick={onClick}>
      <div className="stat-top">
        <span className="stat-label">{label}</span>
        {IconC && <IconC size={16} className="stat-icon" />}
      </div>
      <div className="stat-value">{value}</div>
      {hint && <div className="stat-hint">{hint}</div>}
    </Tag>
  );
}

export function EmptyState({ icon: IconC = Info, title, body, action, compact }) {
  return (
    <div className={`empty ${compact ? 'empty-compact' : ''}`}>
      <span className="empty-icon">
        <IconC size={compact ? 18 : 22} />
      </span>
      {title && <div className="empty-title">{title}</div>}
      {body && <p className="empty-body">{body}</p>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}
export const Empty = ({ children }) => <EmptyState compact body={children} />;

export function Check({ ok, label }) {
  return (
    <div className={`check ${ok ? 'ok' : 'no'}`}>
      <span className="check-box">{ok && <CheckIcon size={11} weight="bold" />}</span>
      {label}
    </div>
  );
}

export function Field({ label, children, hint, error, optional, className = '' }) {
  return (
    <label className={`field ${error ? 'has-error' : ''} ${className}`}>
      {label && (
        <span className="field-label">
          {label}
          {optional && <span className="field-optional">Optional</span>}
        </span>
      )}
      {children}
      {error ? <span className="field-error">{error}</span> : hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function Tabs({ tabs, value, onChange, className = '' }) {
  return (
    <div className={`tabs ${className}`} role="tablist">
      {tabs.map((t) => (
        <button key={t.key} type="button" role="tab" aria-selected={value === t.key} className={`tab ${value === t.key ? 'active' : ''}`} onClick={() => onChange(t.key)}>
          {t.icon && <t.icon size={15} />}
          {t.label}
          {t.count != null && <span className={`tab-count ${t.alert ? 'alert' : ''}`}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

/** Underlined page-level tabs (profile sections etc). */
export function NavTabs({ tabs, value, onChange }) {
  return (
    <div className="navtabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.key} type="button" role="tab" aria-selected={value === t.key} className={`navtab ${value === t.key ? 'active' : ''}`} onClick={() => onChange(t.key)}>
          {t.label}
          {t.count != null && <span className="navtab-count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function Segmented({ options, value, onChange, className = '' }) {
  return (
    <div className={`seg ${className}`}>
      {options.map((o) => {
        const opt = typeof o === 'string' ? { value: o, label: o } : o;
        return (
          <button key={opt.value} type="button" className={`seg-btn ${value === opt.value ? 'on' : ''}`} onClick={() => onChange(opt.value)}>
            {opt.icon && <opt.icon size={15} />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search', big, autoFocus, className = '' }) {
  return (
    <div className={`search ${big ? 'search-big' : ''} ${className}`}>
      <MagnifyingGlass size={big ? 20 : 16} />
      <input value={value} autoFocus={autoFocus} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      {value && (
        <button type="button" className="search-clear" onClick={() => onChange('')} aria-label="Clear search">
          <X size={14} />
        </button>
      )}
    </div>
  );
}

/** Compact labelled select for toolbars. options: [{value,label}] or strings. */
export function FilterSelect({ label, value, onChange, options }) {
  return (
    <label className={`filter-select ${value ? 'is-set' : ''}`}>
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => {
          const opt = typeof o === 'string' ? { value: o, label: o } : o;
          return (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          );
        })}
      </select>
      <CaretDown size={12} weight="bold" />
    </label>
  );
}

// ---------- overlays ----------
function useLockScroll() {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);
}
function useEscape(onClose) {
  const ref = useRef(onClose);
  ref.current = onClose;
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && ref.current?.();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
}

export function Modal({ title, subtitle, onClose, children, footer, size = 'md', icon: IconC, className = '', dismissable = true }) {
  useLockScroll();
  useEscape(dismissable ? onClose : null);
  return createPortal(
    <div className="overlay" onMouseDown={dismissable ? onClose : undefined}>
      <div className={`modal modal-${size} ${className}`} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} onMouseDown={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        {title && (
          <header className="modal-head">
            {IconC && (
              <span className="modal-icon">
                <IconC size={20} />
              </span>
            )}
            <div className="grow">
              <h3>{title}</h3>
              {subtitle && <p className="modal-sub">{subtitle}</p>}
            </div>
            {dismissable && <IconButton icon={X} label="Close" onClick={onClose} className="modal-close" />}
          </header>
        )}
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}

/*
  Detail views are full pages, not side panels. <Drawer> keeps its API but renders into the
  shell's detail slot (hiding the list behind it) with a back button, header and sticky action bar.
*/
export const DetailContext = createContext(null);

export function DetailHost({ children }) {
  const [host, setHost] = useState(null);
  const [open, setOpen] = useState(0);
  const ctx = useMemo(() => ({ host, enter: () => setOpen((n) => n + 1), leave: () => setOpen((n) => Math.max(0, n - 1)) }), [host]);
  return (
    <DetailContext.Provider value={ctx}>
      <div className="page-slot" hidden={open > 0}>
        {children}
      </div>
      <div ref={setHost} className="detail-root" />
    </DetailContext.Provider>
  );
}

export function Drawer({ title, subtitle, onClose, children, footer, headerExtra, backLabel = 'Back' }) {
  const ctx = useContext(DetailContext);
  useEscape(onClose);
  useEffect(() => {
    if (!ctx) return undefined;
    const y = window.scrollY;
    ctx.enter();
    window.scrollTo(0, 0);
    return () => {
      ctx.leave();
      requestAnimationFrame(() => window.scrollTo(0, y));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!ctx?.host)
    return (
      <Modal title={title} subtitle={subtitle} onClose={onClose} footer={footer} size="xl">
        {children}
      </Modal>
    );
  return createPortal(
    <article className="detail page-enter" aria-label={typeof title === 'string' ? title : undefined}>
      <header className="detail-head">
        <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={onClose} className="detail-back">
          {backLabel}
        </Button>
        <div className="detail-title">
          <div className="grow">
            <h1>{title}</h1>
            {subtitle && <p className="page-sub">{subtitle}</p>}
          </div>
          {headerExtra && <div className="detail-extra">{headerExtra}</div>}
        </div>
      </header>
      <div className="detail-body">{children}</div>
      {footer && <footer className="detail-foot">{footer}</footer>}
    </article>,
    ctx.host,
  );
}

export function ConfirmModal({ title, body, confirmLabel = 'Confirm', tone = 'danger', requireText, onConfirm, onClose, icon }) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const ok = !requireText || typed.trim().toLowerCase() === requireText.toLowerCase();
  return (
    <Modal
      size="sm"
      title={title}
      icon={icon ?? (tone === 'danger' ? WarningCircle : Info)}
      className={`confirm confirm-${tone}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            disabled={!ok}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              await onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {typeof body === 'string' ? <p className="confirm-body">{body}</p> : body}
      {requireText && (
        <Field label={<>Type <b className="mono">{requireText}</b> to confirm</>}>
          <input value={typed} onChange={(e) => setTyped(e.target.value)} autoFocus autoComplete="off" />
        </Field>
      )}
    </Modal>
  );
}

/** Dropdown actions menu. items: [{ label, icon, onClick, danger, disabled, hint, divider }] */
export function Menu({ items, label = 'More actions', trigger, align = 'right' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const mobile = useIsMobile();
  useOutside(ref, () => setOpen(false), open && !mobile);
  const visible = items.filter(Boolean);
  const list = (
    <div className="menu-list" role="menu">
      {visible.map((it, i) =>
        it.divider ? (
          <div key={i} className="menu-divider" />
        ) : (
          <button
            key={i}
            type="button"
            role="menuitem"
            className={`menu-item ${it.danger ? 'danger' : ''}`}
            disabled={it.disabled}
            title={it.hint}
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
              it.onClick?.();
            }}
          >
            {it.icon && <it.icon size={17} />}
            <span className="grow">{it.label}</span>
            {it.disabled && it.hint && <LockSimple size={13} className="menu-lock" />}
          </button>
        ),
      )}
    </div>
  );
  return (
    <div className="menu" ref={ref} onClick={(e) => e.stopPropagation()}>
      {trigger ? (
        <span onClick={() => setOpen((o) => !o)}>{trigger}</span>
      ) : (
        <IconButton icon={DotsThree} label={label} size={32} onClick={() => setOpen((o) => !o)} className={open ? 'is-open' : ''} />
      )}
      {open && !mobile && <div className={`menu-pop menu-${align}`}>{list}</div>}
      {open && mobile && (
        <Modal title={label} size="sm" onClose={() => setOpen(false)}>
          {list}
        </Modal>
      )}
    </div>
  );
}

// ---------- skeletons ----------
export function Skeleton({ w = '100%', h = 14, r = 6, className = '' }) {
  return <span className={`skel ${className}`} style={{ width: w, height: h, borderRadius: r }} />;
}
export function SkeletonRows({ n = 6, avatar = true }) {
  return (
    <div className="skel-rows">
      {Array.from({ length: n }, (_, i) => (
        <div className="skel-row" key={i}>
          {avatar && <Skeleton w={34} h={34} r={17} />}
          <div className="grow">
            <Skeleton w={`${40 + ((i * 17) % 35)}%`} h={12} />
            <Skeleton w={`${25 + ((i * 11) % 25)}%`} h={10} className="mt-6" />
          </div>
          <Skeleton w={70} h={22} r={4} />
        </div>
      ))}
    </div>
  );
}
export function PageSkeleton({ variant = 'table' }) {
  return (
    <div className="stack skel-page" aria-busy="true" aria-label="Loading">
      <div>
        <Skeleton w={120} h={10} />
        <Skeleton w={260} h={26} className="mt-10" />
        <Skeleton w="min(520px, 90%)" h={12} className="mt-10" />
      </div>
      {variant === 'dashboard' && (
        <div className="skel-stats">
          {[0, 1, 2, 3].map((i) => (
            <div className="card" key={i}>
              <Skeleton w="50%" h={10} />
              <Skeleton w="35%" h={26} className="mt-10" />
            </div>
          ))}
        </div>
      )}
      {variant === 'profile' ? (
        <div className="card">
          <div className="row gap">
            <Skeleton w={96} h={120} r={8} />
            <div className="grow">
              <Skeleton w="40%" h={22} />
              <Skeleton w="60%" h={12} className="mt-10" />
              <Skeleton w="50%" h={12} className="mt-10" />
            </div>
          </div>
        </div>
      ) : (
        <div className="card card-flush">
          <SkeletonRows n={variant === 'dashboard' ? 4 : 7} />
        </div>
      )}
    </div>
  );
}

// ---------- data table ----------
/*
  columns: [{ key, header, render:(row)=>node, width:'2fr'|'120px', sort:(row)=>value, align:'right',
              mobile:'primary'|'secondary'|'meta'|'aside'|'hidden' }]
  A column with key 'actions' is rendered last and never triggers row click.
*/
export function DataTable({
  columns, rows, rowKey = (r) => r.id, onRowClick, selectable, selected = [], onSelectChange,
  empty, pageSize = 10, initialSort, loading, rowClass, dense,
}) {
  const mobile = useIsMobile();
  const [sort, setSort] = useState(initialSort ?? null); // { key, dir }
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(pageSize);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sort) return rows;
    const out = [...rows].sort((a, b) => {
      const x = col.sort(a);
      const y = col.sort(b);
      return x < y ? -1 : x > y ? 1 : 0;
    });
    return sort.dir === 'desc' ? out.reverse() : out;
  }, [rows, sort, columns]);

  const pages = Math.max(1, Math.ceil(sorted.length / size));
  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [pages, page]);
  const shown = sorted.slice((page - 1) * size, page * size);
  const keys = shown.map(rowKey);
  const allOnPage = keys.length > 0 && keys.every((k) => selected.includes(k));
  const toggleAll = () =>
    onSelectChange(allOnPage ? selected.filter((k) => !keys.includes(k)) : [...new Set([...selected, ...keys])]);
  const toggle = (k) => onSelectChange(selected.includes(k) ? selected.filter((x) => x !== k) : [...selected, k]);

  const template = [selectable ? '40px' : null, ...columns.map((c) => c.width ?? '1fr')].filter(Boolean).join(' ');
  // Smallest width at which every column still fits; below it the table scrolls sideways instead of clipping.
  const minWidth =
    32 + (selectable ? 40 + 14 : 0) + (columns.length - 1) * 14 +
    columns.reduce((sum, c) => {
      const w = c.width ?? '1fr';
      const px = w.match(/^(\d+)px$/) ?? w.match(/^minmax\((\d+)px/);
      return sum + (px ? Number(px[1]) : 90);
    }, 0);

  if (loading) return <div className="dt"><SkeletonRows n={Math.min(size, 7)} /></div>;

  return (
    <div className={`dt ${dense ? 'dt-dense' : ''}`}>
      <div className="dt-scroll">
      {!mobile && (
        <div className="dt-head" style={{ gridTemplateColumns: template, minWidth }}>
          {selectable && (
            <span className="dt-check">
              <input type="checkbox" checked={allOnPage} onChange={toggleAll} aria-label="Select all on page" />
            </span>
          )}
          {columns.map((c) =>
            c.sort ? (
              <button
                key={c.key}
                type="button"
                className={`dt-th sortable ${sort?.key === c.key ? 'sorted' : ''} ${c.align === 'right' ? 'right' : ''}`}
                onClick={() => setSort((s) => (s?.key === c.key ? (s.dir === 'asc' ? { key: c.key, dir: 'desc' } : null) : { key: c.key, dir: 'asc' }))}
              >
                {c.header}
                {sort?.key === c.key ? sort.dir === 'asc' ? <CaretUp size={11} weight="bold" /> : <CaretDown size={11} weight="bold" /> : <CaretUpDown size={11} />}
              </button>
            ) : (
              <span key={c.key} className={`dt-th ${c.align === 'right' ? 'right' : ''}`}>
                {c.header}
              </span>
            ),
          )}
        </div>
      )}

      {shown.map((row) => {
        const k = rowKey(row);
        const isSel = selected.includes(k);
        const cls = `dt-row ${onRowClick ? 'clickable' : ''} ${isSel ? 'selected' : ''} ${rowClass?.(row) ?? ''}`;
        const click = onRowClick ? () => onRowClick(row) : undefined;
        if (mobile) {
          const pick = (role) => columns.filter((c) => c.mobile === role);
          const actions = columns.find((c) => c.key === 'actions');
          return (
            <div key={k} className={`${cls} dt-card`} onClick={click}>
              {selectable && (
                <span className="dt-check" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={isSel} onChange={() => toggle(k)} aria-label="Select row" />
                </span>
              )}
              <div className="dt-card-main">
                <div className="dt-card-top">
                  <div className="grow">{pick('primary').map((c) => <div key={c.key}>{c.render(row)}</div>)}</div>
                  {pick('aside').map((c) => <div key={c.key} className="dt-aside">{c.render(row)}</div>)}
                  {actions && <div onClick={(e) => e.stopPropagation()}>{actions.render(row)}</div>}
                </div>
                {pick('secondary').map((c) => <div key={c.key} className="dt-secondary">{c.render(row)}</div>)}
                {pick('meta').length > 0 && (
                  <div className="dt-meta">
                    {pick('meta').map((c) => (
                      <span key={c.key}>{c.render(row)}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        }
        return (
          <div key={k} className={cls} style={{ gridTemplateColumns: template, minWidth }} onClick={click}>
            {selectable && (
              <span className="dt-check" onClick={(e) => e.stopPropagation()}>
                <input type="checkbox" checked={isSel} onChange={() => toggle(k)} aria-label="Select row" />
              </span>
            )}
            {columns.map((c) => (
              <span key={c.key} className={`dt-td ${c.align === 'right' ? 'right' : ''}`} onClick={c.key === 'actions' ? (e) => e.stopPropagation() : undefined}>
                {c.render(row)}
              </span>
            ))}
          </div>
        );
      })}

      </div>
      {!rows.length && <div className="dt-empty">{empty ?? <EmptyState compact title="Nothing here yet" />}</div>}

      {rows.length > 0 && (
        <Pagination page={page} pages={pages} total={sorted.length} size={size} onPage={setPage} onSize={(s) => { setSize(s); setPage(1); }} />
      )}
    </div>
  );
}

export function Pagination({ page, pages, total, size, onPage, onSize }) {
  const from = (page - 1) * size + 1;
  const to = Math.min(total, page * size);
  const nums = [];
  for (let i = 1; i <= pages; i++) if (i === 1 || i === pages || Math.abs(i - page) <= 1) nums.push(i);
  return (
    <div className="pager">
      <span className="pager-info">
        {from}–{to} of {total}
      </span>
      {onSize && (
        <label className="pager-size">
          Rows
          <select value={size} onChange={(e) => onSize(Number(e.target.value))}>
            {[5, 10, 25, 50].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
      )}
      <div className="pager-nav">
        <IconButton icon={CaretLeft} label="Previous page" size={32} disabled={page <= 1} onClick={() => onPage(page - 1)} />
        {nums.map((n, i) => (
          <span key={n} className="pager-nums">
            {i > 0 && n - nums[i - 1] > 1 && <span className="pager-gap">…</span>}
            <button type="button" className={`pager-num ${n === page ? 'on' : ''}`} onClick={() => onPage(n)}>
              {n}
            </button>
          </span>
        ))}
        <IconButton icon={CaretRight} label="Next page" size={32} disabled={page >= pages} onClick={() => onPage(page + 1)} />
      </div>
    </div>
  );
}

/** Floating bar shown when table rows are selected. */
export function BulkBar({ count, onClear, children }) {
  if (!count) return null;
  return (
    <div className="bulkbar" role="toolbar">
      <span className="bulkbar-count">{count} selected</span>
      <div className="bulkbar-actions">{children}</div>
      <IconButton icon={X} label="Clear selection" size={32} onClick={onClear} />
    </div>
  );
}

// ---------- toasts ----------
const TOAST_ICON = { success: CheckCircle, error: XCircle, info: Info, loading: null, warn: Warning };
export function Toaster({ toasts, onDismiss }) {
  return createPortal(
    <div className="toaster" aria-live="polite">
      {toasts.map((t) => (
        <ToastItem key={t.id} t={t} onDismiss={() => onDismiss(t.id)} />
      ))}
    </div>,
    document.body,
  );
}
function ToastItem({ t, onDismiss }) {
  useEffect(() => {
    if (t.kind === 'loading') return;
    const ms = t.duration ?? (t.kind === 'error' ? 8000 : 4000);
    const timer = setTimeout(onDismiss, ms);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.kind, t.v]);
  const I = TOAST_ICON[t.kind];
  return (
    <div className={`toast toast-${t.kind}`} role="status">
      <span className="toast-icon">{t.kind === 'loading' ? <Spinner size={18} /> : I && <I size={20} weight="fill" />}</span>
      <div className="grow">
        <div className="toast-title">{t.title}</div>
        {t.body && <div className="toast-body">{t.body}</div>}
      </div>
      {t.action && (
        <button
          type="button"
          className="toast-action"
          onClick={() => {
            t.action.onClick();
            onDismiss();
          }}
        >
          {t.action.label}
        </button>
      )}
      {t.kind !== 'loading' && (
        <button type="button" className="toast-close" onClick={onDismiss} aria-label="Dismiss">
          <X size={14} />
        </button>
      )}
    </div>
  );
}
