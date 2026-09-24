import { AppError } from "../middleware/errorHandler.js";
import { getAppointmentById } from "../repository/appointment.js";
import { getPatientByUserId } from "../repository/patient.js";
import { getDoctorByUserId } from "../repository/doctor.js";
import uploadToCloudinary from "../util/uploadToCloudinary.js";
import ChatModel from "../model/chat.js";
import ConversationModel from "../model/conversation.js";
import AppointmentModel from "../model/appointment.js";
import UserModel from "../model/user.js";
import DoctorModel from "../model/doctor.js";
import PatientModel from "../model/patient.js";
import OrganizationModel from "../model/organization.js";
import { createChatMessage } from "../repository/chat.js";
import { normalizeRole } from "../util/canonicalRole.js";

export const toIdString = (val) => {
    if (!val) return null;
    if (typeof val === "object") {
        if (val._id) return val._id.toString();
        if (val.id) return val.id.toString();
    }
    return val.toString();
};

export const canPatientChatWithDoctor = async (patientId, doctorId) => {
    if (!patientId || !doctorId) return false;
    const exists = await AppointmentModel.exists({
        patientId,
        doctorId,
        status: { $nin: ["cancelled"] }
    });
    return !!exists;
};

export const verifyConversationParticipant = async (conversation, userId, rawUserRole) => {
    const userRole = normalizeRole(rawUserRole);
    if (!conversation) throw new AppError(404, "Conversation not found.");

    if (userRole === "patient") {
        throw new AppError(403, "Patients are not authorized to participate in the chat system.");
    } else if (userRole === "doctor") {
        const doctor = await getDoctorByUserId(userId);
        if (!doctor || toIdString(conversation.doctorId) !== toIdString(doctor._id)) {
            throw new AppError(403, "Unauthorized to access this conversation.");
        }
        if (conversation.patientId || !conversation.organizationAdminId) {
            throw new AppError(403, "Doctor can chat ONLY with the Organization Admin of their own organization.");
        }
        const adminUser = await UserModel.findById(conversation.organizationAdminId);
        if (!adminUser || !doctor.organizationId || toIdString(doctor.organizationId) !== toIdString(adminUser.organizationId)) {
            throw new AppError(403, "Doctor can chat ONLY with the Organization Admin of their own organization.");
        }
        return { doctor };
    } else if (userRole === "organization_admin") {
        if (toIdString(conversation.organizationAdminId) !== toIdString(userId)) {
            throw new AppError(403, "Unauthorized to access this conversation.");
        }
        if (conversation.doctorId) {
            const adminUser = await UserModel.findById(userId);
            const docObj = await DoctorModel.findById(conversation.doctorId);
            if (!adminUser || !docObj || !adminUser.organizationId || toIdString(adminUser.organizationId) !== toIdString(docObj.organizationId)) {
                throw new AppError(403, "Messaging allowed only with Doctors of your own organization.");
            }
        }
    } else if (userRole === "super_admin") {
        if (toIdString(conversation.superAdminId) !== toIdString(userId)) {
            throw new AppError(403, "Unauthorized to access this conversation.");
        }
        if (!conversation.organizationAdminId) {
            throw new AppError(403, "Super Admin can chat ONLY with valid Organization Admins.");
        }
        const oUser = await UserModel.findById(conversation.organizationAdminId).populate("organizationId");
        const oRole = normalizeRole(oUser?.role);
        if (!oUser || oRole !== "organization_admin" || !oUser.organizationId) {
            throw new AppError(403, "Super Admin can chat ONLY with valid Organization Admins.");
        }
    } else {
        throw new AppError(403, "Unauthorized user role.");
    }
};

