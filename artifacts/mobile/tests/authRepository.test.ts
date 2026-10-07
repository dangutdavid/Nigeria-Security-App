import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the module boundaries so no React Native / Expo code loads.
vi.mock("@/services/apiClient", () => ({
  mobileApiFetch: vi.fn(),
  setMobileApiToken: vi.fn(async () => {}),
  hasAuthToken: vi.fn(async () => false),
}));
vi.mock("@/services/apiConfig", () => ({
  shouldUseApi: vi.fn(() => true),
}));

import { mobileApiFetch, setMobileApiToken } from "@/services/apiClient";
import { shouldUseApi } from "@/services/apiConfig";
import { establishApiSession } from "@/services/authRepository";

const fetchMock = vi.mocked(mobileApiFetch);
const useApiMock = vi.mocked(shouldUseApi);

beforeEach(() => {
  vi.clearAllMocks();
  useApiMock.mockReturnValue(true);
});

describe("establishApiSession — server is the login authority", () => {
  it("returns ok and persists the token when the server authorizes", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      fromApi: true,
      data: { token: "server-token", user: { id: "u1", role: "officer" } },
    } as never);

    const outcome = await establishApiSession("FO-001", "1234", "frsc");
    expect(outcome.status).toBe("ok");
    expect(setMobileApiToken).toHaveBeenCalledWith("server-token");
  });

  it("returns rejected/invalid on a 401 (wrong credentials)", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, error: "bad", shouldFallback: true } as never);
    const outcome = await establishApiSession("FO-001", "9999", "frsc");
    expect(outcome).toEqual({ status: "rejected", reason: "invalid" });
    expect(setMobileApiToken).not.toHaveBeenCalled();
  });

  it("returns rejected/inactive on a 403 (disabled account)", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403, error: "inactive", shouldFallback: true } as never);
    const outcome = await establishApiSession("FO-001", "1234", "frsc");
    expect(outcome).toEqual({ status: "rejected", reason: "inactive" });
  });

  it("returns unreachable on a transport failure (no HTTP status)", async () => {
    fetchMock.mockResolvedValue({ ok: false, error: "Network request failed", shouldFallback: true } as never);
    const outcome = await establishApiSession("FO-001", "1234", "frsc");
    expect(outcome.status).toBe("unreachable");
  });

  it("returns mfa_required (and stores no token) when the server asks for a second factor", async () => {
    fetchMock.mockResolvedValue({
      ok: true, status: 200, fromApi: true,
      data: { mfaRequired: true, challengeToken: "challenge.sig", methods: ["totp", "recovery"], smsMaskedPhone: null },
    } as never);
    const outcome = await establishApiSession("SV-042", "1234", "frsc");
    expect(outcome).toEqual({ status: "mfa_required", challengeToken: "challenge.sig", methods: ["totp", "recovery"], smsMaskedPhone: null });
    expect(setMobileApiToken).not.toHaveBeenCalled();
  });

  it("flags an enrol-only session when the role requires 2FA that isn't set up", async () => {
    fetchMock.mockResolvedValue({
      ok: true, status: 200, fromApi: true,
      data: { token: "restricted", user: { id: "u2", role: "supervisor" }, mfaEnrollmentRequired: true },
    } as never);
    const outcome = await establishApiSession("SV-042", "1234", "frsc");
    expect(outcome).toMatchObject({ status: "ok", enrollmentRequired: true });
    expect(setMobileApiToken).toHaveBeenCalledWith("restricted");
  });

  it("returns unreachable when API mode is disabled (never calls the network)", async () => {
    useApiMock.mockReturnValue(false);
    const outcome = await establishApiSession("FO-001", "1234", "frsc");
    expect(outcome.status).toBe("unreachable");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
