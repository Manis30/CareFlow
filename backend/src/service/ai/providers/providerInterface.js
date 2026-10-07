/**
 * Common Provider Interface Contract (Rule 16 & Section 18)
 * Ensures Gemini and Groq implement the identical interaction contract.
 */
export class AIProviderInterface {
    /**
     * @param {Object} options
     * @param {string} options.systemInstruction
     * @param {string} options.prompt
     * @param {Object} [options.responseSchema]
     * @param {number} [options.timeoutMs]
     * @returns {Promise<{ text?: string, data?: Object, model: string, latencyMs: number }>}
     */
    async generate({ systemInstruction, prompt, responseSchema, timeoutMs = 10000 }) {
        throw new Error("generate() must be implemented by the provider adapter");
    }

    getProviderName() {
        throw new Error("getProviderName() must be implemented by the provider adapter");
    }
}
