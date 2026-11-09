/* PARISH YETU Worker - platform-owner (super admin) actions.
 *
 *   POST /api/platform/parish-action   { parishId, action, message }
 *        action: approve | reject | request-info | suspend | restore
 *        Changes the parish (and, on approval, its administrator's account) atomically, writes the
 *        platformAudit entry in the same commit, then emails the parish administrator.
 *   POST /api/platform/impersonate     { uid, reason }
 *        Returns a short-lived custom token to sign in as a parish staff account for support.
 *
 * Every request must carry an ID token with the `superAdmin: true` custom claim
 * (set by `npm run admin -- make-super`). Writes use the service account, so all checks are explicit.
 */
import { getDoc, queryEq, commit, setW, setClaims, createCustomToken } from './firebase.js';
import { ApiError, claimsFor } from './provision.js';
import { buildEmail, prepareEmail } from './email.js';

const PID = /^[A-Za-z0-9_-]{1,80}$/;
const UID = /^[A-Za-z0-9_-]{1,128}$/;
const STAFF = ['priest', 'admin', 'secretary', 'finance', 'scc'];
const rid = () => Date.now().toString(36) + '-' + [...crypto.getRandomValues(new Uint8Array(6))].map(x => x.toString(16).padStart(2, '0')).join('');

async function requireSuper(env, user) {
  if (user.superAdmin !== true) throw new ApiError(403, 'permission-denied', 'This action needs the platform superAdmin claim. Run "npm run admin -- make-super --email <you>" and sign in again.');
  if (user.impersonatedBy) throw new ApiError(403, 'permission-denied', 'Not allowed during a support session.');
  const me = await getDoc(env, 'users/' + user.sub);
  if (me && me.status && me.status !== 'active') throw new ApiError(403, 'permission-denied', 'Your platform account is not active.');
  return { uid: user.sub, name: (me && me.name) || user.name || user.email || 'Platform administrator', email: user.email || '' };
}

function message(body, required) {
  const m = String((body && body.message) || '').replace(/\r\n/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, ' ').trim();
  if (required && m.length < 3) throw new ApiError(400, 'invalid-argument', 'Write a message for the parish administrator.', 'message');
  if (m.length > 2000) throw new ApiError(400, 'invalid-argument', 'The message is too long (maximum 2000 characters).', 'message');
  return m;
}

/* The person who registered the parish: parishes.createdBy, else the first parish administrator. */
async function applicantOf(env, pid, p) {
  if (p.createdBy && UID.test(p.createdBy)) {
    const u = await getDoc(env, 'users/' + p.createdBy);
    if (u) return { uid: p.createdBy, ...u };
  }
  const admins = (await queryEq(env, 'users', 'parishId', pid, 50)).filter(u => u.role === 'admin');
  return admins[0] ? { uid: admins[0].id, ...admins[0] } : null;
}

const state = p => (p.status && p.status !== 'active') ? p.status : (p.verificationStatus === 'pending' ? 'pending' : 'active');
const ALLOWED = { approve: ['pending'], reject: ['pending'], 'request-info': ['pending'], suspend: ['active', 'pending'], restore: ['suspended', 'rejected'] };

