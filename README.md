# PARISH YETU

A hosted, multi-tenant Catholic parish management platform. One centrally hosted application serves many independent
parishes; each parish has its own administration environment, records, members, branding and public website at
**https://parishyetu.church/{parish-slug}**. Plain HTML, CSS and JavaScript (no build step).

| Responsibility | Technology |
|---|---|
| Backend APIs and trusted operations (parish provisioning) | Cloudflare Worker (`r2-worker/`) |
| Authentication | Firebase Authentication |
| Database | Cloud Firestore (tenant boundary: `parishes/{parishId}`) |
| Documents and branding images | Cloudflare R2 through the same Worker |
| Static hosting | Firebase Hosting |
| Local administration | `scripts/admin.js` (Node, Admin SDK) |

## Multi-parish hosting

* **Church self-registration** (`/register-parish`) – a five-step wizard: parish identity, hierarchy (diocese and
  deanery from the central directory, or a *proposed* diocese that waits for verification), initial administrator,
  optional branding, review. The browser creates the administrator's Firebase Auth account; the Worker endpoint
  `POST /api/register-parish` then validates everything, checks for duplicates, reserves a permanent parish id and a unique
  slug, creates the parish, directory entry, default settings and website documents, and assigns the **admin** role
  (never `super`). Progress is tracked in `registrations/{uid}`; submitting again resumes safely.
* **Verification** – a self-registered parish can start working immediately, but stays `verificationStatus: pending`
  (hidden from the public directory, no member sign-ups, website not public) until the platform administrator approves it
  in *Platform Administration → Registrations*.
* **Parish websites** – `/parish-home` renders every parish at `/{slug}` (Hosting rewrite `/*`; real files and clean URLs
  always win). Content comes only from `parishes/{id}/public/site` once published; staff edit a draft in **Parish Website**
  (`/website`), preview it and publish. Slugs never change when a name changes; a changed slug keeps redirecting.
* **Website link everywhere** – every parish dashboard (staff and member portal) shows the parish's own website card, and
  the app header has a *Parish website* shortcut (open, copy, share). The link always comes from the user's own parish record.
* **Platform Administration** (`/super-admin`) – registrations, approve/reject/suspend/restore, dioceses
  (create, edit, activate/deactivate, deaneries), diocese proposals, deanery affiliation requests, reassignment, web-address
  changes, diocesan administrators, and an append-only platform audit.

## What it does

* **Public homepage** (`/home`) – a welcoming entry point: find your church, create a member account, sign in.
* **Self-registration** (`/register`) – a person searches for their church, creates an account and becomes an
  **active member immediately**. No approval step. The parish administrator is notified and can later review, suspend or restore the member.
* **Member portal** (`/dashboard` as a parishioner) – sermons and Scripture, Mass schedule, events, announcements,
  Mass intentions, prayer and pastoral requests (private), own sacramental records, own profile.
* **Parish, diocese and platform tools** – the existing modules: parishioners, families, sacraments, Masses, pastoral care,
  SCCs, ministries, events, sermons, catechesis, finance, accounting, assets, projects, documents (Firebase Storage),
  communications, reports, governance, settings, diocesan overview.

## Roles

| Role | Scope | Notes |
|---|---|---|
| `super` | Platform | Platform Administration: verification, dioceses, deaneries, proposals. Provisioned only with `scripts/admin.js make-super`. |
| `diocese` | One diocese | Overview of its parishes, reviews parish reports. Read-only otherwise. Provisioned with `scripts/admin.js assign`. |
| `deanery` | One deanery | Same as diocese, limited to its deanery. |
| `priest`, `admin`, `secretary`, `finance`, `scc` | One church | Module access as listed in Settings → Permissions. `priest` and `admin` manage users, suspension and settings of their church. |
| `parishioner` | Self | Created by self-registration. Can only reach the member portal and their own records. |

Roles live in `users/{uid}` and can only be changed by the platform administrator, the parish priest/administrator
(within their church, never to `super`/`diocese`/`deanery`) or `scripts/admin.js`. A user cannot edit their own role, status or church.

## Setup (about 20 minutes)

1. **Create a Firebase project** at <https://console.firebase.google.com> (the free Spark plan is enough to start;
   Cloud Storage may require the Blaze plan in some regions).
2. **Authentication** → *Sign-in method* → enable **Email/Password**. Under *Settings → Authorized domains* add the domain you will host on
   (`localhost` is there by default). Optional: edit the password-reset email template.
