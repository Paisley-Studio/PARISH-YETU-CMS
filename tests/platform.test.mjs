/* PARISH YETU - integration tests against the Firebase emulators (Auth + Firestore with firestore.rules).
 * Run:  npm test   (uses firebase.test.json: Firestore 8180, Auth 9199, so it never touches other emulators)
 * The Cloudflare Worker module is imported directly and driven with standard Request objects. */
import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../r2-worker/src/index.js';
import { encodeFields, decodeFields } from '../r2-worker/src/firebase.js';
import S from '../r2-worker/src/slug.js';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const P = 'church-cms-4d735';
const FS = 'http://127.0.0.1:8180/v1/projects/' + P + '/databases/(default)/documents';
const AUTH = 'http://127.0.0.1:9199';
const ENV = {
  FIREBASE_EMULATORS: 'true', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8180', AUTH_EMULATOR_HOST: '127.0.0.1:9199',
  ALLOWED_ORIGIN: 'http://localhost:5000', R2_BUCKET: 'test', R2_ACCOUNT_ID: 'acct', R2_ACCESS_KEY_ID: 'k', R2_SECRET_ACCESS_KEY: 's',
};

/* ---------- helpers ---------- */
async function signUp(email) {
  const r = await fetch(AUTH + '/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'Passw0rd!long', returnSecureToken: true }) });
  const j = await r.json(); assert.ok(j.idToken, JSON.stringify(j)); return { uid: j.localId, token: j.idToken, email };
}
async function refresh(u) { // new token (carries updated custom claims)
  const r = await fetch(AUTH + '/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: u.email, password: 'Passw0rd!long', returnSecureToken: true }) });
  const j = await r.json(); u.token = j.idToken; return u;
}
const H = t => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + (t || 'owner') });
async function put(path, data, token) { // full overwrite (owner bypasses rules)
  return fetch(FS + '/' + path, { method: 'PATCH', headers: H(token), body: JSON.stringify({ fields: encodeFields(data) }) });
}
async function patch(path, data, token) { // update listed fields only (rules: update)
  const mask = Object.keys(data).map(k => 'updateMask.fieldPaths=' + encodeURIComponent(k)).join('&');
  return fetch(FS + '/' + path + '?' + mask + '&currentDocument.exists=true', { method: 'PATCH', headers: H(token), body: JSON.stringify({ fields: encodeFields(data) }) });
}
async function get(path, token) {
  const r = await fetch(FS + '/' + path, { headers: token === null ? {} : H(token) });
  return { status: r.status, data: r.ok ? decodeFields((await r.json()).fields) : null };
}
async function api(path, body, token) {
  const r = await worker.fetch(new Request('https://api.test' + path, { method: 'POST', headers: { ...H(token), Origin: 'http://localhost:5000' }, body: JSON.stringify(body) }), ENV);
  return { status: r.status, body: await r.json() };
}
async function claims(uid) {
  const r = await fetch(AUTH + '/identitytoolkit.googleapis.com/v1/projects/' + P + '/accounts:lookup', { method: 'POST', headers: H('owner'), body: JSON.stringify({ localId: [uid] }) });
  const u = (await r.json()).users[0]; return JSON.parse(u.customAttributes || '{}');
}
const reg = (o = {}) => ({
  parish: { name: "St. Mary's Parish, Thika", parishType: 'Parish', country: 'Kenya', county: 'Kiambu', town: 'Thika', address: 'Kenyatta Hwy', phone: '+254 700 000 001', email: 'office@stmarys.test', ...(o.parish || {}) },
  hierarchy: { dioceseId: 'murang-a', deaneryId: 'thika', ...(o.hierarchy || {}) },
  admin: { name: 'Mary Wanjiku', phone: '+254 700 000 002', ...(o.admin || {}) },
  branding: { motto: 'Ut omnes unum sint', about: 'A welcoming parish.', patron: 'Blessed Virgin Mary', ...(o.branding || {}) },
  agree: true, ...(o.top || {}),
});

let superU, adminA, staffB, memberB, applicant;