export async function parishAction(env, user, body) {
  const by = await requireSuper(env, user);
  const pid = String((body && body.parishId) || '');
  const action = String((body && body.action) || '');
  if (!PID.test(pid)) throw new ApiError(400, 'invalid-argument', 'Unknown parish.');
  if (!ALLOWED[action]) throw new ApiError(400, 'invalid-argument', 'Unknown action.');
  const msg = message(body, ['reject', 'request-info', 'suspend'].includes(action));

  const p = await getDoc(env, 'parishes/' + pid);
  if (!p) throw new ApiError(404, 'not-found', 'That parish no longer exists.');
  const cur = state(p);
  if (!ALLOWED[action].includes(cur)) throw new ApiError(409, 'failed-precondition', 'This parish is ' + cur + '; it cannot be ' + action.replace('-', ' ') + 'd now. Refresh the page.');

  const applicant = await applicantOf(env, pid, p);
  const verified = p.verificationStatus !== 'pending' && p.verificationStatus !== 'rejected';
  const now = new Date();
  let pp, dir = null, kind;
  if (action === 'approve') {
    pp = { status: 'active', verificationStatus: 'verified', verifiedBy: by.uid, verifiedAt: now, reviewNote: '', infoRequested: false };
    dir = { status: 'active' }; kind = 'approved';
  } else if (action === 'reject') {
    pp = { status: 'rejected', verificationStatus: 'rejected', reviewNote: msg, reviewedBy: by.uid, reviewedAt: now, infoRequested: false };
    dir = { status: 'rejected' }; kind = 'rejected';
  } else if (action === 'request-info') {
    pp = { infoRequested: true, reviewNote: msg, reviewedBy: by.uid, reviewedAt: now }; kind = 'info-requested';
  } else if (action === 'suspend') {
    pp = { status: 'suspended', suspendedReason: msg, suspendedBy: by.uid, suspendedAt: now };
    dir = { status: 'suspended' }; kind = 'suspended';
  } else { // restore: a rejected parish goes back to the review queue; a suspended one to where it was
    pp = cur === 'rejected' ? { status: 'active', verificationStatus: 'pending', reviewNote: '', infoRequested: false } : { status: 'active', suspendedReason: '' };
    dir = { status: cur === 'rejected' || !verified ? 'pending' : 'active' }; kind = cur === 'rejected' ? null : 'restored';
  }

  const auditId = rid();
  const email = kind
    ? prepareEmail(env, auditId, [applicant && applicant.email, kind === 'suspended' ? p.email : ''], buildEmail(env, kind, { parishName: p.name || pid, adminName: applicant && applicant.name, message: msg }))
    : { status: 'skipped', to: [] };

  const writes = [setW('parishes/' + pid, pp, { merge: true, stamps: ['updatedAt'] })];
  if (dir) writes.push(setW('churchDirectory/' + pid, dir, { merge: true, stamps: ['updatedAt'] }));
  if (action === 'approve' && applicant && applicant.status !== 'active') writes.push(setW('users/' + applicant.uid, { status: 'active' }, { merge: true, stamps: ['updatedAt'] }));
  writes.push(setW('platformAudit/' + auditId, {
    action: 'parish.' + action, parishId: pid, name: p.name || '', reason: msg, previousStatus: cur,
    applicantUid: applicant ? applicant.uid : '', emailTo: email.to, emailStatus: email.status,
    by: by.uid, byName: by.name, byEmail: by.email, via: 'api',
  }, { stamps: ['at'] }));
  if (email.write) writes.push(email.write);
  await commit(env, writes);

  if (action === 'approve' && applicant) {
    try { await setClaims(env, applicant.uid, claimsFor({ ...applicant, status: 'active' })); }
    catch (e) { console.warn('claims refresh skipped', e && e.message); }
  }
  return { ok: true, parishId: pid, action, status: state({ ...p, ...pp }), emailStatus: email.status, emailTo: email.to, mailId: email.write ? auditId : '' };
}

export async function impersonate(env, user, body) {
  const by = await requireSuper(env, user);
  const uid = String((body && body.uid) || '');
  const reason = String((body && body.reason) || '').trim().slice(0, 500);
  if (!UID.test(uid)) throw new ApiError(400, 'invalid-argument', 'Unknown account.');
  if (reason.length < 3) throw new ApiError(400, 'invalid-argument', 'Give a reason for the support session (it is recorded).', 'reason');
  const t = await getDoc(env, 'users/' + uid);
  if (!t) throw new ApiError(404, 'not-found', 'That account has no profile.');
  if (!STAFF.includes(t.role)) throw new ApiError(403, 'permission-denied', 'Support sessions are only available for parish staff accounts.');
  if (t.status !== 'active') throw new ApiError(409, 'failed-precondition', 'That account is not active.');
  const token = await createCustomToken(env, uid, { impersonatedBy: by.uid });
  await commit(env, [setW('platformAudit/' + rid(), {
    action: 'support.impersonation-started', parishId: t.parishId || '', name: t.name || '', targetUid: uid, targetEmail: t.email || '',
    reason, by: by.uid, byName: by.name, byEmail: by.email, via: 'api',
  }, { stamps: ['at'] })]);
  return { token, name: t.name || '', email: t.email || '', parishId: t.parishId || '' };
}
