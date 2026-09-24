import {
    validateAppointmentParticipant,
    sendMessageService,
    resolveConversation
} from "../service/chat.js";
import { getPatientById } from "../repository/patient.js";
import { getDoctorById } from "../repository/doctor.js";

export const registerChatSocketHandlers = (io, socket) => {
    // Automatically join user personal socket room on connection
    if (socket.user && socket.user.id) {
        socket.join(`user:${socket.user.id}`);
    }

    socket.on("join_appointment_chat", async (data) => {
        try {
            const appointmentId = data?.appointmentId;
            if (appointmentId) {
                const { patientId, doctorId } = await validateAppointmentParticipant(
                    appointmentId,
                    socket.user.id,
                    socket.user.role
                );
                const pairRoom = `chat:${patientId}:${doctorId}`;
                const apptRoom = `appointment:${appointmentId}`;
                socket.join(pairRoom);
                socket.join(apptRoom);
            }
            if (data?.conversationId || data?.targetId) {
                const conv = await resolveConversation({
                    currentUser: socket.user,
                    targetId: data?.targetId,
                    conversationId: data?.conversationId
                });
                if (conv) {
                    socket.join(`conversation:${conv._id}`);
                }
            }
        } catch (error) {
            socket.emit("chat_error", {
                success: false,
                message: error.message || "Unauthorized to access this appointment chat"
            });
        }
    });

    socket.on("join_conversation", async (data) => {
        try {
            if (data?.conversationId || data?.targetId) {
                const conv = await resolveConversation({
                    currentUser: socket.user,
                    targetId: data?.targetId,
                    conversationId: data?.conversationId
                });
                if (conv) {
                    socket.join(`conversation:${conv._id}`);
                }
            }
        } catch (err) {
            socket.emit("chat_error", {
                success: false,
                message: err.message || "Unauthorized to join conversation room"
            });
        }
    });

    socket.on("send_message", async (data) => {
        try {
            const targetId = data?.appointmentId || data?.conversationId || data?.recipientId || data?.targetId;
            const message = data?.message ? String(data.message).trim() : "";
            const attachment = data?.attachment || null;

            if (!message && !attachment) {
                return socket.emit("chat_error", {
                    success: false,
                    message: "Message text or attachment is required"
                });
            }

            const sendResult = await sendMessageService(
                targetId,
                socket.user.id,
                socket.user.role,
                { ...data, message, attachment },
                null
            );

            const savedMessage = sendResult.message;
            const updatedConversation = sendResult.conversation;

            let user1Id = null;
            let user2Id = null;

            if (updatedConversation.conversationType === "PATIENT_DOCTOR") {
                const patient = await getPatientById(updatedConversation.patientId);
                const doctor = await getDoctorById(updatedConversation.doctorId);
                user1Id = patient?.userId?._id ? patient.userId._id.toString() : (patient?.userId ? patient.userId.toString() : null);
                user2Id = doctor?.userId?._id ? doctor.userId._id.toString() : (doctor?.userId ? doctor.userId.toString() : null);
            } else if (
                updatedConversation.conversationType === "SUPER_ADMIN_ORGANIZATION_ADMIN" ||
                updatedConversation.conversationType === "SUPER_ADMIN_ORG_ADMIN"
            ) {
                user1Id = updatedConversation.superAdminId ? updatedConversation.superAdminId.toString() : null;
                user2Id = updatedConversation.organizationAdminId ? updatedConversation.organizationAdminId.toString() : null;
            } else if (
                updatedConversation.conversationType === "ORGANIZATION_ADMIN_DOCTOR" ||
                updatedConversation.conversationType === "ORG_ADMIN_DOCTOR"
            ) {
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
        } catch (error) {
            socket.emit("chat_error", {
                success: false,
                message: error.message || "Failed to send message"
            });
        }
    });

    socket.on("leave_appointment_chat", (data) => {
        if (data?.appointmentId) {
            socket.leave(`appointment:${data.appointmentId}`);
        }
        if (data?.conversationId) {
            socket.leave(`conversation:${data.conversationId}`);
        }
    });

    socket.on("leave_conversation", (data) => {
        if (data?.conversationId) {
            socket.leave(`conversation:${data.conversationId}`);
        }
    });

    socket.on("disconnect", () => {
        // Disconnect cleanup
    });
};

export default registerChatSocketHandlers;
