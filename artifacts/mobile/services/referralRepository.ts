import { mobileApiFetch } from "@/services/apiClient";
import { shouldUseApi } from "@/services/apiConfig";

/**
 * Best-effort mirroring of cross-agency referrals to the backend referral
 * API. Only referrals about backend-known citizen reports (CIR-* references)
 * can be mirrored; purely local records (inspections, local crime entries)
 * remain local until those models are backend-managed.
 */

export function isBackendReportReference(recordId: string): boolean {
  return /^CIR-/i.test(recordId.trim());
}

export async function createReferralOnApi(input: {
  reportReference: string;
  toAgency: string;
  reason: string;
}): Promise<string | null> {
  const api = await mobileApiFetch<{ referral?: { id: string } }>({
    method: "POST",
    path: "/referrals",
    requireAuth: true,
    body: input,
  });
  if (api.ok && api.data.referral?.id) return api.data.referral.id;
  if (!api.ok && shouldUseApi()) {
    console.warn(`[referralRepository] create fell back to local-only: ${api.error}`);
  }
  return null;
}

export async function updateReferralStatusOnApi(
  serverReferralId: string,
  status: "pending" | "acknowledged" | "actioned" | "closed",
  note?: string,
): Promise<void> {
  const api = await mobileApiFetch({
    method: "PATCH",
    path: `/referrals/${encodeURIComponent(serverReferralId)}/status`,
    requireAuth: true,
    body: { status, ...(note ? { note } : {}) },
  });
  if (!api.ok && shouldUseApi()) {
    console.warn(`[referralRepository] status sync failed: ${api.error}`);
  }
}
