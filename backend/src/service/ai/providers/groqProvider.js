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
        if (!this.apiKey && process.env.GROQ_API_KEY) {
            this.apiKey = process.env.GROQ_API_KEY;
        }
        return Boolean(this.apiKey);
    }

    async generate({ systemInstruction, prompt, responseSchema, timeoutMs = 10000 }) {
        if (!this.isAvailable()) {
            throw new Error("GROQ_API_KEY is not configured in environment");
        }

        const startTime = Date.now();
        let jsonHeader = "";
        if (responseSchema) {
            let schemaFields = "intent, toolName, toolArgs, missingRequiredFields, confidence";
            if (responseSchema.properties) {
                schemaFields = Object.keys(responseSchema.properties).join(", ");
            }
            jsonHeader = `CRITICAL JSON REQUIREMENT: You MUST respond ONLY with a valid JSON object containing fields: ${schemaFields}. Do not output markdown code blocks.\n\n`;
        }

        const model = process.env.GROQ_MODEL || "openai/gpt-oss-20b";
        const rawSys = systemInstruction || "You are a professional healthcare assistant for CareFlow.";
        const safeSys = jsonHeader + (typeof rawSys === "string" ? rawSys.slice(0, 3500) : "");
        const userJsonSuffix = responseSchema ? "\n\nRespond strictly with a valid JSON object." : "";
        const safePrompt = (typeof prompt === "string" ? prompt.slice(0, 3500) : prompt) + userJsonSuffix;

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
                    console.warn(`[GroqProvider 429 Rate Limit]: Backing off for ${Math.min(retryAfter, 10)}s (attempt ${attempt + 1})...`);
                    if (body.model === "openai/gpt-oss-120b") {
                        body.model = "openai/gpt-oss-20b";
                    }
                    await new Promise(r => setTimeout(r, Math.min(Math.max(1500, retryAfter * 1000), 10000)));
                    continue;
                }

                if (!res.ok) {
                    const errText = await res.text().catch(() => "");
                    throw new Error(`Groq HTTP ${res.status}: ${res.statusText} ${errText}`.trim());
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