test.before(async () => {
  await fetch('http://127.0.0.1:8180/emulator/v1/projects/' + P + '/databases/(default)/documents', { method: 'DELETE' });
  await fetch(AUTH + '/emulator/v1/projects/' + P + '/accounts', { method: 'DELETE' });
  superU = await signUp('super@test.org');
  staffB = await signUp('priest@holyfamily.test');
  memberB = await signUp('member@holyfamily.test');
  await put('users/' + superU.uid, { name: 'Platform', email: superU.email, role: 'super', status: 'active', parishId: '' });
  await put('dioceses/murang-a', { name: "Diocese of Murang'a", archdiocese: 'Archdiocese of Nyeri', country: 'Kenya', status: 'active', deaneries: [{ id: 'thika', name: 'Thika', status: 'active' }] });
  await put('dioceses/nairobi', { name: 'Archdiocese of Nairobi', kind: 'Archdiocese', country: 'Kenya', status: 'active', deaneries: [{ id: 'westlands', name: 'Westlands', status: 'active' }] });
  // a legacy parish created before slugs / name keys existed
  await put('parishes/holy-family-nairobi', { name: 'Holy Family Basilica', town: 'Nairobi', dioceseId: 'nairobi', deanery: 'Westlands', status: 'active' });
  await put('churchDirectory/holy-family-nairobi', { name: 'Holy Family Basilica', town: 'Nairobi', dioceseId: 'nairobi', status: 'active' });
  await put('parishes/holy-family-nairobi/parishioners/p1', { id: 'p1', name: 'Private Person', phone: '0700' });
  await put('users/' + staffB.uid, { name: 'Fr B', email: staffB.email, role: 'priest', status: 'active', parishId: 'holy-family-nairobi' });
  await put('users/' + memberB.uid, { name: 'Member B', email: memberB.email, role: 'parishioner', status: 'active', parishId: 'holy-family-nairobi', personId: memberB.uid });
});

test('slug rules: readable, unique-safe, reserved routes refused', () => {
  assert.equal(S.parishSlug("St. Mary's Parish, Thika", 'Thika'), 'st-marys-parish-thika');
  assert.equal(S.parishSlug("St Peter's", 'Kikuyu'), 'st-peters-kikuyu');
  assert.equal(S.nameKey("St. Mary's Parish, Thika", 'Thika'), S.nameKey("Saint Mary's Catholic Church", 'Thika'));
  assert.ok(!S.isValid('admin') && !S.isValid('01-home') && !S.isValid('register-parish'));
  assert.ok(S.isValid(S.withSuffix('st-marys-parish-thika')));
  const browser = require('../js/slug.js');
  for (const [n, t] of [["St. Mary's Parish, Thika", 'Thika'], ['Sainte-Thérèse', 'Nyeri'], ['Holy Family', 'Nairobi']]) assert.equal(browser.parishSlug(n, t), S.parishSlug(n, t));
});

test('registration: rejects missing token, bad token and unchecked declaration', async () => {
  applicant = await signUp('mary@stmarys.test');
  assert.equal((await api('/api/register-parish', reg(), 'garbage')).status, 401);
  const r = await api('/api/register-parish', reg({ top: { agree: false } }), applicant.token);
  assert.equal(r.status, 400); assert.equal(r.body.field, 'agree');
  const d = await api('/api/register-parish', reg({ hierarchy: { dioceseId: 'murang-a', deaneryId: 'westlands' } }), applicant.token);
  assert.equal(d.status, 400, 'deanery from another diocese must be refused'); assert.equal(d.body.field, 'deaneryId');
});

test('registration: provisions the parish, admin role, slug, directory and claims', async () => {
  const body = reg(); body.admin.role = 'super'; body.parishId = 'holy-family-nairobi'; // browser-supplied privileges are ignored
  const r = await api('/api/register-parish', body, applicant.token);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.slug, 'st-marys-parish-thika');
  const pid = r.body.parishId;
  const u = (await get('users/' + applicant.uid)).data;
  assert.equal(u.role, 'admin'); assert.equal(u.parishId, pid); assert.equal(u.status, 'active');
  const p = (await get('parishes/' + pid)).data;
  assert.equal(p.verificationStatus, 'pending'); assert.equal(p.status, 'active'); assert.equal(p.slug, pid); assert.equal(p.deanery, 'Thika');
  assert.equal((await get('churchDirectory/' + pid)).data.status, 'pending');
  assert.equal((await get('slugs/st-marys-parish-thika')).data.parishId, pid);
  assert.equal((await get('registrations/' + applicant.uid)).data.state, 'active');
  assert.equal((await get('parishes/' + pid + '/config/settings')).data.currency, 'KSh');
  const c = await claims(applicant.uid);
  assert.equal(c.role, 'admin'); assert.equal(c.parishId, pid);
  adminA = await refresh(applicant); adminA.pid = pid;
});

