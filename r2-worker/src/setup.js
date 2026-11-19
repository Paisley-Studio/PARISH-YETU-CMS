/* PARISH YETU Worker - one-time parish setup (POST /api/setup-parish).
 *
 *   { parishId, officials: [{ role, title, name, email, phone, password }] }
 *
 * Called from /setup by the signed-in administrator or priest of an APPROVED parish (verified, active,
 * in an active diocese). Creates a Firebase Auth account and a /users profile for each official, all
 * confined to that one parish, then marks the parish setupComplete so it can never run again.
 * The caller's parish comes from their own live profile, never from the request alone, so officials
 * can never be attached to another parish.
 */
import { getDoc, commit, setW, setClaims, lookupEmails, createAuthUser, deleteAuthUser } from './firebase.js';
import { ApiError, claimsFor } from './provision.js';

const PID = /^[A-Za-z0-9_-]{1,80}$/;
const EMAIL = /^[^@\s]{1,64}@[^@\s]+\.[^@\s]{2,}$/;
const PHONE = /^\+?[0-9 ()-]{7,20}$/;
const ROLES = { priest: 'Parish Priest', admin: 'Parish Administrator', secretary: 'Parish Secretary', finance: 'Finance Officer', scc: 'SCC Leader' };
const bad = (field, msg) => { throw new ApiError(400, 'invalid-argument', msg, field); };
const clean = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

function officials(list, callerEmail) {
  if (!Array.isArray(list) || !list.length) bad('officials', 'Add at least one official.');
  if (list.length > 20) bad('officials', 'Add at most 20 officials at a time.');
  const seen = new Set([String(callerEmail || '').toLowerCase()]);
  let priests = 0;
  return list.map((o, i) => {
    const f = k => 'o' + i + '.' + k;
    const role = String(o && o.role || '');
    if (!ROLES[role]) bad(f('role'), 'Choose a role for official ' + (i + 1) + '.');
    if (role === 'priest' && ++priests > 1) bad(f('role'), 'Only one Parish Priest can be added.');
    const name = clean(o.name, 120);
    if (name.length < 3) bad(f('name'), 'Enter the full name of official ' + (i + 1) + '.');
    const email = clean(o.email, 160).toLowerCase();
    if (!EMAIL.test(email)) bad(f('email'), 'Enter a valid email for ' + name + '.');
    if (seen.has(email)) bad(f('email'), email + ' is used twice (or is your own account). Each official needs their own email.');
    seen.add(email);
    const phone = clean(o.phone, 24);
    if (phone && !PHONE.test(phone)) bad(f('phone'), 'Enter a valid phone number for ' + name + '.');
    const password = String(o.password || '');
    if (password.length < 8 || password.length > 128) bad(f('password'), 'The password for ' + name + ' must be at least 8 characters.');
    return { role, title: clean(o.title, 80) || ROLES[role], name, email, phone, password };
  });
}

export async function setupParish(env, user, body) {
  if (user.impersonatedBy) throw new ApiError(403, 'permission-denied', 'Not allowed during a support session.');
  const me = await getDoc(env, 'users/' + user.sub);
  if (!me || me.status !== 'active' || !['admin', 'priest'].includes(me.role))
    throw new ApiError(403, 'permission-denied', 'Only the parish administrator or parish priest can complete the parish setup.');
  const pid = String((body && body.parishId) || '');
  if (!PID.test(pid)) bad('parishId', 'Choose your parish.');
  if (me.parishId !== pid) throw new ApiError(403, 'wrong-parish', 'This account belongs to a different parish. Sign in with the administrator account of the parish you selected.');

  const p = await getDoc(env, 'parishes/' + pid);
  if (!p) throw new ApiError(404, 'not-found', 'That parish no longer exists.');
  if ((p.status || 'active') !== 'active' || p.verificationStatus === 'pending')
    throw new ApiError(403, 'not-approved', 'This parish has not been approved yet. Setup opens once PARISH YETU approves the parish.');
  if (p.dioceseId) {
    const d = await getDoc(env, 'dioceses/' + p.dioceseId);
    if (!d || (d.status || 'active') !== 'active') throw new ApiError(403, 'not-approved', 'The diocese of this parish has not been approved yet.');
  }
  if (p.setupComplete === true) throw new ApiError(409, 'already-done', 'This parish has already been set up. Officials sign in at /admin. Use Settings → Users to change roles.');

  const list = officials(body.officials, me.email);
  const taken = await lookupEmails(env, list.map(o => o.email));
  if (taken.length) bad('officials', 'These emails already have a PARISH YETU account: ' + taken.join(', ') + '. Use a different email for each official.');

  // Firebase Auth and Firestore cannot share a transaction: create the accounts, and remove them again if anything fails.
  const created = [];
  try {
    for (const o of list) created.push({ ...o, uid: await createAuthUser(env, { email: o.email, password: o.password, displayName: o.name }) });
    const base = { status: 'active', parishId: pid, dioceseId: p.dioceseId || '', deanery: p.deanery || '', organization: p.name || '', sccId: '' };
    const writes = created.map(o => setW('users/' + o.uid, { ...base, name: o.name, email: o.email, phone: o.phone, role: o.role, title: o.title, personId: o.uid, createdBy: user.sub }, { mustNotExist: true, stamps: ['createdAt'] }));
    const priest = created.find(o => o.role === 'priest');
    writes.push(setW('parishes/' + pid, { setupComplete: true, ...(priest ? { priest: priest.name } : {}) }, { merge: true, stamps: ['setupAt', 'updatedAt'] }));
    writes.push(setW('churchDirectory/' + pid, { setupComplete: true }, { merge: true, stamps: ['updatedAt'] }));
    writes.push(setW('parishes/' + pid + '/auditLogs/setup', { id: 'setup', user: me.name || '', action: 'Parish setup completed: ' + created.length + ' official(s) added', module: 'Settings', date: new Date().toISOString().slice(0, 19).replace('T', ' '), device: 'Setup wizard', ip: '—', before: '—', after: created.map(o => o.title + ': ' + o.name).join('; ').slice(0, 900), reason: 'One-time parish setup' }, { stamps: ['createdAt'] }));
    const res = await commit(env, writes);
    if (!res.ok) throw new Error('The setup could not be saved. Please try again.');
  } catch (e) {
    await Promise.all(created.map(o => deleteAuthUser(env, o.uid)));
    if (e instanceof ApiError) throw e;
    if (e && e.authCode === 'EMAIL_EXISTS') bad('officials', 'One of these emails already has an account. Use a different email.');
    if (e && /WEAK_PASSWORD/.test(e.authCode || '')) bad('officials', 'One of the passwords is too weak. Use at least 8 characters.');
    throw e;
  }
  // Claims are informational (rules read the live profile), so a failure here does not undo the setup.
  await Promise.all(created.map(o => setClaims(env, o.uid, claimsFor({ role: o.role, status: 'active', parishId: pid, dioceseId: p.dioceseId || '', organization: p.name || '' })).catch(() => {})));
  return { ok: true, parishId: pid, officials: created.map(o => ({ name: o.name, email: o.email, role: o.role, title: o.title })) };
}
