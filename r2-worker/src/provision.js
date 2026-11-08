/* PARISH YETU Worker - self-service church registration (POST /api/register-parish).
 *
 * The future parish administrator first creates their own Firebase Authentication account in the
 * browser (standard Firebase Auth sign-up: the password never passes through this API), then calls
 * this endpoint with their ID token. Only this trusted code may then create the parish, reserve its
 * public address, write the directory entry and assign the initial "admin" role and custom claims.
 *
 * Firestore and Firebase Auth cannot share a transaction, so the work is tracked in
 * registrations/{uid} (state: provisioning -> active | failed) and every write uses a deterministic
 * document id. Calling the endpoint again resumes; it never creates a second parish.
 *
 * Writes here use the service account (IAM), which bypasses Security Rules: every check is explicit.
 */
import S from './slug.js';
import { getDoc, queryEq, commit, setW, deleteW, setClaims, lookupUser } from './firebase.js';

export class ApiError extends Error {
  constructor(status, code, message, field) { super(message); this.status = status; this.code = code; this.field = field; }
}

const ROLE_LABEL = { admin: 'Parish Administrator' };
const PARISH_TYPES = ['Parish', 'Quasi-parish', 'Mission', 'Chaplaincy', 'Cathedral parish', 'Shrine'];
const SETTINGS0 = { theme: 'Ivory', density: 'Comfortable', notifyEmail: true, notifySms: true, sessionMinutes: 30, currency: 'KSh', language: 'English' };

