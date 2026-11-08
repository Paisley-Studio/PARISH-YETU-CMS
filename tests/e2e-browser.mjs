/* PARISH YETU - end-to-end browser test (headless Microsoft Edge / Chrome over the DevTools protocol).
 * Run:  npm run test:e2e
 * Uses the Hosting, Auth and Firestore emulators from firebase.test.json and runs the Cloudflare Worker
 * module locally on port 8797. Set BROWSER=path\to\chrome.exe to use another Chromium browser. */
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import worker from '../r2-worker/src/index.js';
import { encodeFields, decodeFields } from '../r2-worker/src/firebase.js';

const P = 'church-cms-4d735', HOST = 'http://127.0.0.1:5055', EMU = '?emulators=8180,9199,8797';
const FS = 'http://127.0.0.1:8180/v1/projects/' + P + '/databases/(default)/documents';
const ENV = { FIREBASE_EMULATORS: 'true', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8180', AUTH_EMULATOR_HOST: '127.0.0.1:9199', ALLOWED_ORIGIN: HOST, R2_BUCKET: 't', R2_ACCOUNT_ID: 'a', R2_ACCESS_KEY_ID: 'k', R2_SECRET_ACCESS_KEY: 's' };
const BROWSER = process.env.BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const owner = { 'Content-Type': 'application/json', Authorization: 'Bearer owner' };
const put = (path, data) => fetch(FS + '/' + path, { method: 'PATCH', headers: owner, body: JSON.stringify({ fields: encodeFields(data) }) });
const patch = (path, data) => fetch(FS + '/' + path + '?' + Object.keys(data).map(k => 'updateMask.fieldPaths=' + k).join('&'), { method: 'PATCH', headers: owner, body: JSON.stringify({ fields: encodeFields(data) }) });
const get = async path => { const r = await fetch(FS + '/' + path, { headers: owner }); return r.ok ? decodeFields((await r.json()).fields) : null; };
const step = m => console.log('  ✔ ' + m);

/* ---------- local Worker ---------- */
const srv = http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const r = await worker.fetch(new Request('http://127.0.0.1:8797' + req.url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? undefined : Buffer.concat(chunks) }), ENV);
  res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer()));
}).listen(8797);

