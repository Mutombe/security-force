// Demo network: private security companies in Zimbabwe, their people, sites and clients.
// "Today" in the story is late September 2026; dates are chosen so the demo has
// overdue requests, expiring licences, coverage gaps and open disputes to act on.

const DEMO_PASSWORD = 'demo1234';


const companies = [
  { id: 'C-AEG', name: 'GEMAK Security Services', logo: '/logos/gemak.png', city: 'Harare', reg: 'PSR-2011-0142', color: '#3f9a1f', address: '14 Coventry Rd, Workington, Harare', phone: '+263 242 761 440', email: 'ops@gemak.co.zw', licenceExpiry: '2027-03-31', joinedAt: '2025-11-02', status: 'active' },
  { id: 'C-IRN', name: 'JP Security', logo: '/logos/jp.png', city: 'Bulawayo', reg: 'PSR-2014-0388', color: '#1f3f99', address: '9 Fife St, Bulawayo', phone: '+263 292 880 212', email: 'hr@jpsecurity.co.zw', licenceExpiry: '2026-12-15', joinedAt: '2025-11-19', status: 'active' },
  { id: 'C-SEN', name: 'Sentinel Security Technology', logo: '/logos/sentinel.png', city: 'Harare', reg: 'PSR-2016-0517', color: '#1f7a3a', address: '41 Samora Machel Ave, Harare', phone: '+263 242 700 118', email: 'people@sentinel.co.zw', licenceExpiry: '2027-08-01', joinedAt: '2025-12-04', status: 'active' },
  { id: 'C-BAS', name: 'VS Security', logo: '/logos/vs.png', city: 'Mutare', reg: 'PSR-2019-0733', color: '#1e2a5e', address: '3 Herbert Chitepo St, Mutare', phone: '+263 20 206 4471', email: 'admin@vssecurity.co.zw', licenceExpiry: '2026-10-20', joinedAt: '2026-02-10', status: 'active' },
].map((c) => ({
  ...c,
  policy: { slaHours: 72, accessDays: 30, defaultScopes: ['attendance', 'incident', 'disciplinary', 'separation'], requireInAppConsent: true, autoExpireRequests: true },
}));

const users = [
  { id: 'U-01', name: 'Rufaro Chikore', email: 'rufaro@gemak.co.zw', title: 'Head of HR', memberships: [{ companyId: 'C-AEG', role: 'owner' }] },
  { id: 'U-02', name: 'Kelvin Banda', email: 'kelvin@gemak.co.zw', title: 'Night Supervisor', memberships: [{ companyId: 'C-AEG', role: 'supervisor' }] },
  { id: 'U-03', name: 'Themba Ndlovu', email: 'themba@jpsecurity.co.zw', title: 'Operations Director', memberships: [{ companyId: 'C-IRN', role: 'owner' }] },
  { id: 'U-04', name: 'Grace Mutasa', email: 'grace@sentinel.co.zw', title: 'People & Compliance Lead', memberships: [{ companyId: 'C-SEN', role: 'owner' }] },
  { id: 'U-05', name: 'Peter Dzvova', email: 'peter@vssecurity.co.zw', title: 'Managing Director', memberships: [{ companyId: 'C-BAS', role: 'owner' }] },
  { id: 'U-06', name: 'Tariro Mapfumo', email: 'tariro@complyzw.co.zw', title: 'Compliance Consultant', memberships: [{ companyId: 'C-AEG', role: 'hr' }, { companyId: 'C-BAS', role: 'hr' }, { companyId: 'C-SEN', role: 'viewer' }] },
  { id: 'U-07', name: 'Chiedza Nyoni', email: 'chiedza@gemak.co.zw', title: 'HR Officer', memberships: [{ companyId: 'C-AEG', role: 'hr' }] },
  { id: 'U-08', name: 'Simbarashe Ruzvidzo', email: 'auditor@gemak.co.zw', title: 'Internal Auditor', memberships: [{ companyId: 'C-AEG', role: 'viewer' }] },
].map((u) => ({ ...u, kind: 'staff', password: DEMO_PASSWORD, mfa: false, avatar: null, status: 'active', lastActiveAt: '2026-09-22T16:40:00.000Z' }));

const regulators = [
  { id: 'U-R1', kind: 'regulator', name: 'Nyarai Moyo', title: 'Chief Inspector', email: 'inspector@psra.gov.zw', password: DEMO_PASSWORD, mfa: false, avatar: null, status: 'active' },
];

const clients = [
  ['CL-HCC', 'Harare City Council'],
  ['CL-ZCB', 'Zim Commercial Bank'],
  ['CL-BRE', 'Borrowdale Estates'],
  ['CL-MSL', 'Msasa Logistics'],
  ['CL-APH', 'Avondale Pharma'],
  ['CL-NFD', 'National Fuel Depots'],
  ['CL-CSC', 'Cold Storage Company'],
  ['CL-LDC', 'Liquid Data Centres'],
  ['CL-GMB', 'Grain Marketing Board'],
  ['CL-MML', 'Mutare Mall Holdings'],
  ['CL-SDD', 'Sakubva Distribution'],
].map(([id, name]) => ({ id, name }));

