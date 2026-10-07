# Deploying on Liquid Web (HIPAA-eligible hosting with a BAA)

This kit runs the API on a single Liquid Web dedicated server or VPS, using
Docker Compose with Caddy (TLS), Postgres 16 and Redis. It was smoke-tested end
to end with the real compose file. The API ran as the restricted `nsa_app`
role, TLS terminated at Caddy, and the production demo-login block, citizen
submission and retention job all worked.

## 0. Before anything touches real data

These steps need **you** (the operator). No code can do them:

- [ ] **Data residency decision.** Nigeria's Data Protection Act 2023 (NDPA)
      restricts transfers of personal data outside Nigeria. Liquid Web's data
      centres are in the US and EU, so hosting there is a cross-border
      transfer. Get legal sign-off on the transfer mechanism before launch
      (adequacy, standard contractual clauses or binding corporate rules, or
      consent where lawful), or host in Nigeria instead. See
      `docs/compliance/README.md`.
- [ ] **Business Associate Agreement.** Order a Liquid Web HIPAA-compliant
      plan and sign their BAA before any health information is stored.
      HIPAA may not legally apply, but the BAA is still a strong contractual
      control, and some casualty data is health information.
- [ ] **Data processing agreement (DPA)** with every processor: Liquid Web,
      Sentry, Better Stack, the SMS provider (Termii or Twilio) and object
      storage. Record them in the processor register.
- [ ] **Data protection officer** appointed, and the controller name filled
      in on the mobile privacy notice (`EXPO_PUBLIC_DATA_CONTROLLER`,
      `EXPO_PUBLIC_DPO_CONTACT`).
- [ ] **Retention periods** confirmed with each agency's records schedule.
      The `*_RETENTION_DAYS` values in `secrets/api.env` are defaults, not
      legal advice.

## 1. Provision

Use Ubuntu 24.04 LTS, at least 4 vCPU, 8 GB RAM, and a separate data disk for
the encrypted volume. Turn on Liquid Web's firewall and backups in addition to
the off-site backups below. Point DNS (for example `api.example.gov.ng`) at the
server.

## 2. Harden the host

```sh
scp deploy/liquidweb/harden-host.sh deploy@server:/tmp/
ssh root@server 'bash /tmp/harden-host.sh deploy /root/deploy.pub'
```

The script sets up:

- Key-only SSH with no root login.
- A firewall that allows only 22, 80 and 443, plus fail2ban.
- Automatic security updates.
- auditd rules for identity, privilege and secrets access.
- Kernel network hardening and Docker defaults.

Confirm a fresh SSH login works before closing the root session.

## 3. Encrypt the data volume (encryption at rest)

```sh
sudo cryptsetup luksFormat /dev/sdb          # data disk; store the passphrase in your vault
sudo cryptsetup open /dev/sdb nsa_data
sudo mkfs.ext4 /dev/mapper/nsa_data
sudo mkdir -p /srv/nsa/encrypted && sudo mount /dev/mapper/nsa_data /srv/nsa/encrypted
sudo mkdir -p /srv/nsa/encrypted/postgres
```

Postgres data lives only on this volume. Sensitive fields such as
authenticator secrets and phone numbers get a second layer of AES-256-GCM
encryption in the app (`DATA_ENCRYPTION_KEY`).

## 4. Configure

```sh
sudo mkdir -p /srv/nsa && sudo chown deploy /srv/nsa
git clone <repo> /srv/nsa/src
cp -R /srv/nsa/src/deploy/liquidweb /srv/nsa/deploy && cd /srv/nsa/deploy
cp .env.example .env                                   # API_DOMAIN, ACME_EMAIL
mkdir -m 700 secrets && cp secrets.example/* secrets/ && chmod 600 secrets/*
# Replace every CHANGE_ME with fresh random values:
#   openssl rand -base64 48   (AUTH_SECRET)
#   openssl rand -base64 32   (DATA_ENCRYPTION_KEY, exactly 32 bytes)
#   openssl rand -hex 24      (database, Redis and metrics passwords)
```

Secrets never go in git (`deploy/liquidweb/secrets/` is gitignored). Keep a
copy in your password vault.

## 5. Build and start

```sh
cd /srv/nsa/src
docker build -f artifacts/api-server/Dockerfile --target runtime -t nsa-api:latest .
docker build -f artifacts/api-server/Dockerfile --target migrate -t nsa-migrate:latest .
cd /srv/nsa/deploy
docker compose up -d postgres redis
docker compose --profile jobs run --rm migrate                    # as OWNER
docker compose exec postgres psql -U nsa_owner -d nsa \
  -c "ALTER ROLE nsa_app LOGIN PASSWORD '<value from secrets/api.env>'"
docker compose up -d api caddy
```

The API refuses to start in production if any of these are wrong:

- It connects as a role that bypasses row-level security.
- `AUTH_SECRET` is missing.
- `DATA_ENCRYPTION_KEY` is missing.

## 6. Schedule backups and retention

```sh
sudo cp systemd/* /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now nsa-backup.timer nsa-retention.timer
```

Backups are `pg_dump` files encrypted with `age` to a recovery **public** key
and shipped off-site every night, keeping 35 days. The private key stays
**offline**. Test a restore every quarter with `restore-test.sh` on a separate
machine, and log the result (`docs/RUNBOOK.md`).

## 7. Monitoring

- Better Stack: run `scripts/betterstack/provision.sh` and set the three
  `BETTER_STACK_*` variables (see `docs/observability/better-stack.md`).
- Sentry: set `SENTRY_DSN` and `SENTRY_RELEASE`.
- Prometheus: scrape `api:8082/api/metrics` from inside the Docker network
  with `METRICS_TOKEN`. Caddy blocks it publicly.

## 8. Go-live checks

```sh
curl -s https://$API_DOMAIN/api/healthz                       # {"status":"ok","db":"postgres"}
curl -sI https://$API_DOMAIN/api/healthz | grep -i strict      # HSTS present
curl -s -o /dev/null -w '%{http_code}\n' https://$API_DOMAIN/api/metrics   # 404
docker compose logs api | grep "enforces row-level security"
```

Then commission the external penetration test against this environment
before real users arrive.

## Upgrades

```sh
cd /srv/nsa/src && git pull
docker build … (as in step 5)
cd /srv/nsa/deploy
docker compose --profile jobs run --rm migrate
docker compose up -d api
```

Migrations are forward-only. The nightly encrypted backup is the rollback
path, so take a manual `./backup.sh` before every migration.
