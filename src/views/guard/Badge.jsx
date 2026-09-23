import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { ArrowsOut, ArrowsIn, Clock, MapPin, ShieldCheck, ShieldWarning, SunDim, Warning } from '@phosphor-icons/react';
import { useStore } from '../../store';
import { company, currentEmployment, guardById, licenceStatus, siteById } from '../../access';
import { Avatar, Button, OrgMark, badgeCode, badgeSecondsLeft, fmtDate, useNow } from '../../ui';
import './guard.css';

export default function LiveBadge() {
  const { db, session } = useStore();
  const guard = guardById(db, session.guardId);
  const now = useNow(1000);
  const code = badgeCode(guard.id, now);
  const left = badgeSecondsLeft(now);
  const [qr, setQr] = useState('');
  const [full, setFull] = useState(false);
  const [awake, setAwake] = useState(false);
  const ref = useRef(null);
  const lock = useRef(null);
  const cur = currentEmployment(db, guard.id);
  const co = cur && company(db, cur.companyId);
  const site = cur && siteById(db, cur.siteId);
  const lic = licenceStatus(guard);
  const valid = !!cur && lic.tone !== 'bad';

  useEffect(() => {
    let live = true;
    QRCode.toDataURL(`SF1|${guard.id}|${code}`, { margin: 1, width: 360, color: { dark: '#15171c', light: '#ffffff' } }).then((u) => live && setQr(u));
    return () => {
      live = false;
    };
  }, [guard.id, code]);

  useEffect(() => {
    const on = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', on);
    return () => {
      document.removeEventListener('fullscreenchange', on);
      lock.current?.release?.();
    };
  }, []);

  const toggleFull = async () => {
    if (document.fullscreenElement) return document.exitFullscreen();
    try {
      await ref.current.requestFullscreen();
    } catch {
      setFull((f) => !f); // fallback: CSS overlay
    }
  };

  const keepAwake = async () => {
    try {
      if (lock.current) {
        await lock.current.release();
        lock.current = null;
        setAwake(false);
      } else {
        lock.current = await navigator.wakeLock.request('screen');
        setAwake(true);
        lock.current.addEventListener?.('release', () => setAwake(false));
      }
    } catch {
      setAwake(false);
    }
  };

  const R = 26;
  const C = 2 * Math.PI * R;

  return (
    <div className="gd-badge-page">
      <div ref={ref} className={`gd-badge-wrap ${full && !document.fullscreenElement ? 'is-overlay' : ''} ${full ? 'is-full' : ''}`}>
        <article className={`gd-badge ${valid ? '' : 'is-invalid'}`} aria-label="Live security badge">
          <header className="gd-badge-top">
            <span>Security Force</span>
            <span className={`gd-live ${valid ? '' : 'off'}`}>
              <span className="gd-live-dot" /> {valid ? 'Live badge' : 'Not valid for duty'}
            </span>
          </header>

          <div className="gd-badge-id">
            <Avatar name={guard.name} seed={guard.id} src={guard.avatar} size={112} square />
            <div className="grow">
              <div className="gd-badge-name">{guard.name}</div>
              <div className="mono gd-badge-wid">{guard.id}</div>
              <div className={`gd-badge-lic tone-${lic.tone}`}>
                {lic.tone === 'bad' ? <ShieldWarning size={15} weight="fill" /> : <ShieldCheck size={15} weight="fill" />}
                Licence {guard.licence.number} · {lic.tone === 'bad' ? lic.label : `valid to ${fmtDate(guard.licence.expiry)}`}
              </div>
            </div>
          </div>

          {cur ? (
            <div className="gd-badge-post">
              <OrgMark company={co} size={36} />
              <div className="grow">
                <b>{co.name}</b>
                <span>{cur.position}</span>
              </div>
              <div className="gd-badge-site">
                <span>
                  <MapPin size={14} /> {site?.name ?? 'Unassigned'}
                </span>
                {site && (
                  <span>
                    <Clock size={14} /> {site.shift}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="gd-badge-warn">
              <Warning size={20} weight="fill" />
              <span>Not currently deployed. This badge is not valid for duty at any site.</span>
            </div>
          )}

          <div className="gd-badge-code">
            <div className="gd-qr">{qr ? <img src={qr} alt={`QR code for ${guard.id}`} /> : <span className="skel" style={{ width: '100%', height: '100%' }} />}</div>
            <div className="gd-code-col">
              <span className="gd-code-label">Live code</span>
              <div className="gd-code mono" aria-live="polite">
                {code.slice(0, 3)} {code.slice(3)}
              </div>
              <div className="gd-ring">
                <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
                  <circle cx="32" cy="32" r={R} className="gd-ring-bg" />
                  <circle cx="32" cy="32" r={R} className={`gd-ring-fg ${left <= 5 ? 'low' : ''}`} strokeDasharray={C} strokeDashoffset={C * (1 - left / 30)} />
                </svg>
                <span className="mono">{left}s</span>
              </div>
            </div>
          </div>
          <p className="gd-badge-foot">The code changes every 30 seconds, so a screenshot stops working almost at once. Ask the client to check it at the gate.</p>
        </article>

        <div className="gd-badge-tools">
          <Button variant={full ? 'primary' : 'ghost'} icon={full ? ArrowsIn : ArrowsOut} onClick={toggleFull}>
            {full ? 'Exit full screen' : 'Full screen'}
          </Button>
          {'wakeLock' in navigator && (
            <Button variant={awake ? 'primary' : 'ghost'} icon={SunDim} onClick={keepAwake}>
              {awake ? 'Screen stays on' : 'Keep screen on'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
