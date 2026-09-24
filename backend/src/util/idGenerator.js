import crypto from "crypto";

/**
 * Registry of generated IDs to guarantee intra-session uniqueness
 */
const generatedIds = new Set();

/**
 * Server-side collision-safe business ID generator
 * Format: CF-{PREFIX}-{RANDOM_HEX}
 * 
 * @param {string} prefix - e.g. "ORG", "DOC", "PAT", "APT", "PAY", "MED", "RX"
 * @param {number} length - number of random hex characters (default: 6)
 * @returns {string} - Unique Business ID
 */
export const generateBusinessId = (prefix = "GEN", length = 6) => {
    const cleanPrefix = prefix.toUpperCase().trim();
    let id;
    let attempts = 0;
    
    do {
        // Generate random bytes and slice to requested length
        const bytes = crypto.randomBytes(Math.ceil(length / 2));
        const hex = bytes.toString("hex").toUpperCase().slice(0, length);
        id = `CF-${cleanPrefix}-${hex}`;
        attempts++;
        
        if (attempts > 1000) {
            // Fallback timestamp suffix if extreme collision pressure occurs
            id = `CF-${cleanPrefix}-${hex}${Date.now().toString().slice(-4)}`;
            break;
        }
    } while (generatedIds.has(id));

    generatedIds.add(id);
    return id;
};

/**
 * Resets the in-memory generated ID registry
 */
export const resetIdRegistry = () => {
    generatedIds.clear();
};

export default generateBusinessId;
