# Record of processing activities (template)

Complete one row per processing activity, and review it every year.

| Field | Citizen incident reports | Agency staff accounts | Audit and security logs |
| --- | --- | --- | --- |
| Controller / joint controllers | [operating agency / ministry] | same | same |
| DPO contact | [ ] | [ ] | [ ] |
| Purpose | Receive, route and respond to public-safety reports, plus anonymous statistics | Authenticate and authorise staff | Security, accountability, incident investigation |
| Lawful basis (NDPA s.25) | Public interest / legal obligation of the agency [confirm] | Contract / legal obligation | Legitimate interest / legal obligation |
| Data subjects | Members of the public, people mentioned in reports, vehicle owners | Officers, supervisors, commanders, admins | Staff and citizens (pseudonymous ids) |
| Data categories | Description, location (GPS), photos, vehicle plate, device submission key | Name, badge, agency, role, PIN hash, optional phone (encrypted), authenticator seed (encrypted) | Event type, actor id, agency, timestamps, report references |
| Sensitive data | Possibly injury or health details, criminal-offence data | — | — |
| Recipients | Responsible agency; admins | Admins | Admins, DPO |
| Processors | Liquid Web (hosting), object storage, Sentry, Better Stack | + SMS provider (Termii/Twilio) | Better Stack, Sentry |
| International transfers | [US/EU via Liquid Web — mechanism: ] | same | same |
| Retention | Anonymised 7 years after closure [confirm] | Account life + [ ] | 6 years |
| Security measures | See `docs/compliance/README.md` §2 | same | same |