const clientUsers = [
  { id: 'U-C1', kind: 'client', clientId: 'CL-HCC', name: 'Farisai Gumbo', title: 'Facilities Manager', email: 'facilities@hararecity.co.zw' },
  { id: 'U-C2', kind: 'client', clientId: 'CL-ZCB', name: 'Tonderai Makoni', title: 'Head of Physical Security', email: 'security@zcb.co.zw' },
].map((u) => ({ ...u, password: DEMO_PASSWORD, mfa: false, avatar: null, status: 'active' }));

const S = (id, companyId, clientId, name, city, risk, posts, shift = '18:00–06:00') => ({ id, companyId, clientId, name, city, risk, posts, shift, active: true });
const sites = [
  S('S-01', 'C-AEG', 'CL-BRE', 'Borrowdale Residential Estate', 'Harare', 'Standard', 2),
  S('S-02', 'C-AEG', 'CL-MSL', 'Msasa Industrial Warehouse', 'Harare', 'High', 2),
  S('S-03', 'C-AEG', 'CL-APH', 'Avondale Pharmacy Warehouse', 'Harare', 'High', 2),
  S('S-04', 'C-AEG', 'CL-HCC', 'Town House (City Hall)', 'Harare', 'Critical', 3, '24h'),
  S('S-05', 'C-IRN', 'CL-NFD', 'Bulawayo Fuel Depot', 'Bulawayo', 'Critical', 3, '24h'),
  S('S-06', 'C-IRN', 'CL-CSC', 'Bulawayo Cold Storage', 'Bulawayo', 'Standard', 1),
  S('S-07', 'C-SEN', 'CL-ZCB', 'Eastgate Bank Branch', 'Harare', 'Critical', 2, '07:00–19:00'),
  S('S-08', 'C-SEN', 'CL-LDC', 'Harare Data Centre', 'Harare', 'Critical', 2, '24h'),
  S('S-09', 'C-SEN', null, 'Sentinel Control Room', 'Harare', 'Standard', 1, '24h'),
  S('S-10', 'C-SEN', 'CL-GMB', 'Gweru Grain Silos', 'Gweru', 'Standard', 2),
  S('S-11', 'C-BAS', 'CL-MML', 'Mutare Mall', 'Mutare', 'Standard', 3),
  S('S-12', 'C-BAS', 'CL-SDD', 'Sakubva Distribution Depot', 'Mutare', 'High', 2),
  S('S-13', 'C-SEN', 'CL-HCC', 'Rowan Martin Civic Offices', 'Harare', 'High', 2, '18:00–06:00'),
];

const V = (a, b, c, d) => ({ identity: !!a, qualifications: !!b, employment: !!c, references: !!d });
const guards = [
  ['SG-00048392', 'John Moyo', '63-1184520-K-42', '1991-04-12', 'M', 'Harare', '+263 77 214 5580', V(1, 1, 1, 1), '2028-01-31'],
  ['SG-00051207', 'Tendai Chikwanha', '08-2291034-P-27', '1988-09-30', 'M', 'Harare', '+263 71 998 2041', V(1, 1, 1, 0), '2027-04-30'],
  ['SG-00053318', 'Rudo Ncube', '08-3310921-B-08', '1995-01-22', 'F', 'Bulawayo', '+263 78 440 1128', V(1, 1, 1, 1), '2027-11-30'],
  ['SG-00039946', 'Farai Mutasa', '07-1120394-F-63', '1984-11-03', 'M', 'Bulawayo', '+263 77 330 9002', V(1, 1, 1, 1), '2027-06-30'],
  ['SG-00060412', 'Blessing Sibanda', '75-4432190-S-75', '1997-06-17', 'F', 'Mutare', '+263 71 552 7310', V(1, 0, 1, 0), '2027-02-28'],
  ['SG-00057731', 'Tatenda Nyathi', '63-2209881-N-42', '1993-02-08', 'M', 'Harare', '+263 78 102 6645', V(1, 1, 1, 1), '2026-10-15'],
  ['SG-00044180', 'Kudzai Dube', '29-1109345-D-29', '1986-07-25', 'M', 'Gweru', '+263 77 801 3319', V(1, 1, 1, 1), '2027-09-30'],
  ['SG-00049925', 'Simba Makoni', '08-4412290-M-08', '1990-12-14', 'M', 'Bulawayo', '+263 71 660 4127', V(1, 1, 1, 0), '2027-01-31'],
  ['SG-00062274', 'Nyasha Chirwa', '75-2231188-C-75', '1999-03-29', 'F', 'Mutare', '+263 78 993 1250', V(1, 0, 0, 0), '2027-12-31'],
  ['SG-00058803', 'Tafadzwa Gumbo', '63-3345120-G-42', '1994-08-11', 'M', 'Harare', '+263 77 145 8833', V(1, 1, 1, 1), '2026-08-30'],
  ['SG-00059941', 'Chipo Mhlanga', '63-4410029-H-42', '1996-10-05', 'F', 'Harare', '+263 71 224 5609', V(1, 1, 1, 1), '2028-03-31'],
  ['SG-00061150', 'Tinashe Zhou', '63-5528134-Z-42', '1998-05-19', 'M', 'Harare', '+263 78 311 7742', V(1, 1, 1, 0), '2027-05-31'],
  ['SG-00063015', 'Tapiwa Marufu', '63-6120447-T-42', '1992-03-09', 'M', 'Harare', '+263 77 612 0447', V(1, 1, 1, 1), '2027-10-31'],
  ['SG-00063377', 'Memory Chiweshe', '63-6177301-C-42', '2000-07-21', 'F', 'Harare', '+263 71 617 7301', V(1, 1, 0, 0), '2028-01-15'],
  ['SG-00050581', 'Brighton Mhike', '63-2058110-M-42', '1989-05-30', 'M', 'Harare', '+263 78 205 8110', V(1, 1, 1, 1), '2027-07-31'],
  ['SG-00054422', 'Ruvimbo Sithole', '63-3442218-S-42', '1994-12-02', 'F', 'Harare', '+263 77 344 2218', V(1, 1, 1, 1), '2027-03-31'],
  ['SG-00047760', 'Takudzwa Mlambo', '08-1776055-M-08', '1987-01-17', 'M', 'Bulawayo', '+263 71 177 6055', V(1, 1, 1, 1), '2027-08-31'],
  ['SG-00055903', 'Precious Moyo', '08-5590312-M-08', '1996-09-08', 'F', 'Bulawayo', '+263 78 559 0312', V(1, 1, 1, 0), '2027-12-31'],
  ['SG-00056612', 'Obert Chinyoka', '08-5661209-C-08', '1983-04-26', 'M', 'Bulawayo', '+263 77 566 1209', V(1, 1, 1, 1), '2026-11-05'],
  ['SG-00064120', 'Anesu Garwe', '75-6412031-G-75', '2001-11-11', 'M', 'Mutare', '+263 71 641 2031', V(1, 0, 0, 0), '2028-02-28'],
  ['SG-00052290', 'Lovemore Tshuma', '75-2229088-T-75', '1985-06-13', 'M', 'Mutare', '+263 78 222 9088', V(1, 1, 1, 1), '2027-06-30'],
  ['SG-00046631', 'Shingirai Kapfumvuti', '29-4663107-K-29', '1982-08-19', 'M', 'Gweru', '+263 77 466 3107', V(1, 1, 1, 1), '2027-04-30'],
].map(([id, name, nationalId, dob, gender, city, phone, verification, licenceExpiry], i) => ({
  id, name, nationalId, dob, gender, city, phone, verification,
  licence: { number: `PSL-${String(400120 + i * 137).padStart(6, '0')}`, expiry: licenceExpiry },
  avatar: null,
  createdAt: '2025-11-02T08:00:00.000Z',
}));