export const validateAppointmentParticipant = async (appointmentId, userId, rawUserRole) => {
    const userRole = normalizeRole(rawUserRole);
    const appointment = await getAppointmentById(appointmentId);
    if (!appointment) {
        throw new AppError(404, "Appointment not found");
    }

    const patientObjId = appointment.patientId?._id ? appointment.patientId._id : appointment.patientId;
    const doctorObjId = appointment.doctorId?._id ? appointment.doctorId._id : appointment.doctorId;

    if (userRole === "patient") {
        const patient = await getPatientByUserId(userId);
        if (!patient || patientObjId.toString() !== patient._id.toString()) {
            throw new AppError(403, "You are not allowed to access this conversation");
        }
    } else if (userRole === "doctor") {
        const doctor = await getDoctorByUserId(userId);
        if (!doctor || doctorObjId.toString() !== doctor._id.toString()) {
            throw new AppError(403, "You are not allowed to access this conversation");
        }
    } else {
        throw new AppError(403, "You are not allowed to access this conversation");
    }

    return { appointment, patientId: patientObjId, doctorId: doctorObjId };
};

/**
 * Central Conversation Resolver:
 * Given currentUser and any lookup target (conversationId, appointmentId, or participant User/Doctor/Patient ID),
 * resolves the exact same canonical ConversationModel document.
 */
export const resolveConversation = async ({
    currentUser,
    targetId = null,
    conversationId = null,
    conversationType = null,
    recipientId = null
}) => {
    const userRole = normalizeRole(currentUser.role || currentUser.userRole);
    const userId = currentUser.id || currentUser._id;
    const lookupId = conversationId || targetId || recipientId;

    if (!lookupId) return null;
    const lookupStr = String(lookupId).trim();
    if (lookupStr.length !== 24) return null;

    // 1. Direct conversationId match
    let conv = await ConversationModel.findById(lookupStr).catch(() => null);
    if (conv) {
        await verifyConversationParticipant(conv, userId, userRole);
        return conv;
    }

    // 2. Appointment ID match
    const appt = await AppointmentModel.findById(lookupStr).catch(() => null);
    if (appt) {
        const pId = toIdString(appt.patientId);
        const dId = toIdString(appt.doctorId);
        conv = await ConversationModel.findOne({
            conversationType: "PATIENT_DOCTOR",
            patientId: pId,
            doctorId: dId
        });
        if (conv) {
            await verifyConversationParticipant(conv, userId, userRole);
            return conv;
        }
    }

    // 3. Resolve participant pair by user role & target ID
    if (userRole === "patient") {
        throw new AppError(403, "Patients are not authorized to participate in the chat system.");
    }

    if (userRole === "doctor") {
        const doctor = await getDoctorByUserId(userId);
        if (!doctor) throw new AppError(403, "Doctor profile not found.");

        const isPatient = await PatientModel.exists({ $or: [{ _id: lookupStr }, { userId: lookupStr }] });
        if (isPatient) {
            throw new AppError(403, "Doctor can chat ONLY with the Organization Admin of their own organization.");
        }

        const orgAdminUser = await UserModel.findOne({
            _id: lookupStr,
            role: { $in: ["organization_admin", "admin", "org_admin"] }
        }).catch(() => null);

        if (orgAdminUser) {
            if (!doctor.organizationId || toIdString(doctor.organizationId) !== toIdString(orgAdminUser.organizationId)) {
                throw new AppError(403, "Doctor can chat ONLY with the Organization Admin of their own organization.");
            }

            conv = await ConversationModel.findOne({
                conversationType: { $in: ["ORGANIZATION_ADMIN_DOCTOR", "ORG_ADMIN_DOCTOR"] },
                organizationAdminId: orgAdminUser._id,
                doctorId: doctor._id
            });
            return conv;
        }

        throw new AppError(403, "Doctor can chat ONLY with the Organization Admin of their own organization.");
    }

    if (userRole === "organization_admin") {
        const adminUser = await UserModel.findById(userId);
        if (!adminUser) throw new AppError(403, "Organization Admin not found.");

        // Check if target is Doctor (by Doctor _id OR Doctor userId)
        let docObj = await DoctorModel.findById(lookupStr).catch(() => null);
        if (!docObj) {
            docObj = await DoctorModel.findOne({ userId: lookupStr }).catch(() => null);
        }

        if (docObj) {
            if (!adminUser.organizationId || toIdString(adminUser.organizationId) !== toIdString(docObj.organizationId)) {
                throw new AppError(403, "Messaging allowed only with Doctors of your own organization.");
            }

            conv = await ConversationModel.findOne({
                conversationType: { $in: ["ORGANIZATION_ADMIN_DOCTOR", "ORG_ADMIN_DOCTOR"] },
                organizationAdminId: adminUser._id,
                doctorId: docObj._id
            });
            return conv;
        }

        const superAdminUser = await UserModel.findOne({
            _id: lookupStr,
            role: { $in: ["super_admin", "superadmin"] }
        }).catch(() => null);

        if (superAdminUser) {
            conv = await ConversationModel.findOne({
                conversationType: { $in: ["SUPER_ADMIN_ORGANIZATION_ADMIN", "SUPER_ADMIN_ORG_ADMIN"] },
                superAdminId: superAdminUser._id,
                organizationAdminId: adminUser._id
            });
            return conv;
        }
    }

    if (userRole === "super_admin") {
        const isDoc = await DoctorModel.exists({ $or: [{ _id: lookupStr }, { userId: lookupStr }] });
        if (isDoc) {
            throw new AppError(403, "Super Admin can chat ONLY with valid Organization Admins.");
        }

        const isPatient = await PatientModel.exists({ $or: [{ _id: lookupStr }, { userId: lookupStr }] });
        if (isPatient) {
            throw new AppError(403, "Super Admin can chat ONLY with valid Organization Admins.");
        }

        const orgAdminUser = await UserModel.findOne({
            _id: lookupStr,
            role: { $in: ["organization_admin", "admin", "org_admin"] },
            organizationId: { $ne: null }
        }).populate("organizationId").catch(() => null);

        if (!orgAdminUser || !orgAdminUser.organizationId) {
            throw new AppError(403, "Super Admin can chat ONLY with valid Organization Admins.");
        }

        conv = await ConversationModel.findOne({
            conversationType: { $in: ["SUPER_ADMIN_ORGANIZATION_ADMIN", "SUPER_ADMIN_ORG_ADMIN"] },
            superAdminId: userId,
            organizationAdminId: orgAdminUser._id
        });
        return conv;
    }

    return null;
};