/* ---------- validation ---------- */
const bad = (field, msg) => { throw new ApiError(400, 'invalid-argument', msg, field); };
function str(o, k, label, { req = false, min = 0, max = 160, field } = {}) {
  let v = o && o[k];
  if (v == null) v = '';
  if (typeof v !== 'string') bad(field || k, label + ' must be text.');
  v = v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (req && !v) bad(field || k, label + ' is required.');
  if (v && v.length < min) bad(field || k, label + ' is too short.');
  if (v.length > max) bad(field || k, label + ' is too long (maximum ' + max + ' characters).');
  return v;
}
function longText(o, k, label, max) {
  let v = o && o[k];
  if (v == null) v = '';
  if (typeof v !== 'string') bad(k, label + ' must be text.');
  v = v.replace(/\r\n/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').trim();
  if (v.length > max) bad(k, label + ' is too long (maximum ' + max + ' characters).');
  return v;
}
const EMAIL = /^[^@\s]{1,64}@[^@\s]+\.[^@\s]{2,}$/;
const PHONE = /^\+?[0-9 ()-]{7,20}$/;
const email = (o, k, label, req, field) => { const v = str(o, k, label, { req, max: 160, field }).toLowerCase(); if (v && !EMAIL.test(v)) bad(field || k, 'Enter a valid ' + label.toLowerCase() + '.'); return v; };
const phone = (o, k, label, req, field) => { const v = str(o, k, label, { req, max: 24, field }); if (v && !PHONE.test(v)) bad(field || k, 'Enter a valid ' + label.toLowerCase() + '.'); return v; };
function url(o, k, label) {
  const v = str(o, k, label, { max: 300 });
  if (!v) return '';
  try { const p = new URL(/^https?:\/\//i.test(v) ? v : 'https://' + v); if (!/^https?:$/.test(p.protocol) || !p.hostname.includes('.')) throw 0; return p.toString(); }
  catch (e) { return bad(k, 'Enter a valid ' + label.toLowerCase() + '.'); }
}

export function validate(data) {
  const d = data || {}, p = d.parish || {}, h = d.hierarchy || {}, a = d.admin || {}, b = d.branding || {};
  const out = {
    parish: {
      name: str(p, 'name', 'Official parish name', { req: true, min: 3, max: 160 }),
      parishType: str(p, 'parishType', 'Parish type', { max: 40 }) || 'Parish',
      country: str(p, 'country', 'Country', { req: true, min: 2, max: 80 }),
      county: str(p, 'county', 'County / region', { max: 80 }),
      town: str(p, 'town', 'Town or location', { req: true, min: 2, max: 120 }),
      address: str(p, 'address', 'Physical address', { max: 240 }),
      phone: phone(p, 'phone', 'Parish telephone', true),
      email: email(p, 'email', 'Parish email', false)
    },
    hierarchy: {
      dioceseId: str(h, 'dioceseId', 'Diocese', { max: 80 }),
      deaneryId: str(h, 'deaneryId', 'Deanery', { max: 80 }),
      deaneryName: str(h, 'deaneryName', 'Deanery name', { max: 120, field: 'deaneryOther' }),
      dioceseNotApplicable: h.dioceseNotApplicable === true,
      deaneryNotApplicable: h.deaneryNotApplicable === true,
      proposal: null
    },
    admin: {
      name: str(a, 'name', 'Your full name', { req: true, min: 3, max: 120, field: 'aName' }),
      phone: phone(a, 'phone', 'Your telephone', true, 'aPhone')
    },
    branding: {
      motto: str(b, 'motto', 'Parish motto', { max: 140 }),
      about: longText(b, 'about', 'Parish introduction', 1500),
      patron: str(b, 'patron', 'Patron saint', { max: 120 }),
      website: url(b, 'website', 'Existing website'),
      publicEmail: email(b, 'publicEmail', 'Public email', false),
      publicPhone: phone(b, 'publicPhone', 'Public telephone', false)
    }
  };
  if (!PARISH_TYPES.includes(out.parish.parishType)) bad('parishType', 'Choose a parish type from the list.');
  if (h.proposal && typeof h.proposal === 'object') {
    const q = h.proposal;
    out.hierarchy.proposal = {
      name: str(q, 'name', 'Proposed diocese name', { req: true, min: 4, max: 160, field: 'pName' }),
      kind: q.kind === 'Archdiocese' ? 'Archdiocese' : 'Diocese',
      archdiocese: str(q, 'archdiocese', 'Metropolitan archdiocese', { max: 160, field: 'pArch' }),
      country: str(q, 'country', 'Diocese country', { req: true, min: 2, max: 80, field: 'pCountry' }),
      location: str(q, 'location', 'Diocese location', { max: 120, field: 'pLocation' }),
      bishop: str(q, 'bishop', 'Bishop', { max: 120, field: 'pBishop' }),
      deanery: str(q, 'deanery', 'Deanery', { max: 120, field: 'pDeanery' }),
      notes: longText(q, 'notes', 'Supporting notes', 1000)
    };
    out.hierarchy.dioceseId = '';
    out.hierarchy.deaneryId = '';
  }
  const hh = out.hierarchy;
  if (!hh.dioceseId && !hh.proposal && !hh.dioceseNotApplicable) bad('dioceseId', 'Choose your diocese, propose a new one, or mark it as not applicable.');
  if (d.agree !== true) bad('agree', 'Please confirm the declaration before submitting.');
  return out;
}

/* ---------- helpers ---------- */
const shortCode = name => (String(name).replace(/\b(parish|church|catholic|st\.?|saint|of|the)\b/ig, '').split(/[^A-Za-z0-9]+/).filter(Boolean).map(w => w[0]).join('') || 'PAR').toUpperCase().slice(0, 4);
async function sha(s) { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('').slice(0, 40); }
const fingerprint = p => sha([S.nameKey(p.name, p.town), S.placeKey(p.town), S.placeKey(p.country)].join('|'));
const rnd = n => [...crypto.getRandomValues(new Uint8Array(n || 4))].map(x => 'abcdefghijkmnpqrstuvwxyz23456789'[x % 32]).join('');
const nowStamp = () => new Date().toISOString().slice(0, 19).replace('T', ' ');

export function claimsFor(p) {
  const c = { role: p.role || 'parishioner', status: p.status || 'suspended' };
  ['parishId', 'dioceseId', 'organization', 'sccId'].forEach(k => { if (p[k]) c[k] = String(p[k]).slice(0, 160); });
  return c;
}

/* Duplicate check: by name key (new records) and by town (records created before name keys existed). */
async function findDuplicate(env, p) {
  const nk = S.nameKey(p.name, p.town), tk = S.placeKey(p.town);
  for (const x of await queryEq(env, 'parishes', 'nameKey', nk, 20)) if (S.placeKey(x.town) === tk) return x.id; // nameKey stored with the town removed
  for (const x of await queryEq(env, 'churchDirectory', 'town', p.town, 200)) if (S.nameKey(x.name, x.town) === nk) return x.id;
  return null;
}

async function loadDiocese(env, h) {
  if (!h.dioceseId) return null;
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(h.dioceseId)) bad('dioceseId', 'Choose a diocese from the list.');
  const d = await getDoc(env, 'dioceses/' + h.dioceseId);
  if (!d || (d.status || 'active') !== 'active') bad('dioceseId', 'That diocese is not available. Choose another or propose it.');
  d.id = h.dioceseId;
  let deanery = null;
  if (h.deaneryId) {
    deanery = (d.deaneries || []).find(x => x && x.id === h.deaneryId && (x.status || 'active') === 'active');
    if (!deanery) bad('deaneryId', 'That deanery does not belong to the selected diocese.');
  }
  return { d, deanery };
}

const resultOf = r => ({ state: 'active', parishId: r.parishId, slug: r.slug, verificationStatus: 'pending', parishName: r.parishName || '', dioceseProposal: !!r.dioceseProposalId, path: '/' + r.slug });

/* Reserve fingerprint + slug + registration in one atomic commit (preconditions = no races). */
async function reserve(env, uid, tokenEmail, v, fp, prior) {
  const key = await getDoc(env, 'parishKeys/' + fp);
  if (key && key.uid !== uid) throw new ApiError(409, 'already-exists', 'This parish is already registered or being registered by another account. Contact PARISH YETU support if this is unexpected.');
  const base = S.parishSlug(v.parish.name, v.parish.town) || 'parish-' + rnd(6);
  const tries = [S.isReserved(base) ? 'parish-' + base : base];
  for (let i = 0; i < 6; i++) tries.push(S.withSuffix(base, rnd(4)));
  for (const slug of tries) {
    if (!S.isValid(slug)) continue;
    if (await getDoc(env, 'parishes/' + slug)) continue; // older parishes may lack a slugs/ entry
    const writes = [];
    if (!key) writes.push(setW('parishKeys/' + fp, { uid, parishId: slug }, { mustNotExist: true, stamps: ['createdAt'] }));
    writes.push(setW('slugs/' + slug, { parishId: slug, status: 'reserved' }, { mustNotExist: true, stamps: ['createdAt'] }));
    if (prior && prior.fingerprint && prior.fingerprint !== fp) {
      writes.push(deleteW('parishKeys/' + prior.fingerprint));
      if (prior.slug) writes.push(deleteW('slugs/' + prior.slug));
    }
    const reg = { uid, email: tokenEmail, state: 'provisioning', parishId: slug, slug, fingerprint: fp, parishName: v.parish.name, attempts: ((prior && prior.attempts) || 0) + 1, error: '' };
    writes.push(setW('registrations/' + uid, reg, { stamps: prior ? ['updatedAt'] : ['createdAt', 'updatedAt'] }));
    const res = await commit(env, writes);
    if (res.ok) return reg;
    const k2 = await getDoc(env, 'parishKeys/' + fp);
    if (k2 && k2.uid !== uid) throw new ApiError(409, 'already-exists', 'This parish was just registered by another account. Contact PARISH YETU support if this is unexpected.');
    // otherwise the slug was taken in the meantime: try the next candidate
  }
  throw new ApiError(503, 'aborted', 'Could not reserve a unique web address. Please try again.');
}

export async function registerParish(env, user, body) {
  const uid = user.sub;
  const tokenEmail = String(user.email || '').toLowerCase();
  if (!tokenEmail) throw new ApiError(400, 'failed-precondition', 'The administrator account must have an email address.');
  if (user.firebase && user.firebase.sign_in_provider === 'anonymous') throw new ApiError(403, 'failed-precondition', 'Anonymous accounts cannot register a parish.');

  const [prior, profile] = await Promise.all([getDoc(env, 'registrations/' + uid), getDoc(env, 'users/' + uid)]);
  if (prior && prior.state === 'active') return resultOf(prior);
  // One administrator account = one parish. Existing members/staff must use a different email.
  if (profile && !(prior && profile.parishId === prior.parishId)) {
    throw new ApiError(409, 'failed-precondition', 'This email already belongs to a PARISH YETU account linked to a parish. Use a different email for the new parish administrator.', 'aEmail');
  }
  const acct = await lookupUser(env, uid);
  if (!acct || acct.disabled) throw new ApiError(403, 'failed-precondition', 'This account is not available.');

  const v = validate(body);
  const fp = await fingerprint(v.parish);
  if (!prior || prior.fingerprint !== fp) {
    const dup = await findDuplicate(env, v.parish);
    if (dup && !(prior && prior.parishId === dup)) throw new ApiError(409, 'already-exists', 'A parish with this name is already registered in ' + v.parish.town + '. If it is yours, ask its administrator to add you, or contact PARISH YETU support.', 'name');
  }
  const dio = await loadDiocese(env, v.hierarchy);

  let reg;
  if (prior && prior.fingerprint === fp && prior.parishId && prior.slug) {
    reg = { ...prior, state: 'provisioning' };
    await commit(env, [setW('registrations/' + uid, { state: 'provisioning', attempts: (prior.attempts || 0) + 1, error: '' }, { merge: true, stamps: ['updatedAt'] })]);
  } else {
    if (prior && prior.parishId && await getDoc(env, 'parishes/' + prior.parishId)) {
      throw new ApiError(409, 'failed-precondition', 'Your parish has already been created as "' + (prior.parishName || prior.parishId) + '". Sign in to manage it.');
    }
    reg = await reserve(env, uid, tokenEmail, v, fp, prior);
  }
  const { parishId, slug } = reg;

  try {
    const P = v.parish, H = v.hierarchy, A = v.admin, B = v.branding;
    const prop = H.proposal ? { id: 'reg_' + uid, ...H.proposal } : null;
    const diocese = dio ? dio.d : null, deanery = dio && dio.deanery ? dio.deanery : null;
    const deaneryName = deanery ? deanery.name : '';
    const pendingDeanery = !deanery && !H.deaneryNotApplicable ? (H.deaneryName || (prop && prop.deanery) || '') : '';
    const profileDoc = {
      name: A.name, email: tokenEmail, phone: A.phone, role: 'admin', status: 'active', title: ROLE_LABEL.admin,
      parishId, dioceseId: diocese ? diocese.id : '', deanery: deaneryName, organization: P.name, personId: uid, sccId: ''
    };

    // The commit is atomic: if the parish exists, an earlier attempt wrote everything and the
    // administrator may already be editing - never overwrite their work on a retry.
    if (!(await getDoc(env, 'parishes/' + parishId))) {
      const pub = {
        name: P.name, short: shortCode(P.name), town: P.town, county: P.county, country: P.country, address: P.address,
        phone: P.phone, email: P.email, dioceseId: diocese ? diocese.id : '', dioceseName: diocese ? diocese.name : '',
        deanery: deaneryName, slug, motto: B.motto, websitePublished: false
      };
      const parish = {
        ...pub, parishType: P.parishType,
        diocese: diocese ? diocese.name : '', archdiocese: diocese ? (diocese.kind === 'Archdiocese' ? diocese.name : diocese.archdiocese || '') : '',
        deaneryId: deanery ? deanery.id : '', pendingDeanery,
        dioceseProposalId: prop ? prop.id : '', proposedDiocese: prop ? prop.name : '',
        priest: '', patron: B.patron, outstations: ['Main Church'], stats: {},
        status: 'active', registrationStatus: 'active', verificationStatus: 'pending',
        nameKey: S.nameKey(P.name, P.town), townKey: S.placeKey(P.town), createdBy: uid, registeredVia: 'self-service'
      };
      const site = {
        published: false, displayName: P.name, motto: B.motto, welcome: 'Welcome to ' + P.name,
        about: B.about, patron: B.patron, accent: 'burgundy', logoUrl: '', bannerUrl: '',
        contact: { phone: B.publicPhone || P.phone, email: B.publicEmail || P.email, address: P.address, location: [P.town, P.county, P.country].filter(Boolean).join(', '), officeHours: '', mapUrl: '' },
        social: { website: B.website, facebook: '', youtube: '', instagram: '', x: '', whatsapp: '' },
        priest: { name: '', title: 'Parish Priest', show: false },
        massSchedule: [], outstations: [], events: [], announcements: [], ministries: [], sermons: [], updatedBy: uid
      };
      const writes = [
        setW('parishes/' + parishId, parish, { mustNotExist: true, stamps: ['createdAt', 'updatedAt'] }),
        setW('churchDirectory/' + parishId, { ...pub, status: 'pending' }, { stamps: ['createdAt', 'updatedAt'] }),
        setW('parishes/' + parishId + '/config/settings', SETTINGS0, { stamps: ['createdAt'] }),
        setW('parishes/' + parishId + '/public/draft', site, { stamps: ['updatedAt'] }),
        setW('parishes/' + parishId + '/public/site', site, { stamps: ['updatedAt'] }),
        setW('slugs/' + slug, { parishId, status: 'active' }, { merge: true, stamps: ['updatedAt'] }),
        setW('users/' + uid, profileDoc, { stamps: ['createdAt'] }),
        setW('parishes/' + parishId + '/auditLogs/registration', { id: 'registration', user: A.name, action: 'Parish registered (self-service)', module: 'Platform', date: nowStamp(), device: 'Registration wizard', ip: '—', before: '—', after: P.name, reason: 'Self-service registration', _c: Date.now() }),
        setW('platformAudit/reg_' + uid, { action: 'parish.registered', parishId, slug, by: uid, email: tokenEmail }, { stamps: ['at'] })
      ];
      if (prop) writes.push(setW('dioceseProposals/' + prop.id, { ...prop, status: 'Pending Verification', parishId, parishName: P.name, proposedBy: uid, proposerEmail: tokenEmail, proposerName: A.name }, { stamps: ['createdAt', 'updatedAt'] }));
      const res = await commit(env, writes);
      if (!res.ok && !(await getDoc(env, 'parishes/' + parishId))) throw new Error('Parish records could not be written');
    }

    const live = (await getDoc(env, 'users/' + uid)) || profileDoc;
    await setClaims(env, uid, claimsFor(live));
    await commit(env, [setW('registrations/' + uid, { state: 'active', dioceseProposalId: prop ? prop.id : '', error: '' }, { merge: true, stamps: ['completedAt', 'updatedAt'] })]);
    return resultOf({ ...reg, dioceseProposalId: prop ? prop.id : '' });
  } catch (e) {
    console.error('Provisioning failed', parishId, e && e.message);
    await commit(env, [setW('registrations/' + uid, { state: 'failed', error: String((e && e.message) || e).slice(0, 300) }, { merge: true, stamps: ['updatedAt'] })]).catch(() => {});
    if (e instanceof ApiError) throw e;
    throw new ApiError(500, 'internal', 'Your parish was not fully set up. Nothing was lost — press Submit again to finish.');
  }
}