/* ---------- browser over CDP ---------- */
const prof = mkdtempSync(join(tmpdir(), 'py-e2e-'));
const br = spawn(BROWSER, ['--headless=new', '--remote-debugging-port=9333', '--user-data-dir=' + prof, '--no-first-run', '--disable-gpu', 'about:blank'], { stdio: 'ignore' });
let ws, seq = 0; const pending = new Map(); const pageErrors = [];
async function connect() {
  for (let i = 0; i < 50; i++) { try { const l = await (await fetch('http://127.0.0.1:9333/json/list')).json(); const t = l.find(x => x.type === 'page'); if (t) { ws = new WebSocket(t.webSocketDebuggerUrl); break; } } catch (e) {} await sleep(200); }
  await new Promise((ok, no) => { ws.onopen = ok; ws.onerror = no; });
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    if (m.method === 'Runtime.exceptionThrown') pageErrors.push((m.params.exceptionDetails.exception || {}).description || m.params.exceptionDetails.text); };
}
const cdp = (method, params = {}) => new Promise(r => { const id = ++seq; pending.set(id, r); ws.send(JSON.stringify({ id, method, params })); });
async function js(expr) { const r = await cdp('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'eval error'); return r.result.result.value; }
async function go(path) { await cdp('Page.navigate', { url: HOST + path }); await sleep(400); }
async function waitFor(expr, what, ms = 15000) { const t = Date.now(); while (Date.now() - t < ms) { try { const v = await js(expr); if (v) return v; } catch (e) {} await sleep(250); } const body = await js('document.body ? document.body.innerText.slice(0,600) : ""').catch(() => ''); throw new Error('Timed out waiting for: ' + what + '\n--- page text ---\n' + body); }
const fill = (k, v) => js(`(()=>{const el=document.querySelector('[data-k="${k}"]');if(!el)throw new Error('no field ${k}');if(el.type==='checkbox')el.checked=${JSON.stringify(!!v)};else el.value=${JSON.stringify(v)};el.dispatchEvent(new Event(el.tagName==='SELECT'||el.type==='checkbox'?'change':'input',{bubbles:true}));return true})()`);
const click = sel => js(`(()=>{const el=document.querySelector(${JSON.stringify(sel)});if(!el)throw new Error('no element ${sel}');el.click();return true})()`);
const text = () => js('document.body.innerText');

try {
  await fetch('http://127.0.0.1:8180/emulator/v1/projects/' + P + '/databases/(default)/documents', { method: 'DELETE' });
  await fetch('http://127.0.0.1:9199/emulator/v1/projects/' + P + '/accounts', { method: 'DELETE' });
  await put('dioceses/murang-a', { name: "Diocese of Murang'a", archdiocese: 'Archdiocese of Nyeri', country: 'Kenya', status: 'active', deaneries: [{ id: 'thika', name: 'Thika', status: 'active' }, { id: 'gatanga', name: 'Gatanga', status: 'active' }] });
  await put('dioceses/nairobi', { name: 'Archdiocese of Nairobi', kind: 'Archdiocese', country: 'Kenya', status: 'active', deaneries: [{ id: 'westlands', name: 'Westlands', status: 'active' }] });
  console.log('E2E: page addresses');
  const routes = { home: 'Grow in Faith', login: 'Sign in', join: '', register: '', 'register-parish': 'Register your parish', platform: 'PARISH YETU', dashboard: '', settings: '', website: '', 'super-admin': '', finance: '', admin: 'Staff sign in' };
  for (const [r, want] of Object.entries(routes)) {
    const res = await fetch(HOST + '/' + r, { redirect: 'manual' });
    const body = await res.text();
    assert.equal(res.status, 200, '/' + r + ' -> ' + res.status);
    assert.ok(!body.includes('parish-home') || r === 'admin' || !body.includes('Loading parish website'), '/' + r + ' served the parish shell instead of its page');
    if (want) assert.ok(body.includes(want), '/' + r + ' does not look like the right page');
  }
  step('short addresses load their pages: /' + Object.keys(routes).join(', /'));
  await connect();
  await cdp('Page.enable'); await cdp('Runtime.enable');
  for (const [oldp, newp] of [['/01-home.html#find', '/home#find'], ['/parish-register.html', '/platform'], ['/24-register.html?parish=x-y', '/register?parish=x-y'], ['/01-home', '/home'], ['/admin.html', '/admin']]) {
    await go(oldp);
    await waitFor(`location.pathname + location.search + location.hash === ${JSON.stringify(newp)}`, oldp + ' -> ' + newp);
  }
  step('old addresses (with .html, ?query and #section) forward to the new short addresses');
  console.log('E2E: church registration wizard');

  await go('/register-parish' + EMU);
  await waitFor(`!!document.querySelector('[data-k="name"]')`, 'wizard step 1');
  await click('#next');
  assert.ok(await js(`document.querySelector('[data-f="name"]').classList.contains('bad')`), 'inline validation on empty name');
  step('inline validation blocks an empty step');
  await fill('name', "St. Mary's Parish, Thika"); await fill('county', 'Kiambu'); await fill('town', 'Thika'); await fill('phone', '+254 700 111 222');
  assert.match(await js(`document.getElementById('urlv').textContent`), /parishyetu\.church\/st-marys-parish-thika/);
  step('live web-address preview: parishyetu.church/st-marys-parish-thika');
  await click('#next');
  await waitFor(`!!document.querySelector('#f_dioceseId')`, 'step 2');
  const opts = await js(`[...document.querySelectorAll('#f_dioceseId option')].map(o=>o.textContent)`);
  assert.ok(opts.some(o => o.includes("Murang'a")), 'dioceses load from the directory');
  await fill('dioceseId', 'murang-a');
  const dn = await js(`[...document.querySelectorAll('#f_deaneryChoice option')].map(o=>o.value)`);
  assert.ok(dn.includes('thika') && dn.includes('gatanga') && !dn.includes('westlands'), 'deaneries filtered by diocese: ' + dn);
  step('dioceses loaded; deaneries filtered to the selected diocese');
  await fill('deaneryChoice', 'thika');
  await click('#next');
  await waitFor(`!!document.querySelector('[data-k="aName"]')`, 'step 3');
  await click('#back');
  await waitFor(`document.querySelector('#f_deaneryChoice') && document.querySelector('#f_deaneryChoice').value==='thika'`, 'step 2 kept the chosen deanery');
  await click('#back');
  assert.equal(await js(`document.querySelector('[data-k="name"]').value`), "St. Mary's Parish, Thika");
  step('Back/Next preserve entered data');
  await click('#next'); await waitFor(`!!document.querySelector('#f_dioceseId')`, 'step 2 again'); await click('#next');
  await waitFor(`!!document.querySelector('[data-k="aName"]')`, 'step 3 again');
  await fill('aName', 'Mary Wanjiku'); await fill('aEmail', 'mary@stmarys.test'); await fill('aPhone', '+254 700 333 444'); await fill('pw', 'Passw0rd!long'); await fill('pw2', 'Passw0rd!long');
  await click('#next'); await waitFor(`!!document.querySelector('[data-k="motto"]')`, 'step 4');
  await fill('motto', 'Ut omnes unum sint'); await fill('about', 'A welcoming parish in the heart of Thika.');
  await click('#next'); await waitFor(`document.body.innerText.includes('Review and submit')`, 'review');
  const rv = await text();
  assert.ok(rv.includes("Diocese of Murang'a") && rv.includes('Thika') && rv.includes('mary@stmarys.test') && rv.includes('Ut omnes unum sint'), 'review reflects the inputs');
  step('review screen reflects every section');
  await fill('agree', true);
  await click('#next');
  await waitFor(`document.body.innerText.includes('is on PARISH YETU')`, 'success screen', 25000);
  assert.ok((await text()).includes('parishyetu.church/st-marys-parish-thika'));
  step('submitted: success screen shows status and parishyetu.church/st-marys-parish-thika');
  const users = await (await fetch(FS + ':runQuery', { method: 'POST', headers: owner, body: JSON.stringify({ structuredQuery: { from: [{ collectionId: 'users' }] } }) })).json();
  const prof = users.filter(x => x.document).map(x => decodeFields(x.document.fields)).find(u => u.email === 'mary@stmarys.test');
  assert.equal(prof.role, 'admin'); assert.equal(prof.parishId, 'st-marys-parish-thika');
  step('backend assigned role=admin for parish st-marys-parish-thika');

  console.log('E2E: dashboard link and website management');
  await go('/dashboard' + EMU);
  await waitFor(`!!document.querySelector('.sitecard .sc-url')`, 'dashboard website card');
  assert.equal(await js(`document.querySelector('.sitecard .sc-url').textContent`), 'parishyetu.church/st-marys-parish-thika');
  assert.ok(await js(`!!document.getElementById('sitepill')`), 'header website shortcut');
  step('admin dashboard shows the parish website card and header shortcut');
  await go('/website' + EMU);
  await waitFor(`!!document.getElementById('bpub')`, 'website editor');
  await js(`(()=>{const el=document.querySelector('[data-p="welcome"]');el.value='Karibu St. Mary\\'s';el.dispatchEvent(new Event('input',{bubbles:true}))})()`);
  await click('#bpub');
  await waitFor(`!!document.querySelector('.modal .mf .btn.p')`, 'publish confirm');
  await click('.modal .mf .btn.p');
  for (let i = 0; i < 40; i++) { const s = await get('parishes/st-marys-parish-thika/public/site'); if (s && s.published) break; await sleep(250); }
  assert.equal((await get('parishes/st-marys-parish-thika/public/site')).published, true);
  step('website published from the editor');

  console.log('E2E: public parish website');
  await go('/st-marys-parish-thika');
  await waitFor(`document.body.innerText.includes('verified')`, 'pending-verification page');
  step('unverified parish: public page explains it opens after verification');
  await patch('churchDirectory/st-marys-parish-thika', { status: 'active' });
  await patch('parishes/st-marys-parish-thika', { verificationStatus: 'verified' });
  await go('/st-marys-parish-thika');
  await waitFor(`document.body.innerText.includes('Karibu St. Mary')`, 'published homepage');
  const pub = await text();
  assert.ok(pub.includes("St. Mary's Parish, Thika") && pub.includes('Ut omnes unum sint') && pub.includes('Powered by'));
  assert.ok(!pub.includes('mary@stmarys.test'), 'administrator email is not public');
  step('verified parish: branded homepage renders (name, motto, welcome, "Powered by PARISH YETU")');
  await js('location.reload()'); await sleep(500);
  await waitFor(`document.body.innerText.includes('Karibu St. Mary')`, 'homepage after refresh');
  step('refresh on the parish URL works');
  await go('/no-such-parish-here');
  await waitFor(`document.body.innerText.includes('Parish not found')`, 'not found page');
  step('unknown address shows "Parish not found"');

  console.log('E2E: member joins through the parish website');
  await js(`Auth.logout()`); await sleep(300);
  await go('/st-marys-parish-thika');
  await waitFor(`!!document.querySelector('a[href*="/register?parish=st-marys-parish-thika"]')`, 'join link');
  await go('/register?parish=st-marys-parish-thika');
  await waitFor(`(document.getElementById('chosen')||{}).textContent && document.getElementById('chosen').textContent.includes("St. Mary's Parish, Thika")`, 'parish pre-selected');
  step('"Join the parish" pre-selects the correct parish from its web address');

  await patch('parishes/st-marys-parish-thika', { status: 'suspended' });
  await patch('churchDirectory/st-marys-parish-thika', { status: 'suspended' });
  await go('/st-marys-parish-thika');
  await waitFor(`document.body.innerText.includes('unavailable')`, 'suspended page');
  step('suspended parish: website goes offline');

  console.log('E2E: platform Super Admin');
  const su = await (await fetch('http://127.0.0.1:9199/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'super@parishyetu.test', password: 'Passw0rd!long', returnSecureToken: true }) })).json();
  await put('users/' + su.localId, { name: 'Platform Admin', email: 'super@parishyetu.test', role: 'super', status: 'active', parishId: '', title: 'Super Admin' });
  await go('/login' + EMU);
  await waitFor(`!!document.getElementById('em')`, 'login form');
  await js(`document.getElementById('em').value='super@parishyetu.test';document.getElementById('pw').value='Passw0rd!long';document.getElementById('go').click();true`);
  await waitFor(`location.pathname.endsWith('/super-admin')`, 'redirect to super admin');
  await waitFor(`document.body.innerText.includes('Pending registrations')`, 'super admin overview');
  step('super admin signs in through the login page and lands on Platform Administration');
  await go('/super-admin#Churches');
  await waitFor(`[...document.querySelectorAll('table.t tbody tr')].some(r=>r.innerText.includes("St. Mary's Parish, Thika"))`, 'churches table');
  assert.ok(await js(`document.body.innerText.includes('Suspended')`));
  await js(`[...document.querySelectorAll('table.t tbody tr')].find(r=>r.innerText.includes("St. Mary's Parish, Thika")).click();true`);
  await waitFor(`[...document.querySelectorAll('#dact button')].some(b=>b.textContent==='Restore parish')`, 'drawer actions');
  await js(`[...document.querySelectorAll('#dact button')].find(b=>b.textContent==='Restore parish').click();true`);
  await waitFor(`!!document.querySelector('.modal .mf .btn.p')`, 'restore confirm');
  await click('.modal .mf .btn.p');
  for (let i = 0; i < 40; i++) { if ((await get('parishes/st-marys-parish-thika')).status === 'active') break; await sleep(250); }
  assert.equal((await get('parishes/st-marys-parish-thika')).status, 'active');
  assert.equal((await get('churchDirectory/st-marys-parish-thika')).status, 'active', 'verified parish returns to the public directory');
  step('super admin restores the parish from the Churches table (parish + directory updated)');
  await go('/super-admin#Dioceses');
  await waitFor(`document.body.innerText.includes('Archdiocese of Nairobi') && document.body.innerText.includes("Diocese of Murang'a")`, 'dioceses tab');
  await go('/super-admin#Platform%20Audit');
  await waitFor(`document.body.innerText.includes('parish.restore')`, 'audit entry');
  step('dioceses listed; the restore is recorded in the platform audit');
  assert.deepEqual(pageErrors, [], 'uncaught page errors: ' + pageErrors.join(' | '));
  step('no uncaught JavaScript errors on any page visited');
  console.log('\nE2E PASSED');
} catch (e) {
  console.error('\nE2E FAILED:', e.message);
  process.exitCode = 1;
} finally {
  try { ws && ws.close(); } catch (e) {}
  br.kill(); srv.close();
}