/**
 * Centralized Service Helper to Find or Safely Create a Conversation with unique indexes & atomic upsert.
 */
export const getOrCreateConversation = async ({
    conversationType = "PATIENT_DOCTOR",
    patientId = null,
    doctorId = null,
    organizationAdminId = null,
    superAdminId = null,
    organizationId = null
}) => {
    let normType = conversationType;
    if (conversationType === "SUPER_ADMIN_ORGANIZATION_ADMIN" || conversationType === "SUPER_ADMIN_ORG_ADMIN") {
        normType = "SUPER_ADMIN_ORGANIZATION_ADMIN";
    } else if (conversationType === "ORGANIZATION_ADMIN_DOCTOR" || conversationType === "ORG_ADMIN_DOCTOR") {
        normType = "ORGANIZATION_ADMIN_DOCTOR";
    }

    let query = { conversationType: { $in: [normType, conversationType] } };
    let setOnInsertData = { conversationType: normType, lastMessageAt: null };

    if (normType === "PATIENT_DOCTOR") {
        if (!patientId || !doctorId) {
            throw new AppError(400, "Patient ID and Doctor ID are required for Patient-Doctor chat.");
        }
        const hasAppt = await canPatientChatWithDoctor(patientId, doctorId);
        if (!hasAppt) {
            throw new AppError(403, "Messaging authorized only for patients and doctors with an appointment relationship.");
        }
        query = { conversationType: "PATIENT_DOCTOR", patientId, doctorId };
        setOnInsertData.patientId = patientId;
        setOnInsertData.doctorId = doctorId;
    } else if (normType === "SUPER_ADMIN_ORGANIZATION_ADMIN") {
        if (!superAdminId || !organizationAdminId) {
            throw new AppError(400, "Super Admin ID and Organization Admin ID are required.");
        }
        const sUser = await UserModel.findOne({ _id: superAdminId, role: { $in: ["super_admin", "superadmin"] } });
        const oUser = await UserModel.findOne({ _id: organizationAdminId, role: { $in: ["organization_admin", "admin", "org_admin"] } });
        if (!sUser || !oUser) {
            throw new AppError(403, "Unauthorized Super Admin or Organization Admin user.");
        }
        query = {
            conversationType: { $in: ["SUPER_ADMIN_ORGANIZATION_ADMIN", "SUPER_ADMIN_ORG_ADMIN"] },
            superAdminId,
            organizationAdminId
        };
        setOnInsertData.superAdminId = superAdminId;
        setOnInsertData.organizationAdminId = organizationAdminId;
        setOnInsertData.organizationId = oUser.organizationId || organizationId;
    } else if (normType === "ORGANIZATION_ADMIN_DOCTOR") {
        if (!organizationAdminId || !doctorId) {
            throw new AppError(400, "Organization Admin ID and Doctor ID are required.");
        }
        const oUser = await UserModel.findOne({ _id: organizationAdminId, role: { $in: ["organization_admin", "admin", "org_admin"] } });
        const docObj = await DoctorModel.findById(doctorId);
        if (!oUser || !docObj) {
            throw new AppError(403, "Invalid Organization Admin or Doctor.");
        }

        const adminOrgId = toIdString(oUser.organizationId);
        const docOrgId = toIdString(docObj.organizationId);

        if (!adminOrgId || !docOrgId || adminOrgId !== docOrgId) {
            throw new AppError(403, "Cross-organization messaging between Organization Admin and Doctor is strictly forbidden.");
        }

        query = {
            conversationType: { $in: ["ORGANIZATION_ADMIN_DOCTOR", "ORG_ADMIN_DOCTOR"] },
            organizationAdminId,
            doctorId
        };
        setOnInsertData.organizationAdminId = organizationAdminId;
        setOnInsertData.doctorId = doctorId;
        setOnInsertData.organizationId = docObj.organizationId;
    } else {
        throw new AppError(400, "Invalid conversation type.");
    }

    let conversation;
    try {
        conversation = await ConversationModel.findOneAndUpdate(
            query,
            { $setOnInsert: setOnInsertData },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );
    } catch (err) {
        conversation = await ConversationModel.findOne(query);
    }

    return conversation;
};

