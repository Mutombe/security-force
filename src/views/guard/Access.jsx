import { useMemo, useState } from 'react';
import { Buildings, Eye, Handshake, ShieldCheck } from '@phosphor-icons/react';
import { useStore } from '../../store';
import { grantActive } from '../../access';
import { Card, PageHead, Segmented, Stat } from '../../ui';
import { ActivityTimeline } from '../profile/parts';
import '../profile/profile.css';
import './guard.css';

const KIND = {
  views: (a) => a.action === 'Viewed profile',
  verification: (a) => /verification|consent|access|share|dispute|response/i.test(a.action),
  checks: (a) => a.action === 'Client verification check',
};

export default function AccessLog() {
  const { db, session } = useStore();
  const me = session.guardId;
  const [filter, setFilter] = useState('all');
  // Other people's actions about me (my own sign-ins aren't access).
  const all = useMemo(() => db.audit.filter((a) => a.guardId === me && !(a.actorRole === 'guard' && a.actorId === me && /Signed/.test(a.action))), [db, me]);
  const month = Date.now() - 30 * 86400000;
  const views = all.filter((a) => KIND.views(a) && new Date(a.ts) > month);
  const viewers = new Set(views.map((a) => a.actor));
  const withAccess = new Set(db.grants.filter((g) => g.guardId === me && grantActive(g)).map((g) => g.viewerCompanyId));
  const checks = all.filter((a) => KIND.checks(a) && new Date(a.ts) > month);
  const shown = filter === 'all' ? all : all.filter(KIND[filter]);

  return (
    <div className="stack">
      <PageHead title="Who has seen my record" sub="Every organisation that opened your passport, asked about you, or checked your badge at a site. You can see exactly what they did and when." />
      <div className="stats">
        <Stat label="Passport views" value={views.length} hint="last 30 days" icon={Eye} />
        <Stat label="Organisations that looked" value={viewers.size} hint="last 30 days" icon={Buildings} />
        <Stat label="Companies with access now" value={withAccess.size} hint="restricted records" icon={Handshake} />
        <Stat label="Badge checks at sites" value={checks.length} hint="last 30 days" icon={ShieldCheck} />
      </div>
      <Card
        title="Activity"
        actions={
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All' },
              { value: 'views', label: 'Views' },
              { value: 'verification', label: 'Verification' },
              { value: 'checks', label: 'Checks' },
            ]}
          />
        }
        className="gd-access"
      >
        <ActivityTimeline entries={shown} empty="Nothing here yet." />
      </Card>
    </div>
  );
}
