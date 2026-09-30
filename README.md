# ProCheQ · Verify | Connect | Secure

A verified, guard-approved record of every security guard's career. Security companies check guards before they hire them. Guards own their record and approve who sees the private part. Anyone at a gate can confirm a guard is real.

```bash
npm install
npm run dev      # http://localhost:5190
npm run build
```

## The idea in three moves

1. **Verify.** Check any guard by ProCheQ ID, national ID or name. You see every employer that confirmed them, their training, commendations and licence.
2. **Connect.** To see the private part (incidents, disciplinary actions, why they left each job, whether each employer would rehire them), ask the guard. They approve on their phone. Access lasts 30 days, and they can withdraw it.
3. **Secure.** When you employ a guard you record the facts, and when they leave you record the exit reason. The guard sees every entry and can reply. Nobody gets a star rating.

Plus a **public gate check** on the home page. Type a ProCheQ ID to see whether the guard is real, who employs them now, and whether their licence is valid. No account needed.

## Who sees what

| | Public | Any member company | With the guard's approval | The guard |
|---|---|---|---|---|
| Name, photo, ProCheQ ID, current employer, licence | ✓ | ✓ | ✓ | ✓ |
| Career history, training, commendations | | ✓ | ✓ | ✓ |
| Incidents, discipline, exit reasons, rehire, replies | | own records only | ✓ | ✓ |

## Demo

- **Companies** (password `demo1234`): `rufaro@gemak.co.zw` (GEMAK), `themba@jpsecurity.co.zw` (JP Security), `grace@sentinel.co.zw` (Sentinel), `peter@vssecurity.co.zw` (VS Security)
- **Guards:** sign in with a ProCheQ ID such as `PQ-051207` (Tendai) or `PQ-049925` (Simba). The text-message code appears in a notification with an Autofill button.
- **Try this:** as VS Security, check Simba and ask to see his record. Sign in as Simba and approve. Back as VS Security, his exit reason and incident, with his reply, are now visible.

All data lives in this browser tab's `sessionStorage` and resets when the tab closes. **Reset demo data** is in the account menu. Appearance follows your device, and can be switched to light or dark from the header or the account menu.

## Code

- `src/access.js`: the visibility rules
- `src/store.jsx`: session database, instant saves with Undo, toasts
- `src/forms.jsx`: the five forms (add a guard, add a record, end employment, ask, reply)
- `src/views/`: Landing (with the public check), Check, Guards, Profile, Access, CompanyPage