/**
 * Legacy chat migration helper: backfills conversationId into existing ChatModel messages
 */
export const migrateLegacyChats = async () => {
    try {
        await ConversationModel.updateMany(
            {
                patientId: { $ne: null },
                doctorId: { $ne: null },
                $or: [
                    { conversationType: { $exists: false } },
                    { conversationType: null }
                ]
            },
            {
                $set: { conversationType: "PATIENT_DOCTOR" }
            }
        );

        const legacyMsgs = await ChatModel.find({
            $or: [{ conversationId: { $exists: false } }, { conversationId: null }]
        });

        if (legacyMsgs.length === 0) return;

        for (const msg of legacyMsgs) {
            let pId = msg.patientId;
            let dId = msg.doctorId;

            if (!pId || !dId) {
                if (!msg.appointmentId) continue;
                const appt = await AppointmentModel.findById(msg.appointmentId);
                if (!appt) continue;
                pId = appt.patientId;
                dId = appt.doctorId;
            }

            if (!pId || !dId) continue;

            let conv;
            try {
                conv = await ConversationModel.findOneAndUpdate(
                    { patientId: pId, doctorId: dId },
                    { $setOnInsert: { conversationType: "PATIENT_DOCTOR", patientId: pId, doctorId: dId } },
                    { new: true, upsert: true, setDefaultsOnInsert: true }
                );
            } catch (e) {
                conv = await ConversationModel.findOne({ patientId: pId, doctorId: dId });
            }

            if (conv) {
                msg.conversationId = conv._id;
                msg.patientId = pId;
                msg.doctorId = dId;
                await msg.save();

                if (!conv.lastMessageAt || new Date(msg.createdAt) > new Date(conv.lastMessageAt)) {
                    conv.lastMessage = {
                        messageId: msg._id,
                        content: msg.message || (msg.attachment?.url ? "Attachment file" : "Message"),
                        type: msg.attachment?.url ? "ATTACHMENT" : "TEXT",
                        senderId: msg.senderId,
                        sentAt: msg.createdAt
                    };
                    conv.lastMessageAt = msg.createdAt;
                    await conv.save();
                }
            }
        }
    } catch (err) {
        console.error("Legacy chat migration error:", err);
    }
};

