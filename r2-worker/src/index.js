/* PARISH YETU - Cloudflare Worker: the platform's trusted backend.
 *
 *   POST /api/register-parish   self-service church registration and provisioning   (provision.js)
 *   POST /api/platform/*        super admin: approve / reject / request info / suspend / restore, support sessions (platform.js)
 *   POST /presign-upload        parish documents -> R2 (existing)
 *   POST /presign-download      parish documents <- R2 (existing)
 *   POST /presign-media         parish logo / banner -> R2 (priest / administrator)
 *   GET  /media/{key}           public parish branding images (only parishes/{id}/public/...)
 *
 * Identity: Firebase ID tokens. Authorisation: the caller's live /users profile and parish status in
 * Firestore (custom claims are informational only and can be stale).
 */
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { verifyIdToken, getDoc } from './firebase.js';
import { registerParish, ApiError } from './provision.js';
import { parishAction, impersonate } from './platform.js';

/* ---------- CORS: ALLOWED_ORIGIN may list several origins, comma separated ---------- */
function allowedOrigin(env, request) {
  const list = String(env.ALLOWED_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
  const o = request.headers.get('Origin') || '';
  return list.includes(o) ? o : (list[0] || '');
}
function cors(env, request) {
  return {
    'Access-Control-Allow-Origin': allowedOrigin(env, request),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Vary': 'Origin',
  };
}
function json(env, request, status, body) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(env, request), 'Content-Type': 'application/json' } });
}

const PUBLIC_KEY = /^parishes\/[a-z0-9][a-z0-9-]{0,79}\/public\/[A-Za-z0-9._-]{1,120}$/;
const PID = /^[A-Za-z0-9_-]{1,80}$/;
const IMAGE_TYPES = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

function s3For(env) {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(env, request) });
    const url = new URL(request.url);

    /* Public parish branding (logo / banner). Only keys under parishes/{id}/public/ are ever served. */
    if (request.method === 'GET' && url.pathname.startsWith('/media/')) {
      let key = '';
      try { key = decodeURIComponent(url.pathname.slice('/media/'.length)); } catch (e) { key = ''; }
      if (!PUBLIC_KEY.test(key) || key.includes('..')) return new Response('Not found', { status: 404 });
      const signed = await getSignedUrl(s3For(env), new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: key }), { expiresIn: 3600 });
      return new Response(null, { status: 302, headers: { Location: signed, 'Cache-Control': 'public, max-age=1800' } });
    }

    if (request.method !== 'POST') return json(env, request, 405, { error: 'Method not allowed' });
    const auth = request.headers.get('Authorization') || '';
    if (!auth.startsWith('Bearer ')) return json(env, request, 401, { error: 'Missing token' });
    const idToken = auth.slice(7);
    let user;
    try { user = await verifyIdToken(idToken, env); }
    catch (e) {
      console.error('verifyIdToken failed:', e && (e.message || String(e)));
      return json(env, request, 401, { error: 'Invalid token' });
    }
    let body = {};
    try { body = await request.json(); } catch (e) { body = {}; }

    /* ---------- trusted API ---------- */
    if (url.pathname === '/api/register-parish') {
      try { return json(env, request, 200, await registerParish(env, user, body)); }
      catch (e) {
        if (e instanceof ApiError) return json(env, request, e.status, { error: e.message, code: e.code, field: e.field || '' });
        console.error('register-parish', e && e.message);
        return json(env, request, 500, { error: 'The registration service is temporarily unavailable. Please try again.' });
      }
    }

    /* ---------- platform owner (superAdmin claim) ---------- */
    const PLATFORM = { '/api/platform/parish-action': parishAction, '/api/platform/impersonate': impersonate };
    if (PLATFORM[url.pathname]) {
      try { return json(env, request, 200, await PLATFORM[url.pathname](env, user, body)); }
      catch (e) {
        if (e instanceof ApiError) return json(env, request, e.status, { error: e.message, code: e.code, field: e.field || '' });
        console.error(url.pathname, e && e.message);
        return json(env, request, 500, { error: 'The platform service is temporarily unavailable. Nothing was changed if you see this before a success message; refresh and check.' });
      }
    }

    /* ---------- R2 file services: role, status and parish come from the live profile ---------- */
    let profile;
    try { profile = await getDoc(env, 'users/' + user.sub, idToken); }
    catch (e) { return json(env, request, 503, { error: 'Could not verify your account. Try again.' }); }
    if (!profile || profile.status !== 'active') return json(env, request, 403, { error: 'Account not active.' });
    const role = profile.role || '';
    if (!['super', 'priest', 'admin', 'secretary', 'finance'].includes(role)) return json(env, request, 403, { error: 'Not allowed' });
    // Parish staff are always confined to their own parish. Only the platform admin may name one.
    const parishId = role === 'super' ? String(body.parishId || '') : String(profile.parishId || '');
    if (!PID.test(parishId)) return json(env, request, 403, { error: 'No parish assigned' });
    let parish;
    try { parish = await getDoc(env, 'parishes/' + parishId, idToken); }
    catch (e) { return json(env, request, 503, { error: 'Could not verify the parish. Try again.' }); }
    if (!parish || (parish.status || 'active') !== 'active') return json(env, request, 403, { error: 'This parish is not active.' });

    const s3 = s3For(env);
    const prefix = 'parishes/' + parishId + '/documents/';

    if (url.pathname === '/presign-upload') {
      const key = String(body.key || '').slice(0, 400);
      const contentType = String(body.contentType || 'application/octet-stream').slice(0, 120);
      if (!key.startsWith(prefix) || key.includes('..')) return json(env, request, 400, { error: 'Bad key' });
      const signed = await getSignedUrl(s3, new PutObjectCommand({ Bucket: env.R2_BUCKET, Key: key, ContentType: contentType }), { expiresIn: 600 });
      return json(env, request, 200, { url: signed, key });
    }

    if (url.pathname === '/presign-download') {
      const key = String(body.key || '');
      if (!key.startsWith(prefix) || key.includes('..')) return json(env, request, 400, { error: 'Bad key' });
      const signed = await getSignedUrl(s3, new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: key }), { expiresIn: 3600 });
      return json(env, request, 200, { url: signed });
    }

    /* Parish logo / banner upload: priest and parish administrator only. */
    if (url.pathname === '/presign-media') {
      if (!['super', 'priest', 'admin'].includes(role)) return json(env, request, 403, { error: 'Only the parish priest or administrator can change branding.' });
      const kind = body.kind === 'banner' ? 'banner' : 'logo';
      const type = String(body.contentType || '');
      const ext = IMAGE_TYPES[type];
      const size = Number(body.size || 0);
      if (!ext) return json(env, request, 400, { error: 'Use a PNG, JPEG or WebP image.' });
      if (!(size > 0 && size <= 5 * 1024 * 1024)) return json(env, request, 400, { error: 'Images must be smaller than 5 MB.' });
      const key = 'parishes/' + parishId + '/public/' + kind + '-' + Date.now().toString(36) + '.' + ext;
      const signed = await getSignedUrl(s3, new PutObjectCommand({ Bucket: env.R2_BUCKET, Key: key, ContentType: type, ContentLength: size }), { expiresIn: 600 });
      return json(env, request, 200, { url: signed, key, publicUrl: url.origin + '/media/' + key });
    }

    return json(env, request, 404, { error: 'Not found' });
  },
};
