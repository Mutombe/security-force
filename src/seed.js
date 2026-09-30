// ProCheQ demo data. "Today" in the story is the end of September 2026.
const PASSWORD = 'demo1234';

const companies = [
  { id: 'C-GMK', name: 'GEMAK Security Services', logo: '/logos/gemak.png', city: 'Harare', reg: 'PSR-2011-0142', phone: '+263 242 761 440', email: 'hr@gemak.co.zw', since: '2025-11-02' },
  { id: 'C-JPS', name: 'JP Security', logo: '/logos/jp.png', city: 'Bulawayo', reg: 'PSR-2014-0388', phone: '+263 292 880 212', email: 'hr@jpsecurity.co.zw', since: '2025-11-19' },
  { id: 'C-SEN', name: 'Sentinel Security Technology', logo: '/logos/sentinel.png', city: 'Harare', reg: 'PSR-2016-0517', phone: '+263 242 700 118', email: 'people@sentinel.co.zw', since: '2025-12-04' },
  { id: 'C-VSS', name: 'VS Security', logo: '/logos/vs.png', city: 'Mutare', reg: 'PSR-2019-0733', phone: '+263 20 206 4471', email: 'admin@vssecurity.co.zw', since: '2026-02-10' },
];

const users = [
  { id: 'U-1', companyId: 'C-GMK', name: 'Rufaro Chikore', title: 'Head of HR', email: 'rufaro@gemak.co.zw' },
  { id: 'U-2', companyId: 'C-JPS', name: 'Themba Ndlovu', title: 'Operations Director', email: 'themba@jpsecurity.co.zw' },
  { id: 'U-3', companyId: 'C-SEN', name: 'Grace Mutasa', title: 'People Lead', email: 'grace@sentinel.co.zw' },
  { id: 'U-4', companyId: 'C-VSS', name: 'Peter Dzvova', title: 'Managing Director', email: 'peter@vssecurity.co.zw' },
].map((u) => ({ ...u, password: PASSWORD }));

const G = (id, name, nationalId, dob, gender, city, phone, licenceExpiry, qualifications = true) => ({
  id, name, nationalId, dob, gender, city, phone,
  licence: { number: `PSL-${id.slice(3)}`, expiry: licenceExpiry },
  verified: { identity: true, qualifications },
  avatar: null,
});
const guards = [
  G('PQ-048392', 'John Moyo', '63-1184520-K-42', '1991-04-12', 'M', 'Harare', '+263 77 214 5580', '2028-01-31'),
  G('PQ-051207', 'Tendai Chikwanha', '08-2291034-P-27', '1988-09-30', 'M', 'Harare', '+263 71 998 2041', '2027-04-30'),
  G('PQ-049925', 'Simba Makoni', '08-4412290-M-08', '1990-12-14', 'M', 'Bulawayo', '+263 71 660 4127', '2027-01-31'),
  G('PQ-061150', 'Tinashe Zhou', '63-5528134-Z-42', '1998-05-19', 'M', 'Harare', '+263 78 311 7742', '2027-05-31'),
  G('PQ-044180', 'Kudzai Dube', '29-1109345-D-29', '1986-07-25', 'M', 'Gweru', '+263 77 801 3319', '2027-09-30'),
  G('PQ-053318', 'Rudo Ncube', '08-3310921-B-08', '1995-01-22', 'F', 'Bulawayo', '+263 78 440 1128', '2027-11-30'),
  G('PQ-039946', 'Farai Mutasa', '07-1120394-F-63', '1984-11-03', 'M', 'Bulawayo', '+263 77 330 9002', '2027-06-30'),
  G('PQ-060412', 'Blessing Sibanda', '75-4432190-S-75', '1997-06-17', 'F', 'Mutare', '+263 71 552 7310', '2027-02-28', false),
  G('PQ-057731', 'Tatenda Nyathi', '63-2209881-N-42', '1993-02-08', 'M', 'Harare', '+263 78 102 6645', '2026-10-15'),
  G('PQ-058803', 'Tafadzwa Gumbo', '63-3345120-G-42', '1994-08-11', 'M', 'Harare', '+263 77 145 8833', '2026-08-30'),
  G('PQ-059941', 'Chipo Mhlanga', '63-4410029-H-42', '1996-10-05', 'F', 'Harare', '+263 71 224 5609', '2028-03-31'),
  G('PQ-050581', 'Brighton Mhike', '63-2058110-M-42', '1989-05-30', 'M', 'Harare', '+263 78 205 8110', '2027-07-31'),
  G('PQ-054422', 'Ruvimbo Sithole', '63-3442218-S-42', '1994-12-02', 'F', 'Harare', '+263 77 344 2218', '2027-03-31'),
  G('PQ-055903', 'Precious Moyo', '08-5590312-M-08', '1996-09-08', 'F', 'Bulawayo', '+263 78 559 0312', '2027-12-31'),
  G('PQ-052290', 'Lovemore Tshuma', '75-2229088-T-75', '1985-06-13', 'M', 'Mutare', '+263 78 222 9088', '2027-06-30'),
  G('PQ-063015', 'Tapiwa Marufu', '63-6120447-T-42', '1992-03-09', 'M', 'Harare', '+263 77 612 0447', '2027-10-31'),
];

