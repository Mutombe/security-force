import { useState } from 'react';
import { Check, EnvelopeSimple, Minus, PaperPlaneTilt, ShieldCheck, UserMinus, UserPlus, UserSwitch, Users } from '@phosphor-icons/react';
import { useStore } from '../../store';
import { PERMISSIONS, ROLES, ROLE_PERMS, companyMembers, deniedHint, roleIn } from '../../access';
import { Badge, Button, Card, ConfirmModal, DataTable, EmptyState, Field, Menu, Modal, PageHead, SearchInput, Stat, fromNow, uid } from '../../ui';
import { PermissionNote, UserCell } from '../../components';
import './admin.css';

const ROLE_TONE = { owner: 'hivis', hr: 'info', supervisor: 'neutral', viewer: 'neutral' };

function RolePicker({ value, onChange, disabled = [] }) {
  return (
    <div className="option-list">
      {Object.entries(ROLES).map(([k, r]) => (
        <label key={k} className={`option option-rich ${value === k ? 'on' : ''}`} style={disabled.includes(k) ? { opacity: 0.5 } : undefined}>
          <input type="radio" name="role" checked={value === k} disabled={disabled.includes(k)} onChange={() => onChange(k)} />
          <span className="grow">
            <b>{r.label}</b>
            <span className="option-sub">{r.desc}</span>
          </span>
          <span className="ad-perm-count">{ROLE_PERMS[k].length}/{PERMISSIONS.length}</span>
        </label>
      ))}
    </div>
  );
}

function PermPreview({ role }) {
  return (
    <ul className="ad-perm-preview">
      {PERMISSIONS.map((p) => {
        const on = ROLE_PERMS[role].includes(p.key);
        return (
          <li key={p.key} className={on ? 'on' : ''}>
            {on ? <Check size={13} weight="bold" /> : <Minus size={13} />}
            {p.label}
          </li>
        );
      })}
    </ul>
  );
}

