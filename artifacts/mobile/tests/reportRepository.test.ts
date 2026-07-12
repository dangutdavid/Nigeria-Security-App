import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the module boundaries so no React Native / Expo code loads.
vi.mock("@/services/apiClient", () => ({
  mobileApiFetch: vi.fn(),
}));
vi.mock("@/services/apiConfig", () => ({
  shouldUseApi: vi.fn(() => true),
}));
vi.mock("@/services/citizenIncidentApi", () => ({
  submitCitizenIncidentMock: vi.fn(async () => ({ id: "local-1", reference: "LOCAL-REF" })),
  findCitizenIncidentByReference: vi.fn(async () => ({ id: "local-2", reference: "LOCAL-FOUND" })),
  listCitizenIncidentReports: vi.fn(async () => []),
  listCitizenIncidentReportsByAgency: vi.fn(async () => [{ id: "local-3" }]),
  updateCitizenIncidentStatusMock: vi.fn(async () => null),
  reassignCitizenIncidentAgencyMock: vi.fn(async () => null),
  appendCitizenIncidentTimelineMock: vi.fn(async () => null),
}));

import { mobileApiFetch } from "@/services/apiClient";
import {
  submitCitizenReport,
  trackCitizenReportByReference,
  listReportsByAgency,
  getAgencyMetrics,
} from "@/services/reportRepository";
import {
  submitCitizenIncidentMock,
  listCitizenIncidentReportsByAgency,
} from "@/services/citizenIncidentApi";

const apiFetch = vi.mocked(mobileApiFetch);

const SUBMISSION = {
  incidentType: "road_crash",
  description: "Test",
  location: "Jos",
  emergencyLevel: "low",
  suggestedAgency: "frsc",
} as Parameters<typeof submitCitizenReport>[0];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("reportRepository API-first behaviour", () => {
  it("returns the API report when the backend responds", async () => {
    apiFetch.mockResolvedValueOnce({
      ok: true,
      status: 201,
      fromApi: true,
      data: { report: { id: "api-1", reference: "CIR-API-1" } },
    });
    const result = await submitCitizenReport(SUBMISSION);
    expect(result.reference).toBe("CIR-API-1");
    expect(submitCitizenIncidentMock).not.toHaveBeenCalled();
  });

  it("falls back to the local mock when the API call fails", async () => {
    apiFetch.mockResolvedValueOnce({
      ok: false,
      error: "network down",
      shouldFallback: true,
    });
    const result = await submitCitizenReport(SUBMISSION);
    expect(result.reference).toBe("LOCAL-REF");
    expect(submitCitizenIncidentMock).toHaveBeenCalledWith(SUBMISSION);
  });

  it("tracks by reference via the API first, local on failure", async () => {
    apiFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      fromApi: true,
      data: { report: { id: "api-2", reference: "CIR-API-2" } },
    });
    const apiResult = await trackCitizenReportByReference("cir-api-2");
    expect(apiResult?.reference).toBe("CIR-API-2");

    apiFetch.mockResolvedValueOnce({ ok: false, error: "500", shouldFallback: true });
    const localResult = await trackCitizenReportByReference("whatever");
    expect(localResult?.reference).toBe("LOCAL-FOUND");
  });

  it("lists agency reports from the API, local list on failure", async () => {
    apiFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      fromApi: true,
      data: { reports: [{ id: "api-3" }] },
    });
    const apiList = await listReportsByAgency("police");
    expect(apiList).toEqual([{ id: "api-3" }]);
    expect(listCitizenIncidentReportsByAgency).not.toHaveBeenCalled();

    apiFetch.mockResolvedValueOnce({ ok: false, error: "boom", shouldFallback: true });
    const localList = await listReportsByAgency("police");
    expect(localList).toEqual([{ id: "local-3" }]);
  });

  it("returns null metrics when API mode is unavailable so callers compute locally", async () => {
    apiFetch.mockResolvedValueOnce({ ok: false, error: "disabled", shouldFallback: true });
    const metrics = await getAgencyMetrics("frsc");
    expect(metrics).toBeNull();
  });
});
