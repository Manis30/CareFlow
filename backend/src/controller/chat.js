import {
    sendMessageService,
    getMessagesService,
    getUserConversationsService,
    getOrCreateConversationService
} from "../service/chat.js";
import { getIO } from "../config/socket.js";
import { getPatientById } from "../repository/patient.js";
import { getDoctorById } from "../repository/doctor.js";

export const sendMessageController = async (req, res) => {
    const targetId = req.params.appointmentId || req.params.targetId || req.body.conversationId;
    const result = await sendMessageService(
        targetId,
        req.user.id,
        req.user.role,
        req.body,
        req.file
    );

    // Emit real-time Socket.IO events for HTTP message submissions
    try {
        const io = getIO();
        const savedMessage = result.message;
        const updatedConversation = result.conversation;

        if (updatedConversation && io) {
            let user1Id = null;
            let user2Id = null;

            if (updatedConversation.conversationType === "PATIENT_DOCTOR") {
                const patient = await getPatientById(updatedConversation.patientId);
                const doctor = await getDoctorById(updatedConversation.doctorId);
                user1Id = patient?.userId?._id ? patient.userId._id.toString() : (patient?.userId ? patient.userId.toString() : null);
                user2Id = doctor?.userId?._id ? doctor.userId._id.toString() : (doctor?.userId ? doctor.userId.toString() : null);
            } else if (updatedConversation.conversationType === "SUPER_ADMIN_ORGANIZATION_ADMIN" || updatedConversation.conversationType === "SUPER_ADMIN_ORG_ADMIN") {
                user1Id = updatedConversation.superAdminId ? updatedConversation.superAdminId.toString() : null;
                user2Id = updatedConversation.organizationAdminId ? updatedConversation.organizationAdminId.toString() : null;
            } else if (updatedConversation.conversationType === "ORGANIZATION_ADMIN_DOCTOR" || updatedConversation.conversationType === "ORG_ADMIN_DOCTOR") {
                user1Id = updatedConversation.organizationAdminId ? updatedConversation.organizationAdminId.toString() : null;
                const doctor = await getDoctorById(updatedConversation.doctorId);
                user2Id = doctor?.userId?._id ? doctor.userId._id.toString() : (doctor?.userId ? doctor.userId.toString() : null);
            }

            const conversationPayload = {
                conversationId: updatedConversation._id,
                conversationType: updatedConversation.conversationType,
                patientId: updatedConversation.patientId,
                doctorId: updatedConversation.doctorId,
                organizationAdminId: updatedConversation.organizationAdminId,
                superAdminId: updatedConversation.superAdminId,
                lastMessage: updatedConversation.lastMessage,
                lastMessageAt: updatedConversation.lastMessageAt
            };

            const convRoom = `conversation:${updatedConversation._id}`;

            io.to(convRoom).emit("message:new", savedMessage);
            io.to(convRoom).emit("new_message", savedMessage);
            io.to(convRoom).emit("conversation:updated", conversationPayload);

            if (user1Id) {
                io.to(`user:${user1Id}`).emit("message:new", savedMessage);
                io.to(`user:${user1Id}`).emit("new_message", savedMessage);
                io.to(`user:${user1Id}`).emit("conversation:updated", conversationPayload);
            }
            if (user2Id) {
                io.to(`user:${user2Id}`).emit("message:new", savedMessage);
                io.to(`user:${user2Id}`).emit("new_message", savedMessage);
                io.to(`user:${user2Id}`).emit("conversation:updated", conversationPayload);
            }
        }
    } catch (err) {
        // Socket emission failure is non-blocking
    }

    res.status(201).json({
        success: true,
        message: "Message sent successfully",
        data: result
    });
};

export const getMessagesController = async (req, res) => {
    const targetId = req.params.appointmentId || req.params.targetId;
    const result = await getMessagesService(
        targetId,
        req.user.id,
        req.user.role
    );
    res.status(200).json({
        success: true,
        message: "Messages fetched successfully",
        data: result
    });
};

export const getUserConversationsController = async (req, res) => {
    const result = await getUserConversationsService(
        req.user.id,
        req.user.role
    );
    res.status(200).json({
        success: true,
        message: "Conversations fetched successfully",
        data: result
    });
};

export const createOrGetConversationController = async (req, res) => {
    const { recipientId, conversationType } = req.body;
    const conversation = await getOrCreateConversationService(
        req.user.id,
        req.user.role,
        recipientId,
        conversationType
    );
    res.status(200).json({
        success: true,
        message: "Conversation resolved successfully",
        data: conversation
    });
};

