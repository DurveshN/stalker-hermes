import { createAnthropic } from "@ai-sdk/anthropic";
import { config } from "./config.js";

const anthropic = createAnthropic({ apiKey: config.anthropicApiKey });

export const managerLLM = anthropic(config.managerModel);
export const specialistLLM = anthropic(config.specialistModel);

// Normalize AI SDK v7 usage (fields can be undefined) to plain numbers.
export function usageTokens(usage: {
  inputTokens?: number;
  outputTokens?: number;
}): { tokensIn: number; tokensOut: number } {
  return {
    tokensIn: usage.inputTokens ?? 0,
    tokensOut: usage.outputTokens ?? 0,
  };
}
