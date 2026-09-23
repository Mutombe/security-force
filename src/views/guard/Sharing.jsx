import { useState } from 'react';
import { Plus, ShareNetwork, Ticket } from '@phosphor-icons/react';
import { useStore } from '../../store';
import { SCOPES, company, scopeShort } from '../../access';
import { Badge, Button, ConfirmModal, CopyButton, EmptyState, Field, Modal, OrgMark, PageHead, Segmented, addDays, fmtDate, fmtTime, fromNow } from '../../ui';
import { EntityLink } from '../../components';
import './guard.css';
import '../detail/detail.css';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const makeCode = () => {
  const r = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)), (b) => ALPHABET[b % ALPHABET.length]).join('');
  return `${r(3)}-${r(4)}`;
};

const stateOf = (s) => (s.revokedAt ? 'revoked' : new Date(s.expiresAt) < new Date() ? 'expired' : 'active');

export default function Sharing() {
  const { db, session, act } = useStore();
  const shares = db.shares.filter((s) => s.guardId === session.guardId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const [create, setCreate] = useState(false);
  const [revoke, setRevoke] = useState(null);

  const revokeShare = (share) =>
    act({
      key: share.id,
      pending: 'Revoking code…',
      success: `Code ${share.code} revoked`,
      touches: ['shares', 'grants'],
      undo: true,
      apply: (d, t) => {
        d.shares.find((x) => x.id === share.id).revokedAt = t.now;
        d.grants
          .filter((g) => g.via === 'share' && g.refId === share.id && !g.revokedAt)
          .forEach((g) => {
            g.revokedAt = t.now;
            t.notify(`company:${g.viewerCompanyId}`, { title: 'Share code revoked', body: `${t.actor.name} revoked the code you used. Their shared records are no longer visible.` });
          });
        t.log('Revoked share code', `${share.code} (${share.label})`, { guardId: share.guardId });
      },
    });

  return (
    <div className="stack">
      <PageHead
        title="Share my passport"
        sub="Applying for a job? Give the employer a share code. It lets them see the records you choose, from all your previous employers, until the code expires. You can revoke it at any time."
        actions={
          <Button icon={Plus} onClick={() => setCreate(true)}>
            New share code
          </Button>
        }
      />

      {shares.length ? (
        <div className="gd-shares">
          {shares.map((s) => {
            const st = stateOf(s);
            return (
              <article key={s.id} className={`card gd-share is-${st}`}>
                <div className="gd-share-top">
                  <div className="grow">
                    <div className="gd-share-label">{s.label}</div>
                    <div className="mono gd-share-code">{s.code}</div>
                  </div>
                  <Badge tone={st === 'active' ? 'ok' : 'neutral'} dot>
                    {st === 'active' ? `Active · ends ${fromNow(s.expiresAt)}` : st === 'expired' ? `Expired ${fmtDate(s.expiresAt)}` : 'Revoked'}
                  </Badge>
                </div>
                <div className="chips">
                  {s.scopes.map((k) => (
                    <Badge key={k}>{scopeShort(k)}</Badge>
                  ))}
                </div>
                <div className="gd-redemptions">
                  <span className="gd-party-label">Used by</span>
                  {s.redemptions.length ? (
                    <ul>
                      {s.redemptions.map((r, i) => (
                        <li key={i}>
                          <OrgMark company={company(db, r.companyId)} size={22} />
                          <span className="grow">
                            <EntityLink kind="company" id={r.companyId} className="dt2-inline-link">
                              {company(db, r.companyId).name}
                            </EntityLink>
                          </span>
                          <span className="muted small">{fmtTime(r.at)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted small">Nobody has used this code yet.</p>
                  )}
                </div>
                <div className="gd-share-actions">
                  <span className="muted small">Created {fmtDate(s.createdAt)}</span>
                  {st === 'active' && (
                    <>
                      <CopyButton text={s.code} label="Copy code" />
                      <Button variant="danger-ghost" size="sm" onClick={() => setRevoke(s)}>
                        Revoke
                      </Button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="card">
          <EmptyState
            icon={ShareNetwork}
            title="No share codes yet"
            body="Create a code before an interview. The employer enters it in Security Force to see your verified history."
            action={
              <Button icon={Plus} onClick={() => setCreate(true)}>
                New share code
              </Button>
            }
          />
        </div>
      )}

      {create && <CreateShareModal onClose={() => setCreate(false)} />}
      {revoke && (
        <ConfirmModal
          title="Revoke this code?"
          body={`Code ${revoke.code} stops working now, and any employer who used it loses access to your shared records.`}
          confirmLabel="Revoke code"
          onClose={() => setRevoke(null)}
          onConfirm={() => revokeShare(revoke)}
        />
      )}
    </div>
  );
}

function CreateShareModal({ onClose }) {
  const { db, session, act } = useStore();
  const g = db.guards.find((x) => x.id === session.guardId);
  const [label, setLabel] = useState('');
  const [scopes, setScopes] = useState(SCOPES.map((s) => s.key));
  const [days, setDays] = useState('14');
  const [created, setCreated] = useState(null);
  const toggle = (k) => setScopes((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));

  const create = () => {
    const code = makeCode();
    act({
      key: `share:${code}`,
      pending: 'Creating share code…',
      success: `Share code ${code} created`,
      touches: ['shares'],
      undo: true,
      apply: (d, t) => {
        d.shares.unshift({ id: `SH-${Date.now().toString(36).toUpperCase()}`, guardId: g.id, code, label: label.trim() || 'Job application', scopes, createdAt: t.now, expiresAt: addDays(t.now, Number(days)), revokedAt: null, redemptions: [] });
        t.log('Created share code', `${code} — ${scopes.map(scopeShort).join(', ')}, ${days} days`, { guardId: g.id });
      },
    });
    setCreated(code);
  };

  if (created)
    return (
      <Modal size="sm" title="Your share code" icon={Ticket} onClose={onClose} footer={<Button onClick={onClose}>Done</Button>}>
        <div className="gd-created">
          <div className="mono gd-created-code">{created}</div>
          <CopyButton text={created} label="Copy code" />
        </div>
        <p className="muted small">
          Give this code to the employer you are applying to. It works for {days} days and shows only {scopes.map(scopeShort).join(', ').toLowerCase()}. You'll be notified whenever it is used.
        </p>
      </Modal>
    );

  return (
    <Modal
      title="New share code"
      icon={ShareNetwork}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={create} disabled={!scopes.length}>
            Create code
          </Button>
        </>
      }
    >
      <Field label="Label" optional hint="Only you see this, e.g. the company you are applying to.">
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Application to Granite Security" autoFocus />
      </Field>
      <Field label="What the employer can see">
        <div className="options">
          {SCOPES.map((s) => (
            <label key={s.key} className={`option ${scopes.includes(s.key) ? 'on' : ''}`}>
              <input type="checkbox" checked={scopes.includes(s.key)} onChange={() => toggle(s.key)} />
              <span>{s.label}</span>
            </label>
          ))}
        </div>
      </Field>
      <Field label="Valid for">
        <Segmented value={days} onChange={setDays} options={[{ value: '7', label: '7 days' }, { value: '14', label: '14 days' }, { value: '30', label: '30 days' }]} />
      </Field>
      <p className="muted small">Your identity, employment history and training are always visible to employers. A share code adds the restricted records you tick above.</p>
    </Modal>
  );
}
