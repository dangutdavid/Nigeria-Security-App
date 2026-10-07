# Personal-data breach response

A breach is any security incident leading to accidental or unlawful
destruction, loss, alteration, unauthorised disclosure of, or access to,
personal data. Suspected breaches count until ruled out.

## Clock

| Who | Deadline | Basis |
| --- | --- | --- |
| Nigeria Data Protection Commission (NDPC) | **72 hours** from awareness | NDPA s.40 |
| Affected people | Without undue delay, when the breach is likely to cause high risk | NDPA s.40 |
| EU supervisory authority, if GDPR applies | 72 hours | GDPR Art. 33 |
| HHS / individuals, if HIPAA applies | Up to 60 days | 45 CFR §164.404–408 |
| Processors to the controller | Without undue delay (written into each DPA) | NDPA s.29, GDPR Art. 33(2) |

## Steps

1. **Detect and declare** (anyone). Sources are Better Stack alerts, Sentry,
   audit events such as `Account locked`, `Two-factor failed` and unusual
   `Data export` volume, auditd, and user reports. Open an incident, note the
   time of awareness, and page the incident lead and the DPO.
2. **Contain.** The options, depending on cause:
   - Revoke sessions by rotating `AUTH_SECRET` without
     `AUTH_SECRET_PREVIOUS`. That forces everyone to sign in again.
   - Disable accounts with `PATCH /api/admin/users/:id` (`isActive: false`).
   - Reset a user's two-step verification.
   - Block IPs at ufw or Caddy.
   - Rotate database, Redis, metrics and S3 credentials.
   - Rotate `DATA_ENCRYPTION_KEY`, keeping the old value as `_PREVIOUS`.
3. **Preserve evidence.** Export audit events (`/api/audit-logs/export`), the
   Better Stack log range, Caddy logs and `ausearch -k nsa-secrets`. Snapshot
   the server. The audit tables are immutable, so they are reliable evidence.
4. **Assess.** Work out what data, how many people, which agencies, and whether
   the data was encrypted (field-level or volume). Decide on notification
   using the table above. The DPO decides and records the reasoning.
5. **Notify** the NDPC, and people where required, through the DPO, using the
   statutory content: nature, categories and approximate numbers, likely
   consequences, measures taken, and a contact point.
6. **Recover.** Restore from encrypted backups if needed (`restore-test.sh`)
   and verify integrity.
7. **Review.** Hold a post-incident review within 10 working days. Record
   actions in the breach register, which must be kept even for breaches that
   are not notified.