const sep = (category, rehire, note, date) => ({ category, rehire, note, date });
const E = (id, guardId, companyId, position, siteId, start, end, attendance, separation = null) => ({ id, guardId, companyId, position, siteId, start, end, attendance, separation });
const employments = [
  E('E-01', 'SG-00048392', 'C-AEG', 'Security Officer', 'S-01', '2022-02-01', '2024-03-31', 91, sep('Resignation', 'Eligible', 'Left on good terms to relocate to Bulawayo.', '2024-03-31')),
  E('E-02', 'SG-00048392', 'C-IRN', 'Senior Security Officer', 'S-05', '2024-05-01', '2025-06-30', 96, sep('Contract ended', 'Eligible', 'Fixed-term contract completed.', '2025-06-30')),
  E('E-03', 'SG-00048392', 'C-SEN', 'Shift Supervisor', 'S-07', '2025-08-01', null, 97),
  E('E-04', 'SG-00051207', 'C-AEG', 'Security Officer', 'S-02', '2021-06-01', '2025-01-15', 78, sep('Dismissal — misconduct', 'Not eligible', 'Dismissed after a disciplinary hearing on 10 Jan 2025 (unauthorised absence from post).', '2025-01-15')),
  E('E-05', 'SG-00053318', 'C-SEN', 'Control Room Operator', 'S-09', '2023-03-01', null, 99),
  E('E-06', 'SG-00039946', 'C-IRN', 'Site Supervisor', 'S-05', '2020-01-06', null, 95),
  E('E-07', 'SG-00060412', 'C-BAS', 'Security Officer', 'S-11', '2024-02-12', null, 93),
  E('E-08', 'SG-00057731', 'C-AEG', 'Security Officer', 'S-03', '2023-09-04', null, 94),
  E('E-09', 'SG-00044180', 'C-SEN', 'Security Officer', 'S-10', '2020-04-01', '2023-08-31', 92, sep('Resignation', 'Eligible', 'Resigned to take a supervisory role.', '2023-08-31')),
  E('E-10', 'SG-00044180', 'C-AEG', 'Site Supervisor', 'S-01', '2023-10-02', null, 96),
  E('E-11', 'SG-00049925', 'C-IRN', 'Security Officer', 'S-06', '2022-01-10', '2024-11-20', 71, sep('Absconded', 'Conditional', 'Stopped reporting for duty from 20 Nov 2024. Company keys returned 2 Dec 2024.', '2024-11-20')),
  E('E-12', 'SG-00062274', 'C-BAS', 'Trainee Security Officer', 'S-12', '2025-01-20', null, 90),
  E('E-13', 'SG-00058803', 'C-AEG', 'Security Officer', 'S-02', '2024-04-15', null, 88),
  E('E-14', 'SG-00059941', 'C-SEN', 'Access Control Officer', 'S-08', '2024-06-03', null, 98),
  E('E-15', 'SG-00061150', 'C-AEG', 'Security Officer', 'S-03', '2025-03-01', '2026-02-28', 93, sep('Contract ended', 'Eligible', 'Seasonal contract completed.', '2026-02-28')),
  E('E-16', 'SG-00063015', 'C-SEN', 'Security Officer', 'S-13', '2025-11-03', null, 95),
  E('E-17', 'SG-00063377', 'C-SEN', 'Security Officer', 'S-13', '2026-01-12', null, 97),
  E('E-18', 'SG-00050581', 'C-AEG', 'Security Officer', 'S-01', '2022-07-18', null, 92),
  E('E-19', 'SG-00054422', 'C-AEG', 'Response Team Officer', 'S-02', '2023-05-02', null, 95),
  E('E-20', 'SG-00047760', 'C-IRN', 'Security Officer', 'S-05', '2021-09-13', null, 89),
  E('E-21', 'SG-00055903', 'C-IRN', 'Access Control Officer', 'S-05', '2024-01-08', null, 96),
  E('E-22', 'SG-00056612', 'C-IRN', 'Security Officer', 'S-06', '2023-06-19', null, 84),
  E('E-23', 'SG-00064120', 'C-BAS', 'Security Officer', 'S-11', '2026-03-02', null, 91),
  E('E-24', 'SG-00052290', 'C-BAS', 'Senior Security Officer', 'S-12', '2022-10-10', null, 94),
  E('E-25', 'SG-00046631', 'C-SEN', 'Site Supervisor', 'S-10', '2021-02-15', null, 93),
];

