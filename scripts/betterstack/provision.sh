#!/usr/bin/env bash
# Provision Better Stack Uptime monitoring for the API (idempotent-ish: run once
# per environment; re-running creates duplicates, so check the dashboard first).
#
#   BETTER_STACK_API_TOKEN   Uptime → API tokens (team token)
#   API_PUBLIC_URL           e.g. https://api.securityapp.gov.ng
#   ENV_NAME                 e.g. production / staging (used in monitor names)
#
# Creates:
#   1. Keyword monitor on $API_PUBLIC_URL/api/healthz expecting "status":"ok"
#      from several regions every 30s (catches outages, TLS/DNS failures, and a
#      degraded app that still answers HTTP).
#   2. Heartbeat (60s period, 120s grace): the API pings it every minute
#      (BETTER_STACK_HEARTBEAT_URL) — alerts if the process hangs or dies even
#      when the load balancer still answers.
set -euo pipefail
: "${BETTER_STACK_API_TOKEN:?set BETTER_STACK_API_TOKEN}"
: "${API_PUBLIC_URL:?set API_PUBLIC_URL}"
ENV_NAME=${ENV_NAME:-production}
API="https://uptime.betterstack.com/api/v2"
auth=(-H "Authorization: Bearer ${BETTER_STACK_API_TOKEN}" -H "Content-Type: application/json")

echo "Creating healthz monitor…"
curl -fsS "${auth[@]}" -X POST "$API/monitors" -d @- <<JSON | python3 -c 'import sys,json; d=json.load(sys.stdin)["data"]; print("  monitor id:", d["id"])'
{
  "monitor_type": "keyword",
  "url": "${API_PUBLIC_URL%/}/api/healthz",
  "required_keyword": "\"status\":\"ok\"",
  "pronounceable_name": "NSA API ${ENV_NAME} health",
  "check_frequency": 30,
  "request_timeout": 15,
  "confirmation_period": 60,
  "recovery_period": 180,
  "verify_ssl": true,
  "ssl_expiration": 14,
  "regions": ["eu", "us", "as", "au"],
  "email": true,
  "push": true,
  "call": false,
  "sms": false
}
JSON

echo "Creating heartbeat…"
curl -fsS "${auth[@]}" -X POST "$API/heartbeats" -d @- <<JSON | python3 -c 'import sys,json; d=json.load(sys.stdin)["data"]; print("  set BETTER_STACK_HEARTBEAT_URL=" + d["attributes"]["url"])'
{
  "name": "NSA API ${ENV_NAME} process heartbeat",
  "period": 60,
  "grace": 120,
  "email": true,
  "push": true
}
JSON

echo "Done. Configure on-call schedules / escalation policies in the Better Stack dashboard."
