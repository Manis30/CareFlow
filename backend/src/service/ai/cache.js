/**
 * In-memory Short-TTL Cache for Operational & Platform Stats.
 * Prevents redundant aggregate database queries.
 * Includes invalidation helper for write paths.
 */

const statsCache = new Map();
const DEFAULT_TTL_MS = 30000; // 30 seconds

export const getCachedStats = (key) => {
    const entry = statsCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        statsCache.delete(key);
        return null;
    }
    return entry.data;
};

export const setCachedStats = (key, data, ttlMs = DEFAULT_TTL_MS) => {
    statsCache.set(key, {
        data,
        expiresAt: Date.now() + ttlMs
    });
};

/**
 * Invalidates stats cache entries for a specific organization or globally.
 * Called on appointment write paths (create, cancel, reschedule).
 * @param {string} [organizationId]
 */
export const invalidateStatsCache = (organizationId = null) => {
    if (!organizationId) {
        statsCache.clear();
        return;
    }

    const orgStr = String(organizationId);
    for (const key of statsCache.keys()) {
        if (key.includes(orgStr) || key.startsWith("global:")) {
            statsCache.delete(key);
        }
    }
};