const R = (id, guardId, companyId, type, title, date, detail = '', extra = {}) => ({
  id, guardId, companyId, type, title, date, detail, severity: null, expires: null, evidence: '', retracted: false, createdAt: date + 'T09:00:00.000Z', createdBy: null, ...extra,
});
const records = [
  R('R-01', 'SG-00048392', 'C-AEG', 'training', 'Basic Security Training (Grade C)', '2022-02-20', 'Certificate BST-22-0412.'),
  R('R-02', 'SG-00048392', 'C-AEG', 'training', 'First Aid Level 1', '2023-06-14', 'Red Cross certificate FA1-7781.', { expires: '2025-06-14' }),
  R('R-03', 'SG-00048392', 'C-AEG', 'incident', 'Gate left unsecured at shift change', '2023-10-08', 'Pedestrian gate found unlatched at 06:05 handover. No loss. Officer counselled.', { severity: 'Minor', evidence: 'OB entry 118/23' }),
  R('R-04', 'SG-00048392', 'C-AEG', 'disciplinary', 'Written warning — late reporting', '2023-11-02', 'Three late arrivals within 30 days.', { severity: 'Minor', evidence: 'HR file DW-23-041' }),
  R('R-05', 'SG-00048392', 'C-IRN', 'training', 'Fire Safety & Evacuation', '2024-07-19', 'In-house course, 16 hours.'),
  R('R-06', 'SG-00048392', 'C-IRN', 'commendation', 'Prevented perimeter break-in', '2024-12-03', 'Detected and reported an attempted fence breach at 02:40; police responded within 12 minutes.'),
  R('R-07', 'SG-00048392', 'C-IRN', 'training', 'CCTV Operations', '2025-01-27', 'Certificate CCTV-25-118.'),
  R('R-08', 'SG-00048392', 'C-SEN', 'training', 'Access Control Systems', '2025-09-10', 'Vendor certification (HID).', { expires: '2027-09-10' }),
  R('R-09', 'SG-00051207', 'C-AEG', 'training', 'Basic Security Training (Grade C)', '2021-06-18', 'Certificate BST-21-0201.'),
  R('R-10', 'SG-00051207', 'C-AEG', 'disciplinary', 'Final written warning — sleeping on duty', '2024-08-21', 'Found asleep at post during supervisor patrol, 03:15.', { severity: 'Moderate', evidence: 'Patrol log PL-2408-77' }),
  R('R-11', 'SG-00051207', 'C-AEG', 'incident', 'Unauthorised absence from post', '2025-01-04', 'Post unmanned for about 2 hours during night shift. Warehouse unaffected.', { severity: 'Serious', evidence: 'CCTV ref MSQ-0104' }),
  R('R-12', 'SG-00053318', 'C-SEN', 'training', 'CCTV Operations', '2023-04-12', 'Certificate CCTV-23-044.'),
  R('R-13', 'SG-00053318', 'C-SEN', 'commendation', 'Control room operator of the quarter', '2025-10-01', 'Coordinated the response to three alarm activations in one night.'),
  R('R-14', 'SG-00039946', 'C-IRN', 'training', 'Supervisory Management', '2021-03-09', 'Certificate SM-21-009.'),
  R('R-15', 'SG-00039946', 'C-IRN', 'commendation', 'Five-year long-service award', '2025-01-06'),
  R('R-16', 'SG-00060412', 'C-BAS', 'training', 'Basic Security Training (Grade C)', '2024-02-28', 'Certificate BST-24-0098.'),
  R('R-17', 'SG-00057731', 'C-AEG', 'training', 'First Aid Level 1', '2024-02-11', '', { expires: '2026-02-11' }),
  R('R-18', 'SG-00044180', 'C-SEN', 'training', 'Basic Security Training (Grade B)', '2020-04-20'),
  R('R-19', 'SG-00044180', 'C-AEG', 'training', 'Supervisory Management', '2024-05-17'),
  R('R-20', 'SG-00049925', 'C-IRN', 'training', 'Basic Security Training (Grade C)', '2022-01-28'),
  R('R-21', 'SG-00049925', 'C-IRN', 'incident', 'Loss of site key set', '2024-06-11', 'Master key set reported missing; locks replaced at company cost.', { severity: 'Moderate', evidence: 'OB entry 311/24' }),
  R('R-22', 'SG-00062274', 'C-BAS', 'training', 'Induction — Trainee Programme', '2025-02-01'),
  R('R-23', 'SG-00058803', 'C-AEG', 'training', 'Basic Security Training (Grade C)', '2024-04-30'),
  R('R-24', 'SG-00059941', 'C-SEN', 'training', 'Access Control Systems', '2024-07-08', '', { expires: '2026-07-08' }),
  R('R-25', 'SG-00061150', 'C-AEG', 'training', 'Basic Security Training (Grade C)', '2025-03-15'),
  R('R-26', 'SG-00061150', 'C-AEG', 'commendation', 'Perfect attendance — Q3 2025', '2025-10-02'),
  R('R-27', 'SG-00050581', 'C-AEG', 'training', 'Basic Security Training (Grade C)', '2022-08-01'),
  R('R-28', 'SG-00054422', 'C-AEG', 'training', 'Armed Response Competency', '2024-11-01', 'Range certificate ARC-24-0019.', { expires: '2026-11-01' }),
  R('R-29', 'SG-00047760', 'C-IRN', 'training', 'Basic Security Training (Grade C)', '2021-10-02'),
  R('R-30', 'SG-00055903', 'C-IRN', 'training', 'Access Control Systems', '2024-02-20', '', { expires: '2026-10-10' }),
  R('R-31', 'SG-00052290', 'C-BAS', 'training', 'First Aid Level 1', '2025-10-20', '', { expires: '2027-10-20' }),
  R('R-32', 'SG-00046631', 'C-SEN', 'training', 'Supervisory Management', '2022-06-15'),
  R('R-33', 'SG-00064120', 'C-BAS', 'training', 'Induction — Security Officer', '2026-03-09'),
  R('R-34', 'SG-00063015', 'C-SEN', 'training', 'Basic Security Training (Grade C)', '2025-11-20'),
  R('R-35', 'SG-00063377', 'C-SEN', 'training', 'Basic Security Training (Grade C)', '2026-01-28'),
  R('R-36', 'SG-00056612', 'C-IRN', 'training', 'Basic Security Training (Grade C)', '2023-07-01'),
  R('R-37', 'SG-00044180', 'C-SEN', 'disciplinary', 'Written warning — uniform non-compliance', '2022-05-10', 'Reported for duty without issued boots twice in one week.', { severity: 'Minor', evidence: 'HR file SW-22-018' }),
  R('R-38', 'SG-00060412', 'C-BAS', 'commendation', 'Reported suspicious vehicle; theft prevented', '2025-06-02', 'Vehicle registration passed to ZRP; suspects arrested the same night.'),
  R('R-39', 'SG-00056612', 'C-IRN', 'incident', 'Late handover — 40 minutes', '2026-08-14', 'Relief officer waited 40 minutes; post was covered throughout.', { severity: 'Minor', evidence: 'OB entry 204/26' }),
];

