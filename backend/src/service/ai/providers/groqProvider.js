import { AIProviderInterface } from "./providerInterface.js";

/**
 * Groq Provider Adapter for Fast Resilient Fallback (Rule 16 & Section 19)
 */
export class GroqProvider extends AIProviderInterface {
    constructor() {
        super();
        this.apiKey = process.env.GROQ_API_KEY;
    }

    getProviderName() {
        return "groq";
    }

    isAvailable() {
        return Boolean(this.apiKey);
    }

    async generate({ systemInstruction, prompt, responseSchema, timeoutMs = 10000 }) {
        if (!this.isAvailable()) {
            throw new Error("GROQ_API_KEY is not configured in environment");
        }

        const startTime = Date.now();
        let enhancedSystemInstruction = systemInstruction || "You are a professional healthcare assistant for CareFlow.";
        if (responseSchema) {
            let schemaFields = "intent, toolName, toolArgs, missingRequiredFields, confidence";
            if (responseSchema.properties) {
                schemaFields = Object.keys(responseSchema.properties).join(", ");
            }
            enhancedSystemInstruction += `\n\nCRITICAL JSON SCHEMA REQUIREMENT: You MUST respond ONLY with a valid JSON object. It MUST strictly contain the following fields: ${schemaFields}. Do not output any markdown code blocks or additional text.`;
        }

        const model = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
        const maxLen = 16000;
        const safePrompt = typeof prompt === "string" && prompt.length > maxLen
            ? prompt.slice(0, maxLen) + "\n...[Content truncated for length]"
            : prompt;
        const safeSys = typeof enhancedSystemInstruction === "string" && enhancedSystemInstruction.length > 8000
            ? enhancedSystemInstruction.slice(0, 8000)
            : enhancedSystemInstruction;

        const body = {
            model,
            messages: [
                { role: "system", content: safeSys },
                { role: "user", content: safePrompt }
            ]
        };

        if (responseSchema) {
            body.response_format = { type: "json_object" };
        }

        for (let attempt = 0; attempt < 3; attempt++) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

            try {
                const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${this.apiKey}`,
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(body),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (res.status === 429 && attempt < 2) {
                    const retryAfter = Number(res.headers.get("retry-after") || 2);
                    console.warn(`[GroqProvider 429 Rate Limit]: Backing off for ${retryAfter}s (attempt ${attempt + 1})...`);
                    await new Promise(r => setTimeout(r, Math.max(2000, retryAfter * 1000)));
                    continue;
                }

                if (!res.ok) {
                    throw new Error(`Groq HTTP ${res.status}: ${res.statusText}`);
                }

            const data = await res.json();
            const text = data.choices?.[0]?.message?.content || "";
            let parsedData = null;

            if (responseSchema && text) {
                try {
                    parsedData = JSON.parse(text);
                } catch {
                    const match = text.match(/\{[\s\S]*\}/);
                    if (match) parsedData = JSON.parse(match[0]);
                }
            }

            return {
                success: true,
                provider: "groq",
                model,
                text,
                data: parsedData,
                latencyMs: Date.now() - startTime
            };
            } catch (err) {
                clearTimeout(timeoutId);
                if (attempt === 2) {
                    throw new Error(`Groq generation failed: ${err.message}`);
                }
            }
        }
    }
}

export const groqProvider = new GroqProvider();
