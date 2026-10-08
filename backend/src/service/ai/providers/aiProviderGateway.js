import { geminiProvider } from "./geminiProvider.js";
import { groqProvider } from "./groqProvider.js";

/**
 * Unified AI Provider Gateway (Rule 16 & Section 18, 19, 38)
 * Manages primary (Gemini) -> fallback (Groq) with telemetry & performance tracking.
 */
class AIProviderGateway {
    constructor() {
        this.primary = geminiProvider;
        this.fallback = groqProvider;
        this.metrics = {
            totalCalls: 0,
            geminiSuccessCount: 0,
            groqFallbackCount: 0,
            totalFailures: 0,
            totalLatencyMs: 0
        };
    }

    getMetrics() {
        const total = this.metrics.totalCalls || 1;
        return {
            ...this.metrics,
            fallbackRate: Number(((this.metrics.groqFallbackCount / total) * 100).toFixed(2)),
            avgLatencyMs: Number((this.metrics.totalLatencyMs / total).toFixed(1))
        };
    }

    markProviderUnavailable(providerName = "gemini", durationMs = 60000) {
        if (providerName === "gemini" && typeof this.primary.markUnavailable === "function") {
            this.primary.markUnavailable(durationMs);
        }
    }

    resetCooldown(providerName = "gemini") {
        if (providerName === "gemini" && typeof this.primary.resetCooldown === "function") {
            this.primary.resetCooldown();
        }
    }

    async generate({ systemInstruction, prompt, responseSchema, timeoutMs = 10000 }) {
        this.metrics.totalCalls++;
        const callStartTime = Date.now();
        let geminiError = null;

        // 1. Try Primary Provider (Gemini)
        if (this.primary.isAvailable()) {
            try {
                const res = await this.primary.generate({
                    systemInstruction,
                    prompt,
                    responseSchema,
                    timeoutMs
                });
                this.metrics.geminiSuccessCount++;
                this.metrics.totalLatencyMs += (Date.now() - callStartTime);
                return res;
            } catch (err) {
                geminiError = err;
                const isQuota = err.isQuotaExhausted || err.status === 429 || err.message?.includes("RESOURCE_EXHAUSTED") || err.message?.includes("Quota exceeded") || err.message?.includes("429");
                if (isQuota) {
                    this.markProviderUnavailable("gemini", 60000);
                    console.warn("[AIProviderGateway] Primary provider (Gemini) quota exhausted. Marked Gemini unavailable (cooldown active). Fast-failing to Groq fallback.");
                } else {
                    console.warn("[AIProviderGateway] Primary provider (Gemini) failed. Engaging Groq fallback:", err.message);
                }
            }
        } else {
            geminiError = new Error("Gemini provider is temporarily unavailable (cooldown active)");
            console.log("[AIProviderGateway] Gemini currently unavailable/on cooldown. Routing directly to Groq fallback.");
        }

        // 2. Try Fallback Provider (Groq) (Rule 19)
        if (this.fallback.isAvailable()) {
            try {
                const res = await this.fallback.generate({
                    systemInstruction,
                    prompt,
                    responseSchema,
                    timeoutMs
                });
                this.metrics.groqFallbackCount++;
                this.metrics.totalLatencyMs += (Date.now() - callStartTime);
                return res;
            } catch (groqErr) {
                console.error("[AIProviderGateway] Fallback provider (Groq) also failed:", groqErr.message);
            }
        }

        this.metrics.totalFailures++;
        this.metrics.totalLatencyMs += (Date.now() - callStartTime);
        throw new Error(`All AI providers failed. Gemini: ${geminiError?.message || 'unavailable'}`);
    }

    /**
     * Backward-compatible structured content generator
     */
    async generateStructured({ systemInstruction, prompt, responseSchema, timeoutMs = 10000 }) {
        const res = await this.generate({ systemInstruction, prompt, responseSchema, timeoutMs });
        if (responseSchema && res.data) {
            return res.data;
        }
        return { response: res.text, model: res.model, provider: res.provider };
    }
}

export const aiProviderGateway = new AIProviderGateway();