const exit = (reason, rehire, note) => ({ reason, rehire, note });
const E = (id, guardId, companyId, role, start, end = null, ex = null, reply = null) => ({ id, guardId, companyId, role, start, end, exit: ex, reply });
const employments = [
  E('E-01', 'PQ-048392', 'C-GMK', 'Security Officer', '2022-02-01', '2024-03-31', exit('Resigned', 'Yes', 'Left on good terms to relocate to Bulawayo.')),
  E('E-02', 'PQ-048392', 'C-JPS', 'Senior Security Officer', '2024-05-01', '2025-06-30', exit('Contract ended', 'Yes', 'Fixed-term contract completed.')),
  E('E-03', 'PQ-048392', 'C-SEN', 'Shift Supervisor', '2025-08-01'),
  E('E-04', 'PQ-051207', 'C-GMK', 'Security Officer', '2021-06-01', '2025-01-15', exit('Dismissed — misconduct', 'No', 'Dismissed after a disciplinary hearing on 10 Jan 2025 for leaving the post unmanned.'),
    { text: 'I left the post because of a family medical emergency. I phoned my supervisor at 01:10 and gave HR a hospital letter on 12 Jan 2025.', at: '2026-09-15T12:00:00.000Z' }),
  E('E-05', 'PQ-049925', 'C-JPS', 'Security Officer', '2022-01-10', '2024-11-20', exit('Absconded', 'With conditions', 'Stopped reporting for duty from 20 Nov 2024. Company keys were returned on 2 Dec 2024.')),
  E('E-06', 'PQ-061150', 'C-GMK', 'Security Officer', '2025-03-01', '2026-02-28', exit('Contract ended', 'Yes', 'Seasonal contract completed. Perfect attendance.')),
  E('E-07', 'PQ-044180', 'C-SEN', 'Security Officer', '2020-04-01', '2023-08-31', exit('Resigned', 'Yes', 'Resigned to take a supervisory role.')),
  E('E-08', 'PQ-044180', 'C-GMK', 'Site Supervisor', '2023-10-02'),
  E('E-09', 'PQ-053318', 'C-SEN', 'Control Room Operator', '2023-03-01'),
  E('E-10', 'PQ-039946', 'C-JPS', 'Site Supervisor', '2020-01-06'),
  E('E-11', 'PQ-060412', 'C-VSS', 'Security Officer', '2024-02-12'),
  E('E-12', 'PQ-057731', 'C-GMK', 'Security Officer', '2023-09-04'),
  E('E-13', 'PQ-058803', 'C-GMK', 'Security Officer', '2024-04-15'),
  E('E-14', 'PQ-059941', 'C-SEN', 'Access Control Officer', '2024-06-03'),
  E('E-15', 'PQ-050581', 'C-GMK', 'Security Officer', '2022-07-18'),
  E('E-16', 'PQ-054422', 'C-GMK', 'Response Team Officer', '2023-05-02'),
  E('E-17', 'PQ-055903', 'C-JPS', 'Access Control Officer', '2024-01-08'),
  E('E-18', 'PQ-052290', 'C-VSS', 'Senior Security Officer', '2022-10-10'),
  E('E-19', 'PQ-063015', 'C-SEN', 'Security Officer', '2025-11-03'),
];

