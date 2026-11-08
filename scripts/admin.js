#!/usr/bin/env node
/* PARISH YETU - trusted administration tool (runs on YOUR computer, never in the browser).
 *
 * Uses the Firebase Admin SDK. Needs a service-account key. Keep it OUTSIDE this folder:
 *     export GOOGLE_APPLICATION_CREDENTIALS=/secure/path/serviceAccountKey.json
 *     npm install
 *
 * Every command that creates or edits a user ALSO sets custom claims on the Auth token.
 * The Firestore rules read role / status / parishId / dioceseId / organization / sccId
 * from the token. After running any of these against an existing account, that user
 * MUST sign out and sign in again (or call getIdToken(true) in the browser) for the
 * new claims to take effect.
 *
 * Commands
 *   node scripts/admin.js make-super   --email you@example.org [--name "Full Name"] [--password "initial password"]
 *   node scripts/admin.js add-diocese  --name "Diocese of X" [--archdiocese "Archdiocese of Y"] [--id diocese-x]
 *   node scripts/admin.js add-parish   --name "St Mary's Parish" --diocese diocese-x --town Nyeri [--deanery "North"] [--county Nyeri] [--address ...] [--phone ...] [--email ...] [--priest "Fr ..."]
 *   node scripts/admin.js assign       --email person@example.org --role priest|admin|secretary|finance|scc --parish <parishId> [--scc <sccId>]
 *   node scripts/admin.js assign       --email person@example.org --role diocese --diocese <dioceseId>
 *   node scripts/admin.js assign       --email person@example.org --role deanery --diocese <dioceseId> --deanery "North"
 *   node scripts/admin.js refresh      --email person@example.org
 *   node scripts/admin.js list-churches
 *   node scripts/admin.js migrate [--dry-run]
 *        Prepares existing data for multi-parish hosting. Safe to run repeatedly; never renames a parish,
 *        never changes an existing slug and never overwrites existing values:
 *          - every parish gets a unique public web address (slugs/{slug}, parishes.slug, churchDirectory.slug)
 *          - nameKey / townKey for duplicate detection; verificationStatus 'verified' for existing parishes
 *          - default (unpublished) website documents parishes/{id}/public/{draft,site}
 *          - dioceses get status 'active' and a deaneries[] list built from their parishes
 */
const admin = require('firebase-admin');
const S = require('../js/slug.js');
admin.initializeApp();
const db = admin.firestore(), auth = admin.auth(), TS = admin.firestore.FieldValue.serverTimestamp;

const args = process.argv.slice(3), cmd = process.argv[2];
const opt = k => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : undefined; };
const need = (...ks) => ks.forEach(k => { if (!opt(k)) { console.error('Missing --' + k); process.exit(1); } });
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
const ROLE_LABEL = { super: 'Super Admin', diocese: 'Diocesan Administrator', deanery: 'Deanery Administrator', priest: 'Parish Priest', admin: 'Parish Administrator', secretary: 'Parish Secretary', finance: 'Finance Officer', scc: 'SCC Leader', parishioner: 'Parishioner' };

async function userByEmail(email) { try { return await auth.getUserByEmail(email); } catch (e) { return null; } }

// Custom claims MUST be small; only put what the rules read.
function claimsFor(role, opts) {
  const c = { role, status: 'active' };
  if (opts.parishId)     c.parishId     = opts.parishId;
  if (opts.dioceseId)    c.dioceseId    = opts.dioceseId;
  if (opts.organization) c.organization = opts.organization;
  if (opts.sccId)        c.sccId        = opts.sccId;
  return c;
}


