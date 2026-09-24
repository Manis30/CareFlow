import { Router } from "express";
import authentication from "../middleware/authentication.js";
import authorization from "../middleware/authorization.js";
import upload from "../middleware/upload.js";
import {
    sendMessageController,
    getMessagesController,
    getUserConversationsController,
    createOrGetConversationController
} from "../controller/chat.js";

const route = Router();

route.use(authentication);

route.get(
    "/conversations",
    authorization("doctor", "admin", "superadmin"),
    getUserConversationsController
);

route.post(
    "/conversation/create",
    authorization("doctor", "admin", "superadmin"),
    createOrGetConversationController
);

route.post(
    "/conversations/direct",
    authorization("doctor", "admin", "superadmin"),
    createOrGetConversationController
);

route.post(
    "/message",
    authorization("doctor", "admin", "superadmin"),
    upload.single("attachment"),
    sendMessageController
);

route.post(
    "/appointment/:appointmentId/message",
    authorization("doctor", "admin", "superadmin"),
    upload.single("attachment"),
    sendMessageController
);

route.get(
    "/appointment/:appointmentId/messages",
    authorization("doctor", "admin", "superadmin"),
    getMessagesController
);

route.get(
    "/conversation/:targetId/messages",
    authorization("doctor", "admin", "superadmin"),
    getMessagesController
);

export default route;