export default function Team() {
  const { db, session, can } = useStore();
  const me = session.companyId;
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(null); // { kind, user }
  const members = companyMembers(db, me);
  const owners = members.filter((u) => roleIn(u, me) === 'owner' && u.status !== 'disabled');
  const activeWeek = members.filter((u) => u.lastActiveAt && Date.now() - new Date(u.lastActiveAt) < 7 * 86400000).length;
  const manage = can('team.manage');
  const t = q.trim().toLowerCase();
  const rows = members.filter((u) => !t || u.name.toLowerCase().includes(t) || u.email.toLowerCase().includes(t));

  const columns = [
    { key: 'user', header: 'Member', width: 'minmax(0, 2fr)', mobile: 'primary', sort: (u) => u.name, render: (u) => <UserCell user={u} sub={`${u.email}${u.id === session.userId ? ' · you' : ''}`} /> },
    { key: 'role', header: 'Role', width: '150px', mobile: 'aside', sort: (u) => roleIn(u, me), render: (u) => <Badge tone={ROLE_TONE[roleIn(u, me)]}>{ROLES[roleIn(u, me)].label}</Badge> },
    { key: 'active', header: 'Last active', width: '130px', mobile: 'meta', sort: (u) => u.lastActiveAt ?? '', render: (u) => <span className="small muted">{u.lastActiveAt ? fromNow(u.lastActiveAt) : 'Never'}</span> },
    {
      key: 'status',
      header: 'Status',
      width: '110px',
      mobile: 'meta',
      sort: (u) => u.status,
      render: (u) => <Badge tone={u.status === 'active' ? 'ok' : u.status === 'invited' ? 'info' : 'neutral'} dot>{u.status === 'active' ? 'Active' : u.status === 'invited' ? 'Invited' : 'Deactivated'}</Badge>,
    },
    {
      key: 'actions',
      header: '',
      width: '40px',
      render: (u) => {
        const self = u.id === session.userId;
        const lastOwner = roleIn(u, me) === 'owner' && owners.length <= 1;
        const hint = !manage ? deniedHint(session, 'team.manage') : undefined;
        return (
          <Menu
            label="Member actions"
            items={[
              u.status === 'invited' && { label: 'Resend invitation', icon: PaperPlaneTilt, disabled: !manage, hint, onClick: () => setModal({ kind: 'resend', user: u }) },
              { label: 'Change role', icon: UserSwitch, disabled: !manage || self || lastOwner, hint: hint ?? (self ? "You can't change your own role." : lastOwner ? 'A company needs at least one owner.' : undefined), onClick: () => setModal({ kind: 'role', user: u }) },
              u.memberships.length === 1 && u.status !== 'invited' && {
                label: u.status === 'disabled' ? 'Reactivate' : 'Deactivate',
                icon: ShieldCheck,
                disabled: !manage || self || (lastOwner && u.status !== 'disabled'),
                hint: hint ?? (self ? "You can't deactivate yourself." : lastOwner ? 'A company needs at least one owner.' : undefined),
                onClick: () => setModal({ kind: u.status === 'disabled' ? 'reactivate' : 'deactivate', user: u }),
              },
              { divider: true },
              { label: 'Remove from company', icon: UserMinus, danger: true, disabled: !manage || self || lastOwner, hint: hint ?? (self ? "You can't remove yourself." : lastOwner ? 'A company needs at least one owner.' : undefined), onClick: () => setModal({ kind: 'remove', user: u }) },
            ]}
          />
        );
      },
    },
  ];

  return (
    <div className="stack">
      <PageHead
        title="Team & roles"
        sub="Who in your company can see and act on guard records. Give people the least access they need, and review who can release records regularly."
        actions={
          <Button icon={UserPlus} onClick={() => setModal({ kind: 'invite' })} disabledReason={deniedHint(session, 'team.manage')}>
            Invite member
          </Button>
        }
      />
      {!manage && <PermissionNote>You can see the team, but only owners can invite people or change roles.</PermissionNote>}
      <div className="stats">
        <Stat label="Members" value={members.length} hint={`${members.filter((u) => u.status === 'invited').length} invited`} icon={Users} />
        <Stat label="Owners" value={owners.length} hint={owners.length < 2 ? 'Consider a second owner as backup' : 'Covered'} tone={owners.length < 2 ? 'warn' : undefined} />
        <Stat label="Active this week" value={activeWeek} hint={`of ${members.length} members`} icon={ShieldCheck} />
        <Stat label="Can release records" value={members.filter((u) => ROLE_PERMS[roleIn(u, me)].includes('verification.release')).length} hint="owners and HR" />
      </div>

      <div className="toolbar">
        <SearchInput value={q} onChange={setQ} placeholder="Search name or email" />
      </div>
      <DataTable columns={columns} rows={rows} rowClass={(u) => (u.status === 'disabled' ? 'is-muted' : '')} empty={<EmptyState icon={Users} title="No members match" />} />

      <Card title="Roles & permissions" subtitle="What each role can do in this workspace." flush>
        <div className="ad-matrix-wrap">
          <table className="ad-matrix">
            <thead>
              <tr>
                <th>Permission</th>
                {Object.entries(ROLES).map(([k, r]) => (
                  <th key={k}>{r.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS.map((p) => (
                <tr key={p.key}>
                  <td>{p.label}</td>
                  {Object.keys(ROLES).map((k) => (
                    <td key={k} className={ROLE_PERMS[k].includes(p.key) ? 'on' : ''}>
                      {ROLE_PERMS[k].includes(p.key) ? <Check size={15} weight="bold" aria-label="Allowed" /> : <Minus size={14} aria-label="Not allowed" />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {modal?.kind === 'invite' && <InviteModal onClose={() => setModal(null)} />}
      {modal?.kind === 'role' && <RoleModal user={modal.user} owners={owners} onClose={() => setModal(null)} />}
      {modal?.kind === 'resend' && <ResendConfirm user={modal.user} onClose={() => setModal(null)} />}
      {modal?.kind === 'remove' && <RemoveConfirm user={modal.user} onClose={() => setModal(null)} />}
      {(modal?.kind === 'deactivate' || modal?.kind === 'reactivate') && <ActivationConfirm user={modal.user} reactivate={modal.kind === 'reactivate'} onClose={() => setModal(null)} />}
    </div>
  );
}

function InviteModal({ onClose }) {
  const { db, session, act } = useStore();
  const me = session.companyId;
  const [f, setF] = useState({ name: '', email: '', title: '', role: 'hr' });
  const email = f.email.trim().toLowerCase();
  const existing = /.+@.+\..+/.test(email) ? db.users.find((u) => u.email.toLowerCase() === email) : null;
  const already = existing?.memberships?.some((m) => m.companyId === me);
  const wrongKind = existing && existing.kind !== 'staff';
  const valid = /.+@.+\..+/.test(email) && !already && !wrongKind && (existing || f.name.trim().length > 1);
  const save = () =>
    act({
      key: `invite:${email}`,
      pending: 'Sending invitation…',
      success: existing ? `${existing.name} now has access` : `Invitation sent to ${email}`,
      touches: ['users'],
      undo: true,
      apply: (d, t) => {
        if (existing) {
          d.users.find((u) => u.id === existing.id).memberships.push({ companyId: me, role: f.role });
          t.log('Added member', `${existing.name} added as ${ROLES[f.role].label}`);
        } else {
          d.users.push({ id: uid('U'), kind: 'staff', name: f.name.trim(), email, title: f.title.trim(), password: 'demo1234', mfa: false, avatar: null, status: 'invited', invitedAt: t.now, invitedBy: t.actor.user, lastActiveAt: null, memberships: [{ companyId: me, role: f.role }] });
          t.log('Invited member', `${f.name.trim()} (${email}) invited as ${ROLES[f.role].label}`);
        }
      },
    }).then(onClose);
  return (
    <Modal
      title="Invite a team member"
      icon={UserPlus}
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button icon={EnvelopeSimple} onClick={save} disabled={!valid}>
            {existing && !already ? 'Give access' : 'Send invitation'}
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Work email" error={already ? 'Already a member of this workspace.' : wrongKind ? 'This email belongs to a non-company account.' : null}>
          <input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoFocus placeholder="name@company.co.zw" />
        </Field>
        {!existing && (
          <>
            <Field label="Full name">
              <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
            </Field>
            <Field label="Job title" optional>
              <input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
            </Field>
          </>
        )}
      </div>
      {existing && !already && !wrongKind && (
        <div className="notice notice-ok">
          <UserCell user={existing} size={30} />
          <span>Already uses Security Force. They'll see this workspace next time they sign in.</span>
        </div>
      )}
      <div className="ad-invite-grid">
        <Field label="Role">
          <RolePicker value={f.role} onChange={(role) => setF({ ...f, role })} />
        </Field>
        <Field label={`${ROLES[f.role].label} can`}>
          <PermPreview role={f.role} />
        </Field>
      </div>
    </Modal>
  );
}

function RoleModal({ user, owners, onClose }) {
  const { session, act } = useStore();
  const me = session.companyId;
  const current = roleIn(user, me);
  const [role, setRole] = useState(current);
  const lastOwner = current === 'owner' && owners.length <= 1;
  const save = () =>
    act({
      key: user.id,
      pending: 'Changing role…',
      success: `${user.name} is now ${ROLES[role].label}`,
      touches: ['users'],
      undo: true,
      apply: (d, t) => {
        d.users.find((u) => u.id === user.id).memberships.find((m) => m.companyId === me).role = role;
        t.log('Changed role', `${user.name}: ${ROLES[current].label} → ${ROLES[role].label}`);
      },
    }).then(onClose);
  return (
    <Modal
      title="Change role"
      subtitle={user.name}
      icon={UserSwitch}
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={role === current}>
            Save role
          </Button>
        </>
      }
    >
      {lastOwner && <PermissionNote>{user.name} is the only owner. Make someone else an owner first.</PermissionNote>}
      <div className="ad-invite-grid">
        <RolePicker value={role} onChange={setRole} disabled={lastOwner ? ['hr', 'supervisor', 'viewer'] : []} />
        <PermPreview role={role} />
      </div>
    </Modal>
  );
}

function ResendConfirm({ user, onClose }) {
  const { act } = useStore();
  return (
    <ConfirmModal
      title="Resend invitation?"
      tone="info"
      icon={PaperPlaneTilt}
      body={`We'll email a new sign-in link to ${user.email}. The previous link stops working.`}
      confirmLabel="Resend"
      onClose={onClose}
      onConfirm={() =>
        act({
          key: user.id,
          pending: 'Resending…',
          success: `Invitation resent to ${user.email}`,
          touches: ['users'],
          apply: (d, t) => {
            d.users.find((u) => u.id === user.id).invitedAt = t.now;
            t.log('Resent invitation', user.email);
          },
        })
      }
    />
  );
}

function RemoveConfirm({ user, onClose }) {
  const { session, act } = useStore();
  const me = session.companyId;
  return (
    <ConfirmModal
      title={`Remove ${user.name}?`}
      body={`${user.name} loses access to this workspace immediately and is signed out. Their past actions stay in the audit trail.`}
      confirmLabel="Remove"
      requireText={user.name.split(' ')[0]}
      onClose={onClose}
      onConfirm={() =>
        act({
          key: user.id,
          pending: 'Removing member…',
          success: `${user.name} removed`,
          touches: ['users', 'sessions'],
          undo: true,
          apply: (d, t) => {
            const u = d.users.find((x) => x.id === user.id);
            u.memberships = u.memberships.filter((m) => m.companyId !== me);
            if (!u.memberships.length) u.status = 'disabled';
            d.sessions = d.sessions.filter((s) => s.userId !== user.id);
            t.log('Removed member', `${user.name} (${user.email})`);
          },
        })
      }
    />
  );
}

function ActivationConfirm({ user, reactivate, onClose }) {
  const { act } = useStore();
  return (
    <ConfirmModal
      title={reactivate ? `Reactivate ${user.name}?` : `Deactivate ${user.name}?`}
      tone={reactivate ? 'info' : 'danger'}
      body={reactivate ? `${user.name} will be able to sign in again with their existing role.` : `${user.name} can't sign in until reactivated. Use this for leave or suspensions; remove them if they've left.`}
      confirmLabel={reactivate ? 'Reactivate' : 'Deactivate'}
      onClose={onClose}
      onConfirm={() =>
        act({
          key: user.id,
          pending: reactivate ? 'Reactivating…' : 'Deactivating…',
          success: reactivate ? `${user.name} reactivated` : `${user.name} deactivated`,
          touches: ['users', 'sessions'],
          undo: true,
          apply: (d, t) => {
            d.users.find((u) => u.id === user.id).status = reactivate ? 'active' : 'disabled';
            if (!reactivate) d.sessions = d.sessions.filter((s) => s.userId !== user.id);
            t.log(reactivate ? 'Reactivated member' : 'Deactivated member', user.name);
          },
        })
      }
    />
  );
}
