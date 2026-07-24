import { Router, type IRouter } from "express";
import { AssistantChatRequestSchema } from "@workspace/api-zod";
import {
  AssistantUnavailableError,
  assistantConfigured,
  generateAssistantReply,
} from "../lib/assistant";
import { rateLimit } from "../lib/rateLimit";
import { dailyBudget } from "../lib/dailyBudget";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function envInt(name: string, fallback: number): number {
  const raw = Number(process.env[name]);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : fallback;
}

// The assistant is a PUBLIC (unauthenticated) endpoint that proxies paid
// Anthropic/Gemini calls, so it needs abuse controls even without a login:
//  1. Per-IP rate limit — bounds a single caller (default 15 / 10 min).
//  2. Server-wide daily budget — bounds aggregate spend across all IPs so a
//     distributed abuser can't run the bill up (default 2000 calls / UTC day).
// Both are tunable via env for load without a code change.
const assistantRateLimit = rateLimit({
  windowMs: envInt("ASSISTANT_RATE_WINDOW_MS", 10 * 60 * 1000),
  max: envInt("ASSISTANT_RATE_MAX", 15),
  message: "Too many assistant requests. Please slow down and try again shortly.",
});

const assistantDailyBudget = dailyBudget({
  max: envInt("ASSISTANT_DAILY_BUDGET", 2000),
  name: "assistant",
});

// Citizen chat assistant — backed by Anthropic Claude or Google Gemini
// depending on AI_PROVIDER. Returns 503 when no provider key is configured so
// the mobile app falls back to its local assistant.
router.post("/assistant/chat", assistantRateLimit, assistantDailyBudget, async (req, res) => {
  const result = AssistantChatRequestSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: "Validation failed", issues: result.error.flatten() });
    return;
  }

  if (!assistantConfigured()) {
    res.status(503).json({ error: "Assistant is not configured on the server." });
    return;
  }

  try {
    const { reply, provider, model } = await generateAssistantReply(result.data.messages);
    res.json({ reply, provider, model });
  } catch (error) {
    if (error instanceof AssistantUnavailableError) {
      res.status(503).json({ error: error.message });
      return;
    }
    logger.error({ err: error }, "Assistant chat failed");
    res.status(502).json({ error: "The assistant is temporarily unavailable. Please try again." });
  }
});

export default router;