export const sendMessageService = async (targetId, userId, rawUserRole, bodyData, file) => {
    const userRole = normalizeRole(rawUserRole);

    if (!bodyData.message && !file && !bodyData.attachment) {
        throw new AppError(400, "Message text or attachment is required");
    }

    const currentUser = { id: userId, role: userRole };

    // 1. Resolve existing conversation via central resolver
    let conversation = await resolveConversation({
        currentUser,
        targetId,
        conversationId: bodyData.conversationId,
        conversationType: bodyData.conversationType,
        recipientId: bodyData.recipientId
    });

    let appointmentId = bodyData.appointmentId || null;

    // 2. If no conversation exists yet, create it atomically (first message)
    if (!conversation) {
        const recipient = bodyData.recipientId || targetId;
        if (!recipient) {
            throw new AppError(400, "Recipient ID or Target ID is required to start a conversation.");
        }

        if (userRole === "patient") {
            const patient = await getPatientByUserId(userId);
            if (!patient) throw new AppError(403, "Patient profile not found.");

            let doctor = await DoctorModel.findById(recipient).catch(() => null);
            if (!doctor) doctor = await DoctorModel.findOne({ userId: recipient }).catch(() => null);
            if (!doctor) throw new AppError(404, "Target doctor not found.");

            conversation = await getOrCreateConversation({
                conversationType: "PATIENT_DOCTOR",
                patientId: patient._id,
                doctorId: doctor._id
            });
        } else if (userRole === "doctor") {
            const doctor = await getDoctorByUserId(userId);
            if (!doctor) throw new AppError(403, "Doctor profile not found.");

            let patient = await PatientModel.findById(recipient).catch(() => null);
            if (!patient) patient = await PatientModel.findOne({ userId: recipient }).catch(() => null);

            if (patient) {
                conversation = await getOrCreateConversation({
                    conversationType: "PATIENT_DOCTOR",
                    patientId: patient._id,
                    doctorId: doctor._id
                });
            } else {
                const orgAdmin = await UserModel.findOne({ _id: recipient, role: { $in: ["organization_admin", "admin", "org_admin"] } });
                if (orgAdmin) {
                    conversation = await getOrCreateConversation({
                        conversationType: "ORGANIZATION_ADMIN_DOCTOR",
                        organizationAdminId: orgAdmin._id,
                        doctorId: doctor._id
                    });
                }
            }
        } else if (userRole === "organization_admin") {
            let doctor = await DoctorModel.findById(recipient).catch(() => null);
            if (!doctor) doctor = await DoctorModel.findOne({ userId: recipient }).catch(() => null);

            if (doctor) {
                conversation = await getOrCreateConversation({
                    conversationType: "ORGANIZATION_ADMIN_DOCTOR",
                    organizationAdminId: userId,
                    doctorId: doctor._id
                });
            } else {
                const superAdmin = await UserModel.findOne({ _id: recipient, role: { $in: ["super_admin", "superadmin"] } });
                if (superAdmin) {
                    conversation = await getOrCreateConversation({
                        conversationType: "SUPER_ADMIN_ORGANIZATION_ADMIN",
                        superAdminId: superAdmin._id,
                        organizationAdminId: userId
                    });
                }
            }
        } else if (userRole === "super_admin") {
            const orgAdmin = await UserModel.findOne({ _id: recipient, role: { $in: ["organization_admin", "admin", "org_admin"] } });
            if (orgAdmin) {
                conversation = await getOrCreateConversation({
                    conversationType: "SUPER_ADMIN_ORGANIZATION_ADMIN",
                    superAdminId: userId,
                    organizationAdminId: orgAdmin._id
                });
            }
        }
    }

    if (!conversation) {
        throw new AppError(404, "Target conversation not found or unauthorized.");
    }

    // Verify authorization
    await verifyConversationParticipant(conversation, userId, userRole);

    let attachment = { url: null, publicId: null };
    if (file) {
        const uploadedFile = await uploadToCloudinary(file.buffer, "careflow/chat-attachments");
        attachment = { url: uploadedFile.url, publicId: uploadedFile.publicId };
    } else if (bodyData.attachment) {
        attachment = bodyData.attachment;
    }

    const messageData = {
        conversationId: conversation._id,
        patientId: conversation.patientId || null,
        doctorId: conversation.doctorId || null,
        appointmentId: appointmentId || conversation.latestApptId || null,
        senderId: userId,
        senderRole: userRole,
        message: bodyData.message || "",
        attachment
    };

    const savedMessage = await createChatMessage(messageData);

    const lastMsgContent = bodyData.message || (file || bodyData.attachment ? "Attachment file" : "Message");
    const lastMsgType = file || bodyData.attachment ? "ATTACHMENT" : "TEXT";

    const updatedConv = await ConversationModel.findByIdAndUpdate(
        conversation._id,
        {
            $set: {
                lastMessage: {
                    messageId: savedMessage._id,
                    content: lastMsgContent,
                    type: lastMsgType,
                    senderId: userId,
                    sentAt: savedMessage.createdAt
                },
                lastMessageAt: savedMessage.createdAt
            }
        },
        { new: true }
    );

    return {
        message: savedMessage,
        conversation: updatedConv
    };
};