const APP = (id, companyId, name, nationalId, guardId, stage, position, siteId, createdAt, notes = '', phone = '') => ({ id, companyId, name, nationalId, guardId, stage, position, siteId, createdAt, notes, phone, updatedAt: createdAt });
const applicants = [
  APP('AP-01', 'C-AEG', 'Tinashe Zhou', '63-5528134-Z-42', 'SG-00061150', 'screening', 'Security Officer', 'S-04', '2026-09-15T09:10:00.000Z', 'Worked with us before (S-03). Strong attendance.', '+263 78 311 7742'),
  APP('AP-02', 'C-AEG', 'Simba Makoni', '08-4412290-M-08', 'SG-00049925', 'verification', 'Security Officer', 'S-04', '2026-09-18T11:30:00.000Z', 'Separation at previous employer needs clarifying.', '+263 71 660 4127'),
  APP('AP-03', 'C-AEG', 'Fadzai Mutero', '63-6612094-M-42', null, 'applied', 'Security Officer', 'S-04', '2026-09-21T08:45:00.000Z', 'Walk-in applicant. Grade C certificate claimed.', '+263 77 661 2094'),
  APP('AP-04', 'C-AEG', 'Blessmore Chuma', '63-7011834-C-42', null, 'screening', 'Security Officer', 'S-03', '2026-09-17T14:00:00.000Z', 'Referred by Kudzai Dube.', '+263 71 701 1834'),
  APP('AP-05', 'C-AEG', 'Rutendo Mhaka', '63-7200551-M-42', null, 'offer', 'Access Control Officer', 'S-04', '2026-09-08T10:20:00.000Z', 'Offer sent 20 Sep. Awaiting signature.', '+263 78 720 0551'),
  APP('AP-06', 'C-AEG', 'Nigel Sibanda', '63-7288190-S-42', null, 'rejected', 'Security Officer', 'S-02', '2026-09-02T12:00:00.000Z', 'Did not attend interview.', '+263 77 728 8190'),
  APP('AP-07', 'C-BAS', 'Tendai Chikwanha', '08-2291034-P-27', 'SG-00051207', 'verification', 'Security Officer', 'S-11', '2026-09-18T09:00:00.000Z', 'Night shift, Mutare Mall.', '+263 71 998 2041'),
  APP('AP-08', 'C-IRN', 'Tinashe Zhou', '63-5528134-Z-42', 'SG-00061150', 'verification', 'Security Officer', 'S-05', '2026-09-20T13:00:00.000Z', 'Relief pool.', '+263 78 311 7742'),
  APP('AP-09', 'C-SEN', 'Simba Makoni', '08-4412290-M-08', 'SG-00049925', 'offer', 'Security Officer', 'S-08', '2026-09-09T08:00:00.000Z', 'Verification received from JP Security.', '+263 71 660 4127'),
];

