/* PARISH YETU - the single place where the Firebase SDK is initialised. Every page loads this once. */
(function () {
  var cfg = window.PARISHOS_FIREBASE_CONFIG || {};
  var placeholder = !cfg.apiKey || /YOUR_/.test(String(cfg.apiKey) + String(cfg.projectId));
  if (typeof firebase === 'undefined' || placeholder) {
    window.FB = { ok: false, reason: typeof firebase === 'undefined' ? 'sdk' : 'config', siteBase: 'https://parishyetu.church' };
    return;
  }
  var app = firebase.apps.length ? firebase.app() : firebase.initializeApp(cfg);
  var google = null;
  try {
    if (firebase.auth && firebase.auth.GoogleAuthProvider) {
      google = new firebase.auth.GoogleAuthProvider();
      google.setCustomParameters({ prompt: 'select_account' });
    }
  } catch (e) { /* Auth not loaded yet — the pages will fall back gracefully */ }

  /* Local testing only: http://localhost:5000/...?emulators (remembered for the tab) uses the Firebase emulators. */
  var local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  /* Optional ports: ?emulators=FIRESTORE,AUTH,WORKER (defaults 8080,9099,8787). */
  var emu = false, ports = [8080, 9099, 8787];
  try {
    var m = location.search.match(/[?&]emulators(?:=([\d,]+))?/);
    if (local && m) sessionStorage.setItem('parishyetu.emulators', m[1] || '1');
    var saved = local ? sessionStorage.getItem('parishyetu.emulators') : null;
    emu = !!saved;
    if (saved && saved !== '1') saved.split(',').forEach(function (p, i) { if (+p) ports[i] = +p; });
  } catch (e) {}

  var auth = firebase.auth(), db = firebase.firestore();
  if (emu) {
    auth.useEmulator('http://127.0.0.1:' + ports[1], { disableWarnings: true });
    db.useEmulator('127.0.0.1', ports[0]);
  }

  window.FB = {
    ok: true,
    app: app,
    auth: auth,
    db: db,
    storage: null,
    emulators: emu,
    /* Cloudflare Worker: R2 files + trusted PARISH YETU API (parish provisioning). */
    r2Worker: emu ? 'http://127.0.0.1:' + ports[2] : 'https://parish-os-r2.manchamdevelopers.workers.dev',
    api: emu ? 'http://127.0.0.1:' + ports[2] : 'https://parish-os-r2.manchamdevelopers.workers.dev',
    /* Canonical public address of every parish website: https://parishyetu.church/{slug} */
    siteBase: 'https://parishyetu.church',
    google: google
  };
})();
