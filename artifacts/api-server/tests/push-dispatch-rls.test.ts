import { describe, expect, it, vi } from "vitest";

const sent: string[][] = [];
vi.mock("../src/lib/pushSender", () => ({
  sendPushToTokens: vi.fn(async (tokens: string[]) => {
    sent.push(tokens);
    return tokens.length;
  }),
}));

import { pushTokens, runAsSystem, withDbContext, getDb } from "@workspace/db";
import { sendPushToAgency } from "../src/lib/pushDispatch";

/**
 * Regression guard: push fan-out reads OTHER users' device tokens. Under RLS an
 * anonymous citizen's request can't see those rows, so the lookup must run as
 * system or agency alerts silently stop. Database-mode only.
 */
describe.skipIf(!process.env.DATABASE_URL)("push dispatch under RLS", () => {
  it("an anonymous citizen's submission still reaches agency devices", async () => {
    const token = `ExponentPushToken[rls-${Date.now()}]`;
    await runAsSystem(() =>
      getDb()!.insert(pushTokens).values({ token, platform: "android", userId: "u-vio-rls", agency: "vio" }).then(() => undefined));

    const delivered = await withDbContext({ role: "anonymous" }, () =>
      sendPushToAgency("vio", { title: "New citizen report", body: "test" }));

    expect(delivered).toBeGreaterThanOrEqual(1);
    expect(sent.flat()).toContain(token);
  });
});
