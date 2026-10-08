import { GoogleGenAI } from "@google/genai";
import { AIProviderInterface } from "./providerInterface.js";

/**
 * Gemini Provider Adapter using official @google/genai SDK (Rule 16)
 */
export class GeminiProvider extends AIProviderInterface {
    constructor() {
        super();
        this.apiKey = process.env.GEMINI_API_KEY;
        this.client = null;
        this.cooldownUntil = 0;
        if (this.apiKey) {
            try {
                this.client = new GoogleGenAI({ apiKey: this.apiKey });
            } catch (err) {
                console.error("[GeminiProvider Init Error]:", err.message);
            }
        }
    }

    getProviderName() {
        return "gemini";
    }

    markUnavailable(durationMs = 60000) {
        this.cooldownUntil = Date.now() + durationMs;
    }

    resetCooldown() {
        this.cooldownUntil = 0;
    }

    isAvailable() {
        if (!this.client && process.env.GEMINI_API_KEY) {
            this.apiKey = process.env.GEMINI_API_KEY;
            try {
                this.client = new GoogleGenAI({ apiKey: this.apiKey });
            } catch (err) {
                console.error("[GeminiProvider Init Error]:", err.message);
            }
        }
        if (this.cooldownUntil && Date.now() < this.cooldownUntil) {
            return false;
        }
        return Boolean(this.client && this.apiKey);
    }

    async generate({ systemInstruction, prompt, responseSchema, timeoutMs = 10000 }) {
        if (!this.isAvailable()) {
            throw new Error("GEMINI_API_KEY is not configured or client failed to initialize");
        }

        const startTime = Date.now();
        const primaryModel = process.env.GEMINI_MODEL || "gemini-3.5-flash";
        const candidateModels = [primaryModel, "gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.7-flash", "gemini-3.8-flash", "gemini-3.6-flash"].filter((v, i, a) => a.indexOf(v) === i);
        let lastError = null;

        for (const model of candidateModels) {
            for (let attempt = 0; attempt < 2; attempt++) {
                try {
                    const config = {
                        systemInstruction: systemInstruction || "You are a professional healthcare assistant for CareFlow.",
                        responseMimeType: responseSchema ? "application/json" : "text/plain"
                    };

                    if (responseSchema) {
                        config.responseSchema = responseSchema;
                    }

                    const timeoutPromise = new Promise((_, reject) =>
                        setTimeout(() => reject(new Error(`Gemini request timed out after ${timeoutMs}ms`)), timeoutMs)
                    );

                    const response = await Promise.race([
                        this.client.models.generateContent({
                            model,
                            contents: prompt,
                            config
                        }),
                        timeoutPromise
                    ]);

                    const text = response.text || "";
                    let parsedData = null;
                    if (responseSchema && text) {
                        try {
                            parsedData = JSON.parse(text);
                        } catch {
                            // Extract JSON substring if markdown blocks present
                            const match = text.match(/\{[\s\S]*\}/);
                            if (match) parsedData = JSON.parse(match[0]);
                        }
                    }

                    return {
                        success: true,
                        provider: "gemini",
                        model,
                        text,
                        data: parsedData,
                        latencyMs: Date.now() - startTime
                    };
                } catch (error) {
                    lastError = error;
                    const isQuotaExhausted = error.status === 429 ||
                        error.message?.includes("RESOURCE_EXHAUSTED") ||
                        error.message?.includes("Quota exceeded") ||
                        error.message?.includes("429");
                    if (isQuotaExhausted) {
                        console.warn(`[Gemini Quota on ${model}]: Candidate model over quota. Trying next candidate model...`);
                        break;
                    }
                    const isTransient = error.message?.includes("503") || error.message?.includes("demand");
                    if (isTransient && attempt === 0) {
                        await new Promise(r => setTimeout(r, 600));
                        continue;
                    }
                    console.warn(`[Gemini Candidate Model ${model} Failed]:`, error.message);
                    break;
                }
            }
        }

        if (lastError) {
            const isQuota = lastError.status === 429 ||
                lastError.message?.includes("RESOURCE_EXHAUSTED") ||
                lastError.message?.includes("Quota exceeded") ||
                lastError.message?.includes("429");
            if (isQuota) {
                this.markUnavailable(60000);
                console.warn("[Gemini Quota Exhausted on all candidates]: Marked Gemini unavailable (cooldown 60s). Fast-failing to Groq fallback.");
                const quotaErr = new Error(`Gemini quota exhausted across candidate models: ${lastError.message}`);
                quotaErr.isQuotaExhausted = true;
                throw quotaErr;
            }
        }

        throw new Error(`Gemini generation failed: ${lastError?.message || "All candidate models exhausted"}`);
    }
}

export const geminiProvider = new GeminiProvider();
