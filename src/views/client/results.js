// What a client sees after checking a guard at the gate.
export const RESULTS = {
  verified: { tone: 'ok', label: 'Verified', title: 'Verified: on duty for this site', advice: 'The person is employed by your security company, assigned to this site and licensed.' },
  unassigned: { tone: 'bad', label: 'Wrong site', title: 'Not assigned to this site', advice: 'They are employed, but not rostered here. Do not grant access until the security company confirms the change.' },
  bad_code: { tone: 'bad', label: 'Code failed', title: 'Live code did not match', advice: 'The code may be old, or the badge may be a screenshot. Ask the guard to refresh their badge and try again.' },
  licence_expired: { tone: 'bad', label: 'Licence expired', title: 'Security licence expired', advice: 'They may not work as a guard until the licence is renewed. Contact the security company.' },
  unemployed: { tone: 'bad', label: 'Not employed', title: 'Not currently employed', advice: 'This person is not employed by any participating security company. Do not grant access.' },
  invalid: { tone: 'bad', label: 'Unknown ID', title: 'Workforce ID not recognised', advice: 'No security professional has this ID. Do not grant access. Call the security company on a number you already have.' },
};

export function normaliseWid(v) {
  const s = v.trim().toUpperCase().replace(/\s/g, '');
  if (/^\d{8}$/.test(s)) return `SG-${s}`;
  if (/^SG\d{8}$/.test(s)) return `SG-${s.slice(2)}`;
  return s;
}