test('registration: retry is idempotent and one account cannot open a second parish', async () => {
  const again = await api('/api/register-parish', reg(), adminA.token);
  assert.equal(again.status, 200); assert.equal(again.body.parishId, adminA.pid);
  const other = await api('/api/register-parish', reg({ parish: { name: 'St Joseph', town: 'Ruiru' } }), adminA.token);
  assert.equal(other.body.parishId, adminA.pid, 'second parish must not be created');
});

test('registration: duplicates are refused (new and legacy records)', async () => {
  const x = await signUp('dup@test.org');
  const a = await api('/api/register-parish', reg({ parish: { name: "Saint Mary's Catholic Church" } }), x.token);
  assert.equal(a.status, 409);
  const b = await api('/api/register-parish', reg({ parish: { name: 'Holy Family Basilica', town: 'Nairobi' }, hierarchy: { dioceseId: 'nairobi', deaneryId: '' } }), x.token);
  assert.equal(b.status, 409, 'legacy parish without nameKey must still be detected');
});

test('registration: existing member accounts cannot register a parish', async () => {
  const r = await api('/api/register-parish', reg({ parish: { name: 'St Anne', town: 'Limuru' } }), memberB.token);
  assert.equal(r.status, 409); assert.equal(r.body.field, 'aEmail');
});

test('registration: missing diocese becomes a pending proposal, not an official diocese', async () => {
  const x = await signUp('newdio@test.org');
  const r = await api('/api/register-parish', reg({ parish: { name: 'St Kizito', town: 'Lodwar', county: 'Turkana' }, hierarchy: { dioceseId: '', deaneryId: '', proposal: { name: 'Diocese of Lodwar', country: 'Kenya', bishop: 'Bishop X', deanery: 'Central' } } }), x.token);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const prop = (await get('dioceseProposals/reg_' + x.uid)).data;
  assert.equal(prop.status, 'Pending Verification');
  assert.equal((await get('dioceses/diocese-of-lodwar')).status, 404);
  const p = (await get('parishes/' + r.body.parishId)).data;
  assert.equal(p.dioceseId, ''); assert.equal(p.proposedDiocese, 'Diocese of Lodwar'); assert.equal(p.pendingDeanery, 'Central');
  assert.equal((await get('dioceseProposals/reg_' + x.uid, x.token)).status, 403, 'proposals are platform-admin only');
});

test('registration: a failure after the parish is written resumes safely on retry', async () => {
  const x = await signUp('resume@test.org');
  const real = globalThis.fetch; let failed = false;
  globalThis.fetch = (u, o) => { if (!failed && String(u).includes('accounts:update')) { failed = true; return Promise.resolve(new Response('boom', { status: 500 })); } return real(u, o); };
  let r;
  try { r = await api('/api/register-parish', reg({ parish: { name: 'Our Lady of Fatima', town: 'Kiambu' } }), x.token); }
  finally { globalThis.fetch = real; }
  assert.equal(r.status, 500);
  assert.equal((await get('registrations/' + x.uid)).data.state, 'failed');
  const r2 = await api('/api/register-parish', reg({ parish: { name: 'Our Lady of Fatima', town: 'Kiambu' } }), x.token);
  assert.equal(r2.status, 200, JSON.stringify(r2.body));
  assert.equal((await get('registrations/' + x.uid)).data.state, 'active');
  assert.equal((await claims(x.uid)).role, 'admin');
});

test('rules: parish A cannot read or write parish B private records', async () => {
  assert.equal((await get('parishes/holy-family-nairobi/parishioners/p1', adminA.token)).status, 403);
  assert.equal((await put('parishes/holy-family-nairobi/parishioners/x9', { id: 'x9', name: 'Injected' }, adminA.token)).status, 403);
  assert.equal((await get('parishes/holy-family-nairobi', adminA.token)).status, 403);
  assert.equal((await get('parishes/holy-family-nairobi/parishioners/p1', staffB.token)).status, 200, 'own parish still works');
});

test('rules: no self-promotion, no parish switching, no slug hijack', async () => {
  assert.equal((await patch('users/' + adminA.uid, { role: 'super' }, adminA.token)).status, 403);
  assert.equal((await patch('users/' + memberB.uid, { parishId: adminA.pid }, memberB.token)).status, 403);
  assert.equal((await patch('parishes/' + adminA.pid, { slug: 'holy-family-nairobi' }, adminA.token)).status, 403);
  assert.equal((await patch('parishes/' + adminA.pid, { verificationStatus: 'verified' }, adminA.token)).status, 403);
  assert.equal((await patch('churchDirectory/' + adminA.pid, { status: 'active' }, adminA.token)).status, 403);
  assert.equal((await put('slugs/holy-family', { parishId: adminA.pid }, adminA.token)).status, 403);
  assert.equal((await patch('parishes/' + adminA.pid, { motto: 'Pray always' }, adminA.token)).status, 200, 'allowed profile edit');
});

