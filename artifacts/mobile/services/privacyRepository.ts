import { mobileApiFetch } from "@/services/apiClient";

/** Citizen data-subject requests (server: routes/privacy.ts). */
export async function exportMyReport(reference: string, clientId: string) {
  return mobileApiFetch<Record<string, unknown>>({ method: "POST", path: "/privacy/citizen-reports/export", body: { reference, clientId }, timeoutMs: 15000 });
}

export async function requestMyReportErasure(reference: string, clientId: string, reason?: string) {
  return mobileApiFetch<{ requestId: string; status: string; respondWithinDays: number }>({
    method: "POST",
    path: "/privacy/citizen-reports/erasure-request",
    body: { reference, clientId, ...(reason ? { reason } : {}) },
  });
}
