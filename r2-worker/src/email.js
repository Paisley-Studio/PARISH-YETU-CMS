/* PARISH YETU Worker - platform emails (approval, rejection, request for information, suspension, restore).
 *
 * Delivery: the Worker writes each message to the Firestore `mail` collection, in the same commit as the
 * decision itself. The "Trigger Email from Firestore" Firebase Extension picks it up and sends it through
 * our SMTP server, then records the result on the document (delivery.state: SUCCESS / ERROR).
 * The sender address and SMTP settings live in the extension's configuration, not here.
 *
 * Vars (wrangler.toml): APP_URL (links in the emails; defaults to https://parishyetu.church),
 *                       MAIL_REPLY_TO (optional reply-to address for applicants' answers).
 */
import { setW } from './firebase.js';

const escHtml = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const appUrl = env => String(env.APP_URL || 'https://parishyetu.church').replace(/\/+$/, '');

function layout(title, paragraphs, cta) {
  const body = paragraphs.map(p => `<p style="margin:0 0 14px;line-height:1.6">${p}</p>`).join('');
  const button = cta ? `<p style="margin:22px 0"><a href="${escHtml(cta.href)}" style="background:#6E1725;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700;display:inline-block">${escHtml(cta.label)}</a></p>` : '';
  return `<!doctype html><html><body style="margin:0;background:#F7F3E8;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#23262A">
<div style="max-width:560px;margin:0 auto;padding:28px 18px"><div style="background:#fff;border:1px solid #E8E5DD;border-radius:12px;padding:28px">
<div style="font-weight:800;letter-spacing:.06em;color:#6E1725;margin-bottom:18px">PARISH YETU</div>
<h1 style="font-size:20px;margin:0 0 16px;color:#111315">${escHtml(title)}</h1>${body}${button}
<p style="margin:22px 0 0;font-size:12px;color:#8B8A84">You are receiving this because you registered a parish on Parish Yetu.</p>
</div></div></body></html>`;
}
const quote = m => `<span style="display:block;border-left:3px solid #C9A227;padding:8px 12px;background:#F6EFD3;border-radius:4px;white-space:pre-line">${escHtml(m)}</span>`;

/* Every template returns { subject, html, text }. `m` is the super admin's message (already validated). */
export function buildEmail(env, kind, { parishName, adminName, message }) {
  const hi = 'Dear ' + (adminName || 'Parish Administrator') + ',';
  const login = appUrl(env) + '/admin';
  const P = escHtml(parishName);
  const T = {
    approved: {
      subject: parishName + ' is approved on Parish Yetu',
      title: 'Welcome to Parish Yetu',
      p: [escHtml(hi), `Good news: <b>${P}</b> has been verified and approved. Your parish is now listed in the public church directory, parishioners can find it and join, and your parish website goes live as soon as you publish it.`,
        'Sign in with the email and password you used when you registered.'],
      cta: { label: 'Sign in to your parish', href: login },
      text: `${hi}\n\n${parishName} has been verified and approved on Parish Yetu. Sign in at ${login}`,
    },
    rejected: {
      subject: 'Your Parish Yetu registration for ' + parishName,
      title: 'Registration not approved',
      p: [escHtml(hi), `We were not able to approve the registration of <b>${P}</b>.`, quote(message), 'If you believe this is a mistake, reply to this email and our team will look at it again.'],
      text: `${hi}\n\nWe were not able to approve the registration of ${parishName}.\n\nReason: ${message}\n\nReply to this email if you believe this is a mistake.`,
    },
    'info-requested': {
      subject: 'More information needed for ' + parishName,
      title: 'We need a little more information',
      p: [escHtml(hi), `Thank you for registering <b>${P}</b>. Before we can verify it, please send us the following:`, quote(message), 'Reply to this email with the details. Your registration stays open while we wait.'],
      text: `${hi}\n\nBefore we can verify ${parishName}, please send us the following:\n\n${message}\n\nReply to this email with the details.`,
    },
    suspended: {
      subject: 'Notice: ' + parishName + ' has been suspended on Parish Yetu',
      title: 'Parish account suspended',
      p: [escHtml(hi), `Access to <b>${P}</b> on Parish Yetu has been suspended. Staff and members cannot sign in to it and its public website is offline. <b>No data has been deleted.</b>`, quote(message), 'Reply to this email to resolve the matter and restore access.'],
      text: `${hi}\n\nAccess to ${parishName} on Parish Yetu has been suspended. No data has been deleted.\n\nReason: ${message}\n\nReply to this email to restore access.`,
    },
    restored: {
      subject: parishName + ' has been restored on Parish Yetu',
      title: 'Access restored',
      p: [escHtml(hi), `Access to <b>${P}</b> has been restored. Staff and members can sign in again.`],
      cta: { label: 'Sign in to your parish', href: login },
      text: `${hi}\n\nAccess to ${parishName} has been restored. Sign in at ${login}`,
    },
  }[kind];
  if (!T) throw new Error('Unknown email kind ' + kind);
  return { subject: T.subject, html: layout(T.title, T.p, T.cta), text: T.text };
}

/* Returns { status: 'queued'|'skipped', to, write }. The caller commits `write` (the mail/{id} document
 * for the Trigger Email extension) together with the change it reports, so no decision goes unannounced. */
export function prepareEmail(env, id, to, msg) {
  const list = [...new Set((to || []).map(x => String(x || '').trim().toLowerCase()).filter(x => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x)))];
  if (!list.length) return { status: 'skipped', to: [] };
  const doc = { to: list, message: { subject: msg.subject, html: msg.html, text: msg.text } };
  if (env.MAIL_REPLY_TO) doc.replyTo = String(env.MAIL_REPLY_TO);
  return { status: 'queued', to: list, write: setW('mail/' + id, doc, { stamps: ['createdAt'] }) };
}
