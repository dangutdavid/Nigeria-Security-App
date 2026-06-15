import { Router, type IRouter } from "express";
import { AssistantChatRequestSchema } from "@workspace/api-zod";
import {
  AssistantUnavailableError,
  assistantConfigured,
  generateAssistantReply,
} from "../lib/assistant";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// Citizen chat assistant — backed by Anthropic Claude or Google Gemini
// depending on AI_PROVIDER. Returns 503 when no provider key is configured so
// the mobile app falls back to its local assistant.
router.post("/assistant/chat", async (req, res) => {
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
