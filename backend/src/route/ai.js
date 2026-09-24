import express from "express";
import authentication from "../middleware/authentication.js";
import authorization from "../middleware/authorization.js";
import { validateRequest } from "../middleware/validate.js";
import { aiGatewayRequestSchema } from "../validator/index.js";
import { processAIRequestController, getAIChatHistoryController, clearAIChatHistoryController } from "../controller/ai.js";

import { aiGatewayRateLimiter } from "../middleware/rateLimiter.js";

const router = express.Router();

const ALLOWED_AI_ROLES = ["super_admin", "admin", "doctor", "patient"];

router.post(
    "/gateway",
    authentication,
    authorization(...ALLOWED_AI_ROLES),
    aiGatewayRateLimiter,
    validateRequest(aiGatewayRequestSchema),
    processAIRequestController
);

router.get("/history", authentication, authorization(...ALLOWED_AI_ROLES), getAIChatHistoryController);
router.delete("/history", authentication, authorization(...ALLOWED_AI_ROLES), clearAIChatHistoryController);

export default router;