test('rules: public website is visible only when published and the parish is verified', async () => {
  const pid = adminA.pid;
  assert.equal((await patch('parishes/' + pid + '/public/draft', { about: 'Draft text' }, adminA.token)).status, 200);
  assert.equal((await patch('parishes/' + pid + '/public/site', { published: true, about: 'Published text' }, adminA.token)).status, 200);
  assert.equal((await get('parishes/' + pid + '/public/site', null)).status, 403, 'pending verification -> not public');
  assert.equal((await patch('parishes/' + pid + '/public/site', { logoUrl: 'javascript:alert(1)' }, adminA.token)).status, 403, 'unsafe URL refused');
  assert.equal((await patch('parishes/' + pid + '/public/site', { accent: 'url(evil)' }, adminA.token)).status, 403, 'arbitrary styling refused');
  // platform admin verifies the parish
  assert.equal((await patch('churchDirectory/' + pid, { status: 'active' }, superU.token)).status, 200);
  assert.equal((await patch('parishes/' + pid, { verificationStatus: 'verified' }, superU.token)).status, 200);
  const pub = await get('parishes/' + pid + '/public/site', null);
  assert.equal(pub.status, 200); assert.equal(pub.data.about, 'Published text');
  assert.equal((await get('parishes/' + pid + '/public/draft', null)).status, 403, 'drafts never public');
  assert.equal((await get('parishes/' + pid + '/parishioners/anything', null)).status, 403);
  assert.equal((await get('slugs/st-marys-parish-thika', null)).status, 200);
  assert.equal((await get('dioceses/nairobi', null)).status, 200);
});

test('worker: R2 access follows the live profile and parish, not the request', async () => {
  const m = await api('/presign-media', { kind: 'logo', contentType: 'image/png', size: 1000, parishId: 'holy-family-nairobi' }, adminA.token);
  assert.equal(m.status, 200, JSON.stringify(m.body));
  assert.ok(m.body.key.startsWith('parishes/' + adminA.pid + '/public/'), 'body parishId ignored for parish staff');
  const d = await api('/presign-download', { key: 'parishes/holy-family-nairobi/documents/secret.pdf' }, adminA.token);
  assert.equal(d.status, 400, 'cannot reach another parish documents');
  const mem = await api('/presign-media', { kind: 'logo', contentType: 'image/png', size: 1000 }, memberB.token);
  assert.equal(mem.status, 403);
  const pub = await worker.fetch(new Request('https://api.test/media/parishes/holy-family-nairobi/documents/secret.pdf'), ENV);
  assert.equal(pub.status, 404, 'only /public/ keys are served publicly');
});

test('suspension: a suspended parish loses Firestore and R2 access; a suspended user too', async () => {
  assert.equal((await patch('parishes/' + adminA.pid, { status: 'suspended' }, superU.token)).status, 200);
  assert.equal((await get('parishes/' + adminA.pid, adminA.token)).status, 403);
  assert.equal((await api('/presign-media', { kind: 'logo', contentType: 'image/png', size: 10 }, adminA.token)).status, 403);
  assert.equal((await patch('parishes/' + adminA.pid, { status: 'active' }, superU.token)).status, 200);
  assert.equal((await get('parishes/' + adminA.pid, adminA.token)).status, 200, 'restored');
  assert.equal((await patch('users/' + staffB.uid, { status: 'suspended' }, superU.token)).status, 200);
  assert.equal((await get('parishes/holy-family-nairobi/parishioners/p1', staffB.token)).status, 403);
  assert.equal((await api('/presign-upload', { key: 'parishes/holy-family-nairobi/documents/a.pdf' }, staffB.token)).status, 403);
});