/* Give a parish a unique public address and default website documents (idempotent). */
const taken = new Set();
async function freeSlug(base) {
  let s = S.isReserved(base) ? 'parish-' + base : base;
  for (let i = 0; i < 10; i++) {
    if (S.isValid(s) && !taken.has(s)) {
      const [a, b] = await Promise.all([db.doc('slugs/' + s).get(), db.doc('parishes/' + s).get()]);
      if (!a.exists && !b.exists) { taken.add(s); return s; }
    }
    s = S.withSuffix(base);
  }
  throw new Error('No free slug for ' + base);
}
async function ensureWebsite(id, p, dry) {
  const ref = db.doc('parishes/' + id), cur = (await ref.get()).data() || p;
  let slug = cur.slug;
  const patch = {}, dir = {};
  if (!slug) {
    // The parish id was already derived from name+town; reuse it as the address when it is free and valid.
    const own = await db.doc('slugs/' + id).get();
    slug = S.isValid(id) && !own.exists && !taken.has(id) ? id : await freeSlug(S.parishSlug(cur.name, cur.town) || 'parish');
    taken.add(slug);
    patch.slug = slug; dir.slug = slug;
  }
  if (!cur.nameKey) { patch.nameKey = S.nameKey(cur.name, cur.town); patch.townKey = S.placeKey(cur.town); }
  if (!cur.verificationStatus) patch.verificationStatus = 'verified';
  if (!cur.registrationStatus) patch.registrationStatus = 'active';
  if (cur.websitePublished === undefined) { patch.websitePublished = false; dir.websitePublished = false; }
  if (dry) { console.log((patch.slug ? 'NEW   ' : 'keep  ') + id.padEnd(36) + ' https://parishyetu.church/' + slug, Object.keys(patch).join(',')); return slug; }
  const b = db.batch();
  if (Object.keys(patch).length) b.set(ref, { ...patch, updatedAt: TS() }, { merge: true });
  if (Object.keys(dir).length) b.set(db.doc('churchDirectory/' + id), dir, { merge: true });
  b.set(db.doc('slugs/' + slug), { parishId: id, status: 'active' }, { merge: true });
  const site = {
    published: false, displayName: cur.name || '', motto: cur.motto || '', welcome: 'Welcome to ' + (cur.name || 'our parish'), about: '', patron: cur.patron || '', accent: 'burgundy', logoUrl: '', bannerUrl: '',
    contact: { phone: cur.phone || '', email: cur.email || '', address: cur.address || '', location: [cur.town, cur.county].filter(Boolean).join(', '), officeHours: '', mapUrl: '' },
    social: { website: '', facebook: '', youtube: '', instagram: '', x: '', whatsapp: '' }, priest: { name: cur.priest || '', title: 'Parish Priest', show: !!cur.priest },
    massSchedule: [], outstations: [], events: [], announcements: [], ministries: [], sermons: [], updatedAt: TS()
  };
  for (const d of ['draft', 'site']) { const r = db.doc('parishes/' + id + '/public/' + d); if (!(await r.get()).exists) b.set(r, site); }
  await b.commit();
  return slug;
}