const R = (id, guardId, companyId, type, title, date, detail = '', extra = {}) => ({ id, guardId, companyId, type, title, date, detail, severity: null, evidence: '', expires: null, reply: null, ...extra });
const records = [
  R('R-01', 'PQ-048392', 'C-GMK', 'training', 'Basic Security Training (Grade C)', '2022-02-20', 'Certificate BST-22-0412.'),
  R('R-02', 'PQ-048392', 'C-GMK', 'training', 'First Aid Level 1', '2023-06-14', 'Red Cross certificate FA1-7781.', { expires: '2025-06-14' }),
  R('R-03', 'PQ-048392', 'C-GMK', 'incident', 'Gate left unsecured at shift change', '2023-10-08', 'Pedestrian gate found unlatched at the 06:05 handover. Nothing was lost. Officer counselled.', { severity: 'Minor', evidence: 'OB entry 118/23' }),
  R('R-04', 'PQ-048392', 'C-GMK', 'disciplinary', 'Written warning: late reporting', '2023-11-02', 'Three late arrivals within 30 days.', { severity: 'Minor', evidence: 'HR file DW-23-041' }),
  R('R-05', 'PQ-048392', 'C-JPS', 'training', 'Fire Safety & Evacuation', '2024-07-19', 'In-house course, 16 hours.'),
  R('R-06', 'PQ-048392', 'C-JPS', 'commendation', 'Prevented a perimeter break-in', '2024-12-03', 'Detected and reported an attempted fence breach at 02:40. Police responded within 12 minutes.'),
  R('R-07', 'PQ-048392', 'C-SEN', 'training', 'Access Control Systems', '2025-09-10', 'Vendor certification.', { expires: '2027-09-10' }),
  R('R-08', 'PQ-051207', 'C-GMK', 'training', 'Basic Security Training (Grade C)', '2021-06-18', 'Certificate BST-21-0201.'),
  R('R-09', 'PQ-051207', 'C-GMK', 'disciplinary', 'Final written warning: asleep on duty', '2024-08-21', 'Found asleep at post during a supervisor patrol at 03:15.', { severity: 'Moderate', evidence: 'Patrol log PL-2408-77' }),
  R('R-10', 'PQ-051207', 'C-GMK', 'incident', 'Post left unmanned', '2025-01-04', 'Post unmanned for about two hours on a night shift. Nothing was lost.', { severity: 'Serious', evidence: 'CCTV ref MSQ-0104' }),
  R('R-11', 'PQ-049925', 'C-JPS', 'training', 'Basic Security Training (Grade C)', '2022-01-28'),
  R('R-12', 'PQ-049925', 'C-JPS', 'incident', 'Site keys lost', '2024-06-11', 'Master key set reported missing; locks replaced at company cost.', {
    severity: 'Moderate', evidence: 'OB entry 311/24',
    reply: { text: 'The keys were taken from the guard hut during a break-in reported to the police (RRB 4471/24). I was not negligent.', at: '2026-08-30T10:00:00.000Z' },
  }),
  R('R-13', 'PQ-061150', 'C-GMK', 'training', 'Basic Security Training (Grade C)', '2025-03-15'),
  R('R-14', 'PQ-061150', 'C-GMK', 'commendation', 'Perfect attendance, Q3 2025', '2025-10-02'),
  R('R-15', 'PQ-044180', 'C-SEN', 'training', 'Basic Security Training (Grade B)', '2020-04-20'),
  R('R-16', 'PQ-044180', 'C-SEN', 'disciplinary', 'Written warning: uniform', '2022-05-10', 'Reported for duty without issued boots twice in one week.', { severity: 'Minor', evidence: 'HR file SW-22-018' }),
  R('R-17', 'PQ-044180', 'C-GMK', 'training', 'Supervisory Management', '2024-05-17'),
  R('R-18', 'PQ-053318', 'C-SEN', 'commendation', 'Control room operator of the quarter', '2025-10-01', 'Coordinated the response to three alarms in one night.'),
  R('R-19', 'PQ-039946', 'C-JPS', 'commendation', 'Five-year long-service award', '2025-01-06'),
  R('R-20', 'PQ-060412', 'C-VSS', 'commendation', 'Reported a suspicious vehicle; theft prevented', '2025-06-02'),
  R('R-21', 'PQ-057731', 'C-GMK', 'training', 'First Aid Level 1', '2024-02-11', '', { expires: '2026-02-11' }),
  R('R-22', 'PQ-054422', 'C-GMK', 'training', 'Armed Response Competency', '2024-11-01', 'Range certificate ARC-24-0019.', { expires: '2026-11-01' }),
];

