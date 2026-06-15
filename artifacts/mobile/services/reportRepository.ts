import {
  appendCitizenIncidentTimelineMock,
  CitizenAgencyRoute,
  CitizenIncidentReceipt,
  CitizenIncidentStatus,
  CitizenIncidentSubmission,
  findCitizenIncidentByReference,
  listCitizenIncidentReports,
  listCitizenIncidentReportsByAgency,
  reassignCitizenIncidentAgencyMock,
  submitCitizenIncidentMock,
  updateCitizenIncidentStatusMock,
} from "@/services/citizenIncidentApi";
import { mobileApiFetch } from "@/services/apiClient";

interface StatusUpdateInput {
  reference: string;
  status: CitizenIncidentStatus;
  actorName: string;
  actorAgencyLabel?: string;
}

interface ReassignInput {
  reference: string;
  agency: CitizenAgencyRoute;
  actorName: string;
}

interface TimelineInput {
  reference: string;
  action: string;
  actorName: string;
}

export async function submitCitizenReport(
  input: CitizenIncidentSubmission,
): Promise<CitizenIncidentReceipt> {
  const api = await mobileApiFetch<{ report?: CitizenIncidentReceipt; case?: CitizenIncidentReceipt; reference?: string }, CitizenIncidentSubmission>({
    method: "POST",
    path: "/citizen-reports",
    body: input,
  });

  if (api.ok) {
    const report = api.data.report ?? api.data.case;
    if (report) return report;
  }

  return submitCitizenIncidentMock(input);
}

export async function trackCitizenReportByReference(
  reference: string,
): Promise<CitizenIncidentReceipt | null> {
  const encoded = encodeURIComponent(reference.trim());
  const api = await mobileApiFetch<{ report?: CitizenIncidentReceipt; case?: CitizenIncidentReceipt }>({
    method: "GET",
    path: `/citizen-reports/track/${encoded}`,
  });

  if (api.ok) return api.data.report ?? api.data.case ?? null;
  return findCitizenIncidentByReference(reference);
}

export async function listReports(): Promise<CitizenIncidentReceipt[]> {
  const api = await mobileApiFetch<{ reports?: CitizenIncidentReceipt[]; cases?: CitizenIncidentReceipt[] }>({
    method: "GET",
    path: "/reports",
    requireAuth: true,
  });

  if (api.ok) return api.data.reports ?? api.data.cases ?? [];
  return listCitizenIncidentReports();
}

export async function listReportsByAgency(
  agency: CitizenAgencyRoute,
): Promise<CitizenIncidentReceipt[]> {
  const api = await mobileApiFetch<{ reports?: CitizenIncidentReceipt[]; cases?: CitizenIncidentReceipt[] }>({
    method: "GET",
    path: `/agencies/${agency}/reports`,
    requireAuth: true,
  });

  if (api.ok) return api.data.reports ?? api.data.cases ?? [];
  return listCitizenIncidentReportsByAgency(agency);
}

export async function updateReportStatus(
  input: StatusUpdateInput,
): Promise<CitizenIncidentReceipt | null> {
  const api = await mobileApiFetch<{ report?: CitizenIncidentReceipt; case?: CitizenIncidentReceipt }, StatusUpdateInput>({
    method: "PATCH",
    path: `/reports/${encodeURIComponent(input.reference)}/status`,
    body: input,
    requireAuth: true,
  });

  if (api.ok) return api.data.report ?? api.data.case ?? null;
  return updateCitizenIncidentStatusMock(input);
}

export async function reassignReport(
  input: ReassignInput,
): Promise<CitizenIncidentReceipt | null> {
  const api = await mobileApiFetch<{ report?: CitizenIncidentReceipt; case?: CitizenIncidentReceipt }, ReassignInput>({
    method: "POST",
    path: `/reports/${encodeURIComponent(input.reference)}/reassign`,
    body: input,
    requireAuth: true,
  });

  if (api.ok) return api.data.report ?? api.data.case ?? null;
  return reassignCitizenIncidentAgencyMock(input);
}

export async function appendTimelineEntry(
  input: TimelineInput,
): Promise<CitizenIncidentReceipt | null> {
  const api = await mobileApiFetch<{ report?: CitizenIncidentReceipt; case?: CitizenIncidentReceipt }, TimelineInput>({
    method: "POST",
    path: `/reports/${encodeURIComponent(input.reference)}/timeline`,
    body: input,
    requireAuth: true,
  });

  if (api.ok) return api.data.report ?? api.data.case ?? null;
  return appendCitizenIncidentTimelineMock(input);
}
