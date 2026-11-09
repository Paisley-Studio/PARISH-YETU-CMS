/* PARISH YETU Worker - Firebase connectivity without the Admin SDK (which does not run on Workers).
 *
 *  - verifyIdToken: checks a Firebase ID token (RS256, Google securetoken keys, audience, issuer, expiry).
 *  - Service-account OAuth: a JWT signed with WebCrypto is exchanged for a Google access token.
 *    Requests made with it use IAM and BYPASS Firestore Security Rules, so every caller of these
 *    helpers must perform its own authorisation checks first.
 *  - Firestore REST (get / runQuery / commit with preconditions) and Identity Toolkit (custom claims).
 *
 * Secrets (wrangler secret put): FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.
 * Local tests only: FIREBASE_EMULATORS="true" + FIRESTORE_EMULATOR_HOST / AUTH_EMULATOR_HOST (127.0.0.1 / localhost).
 */
export const PROJECT_ID = 'church-cms-4d735';
const GOOGLE_JWK_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

function b64urlToBytes(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
const b64urlToString = s => new TextDecoder().decode(b64urlToBytes(s));
const bytesToB64url = b => { let s = ''; const a = new Uint8Array(b); for (let i = 0; i < a.length; i++) s += String.fromCharCode(a[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const strToB64url = s => bytesToB64url(new TextEncoder().encode(s));

/* Emulator mode is accepted only when explicitly enabled AND every emulator host is local. */
export function emulated(env) {
  if (String(env.FIREBASE_EMULATORS || '') !== 'true') return false;
  const local = h => /^(127\.0\.0\.1|localhost):\d+$/.test(String(h || ''));
  return local(env.FIRESTORE_EMULATOR_HOST) && local(env.AUTH_EMULATOR_HOST);
}

/* ---------- ID token verification ---------- */
let cachedKeys = null, cachedKeysExpiry = 0;
async function googleJwks() {
  const now = Date.now();
  if (cachedKeys && now < cachedKeysExpiry) return cachedKeys;
  const r = await fetch(GOOGLE_JWK_URL, { cf: { cacheTtl: 3600 } });
  if (!r.ok) throw new Error('Could not fetch Google JWKs (' + r.status + ')');
  const data = await r.json();
  const m = (r.headers.get('cache-control') || '').match(/max-age=(\d+)/);
  const map = {};
  (data.keys || []).forEach(k => { if (k.kid) map[k.kid] = k; });
  cachedKeys = map;
  cachedKeysExpiry = now + (m ? parseInt(m[1], 10) * 1000 : 3600 * 1000);
  return map;
}

export async function verifyIdToken(idToken, env) {
  const parts = String(idToken).split('.');
  if (parts.length !== 3) throw new Error('Malformed token');
  const [h64, p64, s64] = parts;
  const header = JSON.parse(b64urlToString(h64));
  const payload = JSON.parse(b64urlToString(p64));
  const nowSec = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp < nowSec) throw new Error('Token expired');
  if (payload.aud !== PROJECT_ID) throw new Error('Wrong audience');
  if (payload.iss !== 'https://securetoken.google.com/' + PROJECT_ID) throw new Error('Wrong issuer');
  if (!payload.sub) throw new Error('Missing subject');
  if (env && emulated(env) && header.alg === 'none') return payload; // Auth emulator tokens are unsigned
  if (header.alg !== 'RS256') throw new Error('Unsupported algorithm');
  if (typeof payload.iat !== 'number' || payload.iat > nowSec + 60) throw new Error('Token issued in the future');
  const jwk = (await googleJwks())[header.kid];
  if (!jwk) throw new Error('Unknown key id');
  const key = await crypto.subtle.importKey('jwk', { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify({ name: 'RSASSA-PKCS1-v1_5' }, key, b64urlToBytes(s64), new TextEncoder().encode(h64 + '.' + p64));
  if (!ok) throw new Error('Signature verification failed');
  return payload;
}

/* ---------- service-account JWT signing ---------- */
async function signServiceJwt(env, payload) {
  if (!env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) throw new Error('Backend credentials are not configured');
  const pem = String(env.FIREBASE_PRIVATE_KEY).replace(/-----[^-]+-----/g, '').replace(/[^A-Za-z0-9+/=]/g, '');
  const der = Uint8Array.from(atob(pem), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const unsigned = strToB64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' + strToB64url(JSON.stringify(payload));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  return unsigned + '.' + bytesToB64url(sig);
}

/* Firebase custom token (the same format the Admin SDK's createCustomToken produces). The browser
 * exchanges it with signInWithCustomToken. Valid for exchange for 5 minutes only. */
export async function createCustomToken(env, uid, claims) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: env.FIREBASE_CLIENT_EMAIL || 'firebase-auth-emulator@example.com', sub: env.FIREBASE_CLIENT_EMAIL || 'firebase-auth-emulator@example.com',
    aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
    iat: now, exp: now + 300, uid, claims: claims || {},
  };
  if (emulated(env)) return strToB64url(JSON.stringify({ alg: 'none', typ: 'JWT' })) + '.' + strToB64url(JSON.stringify(payload)) + '.';
  return signServiceJwt(env, payload);
}

/* ---------- service-account access token ---------- */
const SCOPES = 'https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/identitytoolkit';
let saToken = null, saExpiry = 0;
export async function accessToken(env) {
  if (emulated(env)) return 'owner'; // emulators accept "owner" as an admin credential
  const now = Math.floor(Date.now() / 1000);
  if (saToken && now < saExpiry - 120) return saToken;
  const assertion = await signServiceJwt(env, { iss: env.FIREBASE_CLIENT_EMAIL, scope: SCOPES, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=' + assertion,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error('Google token exchange failed (' + r.status + ')');
  saToken = j.access_token; saExpiry = now + (j.expires_in || 3600);
  return saToken;
}

/* ---------- Firestore REST ---------- */
const fsBase = env => (emulated(env) ? 'http://' + env.FIRESTORE_EMULATOR_HOST : 'https://firestore.googleapis.com') + '/v1/projects/' + PROJECT_ID + '/databases/(default)/documents';
export const docName = path => 'projects/' + PROJECT_ID + '/databases/(default)/documents/' + path;

export function encode(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encode) } };
  return { mapValue: { fields: encodeFields(v) } };
}
export function encodeFields(o) { const f = {}; Object.keys(o).forEach(k => { if (o[k] !== undefined) f[k] = encode(o[k]); }); return f; }
export function decode(v) {
  if (!v) return undefined;
  if ('stringValue' in v) return v.stringValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(decode);
  if ('mapValue' in v) return decodeFields(v.mapValue.fields || {});
  return undefined;
}
export function decodeFields(f) { const o = {}; Object.keys(f || {}).forEach(k => { o[k] = decode(f[k]); }); return o; }

/* Reads with the service account (bypasses rules) unless a user ID token is given (rules apply). */
export async function getDoc(env, path, userToken) {
  const tok = userToken || await accessToken(env);
  const r = await fetch(fsBase(env) + '/' + path, { headers: { Authorization: 'Bearer ' + tok } });
  if (r.status === 404 || (userToken && r.status === 403)) return null;
  if (!r.ok) throw new Error('Firestore read failed (' + r.status + ')');
  const d = await r.json();
  return decodeFields(d.fields);
}

export async function queryEq(env, collection, field, value, limit) {
  const r = await fetch(fsBase(env) + ':runQuery', {
    method: 'POST', headers: { Authorization: 'Bearer ' + await accessToken(env), 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: collection }], where: { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: encode(value) } }, limit: limit || 50 } }),
  });
  if (!r.ok) throw new Error('Firestore query failed (' + r.status + ')');
  return (await r.json()).filter(x => x.document).map(x => ({ id: x.document.name.split('/').pop(), ...decodeFields(x.document.fields) }));
}