export const getMessagesService = async (targetId, userId, rawUserRole) => {
    const userRole = normalizeRole(rawUserRole);
    await migrateLegacyChats();

    const currentUser = { id: userId, role: userRole };
    const conversation = await resolveConversation({
        currentUser,
        targetId
    });

    if (!conversation) {
        return [];
    }

    await verifyConversationParticipant(conversation, userId, userRole);

    return await ChatModel.find({ conversationId: conversation._id })
        .populate("senderId", "name email role profileImage")
        .sort({ createdAt: 1 });
};

export const getUserConversationsService = async (userId, rawUserRole) => {
    const userRole = normalizeRole(rawUserRole);
    await migrateLegacyChats();

    // 1. PATIENT ROLE
    if (userRole === "patient") {
        return [];
    }

    // 2. DOCTOR ROLE
    if (userRole === "doctor") {
        const doctor = await getDoctorByUserId(userId);
        if (!doctor || !doctor.organizationId) return [];

        const orgAdmin = await UserModel.findOne({
            organizationId: doctor.organizationId,
            role: { $in: ["organization_admin", "admin", "org_admin"] }
        }).populate("organizationId", "name organizationLogo logo address");

        if (!orgAdmin) return [];

        const adminId = toIdString(orgAdmin._id);
        const key = `admin:${adminId}`;

        const conv = await ConversationModel.findOne({
            conversationType: { $in: ["ORGANIZATION_ADMIN_DOCTOR", "ORG_ADMIN_DOCTOR"] },
            organizationAdminId: orgAdmin._id,
            doctorId: doctor._id
        });

        return [{
            _id: conv?._id || null,
            conversationId: conv?._id || null,
            conversationType: "ORGANIZATION_ADMIN_DOCTOR",
            key,
            category: "ORGANIZATION CHAT",
            organizationAdminId: adminId,
            doctorId: doctor._id.toString(),
            adminObj: orgAdmin,
            lastMessageText: conv?.lastMessage?.content || "No messages yet",
            lastMessageAt: conv?.lastMessageAt ? new Date(conv.lastMessageAt).getTime() : 0,
            hasMessages: !!conv?.lastMessageAt,
            lastMessage: conv?.lastMessage || null
        }];
    }

    // 3. ORGANIZATION ADMIN ROLE
    if (userRole === "organization_admin") {
        const adminUser = await UserModel.findById(userId);
        if (!adminUser) return [];

        const conversations = await ConversationModel.find({ organizationAdminId: userId })
            .populate({ path: "doctorId", populate: { path: "userId", select: "name email phone profileImage specialization" } })
            .populate("superAdminId", "name email phone profileImage")
            .sort({ lastMessageAt: -1 });

        const convMap = new Map();

        for (const conv of conversations) {
            if ((conv.conversationType === "SUPER_ADMIN_ORGANIZATION_ADMIN" || conv.conversationType === "SUPER_ADMIN_ORG_ADMIN") && conv.superAdminId) {
                const sId = toIdString(conv.superAdminId);
                if (!sId) continue;

                const key = `superadmin:${sId}`;
                convMap.set(key, {
                    _id: conv._id,
                    conversationId: conv._id,
                    conversationType: "SUPER_ADMIN_ORGANIZATION_ADMIN",
                    key,
                    category: "PLATFORM ADMINISTRATION",
                    superAdminId: sId,
                    organizationAdminId: userId,
                    superAdminObj: conv.superAdminId,
                    lastMessageText: conv.lastMessage?.content || "No messages yet",
                    lastMessageAt: conv.lastMessageAt ? new Date(conv.lastMessageAt).getTime() : 0,
                    hasMessages: !!conv.lastMessageAt,
                    lastMessage: conv.lastMessage
                });
            } else if ((conv.conversationType === "ORGANIZATION_ADMIN_DOCTOR" || conv.conversationType === "ORG_ADMIN_DOCTOR") && conv.doctorId) {
                const dId = toIdString(conv.doctorId);
                if (!dId) continue;

                const key = `doctor:${dId}`;
                convMap.set(key, {
                    _id: conv._id,
                    conversationId: conv._id,
                    conversationType: "ORGANIZATION_ADMIN_DOCTOR",
                    key,
                    category: "ORGANIZATION DOCTORS",
                    doctorId: dId,
                    organizationAdminId: userId,
                    doctorObj: conv.doctorId,
                    lastMessageText: conv.lastMessage?.content || "No messages yet",
                    lastMessageAt: conv.lastMessageAt ? new Date(conv.lastMessageAt).getTime() : 0,
                    hasMessages: !!conv.lastMessageAt,
                    lastMessage: conv.lastMessage
                });
            }
        }

        // Add Super Admin contact
        const superAdmin = await UserModel.findOne({ role: { $in: ["super_admin", "superadmin"] } });
        if (superAdmin) {
            const sId = superAdmin._id.toString();
            const key = `superadmin:${sId}`;
            if (!convMap.has(key)) {
                convMap.set(key, {
                    conversationId: null,
                    conversationType: "SUPER_ADMIN_ORGANIZATION_ADMIN",
                    key,
                    category: "PLATFORM ADMINISTRATION",
                    superAdminId: sId,
                    organizationAdminId: userId,
                    superAdminObj: superAdmin,
                    lastMessageText: "No messages yet",
                    lastMessageAt: 0,
                    hasMessages: false,
                    lastMessage: null
                });
            }
        }

        // Add Doctors belonging to Admin's Organization ONLY
        if (adminUser.organizationId) {
            const doctors = await DoctorModel.find({ organizationId: adminUser.organizationId })
                .populate("userId", "name email phone profileImage");
            for (const doc of doctors) {
                const dId = doc._id.toString();
                const key = `doctor:${dId}`;
                if (!convMap.has(key)) {
                    convMap.set(key, {
                        conversationId: null,
                        conversationType: "ORGANIZATION_ADMIN_DOCTOR",
                        key,
                        category: "ORGANIZATION DOCTORS",
                        doctorId: dId,
                        organizationAdminId: userId,
                        doctorObj: doc,
                        lastMessageText: "No messages yet",
                        lastMessageAt: 0,
                        hasMessages: false,
                        lastMessage: null
                    });
                }
            }
        }

        const list = Array.from(convMap.values());
        list.sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));
        return list;
    }

    // 4. SUPER ADMIN ROLE
    if (userRole === "super_admin") {
        const orgAdmins = await UserModel.find({
            role: { $in: ["organization_admin", "admin", "org_admin"] },
            organizationId: { $ne: null },
            isActive: { $ne: false }
        }).populate("organizationId", "name organizationLogo logo address");

        const validAdminMap = new Map();
        for (const oAdmin of orgAdmins) {
            const oId = toIdString(oAdmin._id);
            // Must have valid populated organizationId and not be self
            if (oId && oId !== toIdString(userId) && oAdmin.organizationId && oAdmin.organizationId._id) {
                validAdminMap.set(oId, oAdmin);
            }
        }

        const conversations = await ConversationModel.find({
            superAdminId: userId,
            conversationType: { $in: ["SUPER_ADMIN_ORGANIZATION_ADMIN", "SUPER_ADMIN_ORG_ADMIN"] }
        }).sort({ lastMessageAt: -1 });

        const convMap = new Map();

        for (const conv of conversations) {
            const oId = toIdString(conv.organizationAdminId);
            if (oId && validAdminMap.has(oId)) {
                const adminObj = validAdminMap.get(oId);
                const key = `orgadmin:${oId}`;
                convMap.set(key, {
                    _id: conv._id,
                    conversationId: conv._id,
                    conversationType: "SUPER_ADMIN_ORGANIZATION_ADMIN",
                    key,
                    category: "Organization Admins",
                    superAdminId: userId,
                    organizationAdminId: oId,
                    adminObj,
                    lastMessageText: conv.lastMessage?.content || "No messages yet",
                    lastMessageAt: conv.lastMessageAt ? new Date(conv.lastMessageAt).getTime() : 0,
                    hasMessages: !!conv.lastMessageAt,
                    lastMessage: conv.lastMessage
                });
            }
        }

        for (const [oId, oAdmin] of validAdminMap.entries()) {
            const key = `orgadmin:${oId}`;
            if (!convMap.has(key)) {
                convMap.set(key, {
                    conversationId: null,
                    conversationType: "SUPER_ADMIN_ORGANIZATION_ADMIN",
                    key,
                    category: "Organization Admins",
                    superAdminId: userId,
                    organizationAdminId: oId,
                    adminObj: oAdmin,
                    lastMessageText: "No messages yet",
                    lastMessageAt: 0,
                    hasMessages: false,
                    lastMessage: null
                });
            }
        }

        const list = Array.from(convMap.values());
        list.sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));
        return list;
    }

    return [];
};