test('migration: existing parishes get a unique address without losing data; re-running changes nothing', async () => {
  const { execFileSync } = await import('node:child_process');
  await put('parishes/st-peters-kikuyu', { name: "St Peter's Parish", town: 'Kikuyu', dioceseId: 'nairobi', deanery: 'Westlands', status: 'active', priest: 'Fr P' });
  await put('churchDirectory/st-peters-kikuyu', { name: "St Peter's Parish", town: 'Kikuyu', status: 'active' });
  await put('dioceses/legacy', { name: 'Diocese of Legacy' });
  const env = { ...process.env, FIRESTORE_EMULATOR_HOST: '127.0.0.1:8180', GCLOUD_PROJECT: P, GOOGLE_CLOUD_PROJECT: P };
  execFileSync(process.execPath, ['scripts/admin.js', 'migrate'], { env, stdio: 'pipe' });
  const p = (await get('parishes/st-peters-kikuyu')).data;
  assert.equal(p.slug, 'st-peters-kikuyu'); assert.equal(p.name, "St Peter's Parish"); assert.equal(p.priest, 'Fr P');
  assert.equal(p.verificationStatus, 'verified');
  assert.equal((await get('slugs/st-peters-kikuyu')).data.parishId, 'st-peters-kikuyu');
  assert.equal((await get('churchDirectory/st-peters-kikuyu')).data.slug, 'st-peters-kikuyu');
  assert.equal((await get('parishes/st-peters-kikuyu/public/site')).data.published, false);
  assert.equal((await get('dioceses/legacy')).data.status, 'active');
  const before = (await get('parishes/' + adminA.pid)).data.slug;
  execFileSync(process.execPath, ['scripts/admin.js', 'migrate'], { env, stdio: 'pipe' });
  assert.equal((await get('parishes/st-peters-kikuyu')).data.slug, 'st-peters-kikuyu');
  assert.equal((await get('parishes/' + adminA.pid)).data.slug, before, 'registered parish untouched');
});

/* ---------- platform owner (super admin) API ---------- */
async function list(coll) {
  const r = await fetch(FS + '/' + coll + '?pageSize=300', { headers: H('owner') });
  return ((await r.json()).documents || []).map(d => ({ id: d.name.split('/').pop(), ...decodeFields(d.fields) }));
}
async function setClaimsFor(uid, c) {
  const r = await fetch(AUTH + '/identitytoolkit.googleapis.com/v1/projects/' + P + '/accounts:update', { method: 'POST', headers: H('owner'), body: JSON.stringify({ localId: uid, customAttributes: JSON.stringify(c) }) });
  assert.equal(r.status, 200);
}
let joseph, josephPid;

test('platform: actions need the superAdmin claim', async () => {
  joseph = await signUp('joseph@stjoseph.test');
  const r = await api('/api/register-parish', reg({ parish: { name: 'St. Joseph Parish', town: 'Ruiru', email: 'office@stjoseph.test', priest: 'Fr. Peter Kamau' }, admin: { name: 'Joseph Njoroge' } }), joseph.token);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  josephPid = r.body.parishId;
  assert.equal((await get('parishes/' + josephPid)).data.priest, 'Fr. Peter Kamau', 'priest name captured at registration');
  const noClaim = await api('/api/platform/parish-action', { parishId: josephPid, action: 'approve' }, superU.token);
  assert.equal(noClaim.status, 403, 'role:super profile without the claim is refused');
  assert.equal((await api('/api/platform/parish-action', { parishId: josephPid, action: 'approve' }, joseph.token)).status, 403, 'parish admin refused');
  await setClaimsFor(superU.uid, { role: 'super', status: 'active', superAdmin: true });
  await refresh(superU);
});

