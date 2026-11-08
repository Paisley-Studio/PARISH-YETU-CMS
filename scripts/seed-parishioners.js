#!/usr/bin/env node
/* PARISH YETU - seed 10 test parishioners into a real parish.
 *
 *   node scripts/seed-parishioners.js --parish christ-the-king-cathedral-nakuru
 *
 * Optional:
 *   --parish <id>    which parish to write into (default: christ-the-king-cathedral-nakuru)
 *   --count <n>      how many to create (default: 10)
 *   --wipe           delete existing seeded records first (only those starting with test-)
 */
const admin = require('firebase-admin');
admin.initializeApp();
const db = admin.firestore(), TS = admin.firestore.FieldValue.serverTimestamp;

const args = process.argv.slice(3);
const opt = k => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : undefined; };
const flag = k => args.includes('--' + k);

const PARISH = opt('parish') || 'christ-the-king-cathedral-nakuru';
const COUNT  = Math.max(1, Math.min(50, parseInt(opt('count') || '10', 10)));
const WIPE   = flag('wipe');

const FIRST_F = ['Mary','Grace','Ann','Rose','Lucy','Esther','Catherine','Jane','Mercy','Faith'];
const FIRST_M = ['John','Peter','Joseph','Paul','Michael','David','James','Daniel','Samuel','Thomas'];
const LAST    = ['Kamau','Otieno','Wanjiru','Mwangi','Njoroge','Achieng','Ochieng','Kariuki','Njeri','Hassan'];
const OCC     = ['Teacher','Farmer','Trader','Nurse','Driver','Carpenter','Engineer','Accountant','Student','Tailor'];

const pad = (n, w) => String(n).padStart(w, '0');
const rnd = a => a[Math.floor(Math.random() * a.length)];
const iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1, 2) + '-' + pad(d.getDate(), 2);

(async () => {
  // 1. Confirm parish exists
  const parishRef = db.doc('parishes/' + PARISH);
  const psnap = await parishRef.get();
  if (!psnap.exists) {
    console.error('Parish not found:', PARISH);
    console.error('Run: node scripts/admin.js list-churches');
    process.exit(1);
  }
  const parish = psnap.data();
  console.log('Seeding into:', parish.name, '(' + PARISH + ')');

  // 2. Optionally wipe previous test data
  if (WIPE) {
    const existing = await parishRef.collection('parishioners').get();
    const victims = existing.docs.filter(d => String(d.id).startsWith('test-'));
    if (victims.length) {
      const b = db.batch();
      victims.forEach(d => b.delete(d.ref));
      await b.commit();
      console.log('Wiped', victims.length, 'previous test records');
    }
  }

  // 3. Create N parishioners
  const created = [];
  const today = iso(new Date());
  const short = String(parish.short || parish.name.split(/\s+/).map(w => w[0]).join('')).toUpperCase().slice(0, 4);

  for (let i = 0; i < COUNT; i++) {
    const isF = Math.random() < 0.5;
    const first = isF ? rnd(FIRST_F) : rnd(FIRST_M);
    const last  = rnd(LAST);
    const name  = first + ' ' + last;
    const gender = isF ? 'F' : 'M';
    const id = 'test-' + Date.now().toString(36) + '-' + pad(i + 1, 3);
    const memberNo = short + '-' + pad(1000 + i + Math.floor(Math.random() * 900), 4);
    const phone = '+2547' + pad(Math.floor(Math.random() * 100000000), 8);
    const dob = '19' + (50 + Math.floor(Math.random() * 40)) + '-' +
                pad(1 + Math.floor(Math.random() * 12), 2) + '-' +
                pad(1 + Math.floor(Math.random() * 28), 2);

    const doc = {
      id,
      memberNo,
      name,
      gender,
      dob,
      phone,
      email: first.toLowerCase() + '.' + last.toLowerCase() + i + '@example.org',
      occupation: rnd(OCC),
      familyId: '',
      sccId: '',
      outstation: (parish.outstations && parish.outstations[0]) || 'Main Church',
      role: 'Member',
      status: 'Active',
      ministries: [],
      lastActivity: today,
      registeredOn: today,
      source: 'seed-script',
      history: [{ date: today, action: 'Registered', by: 'seed-script' }],
      _c: Date.now() + i,
      createdAt: TS(),
    };

    await parishRef.collection('parishioners').doc(id).set(doc);
    created.push({ id, name, memberNo, gender });
  }

  console.log('\nCreated', created.length, 'parishioners:');
  created.forEach((p, i) => {
    console.log(' ', pad(i + 1, 2), p.memberNo, '—', p.name, '(' + p.gender + ')');
  });
  console.log('\nOpen /parishioners to see them.');
  console.log('To remove later: re-run with --wipe');
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });