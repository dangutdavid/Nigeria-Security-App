# Compliance: what applies, what the system does, what is still yours

> This document maps technical controls to legal requirements. It is **not
> legal advice**. Compliance also needs policies, contracts, training and
> sign-off by qualified counsel and a data protection officer (DPO). Those
> organisational items are listed at the end and are not done by code.

## 1. Which laws apply

| Framework | Applies? | Why |
| --- | --- | --- |
| **Nigeria Data Protection Act 2023 (NDPA)** and GAID 2025 | **Yes, primary** | Nigerian controller processing data of people in Nigeria. Enforced by the Nigeria Data Protection Commission (NDPC). |
| **GDPR** (EU) | Only partly, by design choice | Applies only if the controller is established in the EU or targets people in the EU. Its controls are adopted anyway because NDPA closely mirrors them. |
| **PIPEDA** (Canada) | Very unlikely | Covers private-sector *commercial* activity in Canada. A Nigerian public-safety service is not that. |
| **HIPAA** (US) | Very unlikely | Covers US healthcare providers, health plans and clearing houses, and their business associates. Agencies here are not covered entities. The HIPAA Security Rule's technical safeguards are still a strong benchmark, and some casualty and injury data is health-related, so the safeguards are implemented and a BAA is signed with the host. |

**Cross-border transfer.** Hosting on Liquid Web in the US or EU moves
Nigerians' personal data abroad. Under NDPA Part VIII that needs a lawful
mechanism: adequacy, appropriate safeguards such as standard contractual
clauses or binding corporate rules, or a specific derogation. Decide this
before go-live, or host inside Nigeria.

## 2. Control map

| Requirement | NDPA | GDPR | HIPAA | PIPEDA | Implementation | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| Access control, least privilege | s.39 | Art. 32 | §164.312(a)(1) | 4.7 | Capability matrix, agency scoping, Postgres row-level security on every table | `docs/security/PERMISSIONS.md`, `docs/security/ROW_LEVEL_SECURITY.md`, `tests/permissions.test.ts`, `tests/rls-isolation.test.ts` |
| Tenant/data isolation at DB level | s.39 | Art. 25, 32 | §164.312(a)(1) | 4.7 | FORCE RLS, restricted `nsa_app` role, refuses to start as a bypass role | migration `0004`, `src/lib/dbSafety.ts` |
| Unique user identification | s.39 | Art. 32 | §164.312(a)(2)(i) | 4.7 | Badge accounts, server-signed sessions with token id | `src/lib/auth.ts` |
| Strong authentication | s.39 | Art. 32 | §164.312(d) | 4.7 | PIN, then two-step verification (authenticator app, SMS or recovery codes), enforced per role in production | `src/lib/mfa.ts`, `tests/mfa.test.ts`, `tests/totp.test.ts` |
| Brute-force protection | s.39 | Art. 32 | §164.308(a)(5) | 4.7 | Per-IP rate limits and per-account lockout | `tests/account-lockout.test.ts`, `tests/rate-limit.test.ts` |
| Automatic logoff | s.39 | Art. 32 | §164.312(a)(2)(iii) | 4.7 | Session lifetime (`SESSION_TTL_HOURS`), background sign-out on mobile | `context/AuthContext.tsx` |
| Encryption in transit | s.39 | Art. 32 | §164.312(e)(1) | 4.7 | TLS at Caddy with HSTS, optional Postgres TLS (`DATABASE_SSL`) | `deploy/liquidweb/Caddyfile` |
| Encryption at rest | s.39 | Art. 32 | §164.312(a)(2)(iv) | 4.7 | LUKS data volume, AES-256-GCM field encryption, `age`-encrypted backups | `src/lib/fieldCrypto.ts`, `deploy/liquidweb/README.md` |
| Audit controls, integrity | s.39 | Art. 30, 32 | §164.312(b), (c)(1) | 4.1.4 | Append-only audit trail with immutability trigger, host auditd | migration `0004`, `harden-host.sh` |
| Monitoring and alerting | s.39 | Art. 32 | §164.308(a)(1)(ii)(D) | 4.7 | Sentry, Better Stack logs and uptime, Prometheus alert rules | `docs/observability/` |
| Data minimisation in logs | s.24 | Art. 5(1)(c) | min. necessary | 4.4 | PII and secret redaction before any log line leaves the process | `src/lib/logger.ts`, `tests/logging.test.ts` |
| Transparency | s.27 | Art. 13 | — | 4.8 | Privacy notice at the point of collection | `app/privacy.tsx` |
| Right of access and portability | s.34 | Art. 15, 20 | — | 4.9 | Citizen export (reference plus device key), staff self-export | `src/routes/privacy.ts`, `tests/privacy.test.ts` |
| Right to erasure | s.34 | Art. 17 | — | 4.5 | Request routed to the DPO, admin erasure deletes evidence and anonymises | same |
| Storage limitation | s.24(1)(d) | Art. 5(1)(e) | §164.316(b)(2) (6-yr docs) | 4.5 | Daily retention job | `src/jobs/retention.ts`, `nsa-retention.timer` |
| Backup and recovery | s.39 | Art. 32(1)(c) | §164.308(a)(7) | 4.7 | Nightly encrypted off-site backups, quarterly restore drill | `deploy/liquidweb/backup.sh`, `restore-test.sh` |
| Secure configuration | s.39 | Art. 32 | §164.308(a)(1) | 4.7 | Host hardening, container hardening, secrets outside git, gitleaks, dependency audit in CI | `harden-host.sh`, `.github/workflows/ci.yml` |
| Breach notification | s.40 (72 h to NDPC) | Art. 33 (72 h), 34 | §164.404 (≤60 days) | breach of security safeguards (RROSH) | Detection through the monitoring above, plus the procedure in [breach-response.md](breach-response.md) | — |

## 3. What only the organisation can do

- [ ] Appoint a **DPO** and publish their contact details in the privacy notice.
- [ ] **Register with the NDPC** if the controller is a data controller of
      major importance, and file the annual compliance audit return through a
      licensed Data Protection Compliance Organisation.
- [ ] Complete the **DPIA**. This processing is high-risk: law enforcement,
      location data, and potentially vulnerable people. Use [dpia-template.md](dpia-template.md).
- [ ] Keep the **record of processing activities** and processor register
      ([ropa-template.md](ropa-template.md)).
- [ ] Sign **DPAs** with Liquid Web, Sentry, Better Stack, the SMS provider
      and object storage, and a **BAA** with Liquid Web.
- [ ] Decide the **cross-border transfer mechanism**, or host in Nigeria.
- [ ] Approve **retention periods** per agency records schedule.
- [ ] Write workforce policies: acceptable use, access reviews (quarterly,
      using `/api/admin/users`), joiner/mover/leaver, and security training.
- [ ] Commission an **external penetration test** before go-live, and yearly
      after that.
- [ ] Rehearse the breach procedure with a tabletop exercise each year.
