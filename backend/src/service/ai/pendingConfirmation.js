import crypto from "crypto";
import { AppError } from "../../middleware/errorHandler.js";

/**
 * Server-Side Pending Confirmation Store.
 * Prevents client-side tampering of tool arguments during confirmation.
 * Enforces single-use consumption and 15-minute expiration to prevent double-booking.
 */

const pendingConfirmations = new Map();
const CONFIRMATION_TTL_MS = 15 * 60 * 1000; // 15 minutes

// Periodic cleanup of expired confirmations
setInterval(() => {
    const now = Date.now();
    for (const [id, entry] of pendingConfirmations.entries()) {
        if (entry.expiresAt < now) {
            pendingConfirmations.delete(id);
        }
    }
}, 60 * 1000);

/**
 * Creates a cryptographically secure pending confirmation action stored exclusively on the server.
 */
export const createPendingConfirmation = ({
    userId,
    role,
    organizationId = null,
    toolName,
    canonicalArgs = {},
    displayPayload = {},
    summary = ""
}) => {
    if (!userId) {
        throw new AppError(400, "userId is required to create a pending confirmation.");
    }
    if (!toolName) {
        throw new AppError(400, "toolName is required to create a pending confirmation.");
    }

    const confirmationId = `cf-conf-${crypto.randomUUID()}`;
    const now = Date.now();
    const expiresAt = now + CONFIRMATION_TTL_MS;

    const actionHash = crypto
        .createHash("sha256")
        .update(`${userId}:${toolName}:${JSON.stringify(canonicalArgs)}:${now}`)
        .digest("hex");

    const entry = {
        confirmationId,
        userId: String(userId),
        role,
        organizationId: organizationId ? String(organizationId) : null,
        toolName,
        canonicalArgs: Object.freeze({ ...canonicalArgs }),
        displayPayload: { ...displayPayload, confirmationId },
        summary,
        actionHash,
        createdAt: now,
        expiresAt,
        consumed: false,
        consumedAt: null
    };

    pendingConfirmations.set(confirmationId, entry);

    return {
        confirmationId,
        expiresAt,
        summary,
        displayPayload: entry.displayPayload
    };
};

/**
 * Atomically retrieves and consumes a pending confirmation.
 * Validates existence, authenticated user ownership, expiration, and non-consumed state.
 * Throws 409 if already consumed to prevent double booking.
 */
export const consumePendingConfirmation = (confirmationId, userId) => {
    if (!confirmationId) {
        throw new AppError(400, "confirmationId is required to execute confirmation.");
    }

    const entry = pendingConfirmations.get(confirmationId);
    if (!entry) {
        throw new AppError(404, "Confirmation action not found or has expired. Please initiate the request again.");
    }

    if (String(entry.userId) !== String(userId)) {
        throw new AppError(403, "You are not authorized to confirm this action.");
    }

    if (Date.now() > entry.expiresAt) {
        pendingConfirmations.delete(confirmationId);
        throw new AppError(410, "This confirmation request has expired (15-minute limit). Please request a new appointment slot.");
    }

    if (entry.consumed) {
        throw new AppError(409, "Booking has already been completed.");
    }

    // Atomically mark as consumed
    entry.consumed = true;
    entry.consumedAt = Date.now();

    return {
        toolName: entry.toolName,
        canonicalArgs: { ...entry.canonicalArgs },
        displayPayload: entry.displayPayload,
        summary: entry.summary,
        actionHash: entry.actionHash
    };
};

/**
 * Peek at a pending confirmation without consuming it (useful for validation).
 */
export const getPendingConfirmation = (confirmationId) => {
    return pendingConfirmations.get(confirmationId) || null;
};
