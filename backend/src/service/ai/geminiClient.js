import { aiProviderGateway } from "./providers/aiProviderGateway.js";

/**
 * Centralized Gemini Client & Unified Provider Gateway Wrapper.
 * Preserves existing import signatures while delegating to the unified AI Provider architecture.
 */
export const getGeminiModelName = () => {
    return process.env.GEMINI_MODEL || "gemini-3.6-flash";
};

export const generateStructuredContent = async ({ systemInstruction, prompt, responseSchema, timeoutMs = 10000 }) => {
    return await aiProviderGateway.generateStructured({
        systemInstruction,
        prompt,
        responseSchema,
        timeoutMs
    });
};

export const getAIProviderMetrics = () => {
    return aiProviderGateway.getMetrics();
};
