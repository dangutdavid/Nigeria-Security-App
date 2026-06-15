import { mobileApiFetch } from "@/services/apiClient";
import { shouldUseApi } from "@/services/apiConfig";

export type AssistantRole = "user" | "assistant";

export interface AssistantMessage {
  role: AssistantRole;
  content: string;
}

export interface AssistantResult {
  reply: string;
  /** "api" when answered by the backend (Claude/Gemini), "local" for the offline fallback. */
  source: "api" | "local";
}

interface AssistantChatResponse {
  reply?: string;
  provider?: string;
  model?: string;
}

/**
 * Send the conversation to the backend assistant (Anthropic Claude or Google
 * Gemini, depending on the server's AI_PROVIDER). Falls back to a local
 * rule-based responder when API mode is disabled or the request fails, so the
 * assistant keeps working offline in the Expo Go demo.
 */
export async function sendAssistantMessage(
  messages: AssistantMessage[],
): Promise<AssistantResult> {
  const api = await mobileApiFetch<AssistantChatResponse, { messages: AssistantMessage[] }>({
    method: "POST",
    path: "/assistant/chat",
    body: { messages },
  });

  if (api.ok && api.data.reply) {
    return { reply: api.data.reply, source: "api" };
  }

  if (shouldUseApi() && !api.ok) {
    console.warn(`[assistantRepository] chat fell back to local responder: ${api.error}`);
  }

  return { reply: localAssistantReply(messages), source: "local" };
}

const AGENCY_GUIDE =
  "FRSC handles road crashes and traffic; the Police handle crime, theft and robbery; " +
  "VIO handles vehicle roadworthiness and documents; NSCDC (Civil Defence) handles fire, " +
  "disasters and civil emergencies. When you submit a report the app routes it for you.";

/**
 * Offline rule-based fallback. Keyword matching only — keeps the demo useful
 * without a backend or network.
 */
function localAssistantReply(messages: AssistantMessage[]): string {
  const last = [...messages].reverse().find((m) => m.role === "user")?.content.toLowerCase() ?? "";

  if (/emergency|urgent|danger|dying|accident now|help me now/.test(last)) {
    return "If this is a life-threatening emergency, call 112 right now. You can also submit a report in the app and mark it high priority so the right agency is alerted.";
  }
  if (/track|status|reference|where is my report/.test(last)) {
    return "To track a report, open Track Report and enter your reference number (it looks like CIR-XXXX). You'll see the current status and timeline.";
  }
  if (/report|submit|file|how do i/.test(last)) {
    return "To report an incident, open Report an Incident, describe what happened, add a location (GPS or typed), choose the emergency level, and submit. You'll get a reference number to track it. " + AGENCY_GUIDE;
  }
  if (/agency|who handles|frsc|police|vio|nscdc|civil defence|which/.test(last)) {
    return AGENCY_GUIDE;
  }
  if (/hello|hi|hey|good morning|good afternoon/.test(last)) {
    return "Hello! I can help you report an incident, track a report by reference, or understand which agency handles what. What do you need?";
  }
  return "I can help you report an incident, track a report by its reference number, or explain which agency handles what. For a life-threatening emergency, call 112. What would you like to do?";
}