test('platform: request info -> approve sends emails, activates and audits atomically', async () => {
  const bad = await api('/api/platform/parish-action', { parishId: josephPid, action: 'request-info' }, superU.token);
  assert.equal(bad.status, 400, 'a message is required');
  const ri = await api('/api/platform/parish-action', { parishId: josephPid, action: 'request-info', message: 'Please send a letter from the diocese.' }, superU.token);
  assert.equal(ri.status, 200, JSON.stringify(ri.body));
  assert.equal(ri.body.emailStatus, 'queued'); assert.deepEqual(ri.body.emailTo, ['joseph@stjoseph.test']);
  let p = (await get('parishes/' + josephPid)).data;
  assert.equal(p.infoRequested, true); assert.equal(p.verificationStatus, 'pending');

  await patch('users/' + joseph.uid, { status: 'pending' }); // an account waiting for approval
  const ap = await api('/api/platform/parish-action', { parishId: josephPid, action: 'approve' }, superU.token);
  assert.equal(ap.status, 200, JSON.stringify(ap.body));
  p = (await get('parishes/' + josephPid)).data;
  assert.equal(p.status, 'active'); assert.equal(p.verificationStatus, 'verified'); assert.equal(p.infoRequested, false);
  assert.equal((await get('churchDirectory/' + josephPid)).data.status, 'active');
  assert.equal((await get('users/' + joseph.uid)).data.status, 'active', 'applicant account activated');
  assert.equal((await claims(joseph.uid)).status, 'active');
  const mails = (await list('mail')).filter(m => m.to.includes('joseph@stjoseph.test'));
  assert.ok(mails.some(m => /approved/.test(m.message.subject)), 'welcome email queued');
  assert.ok(mails.some(m => /More information/.test(m.message.subject)), 'info request email queued');
  const aud = (await list('platformAudit')).filter(a => a.parishId === josephPid);
  assert.ok(aud.some(a => a.action === 'parish.approve' && a.by === superU.uid && a.emailStatus === 'queued'));
  assert.ok(aud.some(a => a.action === 'parish.request-info'));
  assert.equal((await api('/api/platform/parish-action', { parishId: josephPid, action: 'approve' }, superU.token)).status, 409, 'cannot approve twice');
  assert.equal((await get('mail/' + mails[0].id, joseph.token)).status, 403, 'mail queue is server-only');
});

test('platform: suspend blocks the parish and notifies; restore brings it back', async () => {
  const s = await api('/api/platform/parish-action', { parishId: josephPid, action: 'suspend', message: 'Unpaid subscription.' }, superU.token);
  assert.equal(s.status, 200, JSON.stringify(s.body));
  assert.deepEqual(s.body.emailTo.sort(), ['joseph@stjoseph.test', 'office@stjoseph.test']);
  await refresh(joseph);
  assert.equal((await get('parishes/' + josephPid, joseph.token)).status, 403, 'staff blocked immediately');
  assert.equal((await get('churchDirectory/' + josephPid)).data.status, 'suspended');
  const r = await api('/api/platform/parish-action', { parishId: josephPid, action: 'restore' }, superU.token);
  assert.equal(r.status, 200);
  assert.equal((await get('parishes/' + josephPid, joseph.token)).status, 200);
  assert.equal((await get('churchDirectory/' + josephPid)).data.status, 'active');
});

test('platform: reject, then restore puts the application back in the queue', async () => {
  const x = await signUp('anne@stanne.test');
  const r = await api('/api/register-parish', reg({ parish: { name: 'St. Anne Parish', town: 'Juja' }, admin: { name: 'Anne W' } }), x.token);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const rj = await api('/api/platform/parish-action', { parishId: r.body.parishId, action: 'reject', message: 'Not a Catholic parish.' }, superU.token);
  assert.equal(rj.status, 200);
  assert.equal((await get('parishes/' + r.body.parishId)).data.status, 'rejected');
  assert.equal((await api('/api/platform/parish-action', { parishId: r.body.parishId, action: 'restore' }, superU.token)).status, 200);
  const p = (await get('parishes/' + r.body.parishId)).data;
  assert.equal(p.status, 'active'); assert.equal(p.verificationStatus, 'pending', 'back to review, not silently verified');
});

test('platform: support session signs in as parish staff, is audited', async () => {
  assert.equal((await api('/api/platform/impersonate', { uid: joseph.uid }, superU.token)).status, 400, 'reason required');
  assert.equal((await api('/api/platform/impersonate', { uid: superU.uid, reason: 'test' }, superU.token)).status, 403, 'never another platform account');
  assert.equal((await api('/api/platform/impersonate', { uid: joseph.uid, reason: 'xyz' }, joseph.token)).status, 403);
  const imp = await api('/api/platform/impersonate', { uid: joseph.uid, reason: 'Cannot see Mass schedule' }, superU.token);
  assert.equal(imp.status, 200, JSON.stringify(imp.body));
  const ex = await fetch(AUTH + '/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token: imp.body.token, returnSecureToken: true }) });
  const j = await ex.json(); assert.ok(j.idToken, JSON.stringify(j));
  const claimsOf = t => JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString());
  assert.equal(claimsOf(j.idToken).user_id, joseph.uid); assert.equal(claimsOf(j.idToken).impersonatedBy, superU.uid);
  assert.equal((await get('parishes/' + josephPid, j.idToken)).status, 200, 'sees what the admin sees');
  assert.ok((await list('platformAudit')).some(a => a.action === 'support.impersonation-started' && a.targetUid === joseph.uid && a.reason === 'Cannot see Mass schedule'));
});
