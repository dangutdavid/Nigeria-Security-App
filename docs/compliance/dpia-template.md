# Data protection impact assessment (outline)

Required before go-live (NDPA s.28, GDPR Art. 35). The processing involves law
enforcement, location tracking and possibly vulnerable people.

1. **Description.** Data flows: the citizen app goes to the API (TLS), then to
   Postgres (with RLS) and object storage, and on to agency staff. Also cover
   processors and transfers. Diagrams are in `docs/ARCHITECTURE.md`.
2. **Necessity and proportionality.** Why each data item is needed. Citizens
   can report without a name or phone number. Location is optional. The
   anonymised statistics stay after retention ends.
3. **Risks to people.** Examples: a misdirected report exposes a reporter, an
   abusive officer looks up records, a breach of incident photos, a phone left
   signed in, an over-long retention period.
4. **Mitigations.** Point to the controls in `README.md` §2: RLS and per-agency
   scope, two-step verification and lockout, auto-logoff, encryption, the
   immutable audit trail, retention, and the data-subject rights flows.
5. **Residual risk and sign-off.** DPO opinion, and the decision to consult the
   NDPC if high residual risk remains.
6. **Review date.**