export const getOrCreateConversationService = async (userId, rawUserRole, recipientId, conversationType) => {
    const userRole = normalizeRole(rawUserRole);
    if (!recipientId) {
        throw new AppError(400, "Recipient ID is required to resolve a conversation.");
    }

    if (userRole === "super_admin") {
        const orgAdmin = await UserModel.findOne({ _id: recipientId, role: { $in: ["organization_admin", "admin", "org_admin"] } });
        if (!orgAdmin) throw new AppError(404, "Target Organization Admin user not found.");
        return await getOrCreateConversation({
            conversationType: "SUPER_ADMIN_ORGANIZATION_ADMIN",
            superAdminId: userId,
            organizationAdminId: orgAdmin._id
        });
    }

    if (userRole === "organization_admin") {
        let doctor = await DoctorModel.findById(recipientId).catch(() => null);
        if (!doctor) doctor = await DoctorModel.findOne({ userId: recipientId }).catch(() => null);
        if (doctor) {
            return await getOrCreateConversation({
                conversationType: "ORGANIZATION_ADMIN_DOCTOR",
                organizationAdminId: userId,
                doctorId: doctor._id
            });
        }
        const superAdmin = await UserModel.findOne({ _id: recipientId, role: { $in: ["super_admin", "superadmin"] } });
        if (superAdmin) {
            return await getOrCreateConversation({
                conversationType: "SUPER_ADMIN_ORGANIZATION_ADMIN",
                superAdminId: superAdmin._id,
                organizationAdminId: userId
            });
        }
    }

    throw new AppError(400, "Unable to resolve conversation for this user role.");
};