// A company asks a guard to see their full record. Nothing private is shared until the guard approves.
const Q = (id, companyId, guardId, reason, status, askedAt, decidedAt = null, expiresAt = null) => ({ id, companyId, guardId, reason, status, askedAt, decidedAt, expiresAt });
const requests = [
  Q('RQ-1', 'C-VSS', 'PQ-051207', 'Applied for night-shift officer at Mutare Mall.', 'pending', '2026-09-28T09:10:00.000Z'),
  Q('RQ-2', 'C-SEN', 'PQ-049925', 'Applied for a security officer post.', 'approved', '2026-09-10T08:00:00.000Z', '2026-09-10T09:30:00.000Z', '2026-10-10T09:30:00.000Z'),
  Q('RQ-3', 'C-JPS', 'PQ-061150', 'Applied to join our Bulawayo relief team.', 'pending', '2026-09-29T15:30:00.000Z'),
  Q('RQ-4', 'C-GMK', 'PQ-049925', 'Applied for a 24-hour post in Harare.', 'pending', '2026-09-27T11:00:00.000Z'),
  Q('RQ-5', 'C-GMK', 'PQ-044180', 'Hiring for site supervisor.', 'approved', '2023-09-12T09:00:00.000Z', '2023-09-12T10:00:00.000Z', '2023-10-12T10:00:00.000Z'),
];

const A = (at, actor, person, actorKind, actorId, action, detail, guardId = null) => ({ id: `A-${at}`, at, actor, person, actorKind, actorId, action, detail, guardId });
const activity = [
  A('2026-09-29T15:30:00.000Z', 'JP Security', 'Themba Ndlovu', 'company', 'C-JPS', 'Asked to see full record', 'Tinashe Zhou', 'PQ-061150'),
  A('2026-09-29T15:26:00.000Z', 'JP Security', 'Themba Ndlovu', 'company', 'C-JPS', 'Checked profile', 'Tinashe Zhou', 'PQ-061150'),
  A('2026-09-28T09:10:00.000Z', 'VS Security', 'Peter Dzvova', 'company', 'C-VSS', 'Asked to see full record', 'Tendai Chikwanha', 'PQ-051207'),
  A('2026-09-28T09:02:00.000Z', 'VS Security', 'Peter Dzvova', 'company', 'C-VSS', 'Checked profile', 'Tendai Chikwanha', 'PQ-051207'),
  A('2026-09-27T11:00:00.000Z', 'GEMAK Security Services', 'Rufaro Chikore', 'company', 'C-GMK', 'Asked to see full record', 'Simba Makoni', 'PQ-049925'),
  A('2026-09-22T06:58:00.000Z', 'Public check', '', 'public', null, 'Checked at the gate', 'John Moyo', 'PQ-048392'),
  A('2026-09-10T09:30:00.000Z', 'Simba Makoni', 'Simba Makoni', 'guard', 'PQ-049925', 'Approved full record', 'Sentinel Security Technology for 30 days', 'PQ-049925'),
  A('2026-09-10T08:00:00.000Z', 'Sentinel Security Technology', 'Grace Mutasa', 'company', 'C-SEN', 'Asked to see full record', 'Simba Makoni', 'PQ-049925'),
];

export function seed() {
  return structuredClone({ version: 1, companies, users, guards, employments, records, requests, activity });
}
