import express from "express";
import authentication from "../middleware/authentication.js";
import { getMyNotificationsController, markReadController } from "../controller/notification.js";

const router = express.Router();

router.get("/", authentication, getMyNotificationsController);
router.patch("/:id/read", authentication, markReadController);

export default router;
