-- =============================================================================
-- Row-level security: tenant isolation enforced by Postgres, not just the API.
--
-- The API stamps every connection with the caller's identity
-- (app.role / app.agency / app.user_id — see lib/db/src/context.ts). The
-- policies below read those settings. A query that forgets its WHERE clause
-- returns only the caller's own rows instead of leaking another agency's data.
--
-- Roles:
--   * The migrating role owns the tables. FORCE ROW LEVEL SECURITY makes the
--     owner subject to the policies too (superusers still bypass RLS — the API
--     must never connect as a superuser; it refuses to in production).
--   * nsa_app is the runtime role (NOBYPASSRLS, not owner). Ops grants it
--     LOGIN + password per environment (docs/security/ROW_LEVEL_SECURITY.md).
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS app;

-- ---- Caller identity helpers -------------------------------------------------
CREATE OR REPLACE FUNCTION app.caller_role() RETURNS text LANGUAGE sql STABLE AS
$$ SELECT coalesce(nullif(current_setting('app.role', true), ''), 'anonymous') $$;

CREATE OR REPLACE FUNCTION app.caller_agency() RETURNS text LANGUAGE sql STABLE AS
$$ SELECT lower(nullif(current_setting('app.agency', true), '')) $$;

CREATE OR REPLACE FUNCTION app.caller_user_id() RETURNS text LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('app.user_id', true), '') $$;

-- Narrow single-row grants for unauthenticated citizen flows.
CREATE OR REPLACE FUNCTION app.lookup(kind text) RETURNS text LANGUAGE sql STABLE AS
$$ SELECT nullif(current_setting('app.lookup_' || kind, true), '') $$;

CREATE OR REPLACE FUNCTION app.is_system() RETURNS boolean LANGUAGE sql STABLE AS
$$ SELECT app.caller_role() = 'system' $$;

CREATE OR REPLACE FUNCTION app.is_admin() RETURNS boolean LANGUAGE sql STABLE AS
$$ SELECT app.caller_role() IN ('admin', 'super_admin', 'system') $$;

CREATE OR REPLACE FUNCTION app.is_staff() RETURNS boolean LANGUAGE sql STABLE AS
$$ SELECT app.caller_role() IN ('officer', 'supervisor', 'commander', 'admin', 'super_admin', 'system') $$;

-- Admins/system see every agency; staff see only their own.
CREATE OR REPLACE FUNCTION app.can_see_agency(agency text) RETURNS boolean LANGUAGE sql STABLE AS
$$ SELECT app.is_admin() OR (app.is_staff() AND lower(agency) = app.caller_agency()) $$;

-- ---- Runtime role --------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nsa_app') THEN
    CREATE ROLE nsa_app NOLOGIN NOBYPASSRLS;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public, app TO nsa_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO nsa_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO nsa_app;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO nsa_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO nsa_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO nsa_app;

-- ---- Enable + force RLS on every application table ---------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'agencies','agency_units','audit_events','audit_logs','auth_users','case_types','cases',
    'citizen_notifications','citizen_profiles','citizen_report_evidence','citizen_reports',
    'duty_sessions','evidence','push_tokens','referrals','revoked_tokens','tenants','users'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- ---- Agency registry: public read (login screen), admin write ---------------
CREATE POLICY agencies_read ON public.agencies FOR SELECT USING (true);
CREATE POLICY agencies_admin_write ON public.agencies FOR ALL USING (app.is_admin()) WITH CHECK (app.is_admin());

-- ---- Credentials: admins manage; a user may read only their own row ---------
-- Pre-session credential checks (login, OTP, PIN reset) run as 'system'.
CREATE POLICY auth_users_admin ON public.auth_users FOR ALL USING (app.is_admin()) WITH CHECK (app.is_admin());
CREATE POLICY auth_users_self_read ON public.auth_users FOR SELECT USING (id::text = app.caller_user_id());

-- ---- Citizen reports ------------------------------------------------------------
-- Staff: only reports routed to their agency. Anonymous citizens: only the one
-- report whose reference / offline clientId they presented.
CREATE POLICY citizen_reports_read ON public.citizen_reports FOR SELECT USING (
  app.can_see_agency(coalesce(assigned_agency, suggested_agency))
  OR upper(reference) = upper(app.lookup('reference'))
  OR client_id = app.lookup('client_id')
);
CREATE POLICY citizen_reports_submit ON public.citizen_reports FOR INSERT WITH CHECK (true);
-- Staff may work their own agency's reports but cannot move one out of their
-- agency (WITH CHECK) — reassignment is an admin action.
CREATE POLICY citizen_reports_update ON public.citizen_reports FOR UPDATE
  USING (app.can_see_agency(coalesce(assigned_agency, suggested_agency)))
  WITH CHECK (app.can_see_agency(coalesce(assigned_agency, suggested_agency)));
CREATE POLICY citizen_reports_admin_delete ON public.citizen_reports FOR DELETE USING (app.is_admin());

-- ---- Report evidence: visible iff the parent report is visible to the caller -
CREATE POLICY citizen_report_evidence_read ON public.citizen_report_evidence FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.citizen_reports r WHERE r.id = report_id)
  OR id::text = app.lookup('evidence_id')
);
CREATE POLICY citizen_report_evidence_write ON public.citizen_report_evidence FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.citizen_reports r WHERE r.id = report_id));
CREATE POLICY citizen_report_evidence_update ON public.citizen_report_evidence FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.citizen_reports r WHERE r.id = report_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.citizen_reports r WHERE r.id = report_id));
CREATE POLICY citizen_report_evidence_admin_delete ON public.citizen_report_evidence FOR DELETE USING (app.is_admin());

