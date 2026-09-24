/**
 * Prompt Injection Protection Layer for CareFlow AI.
 * Rule: User inputs, medical records, and messages are UNTRUSTED DATA.
 * System instructions and tool permissions always take precedence.
 */

const INJECTION_PATTERNS = [
    /ignore\s+(previous|all)\s+instructions/i,
    /disregard\s+(system|safety|security)\s+rules/i,
    /override\s+permissions/i,
    /reveal\s+(all|other)\s+patient/i,
    /show\s+all\s+database/i,
    /system\s+prompt\s*:/i,
    /developer\s+mode/i,
    /jailbreak/i
];

export const sanitizeUntrustedInput = (input) => {
    if (!input || typeof input !== "string") {
        return "";
    }

    let sanitized = input.trim();
    for (const pattern of INJECTION_PATTERNS) {
        if (pattern.test(sanitized)) {
            console.warn(`[AI SECURITY ALERT] Potential prompt injection attempt detected and sanitized: "${sanitized.substring(0, 50)}..."`);
            sanitized = sanitized.replace(pattern, "[FLAGGED_INJECTION_ATTEMPT]");
        }
    }

    return sanitized;
};

export const wrapUntrustedData = (label, data) => {
    const jsonStr = typeof data === "object" ? JSON.stringify(data) : String(data);
    const sanitized = sanitizeUntrustedInput(jsonStr);
    return `--- UNTRUSTED DATA BOUNDARY (${label}) ---\n${sanitized}\n--- END UNTRUSTED DATA BOUNDARY ---`;
};