/* Write builders. merge=true only replaces the listed top-level fields. Timestamps are server-side. */
export function setW(path, data, { merge = false, mustNotExist = false, stamps = [] } = {}) {
  const w = { update: { name: docName(path), fields: encodeFields(data) } };
  if (merge) w.updateMask = { fieldPaths: Object.keys(data).map(k => '`' + k.replace(/`/g, '\\`') + '`') };
  if (mustNotExist) w.currentDocument = { exists: false };
  if (stamps.length) w.updateTransforms = stamps.map(f => ({ fieldPath: f, setToServerValue: 'REQUEST_TIME' }));
  return w;
}
export const deleteW = path => ({ delete: docName(path) });

/* Atomic commit. Returns { ok:true } or { ok:false, conflict:true } when a precondition failed. */
export async function commit(env, writes) {
  const r = await fetch(fsBase(env) + ':commit', {
    method: 'POST', headers: { Authorization: 'Bearer ' + await accessToken(env), 'Content-Type': 'application/json' },
    body: JSON.stringify({ writes }),
  });
  if (r.ok) return { ok: true };
  const t = await r.text();
  if (r.status === 409 || /ALREADY_EXISTS|FAILED_PRECONDITION/.test(t)) return { ok: false, conflict: true };
  throw new Error('Firestore commit failed (' + r.status + '): ' + t.slice(0, 200));
}

/* ---------- Identity Toolkit ---------- */
const itBase = env => (emulated(env) ? 'http://' + env.AUTH_EMULATOR_HOST + '/identitytoolkit.googleapis.com' : 'https://identitytoolkit.googleapis.com') + '/v1/projects/' + PROJECT_ID;
export async function lookupUser(env, uid) {
  const r = await fetch(itBase(env) + '/accounts:lookup', { method: 'POST', headers: { Authorization: 'Bearer ' + await accessToken(env), 'Content-Type': 'application/json' }, body: JSON.stringify({ localId: [uid] }) });
  if (!r.ok) throw new Error('Account lookup failed (' + r.status + ')');
  const j = await r.json();
  return (j.users || [])[0] || null;
}
export async function setClaims(env, uid, claims) {
  const r = await fetch(itBase(env) + '/accounts:update', { method: 'POST', headers: { Authorization: 'Bearer ' + await accessToken(env), 'Content-Type': 'application/json' }, body: JSON.stringify({ localId: uid, customAttributes: JSON.stringify(claims) }) });
  if (!r.ok) throw new Error('Setting account claims failed (' + r.status + ')');
}
