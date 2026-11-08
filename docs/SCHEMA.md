# PARISH YETU data model

All names are fixed in code. Church scoping is by **document id** (`parishId`), never by name.

```
dioceses/{dioceseId}                 PUBLIC directory: name, kind('Diocese'|'Archdiocese'), archdiocese, country, location, bishop,
                                      website, status('active'|'inactive'), deaneries[{id,name,status}]      platform admin writes
dioceseProposals/{id}                proposed diocese from a registration: name, kind, country, bishop, deanery, notes, parishId,
                                      status('Pending Verification'|'Clarification Requested'|'Approved'|'Rejected')  Worker creates, platform admin reviews
churchDirectory/{parishId}           PUBLIC: name, short, town, county, country, address, phone, email, dioceseId, dioceseName, deanery,
                                      slug, motto, websitePublished, status('pending'|'active'|'suspended'|'rejected')
                                      anyone reads; platform admin writes; priest/admin may update name/town/address/phone/email/motto/websitePublished
slugs/{slug}                         PUBLIC: parishId, status('reserved'|'active'|'redirect'), redirectTo     Worker / platform admin only
registrations/{uid}                  self-service registration tracking: state('provisioning'|'active'|'failed'), parishId, slug,
                                      fingerprint, attempts, error                                            Worker only; owner + platform admin read
parishKeys/{fingerprint}             duplicate lock (normalised name + town + country) -> uid, parishId      Worker only
platformAudit/{id}                   append-only platform decisions (approve, suspend, reassign, slug change …)  platform admin
churchRequests/{id}                  name, town, diocese, contactName, contactEmail, notes, status   anyone creates, platform admin reads
users/{uid}                          name, email, phone, role, status('active'|'suspended'), parishId, dioceseId, deanery,
                                      organization, title, personId, sccId, createdAt
parishes/{parishId}                  name, short, dioceseId, diocese, archdiocese, deanery, deaneryId, town, county, country, address, phone,
                                      email, priest, patron, motto, outstations[], stats{…}, reportStatus, reportRef, reportComment,
                                      slug, previousSlugs[], websitePublished, parishType,
                                      status('active'|'suspended'|'rejected')          operational access for the whole parish
                                      verificationStatus('pending'|'verified'|'rejected'), registrationStatus('active'),
                                      pendingDeanery, dioceseProposalId, proposedDiocese, nameKey, townKey, registeredVia, createdBy
parishes/{parishId}/config/settings  theme, density, sessionMinutes, currency, language, notify*
parishes/{parishId}/public/draft     website draft (staff only)
parishes/{parishId}/public/site      published website: published, displayName, motto, welcome, about, patron, accent, logoUrl, bannerUrl,
                                      contact{…}, social{…}, priest{name,title,show}, massSchedule[], events[], announcements[],
                                      ministries[], outstations[], sermons[], sections{…}
                                      PUBLIC only when published == true AND churchDirectory status == 'active'
parishes/{parishId}/{collection}/{id}   see below
```

### Parish lifecycle
| Event | parishes.status | verificationStatus | churchDirectory.status | Effect |
|---|---|---|---|---|
| Self-registered | active | pending | pending | Staff work normally; hidden from directory; no member sign-ups; website not public |
| Approved | active | verified | active | Listed, members can join, published website is public |
| Rejected | rejected | rejected | rejected | All parish access denied |
| Suspended | suspended | (unchanged) | suspended | All parish access denied (Firestore and R2 Worker); website offline |
| Restored | active | (unchanged) | active / pending | Access returns |

Slugs are permanent: a name change never changes the slug. A platform-admin slug change writes `slugs/{old}.redirectTo`.

Every church sub-document has `id` (= document id), `_c` (creation time in ms, used for ordering), `createdAt`/`updatedAt` (server timestamps).

| Collection | Module | Who reads | Who writes |
|---|---|---|---|
| parishioners | People | priest, admin, secretary; scc (own SCC); member (own record + family) | priest, admin, secretary; scc (own SCC); member (own contact fields) |
| families | People | priest, admin, secretary; scc (own SCC); member (own family) | priest, admin, secretary; scc (own SCC) |
| sccs, sccReports | SCC | every active user of the church (sccs); staff with `scc` (reports) | priest/admin/secretary; scc leader (own SCC) |
| sacraments | Sacraments | priest, admin, secretary; member (own) | priest, admin, secretary |
| masses, events, sermons, liturgical | Liturgy | every active user of the church | module roles |
| intentions, registrations | Masses / Events | module roles; member (own) | module roles; member creates own |
| requests | Member requests | member (own); priest (all); admin/secretary (non-private only) | member creates own; priest (all), admin/secretary (non-private) update status |
| pastoralCases, visits | Pastoral | priest | priest |
| transactions, funds, budgets, expenses, banks, reconciliation, accounts, journals, payables, receivables, giving | Finance | roles with `finance`/`accounting`/`giving`; member (own giving) | same (transactions may be *created* by Mass/event staff, changed only by finance roles) |
| assets, projects, documents, ministries, volunteers, catechesis | Operations | module roles | module roles with `write` |
| messages, segments | Communication | comms roles; members read `channel == 'Announcement'` | comms roles with `write` |
| councils, meetings, decisions, actions, approvals, staff | Governance | governance roles; diocese/deanery (read) | governance roles |
| reports | Reporting | reports roles; diocese/deanery | reports roles; diocese/deanery change only status/comment |
| notifications | Alerts | by `audience`: `all` (all staff), `admins` (priest+admin), `priest` | staff create; mark read; member creates `member-request` notices |
| auditLogs | Audit | admin, super | any active user appends; never edited or deleted |

`super` may read and write everything. Deleting a registered member's record is refused for everyone but `super`; suspend instead.

## Indexes
None are required (single-field indexes are automatic). Queries that combine `where` with another field never use `orderBy`.

## Account status vs membership status
`users/{uid}.status` (`active`/`suspended`) controls access and is checked by every Security Rule.
`parishioners/{id}.status` (`Active`, `Pending`, `Inactive`, `Transferred`, `Deceased`, `Suspended`) is the church's membership record. Suspending changes both together.