(async () => {
  if (cmd === 'make-super') {
    need('email');
    let u = await userByEmail(opt('email'));
    if (!u) {
      if (!opt('password') || opt('password').length < 12) { console.error('No account exists for that email. Pass --password (12+ characters) to create one.'); process.exit(1); }
      u = await auth.createUser({ email: opt('email'), password: opt('password'), displayName: opt('name') || 'Platform Administrator', emailVerified: true });
      console.log('Created sign-in account', u.uid);
    }
    const claims = claimsFor('super', {});
    await auth.setCustomUserClaims(u.uid, claims);
    await db.doc('users/' + u.uid).set({
      name: opt('name') || u.displayName || 'Platform Administrator',
      email: u.email.toLowerCase(),
      role: 'super', status: 'active', title: ROLE_LABEL.super,
      organization: 'Platform', personId: u.uid, parishId: '',
      claims,                          // store a copy for the settings UI / debugging
      claimsUpdatedAt: TS(),
      createdAt: TS()
    }, { merge: true });
    console.log('Platform administrator ready:', u.email);
    console.log('Custom claims set. The user MUST sign out and back in for them to take effect.');
  }
  else if (cmd === 'add-diocese') {
    need('name');
    const id = opt('id') || slug(opt('name'));
    await db.doc('dioceses/' + id).set({ name: opt('name'), archdiocese: opt('archdiocese') || '', kind: /^arch/i.test(opt('name')) ? 'Archdiocese' : 'Diocese', country: opt('country') || 'Kenya', status: 'active', deaneries: [], createdAt: TS() });
    console.log('Diocese saved:', id);
  }
  else if (cmd === 'add-parish') {
    need('name', 'diocese', 'town');
    const d = await db.doc('dioceses/' + opt('diocese')).get();
    if (!d.exists) { console.error('Unknown diocese id. Run add-diocese first.'); process.exit(1); }
    const id = opt('id') || slug(opt('name') + '-' + opt('town'));
    const short = opt('name').replace(/\b(parish|church|catholic|st\.?|saint)\b/ig, '').split(/\s+/).filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 4) || 'PAR';
    const pub = { name: opt('name'), short, town: opt('town'), county: opt('county') || '', address: opt('address') || '', phone: opt('phone') || '', email: opt('email') || '', dioceseId: d.id, dioceseName: d.data().name, deanery: opt('deanery') || '', status: 'active' };
    const b = db.batch();
    b.set(db.doc('parishes/' + id), { ...pub, diocese: d.data().name, archdiocese: d.data().archdiocese || '', priest: opt('priest') || '', patron: '', outstations: ['Main Church'], stats: {}, createdAt: TS() });
    b.set(db.doc('churchDirectory/' + id), { ...pub, createdAt: TS() });
    b.set(db.doc('parishes/' + id + '/config/settings'), { theme: 'Ivory', density: 'Comfortable', notifyEmail: true, notifySms: true, sessionMinutes: 30, currency: 'KSh', language: 'English', createdAt: TS() });
    await b.commit();
    const slug = await ensureWebsite(id, { ...pub, verified: true });
    console.log('Church saved and searchable:', id, '->', 'https://parishyetu.church/' + slug);
  }
  else if (cmd === 'assign') {
    need('email', 'role');
    const role = opt('role');
    if (!ROLE_LABEL[role] || role === 'super') { console.error('Role must be one of: diocese, deanery, priest, admin, secretary, finance, scc, parishioner'); process.exit(1); }
    const u = await userByEmail(opt('email'));
    if (!u) { console.error('That person has no account yet. Ask them to register on the website first.'); process.exit(1); }

    const patch = { role, title: ROLE_LABEL[role], status: 'active', updatedAt: TS() };
    const claimOpts = {};

    if (role === 'diocese' || role === 'deanery') {
      need('diocese');
      const d = await db.doc('dioceses/' + opt('diocese')).get();
      if (!d.exists) { console.error('Unknown diocese id'); process.exit(1); }
      Object.assign(patch, { dioceseId: d.id, parishId: '', organization: role === 'deanery' ? (opt('deanery') || '') : d.data().name, deanery: opt('deanery') || '' });
      claimOpts.dioceseId = d.id;
      claimOpts.organization = role === 'deanery' ? (opt('deanery') || '') : d.data().name;
      if (role === 'deanery') need('deanery');
    } else {
      need('parish');
      const p = await db.doc('parishes/' + opt('parish')).get();
      if (!p.exists) { console.error('Unknown church id'); process.exit(1); }
      Object.assign(patch, { parishId: p.id, dioceseId: p.data().dioceseId || '', deanery: p.data().deanery || '', organization: p.data().name, sccId: role === 'scc' ? (opt('scc') || '') : '' });
      claimOpts.parishId     = p.id;
      claimOpts.dioceseId    = p.data().dioceseId || '';
      claimOpts.organization = p.data().name;
      if (role === 'scc') claimOpts.sccId = opt('scc') || '';
    }

    const claims = claimsFor(role, claimOpts);
    await auth.setCustomUserClaims(u.uid, claims);
    patch.claims = claims;
    patch.claimsUpdatedAt = TS();

    const ref = db.doc('users/' + u.uid), snap = await ref.get();
    if (!snap.exists) Object.assign(patch, { name: u.displayName || u.email, email: u.email.toLowerCase(), personId: u.uid, createdAt: TS() });
    await ref.set(patch, { merge: true });
    console.log('Assigned', ROLE_LABEL[role], 'to', u.email);
    console.log('Custom claims set. That user MUST sign out and back in for them to take effect.');
  }
  else if (cmd === 'refresh') {
    need('email');
    const u = await userByEmail(opt('email'));
    if (!u) { console.error('No such account.'); process.exit(1); }
    const snap = await db.doc('users/' + u.uid).get();
    if (!snap.exists) { console.error('No /users profile for that account.'); process.exit(1); }
    const d = snap.data();
    const opts = {};
    if (d.parishId)      opts.parishId     = d.parishId;
    if (d.dioceseId)     opts.dioceseId    = d.dioceseId;
    if (d.organization)  opts.organization = d.organization;
    if (d.sccId)         opts.sccId        = d.sccId;
    const claims = claimsFor(d.role || 'parishioner', opts);
    await auth.setCustomUserClaims(u.uid, claims);
    await snap.ref.set({ claims, claimsUpdatedAt: TS() }, { merge: true });
    console.log('Claims refreshed for', u.email, '->', JSON.stringify(claims));
  }
  else if (cmd === 'list-churches') {
    const s = await db.collection('churchDirectory').get();
    s.forEach(d => console.log(d.id.padEnd(36), d.data().name, '·', d.data().dioceseName));
    if (s.empty) console.log('(no churches yet)');
  }
  else if (cmd === 'migrate') {
    const dry = args.includes('--dry-run');
    const ps = await db.collection('parishes').get();
    (await db.collection('slugs').get()).forEach(d => taken.add(d.id));
    ps.forEach(d => { if (d.data().slug) taken.add(d.data().slug); });
    for (const d of ps.docs) await ensureWebsite(d.id, d.data(), dry);
    const ds = await db.collection('dioceses').get();
    for (const d of ds.docs) {
      const x = d.data(), patch = {};
      if (!x.status) patch.status = 'active';
      if (!x.kind) patch.kind = /^arch/i.test(x.name || '') ? 'Archdiocese' : 'Diocese';
      if (!Array.isArray(x.deaneries)) {
        const names = [...new Set(ps.docs.filter(p => p.data().dioceseId === d.id && p.data().deanery).map(p => p.data().deanery))];
        patch.deaneries = names.map(n => ({ id: S.slugify(n, 40) || 'deanery', name: n, status: 'active' }));
      }
      if (Object.keys(patch).length) { console.log((dry ? '[dry] ' : '') + 'diocese ' + d.id, JSON.stringify(patch)); if (!dry) await d.ref.set(patch, { merge: true }); }
    }
    console.log(dry ? 'Dry run only - nothing was written.' : 'Migration complete: ' + ps.size + ' parishes, ' + ds.size + ' dioceses checked.');
  }
  else {
    console.error('Unknown command. See the header of scripts/admin.js.'); process.exit(1);
  }
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });