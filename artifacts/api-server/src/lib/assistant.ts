import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import type { AssistantChatMessage } from "@workspace/api-zod";

/**
 * Citizen chat assistant provider abstraction. Two providers are supported —
 * Anthropic Claude and Google Gemini — selected by the `AI_PROVIDER` env var.
 * API keys stay server-side; if no key is configured the assistant reports
 * itself unavailable so the mobile app can fall back to its local helper.
 */
export interface AssistantReply {
  reply: string;
  provider: "anthropic" | "gemini";
  model: string;
}

export class AssistantUnavailableError extends Error {}

const DEFAULT_ANTHROPIC_MODEL = "claude-opus-4-8";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";

export const ASSISTANT_SYSTEM_PROMPT = [
  "You are the in-app assistant for a Nigerian public-safety reporting app.",
  "You help citizens understand how to report incidents, what details to include,",
  "which agency handles what (FRSC for road/traffic, Police for crime and theft,",
  "VIO for vehicle roadworthiness, NSCDC/Civil Defence for fire, disaster, and civil emergencies),",
  "and how to track a submitted report by its reference number.",
  "Be concise, calm, and practical. Use plain language.",
  "For any life-threatening emergency, tell the user to call 112 immediately rather than waiting on an app.",
  "Do not give legal advice, do not promise outcomes or response times, and never ask for passwords or PINs.",
  "If you are unsure, say so and suggest submitting a report so an officer can follow up.",
].join(" ");

function selectedProvider(): "anthropic" | "gemini" {
  const value = process.env["AI_PROVIDER"]?.trim().toLowerCase();
  if (value === "gemini") return "gemini";
  return "anthropic";
}

export function assistantConfigured(): boolean {
  const provider = selectedProvider();
  if (provider === "gemini") {
    return Boolean(process.env["GEMINI_API_KEY"] ?? process.env["GOOGLE_API_KEY"]);
  }
  return Boolean(process.env["ANTHROPIC_API_KEY"]);
}

async function chatWithAnthropic(messages: AssistantChatMessage[]): Promise<AssistantReply> {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) throw new AssistantUnavailableError("ANTHROPIC_API_KEY is not configured.");
  const model = process.env["ANTHROPIC_MODEL"]?.trim() || DEFAULT_ANTHROPIC_MODEL;

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model,
    max_tokens: 1024,
    system: ASSISTANT_SYSTEM_PROMPT,
    thinking: { type: "adaptive" },
    output_config: { effort: "low" },
    messages: messages.map((message) => ({ role: message.role, content: message.content })),
  });

  if (response.stop_reason === "refusal") {
    return {
      reply:
        "I can't help with that here. If this is an emergency, call 112. Otherwise you can submit a report and an officer will follow up.",
      provider: "anthropic",
      model,
    };
  }

  const reply = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  return { reply: reply || "I wasn't able to generate a response. Please try again.", provider: "anthropic", model };
}

async function chatWithGemini(messages: AssistantChatMessage[]): Promise<AssistantReply> {
  const apiKey = process.env["GEMINI_API_KEY"] ?? process.env["GOOGLE_API_KEY"];
  if (!apiKey) throw new AssistantUnavailableError("GEMINI_API_KEY is not configured.");
  const model = process.env["GEMINI_MODEL"]?.trim() || DEFAULT_GEMINI_MODEL;

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model,
    contents: messages.map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    })),
    config: {
      systemInstruction: ASSISTANT_SYSTEM_PROMPT,
      maxOutputTokens: 1024,
    },
  });

  const reply = (response.text ?? "").trim();
  return { reply: reply || "I wasn't able to generate a response. Please try again.", provider: "gemini", model };
}

/**
 * Generate an assistant reply using the configured provider. Throws
 * `AssistantUnavailableError` when no provider is configured so the caller can
 * return a 503 and the mobile app can fall back to its local assistant.
 */
export async function generateAssistantReply(
  messages: AssistantChatMessage[],
): Promise<AssistantReply> {
  return selectedProvider() === "gemini" ? chatWithGemini(messages) : chatWithAnthropic(messages);
}