3. **Firestore Database** → *Create database* → production mode → choose a region close to your parishes.
4. **Storage** (only needed for the Documents module) → *Get started*.
5. **Web configuration** → Project settings → *Your apps* → add a **Web app** → copy the `firebaseConfig` values into
   `js/firebase-config.js`. These are identifiers, not secrets. **You must supply:** `apiKey`, `authDomain`, `projectId`,
   `storageBucket`, `messagingSenderId`, `appId`. Also put your project id in `.firebaserc`.
6. **Apply rules and indexes**:
   ```
   npm install -g firebase-tools        # or use npx
   firebase login
   firebase deploy --only firestore:rules,firestore:indexes,storage
   ```
   Nothing else is needed for indexes: every query uses single-field indexes that Firestore creates automatically
   (`firestore.indexes.json` is intentionally empty).
7. **Provision the first platform administrator.** In Project settings → *Service accounts* generate a private key, save it
   **outside this folder**, then:
   ```
   npm install
   export GOOGLE_APPLICATION_CREDENTIALS=/secure/path/serviceAccountKey.json
   node scripts/admin.js make-super --email you@example.org --name "Your Name" --password "a long initial password"
   ```
   There are no default accounts and no public way to become an administrator. Sign in and change the password.
8. **Configure and deploy the Cloudflare Worker** (backend API + R2) – see *Cloudflare Worker* below.
9. **Create the first diocese and church** (parishes can also register themselves at `/register-parish`) – either sign in as the platform administrator and use *Settings → Churches*, or:
   ```
   node scripts/admin.js add-diocese --name "Diocese of Example"
   node scripts/admin.js add-parish  --name "St Mary's Parish" --diocese diocese-of-example --town Nyeri --deanery "North"
   ```
   The church is searchable on the homepage immediately. Church details (priest, phone, outstations) are edited by the
   parish in *Settings → Parish Profile*. Nothing about a church is pre-filled or invented.
10. **Give the parish its staff.** Parishioners register themselves. Then either the platform administrator (switch church in the user menu →
   *Settings → Users → Change role*) or `node scripts/admin.js assign --email priest@example.org --role priest --parish <churchId>` makes
   the first priest/administrator. Diocese and deanery administrators are assigned with `scripts/admin.js assign`.
11. **Run locally**: any static server over http works (Firebase Auth does not work from `file://`):
    ```
    npx firebase-tools emulators:start --only hosting     # or: python3 -m http.server 8000
    ```
12. **Deploy**: `firebase deploy --only hosting,firestore,storage`. Hosting serves the folder as it is; `scripts/`, `docs/`, rules and this
    README are excluded by `firebase.json`.

## Cloudflare Worker (`r2-worker/`)

One Worker is the platform backend: `POST /api/register-parish` (provisioning), the existing R2 document endpoints, parish
branding uploads (`/presign-media`) and public branding images (`GET /media/parishes/{id}/public/...`).

* It verifies Firebase ID tokens itself, and authorises R2 access from the caller's **live** `/users` profile and parish
  status in Firestore (claims can be stale), so suspended accounts or parishes lose access immediately.
* For provisioning it uses a Google service account through OAuth (JWT signed with WebCrypto). Those requests bypass
  Firestore Security Rules, so `r2-worker/src/provision.js` performs every check explicitly.

Secrets (never commit them):
```
cd r2-worker
npx wrangler secret put FIREBASE_CLIENT_EMAIL     # service account email
npx wrangler secret put FIREBASE_PRIVATE_KEY      # its private_key (PEM)
npx wrangler secret put R2_ACCESS_KEY_ID          # already used by the document service
npx wrangler secret put R2_SECRET_ACCESS_KEY
npx wrangler deploy
```
Use a **dedicated** service account with only the *Cloud Datastore User* and *Firebase Authentication Admin* roles.
`ALLOWED_ORIGIN` in `wrangler.toml` lists the origins allowed to call the Worker. The R2 bucket's CORS policy must allow
`PUT` from the same origins for uploads.

## Testing

```
npm test           # Worker + Firestore rules + migration, against the Auth/Firestore emulators (ports 8180/9199)
npm run test:e2e   # real browser (headless Edge/Chrome) through the wizard, dashboards, website and Super Admin
```
Both use `firebase.test.json`, so they never interfere with other emulators you may be running.

## Migrating existing parishes