const REQ = (o) => ({ releasedScopes: [], respondedAt: null, responseNote: '', respondedBy: null, accessExpiresAt: null, ...o });
const requests = [
  REQ({ id: 'VR-01', guardId: 'SG-00051207', fromCompanyId: 'C-BAS', toCompanyId: 'C-AEG', requestedScopes: ['attendance', 'incident', 'disciplinary', 'separation'], purpose: 'Applicant for night-shift officer at Mutare Mall.', consent: 'granted', consentAt: '2026-09-19T10:40:00.000Z', status: 'pending', createdAt: '2026-09-19T10:22:00.000Z', dueAt: '2026-09-22T10:22:00.000Z', createdBy: 'Peter Dzvova' }),
  REQ({ id: 'VR-02', guardId: 'SG-00049925', fromCompanyId: 'C-SEN', toCompanyId: 'C-IRN', requestedScopes: ['attendance', 'incident', 'separation'], releasedScopes: ['attendance', 'incident', 'separation'], purpose: 'Pre-employment screening, Harare Data Centre.', consent: 'granted', consentAt: '2026-09-10T09:00:00.000Z', status: 'approved', createdAt: '2026-09-10T08:05:00.000Z', dueAt: '2026-09-13T08:05:00.000Z', respondedAt: '2026-09-11T14:40:00.000Z', responseNote: 'Released per applicant consent.', respondedBy: 'Themba Ndlovu', accessExpiresAt: '2026-10-11T14:40:00.000Z', createdBy: 'Grace Mutasa' }),
  REQ({ id: 'VR-03', guardId: 'SG-00044180', fromCompanyId: 'C-AEG', toCompanyId: 'C-SEN', requestedScopes: ['attendance', 'disciplinary', 'separation'], releasedScopes: ['attendance', 'disciplinary', 'separation'], purpose: 'Hiring for Site Supervisor, Borrowdale.', consent: 'offline', consentAt: '2023-09-12T09:00:00.000Z', status: 'approved', createdAt: '2023-09-12T09:00:00.000Z', dueAt: '2023-09-15T09:00:00.000Z', respondedAt: '2023-09-13T11:00:00.000Z', respondedBy: 'Grace Mutasa', accessExpiresAt: '2023-10-13T11:00:00.000Z', createdBy: 'Rufaro Chikore' }),
  REQ({ id: 'VR-04', guardId: 'SG-00061150', fromCompanyId: 'C-IRN', toCompanyId: 'C-AEG', requestedScopes: ['attendance', 'separation'], purpose: 'Applicant for the Bulawayo Fuel Depot relief pool.', consent: 'granted', consentAt: '2026-09-21T16:02:00.000Z', status: 'pending', createdAt: '2026-09-21T15:30:00.000Z', dueAt: '2026-09-24T15:30:00.000Z', createdBy: 'Themba Ndlovu' }),
  REQ({ id: 'VR-05', guardId: 'SG-00049925', fromCompanyId: 'C-AEG', toCompanyId: 'C-IRN', requestedScopes: ['attendance', 'incident', 'separation'], purpose: 'Applicant for Town House (City Hall), 24h post.', consent: 'pending', consentAt: null, status: 'awaiting_consent', createdAt: '2026-09-22T09:00:00.000Z', dueAt: '2026-09-25T09:00:00.000Z', createdBy: 'Rufaro Chikore' }),
];

// A grant is what an approved request (or a guard's share code) actually unlocks.
const grants = [
  { id: 'G-01', guardId: 'SG-00049925', viewerCompanyId: 'C-SEN', sourceCompanyId: 'C-IRN', scopes: ['attendance', 'incident', 'separation'], via: 'request', refId: 'VR-02', createdAt: '2026-09-11T14:40:00.000Z', expiresAt: '2026-10-11T14:40:00.000Z', revokedAt: null },
  { id: 'G-02', guardId: 'SG-00044180', viewerCompanyId: 'C-AEG', sourceCompanyId: 'C-SEN', scopes: ['attendance', 'disciplinary', 'separation'], via: 'request', refId: 'VR-03', createdAt: '2023-09-13T11:00:00.000Z', expiresAt: '2023-10-13T11:00:00.000Z', revokedAt: null },
];

const shares = [
  { id: 'SH-01', guardId: 'SG-00048392', code: 'JM4-82QX', label: 'Job applications — Sept 2026', scopes: ['attendance', 'incident', 'disciplinary', 'separation'], createdAt: '2026-09-20T18:00:00.000Z', expiresAt: '2026-10-07T18:00:00.000Z', revokedAt: null, redemptions: [] },
];

const responses = [
  { id: 'RS-01', guardId: 'SG-00051207', companyId: 'C-AEG', targetType: 'employment', targetId: 'E-04', text: 'I was absent because of a family medical emergency. I phoned the supervisor at 01:10 and gave a hospital letter to HR on 12 Jan 2025.', status: 'open', companyNote: '', createdAt: '2026-09-15T12:00:00.000Z', dueAt: '2026-09-29T12:00:00.000Z', escalatedAt: null, regulatorNote: '' },
  { id: 'RS-02', guardId: 'SG-00049925', companyId: 'C-IRN', targetType: 'record', targetId: 'R-21', text: 'The keys were taken from the guard hut during a break-in that was reported to ZRP (RRB 4471/24). I was not negligent.', status: 'escalated', companyNote: 'Record maintained: keys were left unsecured in the hut, contrary to site instructions.', resolvedAt: '2026-09-05T14:20:00.000Z', resolvedBy: 'Themba Ndlovu', createdAt: '2026-08-30T10:00:00.000Z', dueAt: '2026-09-13T10:00:00.000Z', escalatedAt: '2026-09-12T08:30:00.000Z', regulatorNote: '' },
];

const checks = [
  { id: 'CK-01', clientId: 'CL-HCC', siteId: 'S-13', guardId: 'SG-00063015', input: 'SG-00063015', result: 'verified', ts: '2026-09-22T18:04:00.000Z', by: 'Farisai Gumbo' },
  { id: 'CK-02', clientId: 'CL-HCC', siteId: 'S-13', guardId: 'SG-00063377', input: 'SG-00063377', result: 'verified', ts: '2026-09-22T18:06:00.000Z', by: 'Farisai Gumbo' },
  { id: 'CK-03', clientId: 'CL-HCC', siteId: 'S-04', guardId: null, input: 'SG-00091234', result: 'invalid', ts: '2026-09-21T19:30:00.000Z', by: 'Farisai Gumbo' },
  { id: 'CK-04', clientId: 'CL-ZCB', siteId: 'S-07', guardId: 'SG-00048392', input: 'SG-00048392', result: 'verified', ts: '2026-09-22T06:58:00.000Z', by: 'Tonderai Makoni' },
];

const apiKeys = [
  { id: 'K-01', companyId: 'C-AEG', name: 'Sage Payroll sync', prefix: 'sf_live_7Hq2', scopes: ['employments:write', 'attendance:write'], createdAt: '2026-01-14T09:00:00.000Z', createdBy: 'Rufaro Chikore', lastUsedAt: '2026-09-23T02:00:00.000Z', revokedAt: null },
  { id: 'K-02', companyId: 'C-AEG', name: 'Roster system (read-only)', prefix: 'sf_live_p9Xa', scopes: ['guards:read', 'sites:read'], createdAt: '2026-04-02T09:00:00.000Z', createdBy: 'Rufaro Chikore', lastUsedAt: '2026-09-22T21:15:00.000Z', revokedAt: null },
];
const webhooks = [
  { id: 'WH-01', companyId: 'C-AEG', url: 'https://erp.gemak.co.zw/hooks/security-force', events: ['verification.requested', 'response.submitted', 'licence.expiring'], active: true, createdAt: '2026-02-01T09:00:00.000Z', lastDelivery: { at: '2026-09-22T09:00:05.000Z', status: 200 } },
];
const imports = [
  { id: 'IM-01', companyId: 'C-AEG', file: 'sage-attendance-aug-2026.csv', kind: 'attendance', rows: 7, status: 'completed', createdAt: '2026-09-01T02:00:00.000Z', by: 'Sage Payroll sync' },
];

const sessions = [
  { id: 'SS-01', userId: 'U-01', device: 'Chrome on Windows', ip: '41.174.12.8', location: 'Harare, ZW', createdAt: '2026-09-22T07:55:00.000Z', lastSeenAt: '2026-09-22T16:40:00.000Z', current: false },
  { id: 'SS-02', userId: 'U-01', device: 'Safari on iPhone', ip: '77.246.51.20', location: 'Harare, ZW', createdAt: '2026-09-18T19:10:00.000Z', lastSeenAt: '2026-09-21T21:02:00.000Z', current: false },
];