-- ---- Notifications ---------------------------------------------------------------
CREATE POLICY citizen_notifications_read ON public.citizen_notifications FOR SELECT USING (
  app.is_admin()
  OR (audience = 'agency' AND app.can_see_agency(agency))
  OR (user_id IS NOT NULL AND user_id = app.caller_user_id())
  OR (audience = 'citizen' AND upper(report_reference) = upper(app.lookup('reference')))
);
-- Notifications are server-generated fan-out (e.g. a citizen submission alerts
-- the agency); creation is allowed from any context, reading is not.
CREATE POLICY citizen_notifications_create ON public.citizen_notifications FOR INSERT WITH CHECK (true);
CREATE POLICY citizen_notifications_mark_read ON public.citizen_notifications FOR UPDATE USING (
  app.is_admin()
  OR (audience = 'agency' AND app.can_see_agency(agency))
  OR (user_id IS NOT NULL AND user_id = app.caller_user_id())
) WITH CHECK (true);
CREATE POLICY citizen_notifications_admin_delete ON public.citizen_notifications FOR DELETE USING (app.is_admin());

-- ---- Push tokens: a device registers its own; dispatch reads them as system --
CREATE POLICY push_tokens_own ON public.push_tokens FOR ALL
  USING (app.is_system() OR (user_id IS NOT NULL AND user_id = app.caller_user_id()))
  WITH CHECK (app.is_system() OR (user_id IS NOT NULL AND user_id = app.caller_user_id()));

-- ---- Audit trail: append-only from any context, readable by admins only -----
CREATE POLICY audit_events_append ON public.audit_events FOR INSERT WITH CHECK (true);
CREATE POLICY audit_events_admin_read ON public.audit_events FOR SELECT USING (app.is_admin());
CREATE POLICY audit_logs_append ON public.audit_logs FOR INSERT WITH CHECK (true);
CREATE POLICY audit_logs_read ON public.audit_logs FOR SELECT USING (
  app.is_admin()
  OR (app.is_staff() AND tenant_id IN (SELECT t.id FROM public.tenants t WHERE t.agency_type::text = app.caller_agency()))
);

-- Tamper-evidence: audit rows can never be modified, and only the 'system'
-- role (retention job) may delete — enforced even against the table owner.
CREATE OR REPLACE FUNCTION app.audit_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND app.is_system() THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'audit records are immutable (% on %)', TG_OP, TG_TABLE_NAME
    USING ERRCODE = 'insufficient_privilege';
END $$;
CREATE TRIGGER audit_events_immutable BEFORE UPDATE OR DELETE ON public.audit_events
  FOR EACH ROW EXECUTE FUNCTION app.audit_immutable();
CREATE TRIGGER audit_logs_immutable BEFORE UPDATE OR DELETE ON public.audit_logs
  FOR EACH ROW EXECUTE FUNCTION app.audit_immutable();

-- ---- Token revocation list: holds only token ids + expiry (no personal data).
-- Checked on every request before a session context exists.
CREATE POLICY revoked_tokens_read ON public.revoked_tokens FOR SELECT USING (true);
CREATE POLICY revoked_tokens_add ON public.revoked_tokens FOR INSERT WITH CHECK (true);
CREATE POLICY revoked_tokens_expire ON public.revoked_tokens FOR DELETE USING (expires_at < now());

-- ---- Operational model: tenant-scoped ------------------------------------------
CREATE POLICY tenants_scope ON public.tenants FOR ALL
  USING (app.is_admin() OR (app.is_staff() AND agency_type::text = app.caller_agency()))
  WITH CHECK (app.is_admin() OR (app.is_staff() AND agency_type::text = app.caller_agency()));

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['agency_units','case_types','cases','duty_sessions','users'] LOOP
    EXECUTE format($f$
      CREATE POLICY %1$s_tenant_scope ON public.%1$I FOR ALL
        USING (app.is_admin() OR (app.is_staff() AND tenant_id IN (
          SELECT t.id FROM public.tenants t WHERE t.agency_type::text = app.caller_agency())))
        WITH CHECK (app.is_admin() OR (app.is_staff() AND tenant_id IN (
          SELECT t.id FROM public.tenants t WHERE t.agency_type::text = app.caller_agency())))
    $f$, t);
  END LOOP;
END $$;

-- Case evidence inherits its case's visibility.
CREATE POLICY evidence_via_case ON public.evidence FOR ALL
  USING (EXISTS (SELECT 1 FROM public.cases c WHERE c.id = case_id))
  WITH CHECK (EXISTS (SELECT 1 FROM public.cases c WHERE c.id = case_id));

-- Referrals: visible to both the sending and the receiving agency.
CREATE POLICY referrals_parties ON public.referrals FOR ALL
  USING (app.is_admin() OR (app.is_staff() AND (
    from_tenant_id IN (SELECT t.id FROM public.tenants t WHERE t.agency_type::text = app.caller_agency())
    OR to_tenant_id IN (SELECT t.id FROM public.tenants t WHERE t.agency_type::text = app.caller_agency()))))
  WITH CHECK (app.is_admin() OR (app.is_staff() AND (
    from_tenant_id IN (SELECT t.id FROM public.tenants t WHERE t.agency_type::text = app.caller_agency())
    OR to_tenant_id IN (SELECT t.id FROM public.tenants t WHERE t.agency_type::text = app.caller_agency()))));

-- Not used by the API yet: admin/system only until a feature needs it.
CREATE POLICY citizen_profiles_admin ON public.citizen_profiles FOR ALL USING (app.is_admin()) WITH CHECK (app.is_admin());