```
node scripts/admin.js migrate --dry-run   # shows the address each parish will get
node scripts/admin.js migrate             # writes it; safe to run repeatedly
```
Gives every existing parish a unique slug (its existing id when that is free), name keys for duplicate detection,
`verificationStatus: verified`, unpublished default website documents, and dioceses a `status` and `deaneries` list.
It never renames a parish, changes an existing slug, or touches nested records.

## How membership works

1. The person searches the public `churchDirectory` and selects a church (its document id is stored, never just its name).
2. The app checks the church exists and is active, creates the Firebase Auth account, then writes **in one atomic batch**:
   `users/{uid}` (role `parishioner`, status `active`), `parishes/{id}/parishioners/{uid}` (status `Active`, counted immediately)
   and `parishes/{id}/notifications/newmember_{uid}` (for the administrators, linking to the member).
3. If the account is created but the batch fails, the pending details are kept in the browser; the next sign-in or the *Finish joining* screen retries.
   The profile and notification ids are fixed, so retries and double-clicks never create duplicates.
4. **Suspension** (Parishioners → *Suspend member*, or Settings → Users) sets the account to `suspended` and the member record to `Suspended`
   in one batch. Security Rules require an active account for every read and write, so access stops immediately even if a session is open.
   The record, history and past contributions are kept; reports show active and suspended members separately. Restoring reverses it.
5. People who cannot find their church submit a request (`churchRequests`); it never becomes a church or gives anyone privileges.
   The platform administrator reviews requests in *Settings → Churches*.

## Project layout

```
/home … /register   pages (/settings also hosts the platform "Churches" tab)
/register-parish              church self-registration wizard
/parish-home                  public parish website shell for /{slug}
/website                   Parish Profile & Website editor (and member view of the link)
/super-admin               Platform Administration
js/slug.js                        slug / duplicate-key rules (copied to r2-worker/src/slug.js: npm run sync-slug)
r2-worker/                        Cloudflare Worker: backend API + R2
tests/                            emulator integration tests and browser end-to-end test
js/firebase-config.js             YOUR Firebase web configuration (edit this)
js/firebase-init.js               initialises the SDK once
js/core.js                        shared UI toolkit + Firebase data layer (DB, Auth, Boot) used by every page
firestore.rules  storage.rules    security rules
scripts/admin.js                  trusted provisioning tool (Admin SDK, run locally)
docs/SCHEMA.md                    data model and access matrix
```

Pages keep the `DB` / `Auth` interface they always had; `js/core.js` now loads the signed-in user's church from Firestore at start-up and writes
every change back (only the fields that changed). If a query fails the page shows an error screen. It never substitutes made-up records.

## Limits and honest notes

* The Security Rules, Worker and migration are tested against the Firebase emulators (`npm test`, `npm run test:e2e`), not yet
  against the live project.
* Custom claims are informational: Security Rules and the Worker both read the live `/users` profile. `scripts/admin.js` and
  provisioning still set claims; role changes made in the app do not update them.
* Anyone can create an account and submit a parish registration. It stays private until verified; consider Cloudflare
  Turnstile and rate limiting on `/api/register-parish` before a public launch.
* Each collection loads at most 300–2000 of the newest records (see `limit` in `js/core.js` → `ACCESS`). Tables paginate in the browser. Very large parishes
  should add server-side paging before exceeding those limits.
* The diocesan overview shows statistics that a parish priest/administrator's browser writes to the church document when they open the app.
  Figures can lag until a senior parish officer next signs in. The "health index" is the average of (SCCs that met in the last 45 days) and
  (past Masses with recorded attendance).
* **SMS and email** in Communications are recorded, not sent (they are marked *Not sent*). Announcements are published to members. No payment gateway exists:
  the member Giving tab shows gifts recorded by the finance office.
* Notification, SMS/email and appearance switches in Settings are stored preferences only. Two-factor sign-in is not implemented.
* Catechesis enrolments are personal records and are not shown in the member portal.
* Documents and parish branding images are stored in Cloudflare R2 through the Worker. `storage.rules` remain for Cloud Storage paths.
* Roles and permissions are fixed in code and rules (the Permissions tab is read-only). To change them, edit the role definitions (`ROLES0`) and the access map (`ACCESS`) in `js/core.js` **and** `firestore.rules` together.
* Records from the earlier browser-only version are **not** imported. A new church starts empty; administrators enter its real records.

## Verifying the rules

`npm test` covers: parish A cannot read or write parish B; no self-promotion to `super`; members cannot change `parishId`;
slugs, verification and directory status cannot be changed by parish staff; the public website is readable only when
published and verified; drafts are never public; suspended users and suspended parishes are denied in Firestore and in the Worker.