const N = (id, to, title, body, link, ts, read = false) => ({ id, to, title, body, link, ts, read });
const notifications = [
  N('N-01', 'company:C-AEG', 'Verification request overdue', 'VS Security asked about Tendai Chikwanha 4 days ago. Your 72-hour target has passed.', { name: 'verification' }, '2026-09-22T10:22:00.000Z'),
  N('N-02', 'company:C-AEG', 'New verification request', 'JP Security asked about Tinashe Zhou.', { name: 'verification' }, '2026-09-21T15:30:00.000Z'),
  N('N-03', 'company:C-AEG', 'Guard response to review', 'Tendai Chikwanha responded to a separation record.', { name: 'disputes' }, '2026-09-15T12:00:00.000Z'),
  N('N-04', 'company:C-AEG', 'Licence expired', "Tafadzwa Gumbo's security licence expired on 30 Aug 2026.", { name: 'guard', params: { id: 'SG-00058803' } }, '2026-08-30T06:00:00.000Z', true),
  N('N-05', 'guard:SG-00049925', 'Consent needed', 'GEMAK Security Services wants to verify your employment with JP Security.', { name: 'consents' }, '2026-09-22T09:00:00.000Z'),
  N('N-06', 'guard:SG-00051207', 'Your response is under review', 'GEMAK Security Services has until 29 Sep to respond.', { name: 'responses' }, '2026-09-15T12:00:00.000Z', true),
  N('N-07', 'regulator', 'Dispute escalated', 'Simba Makoni escalated a dispute with JP Security.', { name: 'escalations' }, '2026-09-12T08:30:00.000Z'),
  N('N-08', 'client:CL-HCC', 'Coverage gap at Town House', 'GEMAK Security Services has 0 of 3 posts filled at Town House (City Hall).', { name: 'sites' }, '2026-09-23T06:00:00.000Z'),
  N('N-09', 'guard:SG-00048392', 'Share code used', 'Your share code JM4-82QX is valid until 7 Oct.', { name: 'sharing' }, '2026-09-20T18:00:00.000Z', true),
];

const A = (ts, actor, actorUser, actorRole, actorId, action, detail, guardId = null) => ({ ts, actor, actorUser, actorRole, actorId, action, detail, guardId });
const audit = [
  A('2026-09-22T09:00:00.000Z', 'GEMAK Security Services', 'Rufaro Chikore', 'staff', 'C-AEG', 'Requested verification', 'Simba Makoni (SG-00049925) from JP Security — awaiting consent', 'SG-00049925'),
  A('2026-09-21T16:02:00.000Z', 'Tinashe Zhou', 'Tinashe Zhou', 'guard', 'SG-00061150', 'Gave consent', 'JP Security may request records from GEMAK Security Services', 'SG-00061150'),
  A('2026-09-21T15:30:00.000Z', 'JP Security', 'Themba Ndlovu', 'staff', 'C-IRN', 'Requested verification', 'Tinashe Zhou (SG-00061150) from GEMAK Security Services', 'SG-00061150'),
  A('2026-09-19T10:22:00.000Z', 'VS Security', 'Peter Dzvova', 'staff', 'C-BAS', 'Requested verification', 'Tendai Chikwanha (SG-00051207) from GEMAK Security Services', 'SG-00051207'),
  A('2026-09-19T10:15:00.000Z', 'VS Security', 'Peter Dzvova', 'staff', 'C-BAS', 'Viewed profile', 'Tendai Chikwanha (SG-00051207)', 'SG-00051207'),
  A('2026-09-15T12:00:00.000Z', 'Tendai Chikwanha', 'Tendai Chikwanha', 'guard', 'SG-00051207', 'Submitted response', 'Responded to separation record at GEMAK Security Services', 'SG-00051207'),
  A('2026-09-12T08:30:00.000Z', 'Simba Makoni', 'Simba Makoni', 'guard', 'SG-00049925', 'Escalated dispute', 'Loss of site key set — JP Security', 'SG-00049925'),
  A('2026-09-11T14:40:00.000Z', 'JP Security', 'Themba Ndlovu', 'staff', 'C-IRN', 'Approved verification', 'Released attendance, incident, separation of Simba Makoni to Sentinel Security Technology', 'SG-00049925'),
  A('2026-09-10T08:05:00.000Z', 'Sentinel Security Technology', 'Grace Mutasa', 'staff', 'C-SEN', 'Requested verification', 'Simba Makoni (SG-00049925) from JP Security', 'SG-00049925'),
  A('2026-09-08T07:30:00.000Z', 'Zim Commercial Bank', 'Tonderai Makoni', 'client', 'CL-ZCB', 'Client verification check', 'John Moyo (SG-00048392) — verified at Eastgate Bank Branch', 'SG-00048392'),
  A('2026-09-01T02:00:00.000Z', 'GEMAK Security Services', 'Sage Payroll sync', 'integration', 'C-AEG', 'Imported attendance', 'sage-attendance-aug-2026.csv — 7 rows'),
].map((a, i) => ({ id: `A-SEED-${String(i).padStart(2, '0')}`, ...a }));

export function seed() {
  return structuredClone({
    meta: { version: 3, seededAt: new Date().toISOString() },
    settings: { network: 'normal', idleLockMinutes: 15 },
    companies,
    users: [...users, ...regulators, ...clientUsers],
    clients,
    sites,
    guards,
    employments,
    records,
    applicants,
    requests,
    grants,
    shares,
    responses,
    checks,
    apiKeys,
    webhooks,
    imports,
    sessions,
    notifications,
    audit,
  });
}
