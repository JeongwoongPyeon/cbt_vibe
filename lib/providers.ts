import type { AiProvider, EnvStatus } from "./types";

export const AI_PROVIDERS = [
  {
    id: "openai",
    label: "OpenAI",
    key: "OPENAI_API_KEY",
    model: "gpt-5.4-mini",
    docs: "https://developers.openai.com/api/docs/models/gpt-5.4-mini",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    key: "GEMINI_API_KEY",
    model: "gemini-3.8-flash",
    docs: "https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash",
  },
  {
    id: "anthropic",
    label: "Anthropic Claude",
    key: "ANTHROPIC_API_KEY",
    model: "claude-sonnet-5",
    docs: "https://platform.claude.com/docs/en/models/overview",
  },
] as const;

export function resolveProvider(
  value: unknown,
  fallback: unknown = "openai",
): AiProvider {
  const candidate = value == null || value === "" ? fallback : value;
  if (
    candidate === "openai" ||
    candidate === "gemini" ||
    candidate === "anthropic"
  )
    return candidate;
  throw new Error("지원하지 않는 AI 제공자입니다.");
}

export function providerModel(env: EnvStatus, provider: AiProvider) {
  return env[`${provider}Model`];
}

export function providerConfigured(env: EnvStatus, provider: AiProvider) {
  return env[`${provider}Configured`];
}
