import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import UserModel from "../src/model/user.js";
import DoctorModel from "../src/model/doctor.js";
import PatientModel from "../src/model/patient.js";
import AppointmentModel from "../src/model/appointment.js";
import { getDoctorTodayAppointmentsService } from "../src/service/appointment.js";
import { runOrchestratedWorkflow } from "../src/service/ai/orchestrator/agentOrchestrator.js";
import { getUserConversationsService, sendMessageService } from "../src/service/chat.js";

async function runSmoke() {
    await mongoose.connect(process.env.DB_URL);
    console.log("Connected to MongoDB.");

    // Retrieve test users
    const docUser = await UserModel.findOne({ name: /Senthil Kumar/i }).lean();
    const doctor = await DoctorModel.findOne({ userId: docUser._id }).lean();
    const patientUser = await UserModel.findOne({ role: "patient" }).lean();
    const adminUser = await UserModel.findOne({ role: { $in: ["admin", "organization_admin"] }, organizationId: doctor.organizationId }).lean();
    const superAdminUser = await UserModel.findOne({ role: "super_admin" }).lean();

    console.log("Doctor User ID:", docUser._id);
    console.log("Doctor ID:", doctor._id);

    // =========================================================================
    // CHECK 1: DATABASE
    // Verify actual today's appointment count for the authenticated doctor.
    // =========================================================================
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dbTodayAppts = await AppointmentModel.find({
        doctorId: doctor._id,
        appointmentDate: { $gte: today, $lt: tomorrow }
    });
    console.log("\n--- CHECK 1: DATABASE ---");
    console.log("Real DB today appointments count:", dbTodayAppts.length);
    const dbCheckPass = dbTodayAppts.length === 1;
    console.log("CHECK 1 Result:", dbCheckPass ? "PASS" : "FAIL");

    // =========================================================================
    // CHECK 3: AI TODAY SCHEDULE
    // "What is my schedule today?" AI count must equal UI/database (1)
    // =========================================================================
    console.log("\n--- CHECK 3: AI TODAY SCHEDULE ---");
    const docReqUser = { id: String(docUser._id), _id: docUser._id, role: "doctor", organizationId: String(doctor.organizationId) };
    const todayAiRes = await runOrchestratedWorkflow(
        docReqUser,
        { message: "What can you tell me about Today Schedule?" }
    );
    console.log("Today AI Response:\n", todayAiRes.aiResponse);
    const aiTodayPass = !todayAiRes.aiResponse.includes("42") && 
        (todayAiRes.aiResponse.includes("1") || todayAiRes.aiResponse.includes("Jaganathan") || todayAiRes.aiResponse.includes("consultation today"));
    console.log("CHECK 3 Result:", aiTodayPass ? "PASS" : "FAIL");

    // =========================================================================
    // CHECK 4: CHANNEL FILTER CONTRACT
    // All Channels, Online, In-Clinic
    // =========================================================================
    console.log("\n--- CHECK 4: CHANNEL FILTER CONTRACT ---");
    const allAppts = await getDoctorTodayAppointmentsService(docUser._id);
    const onlineAppts = allAppts.filter(a => a.consultationType === "online");
    const inClinicAppts = allAppts.filter(a => a.consultationType === "offline");
    console.log("All Channels count:", allAppts.length);
    console.log("Online count:", onlineAppts.length);
    console.log("In-Clinic count:", inClinicAppts.length);
    const channelPass = allAppts.length === 1 && onlineAppts.length === 0 && inClinicAppts.length === 1;
    console.log("CHECK 4 Result:", channelPass ? "PASS" : "FAIL");

    // =========================================================================
    // CHECK 5: CLINICAL NOTES RESOLUTION
    // "Draft clinical notes for consultation" must NOT ask for appointmentId
    // =========================================================================
    console.log("\n--- CHECK 5: CLINICAL NOTES RESOLUTION ---");
    const notesAiRes = await runOrchestratedWorkflow(
        docReqUser,
        { message: "Draft clinical notes for consultation" }
    );
    console.log("Clinical Notes AI Response:\n", notesAiRes.aiResponse);
    const notesPass = !notesAiRes.aiResponse.includes("I need appointmentId") &&
        !notesAiRes.aiResponse.includes("Please provide appointmentId") &&
        (notesAiRes.aiResponse.includes("SOAP CLINICAL NOTE DRAFT") || notesAiRes.aiResponse.includes("I found these consultations"));
    console.log("CHECK 5 Result:", notesPass ? "PASS" : "FAIL");

    // =========================================================================
    // CHECK 6: PATIENT DISCOVERY
    // "What can you tell me about Patient Records?" -> numbered authorized patients
    // =========================================================================
    console.log("\n--- CHECK 6: PATIENT DISCOVERY ---");
    const patDiscRes = await runOrchestratedWorkflow(
        docReqUser,
        { message: "What can you tell me about Patient Records?" }
    );
    console.log("Patient Discovery AI Response:\n", patDiscRes.aiResponse);
    const patDiscPass = (patDiscRes.aiResponse.includes("1.") || patDiscRes.aiResponse.includes("access to") || patDiscRes.aiResponse.includes("available to you")) &&
        !patDiscRes.aiResponse.includes("patientId");
    console.log("CHECK 6 Result:", patDiscPass ? "PASS" : "FAIL");

    // =========================================================================
    // CHECK 7: SHARED RECORDS & NUMERIC CONTEXT
    // Select patient -> "Show his shared medical records" -> "2"
    // =========================================================================
    console.log("\n--- CHECK 7: SHARED RECORDS SELECTION ---");
    const targetPatient = patDiscRes.agentState?.authorizedPatients?.[0];
    let sharedRecPass = false;
    if (targetPatient) {
        console.log("Selecting patient:", targetPatient.name);
        const selPatRes = await runOrchestratedWorkflow(
            docReqUser,
            { message: targetPatient.name, agentState: patDiscRes.agentState }
        );
        console.log("Select Patient Response:\n", selPatRes.aiResponse);

        const sharedListRes = await runOrchestratedWorkflow(
            docReqUser,
            { message: "Show his shared medical records.", agentState: selPatRes.agentState }
        );
        console.log("Shared Records List Response:\n", sharedListRes.aiResponse);

        if (sharedListRes.agentState?.sharedRecords?.length >= 2) {
            const secondRecRes = await runOrchestratedWorkflow(
                docReqUser,
                { message: "2", agentState: sharedListRes.agentState }
            );
            console.log("Record '2' Selection Response:\n", secondRecRes.aiResponse);
            sharedRecPass = !secondRecRes.aiResponse.includes("unable to understand") &&
                (secondRecRes.responseType === "GROUNDED_RECORD" || secondRecRes.aiResponse.length > 20);
        } else {
            console.log("Patient has shared records or single record");
            sharedRecPass = sharedListRes.responseType === "CLARIFICATION" || sharedListRes.responseType === "GROUNDED_RECORD";
        }
    }
    console.log("CHECK 7 Result:", sharedRecPass ? "PASS" : "FAIL");

    // =========================================================================
    // CHECK 8: CLINICAL CHAT
    // Resolves conversation for doctor, sends "hi"
    // =========================================================================
    console.log("\n--- CHECK 8: CLINICAL CHAT ---");
    const convs = await getUserConversationsService(docUser._id, "doctor");
    console.log("Doctor conversations count:", convs.length);
    let chatPass = false;
    if (convs.length > 0) {
        const conv = convs[0];
        console.log("Doctor conversation ID:", conv._id || conv.conversationId);
        console.log("Doctor conversation type:", conv.conversationType);

        // Send "hi"
        const sendRes = await sendMessageService(
            conv._id || conv.conversationId,
            docUser._id,
            "doctor",
            { message: "hi", conversationId: conv._id || conv.conversationId }
        );
        console.log("Message sent:", sendRes?.message?.message, "by sender:", sendRes?.message?.senderId);
        chatPass = sendRes?.message?.message === "hi";
    }
    console.log("CHECK 8 Result:", chatPass ? "PASS" : "FAIL");

    // =========================================================================
    // CHECK 9: CROSS-ROLE SANITY
    // Patient AI, Admin AI, Super Admin AI
    // =========================================================================
    console.log("\n--- CHECK 9: CROSS-ROLE SANITY ---");
    let patientAiPass = false;
    let adminAiPass = false;
    let superAdminAiPass = false;

    if (patientUser) {
        const pRes = await runOrchestratedWorkflow(
            { id: String(patientUser._id), _id: patientUser._id, role: "patient" },
            { message: "Explain my active prescriptions" }
        );
        patientAiPass = !pRes.aiResponse.includes("unable to understand that request");
        console.log("Patient AI Response:", pRes.aiResponse?.slice(0, 100), "... PASS:", patientAiPass);
    }

    if (adminUser) {
        const aRes = await runOrchestratedWorkflow(
            { id: String(adminUser._id), _id: adminUser._id, role: "admin", organizationId: String(adminUser.organizationId) },
            { message: "Show clinic operational statistics" }
        );
        adminAiPass = !aRes.aiResponse.includes("unable to understand that request");
        console.log("Admin AI Response:", aRes.aiResponse?.slice(0, 100), "... PASS:", adminAiPass);
    }

    if (superAdminUser) {
        const saRes = await runOrchestratedWorkflow(
            { id: String(superAdminUser._id), _id: superAdminUser._id, role: "super_admin" },
            { message: "Show platform statistics" }
        );
        superAdminAiPass = !saRes.aiResponse.includes("unable to understand that request");
        console.log("Super Admin AI Response:", saRes.aiResponse?.slice(0, 100), "... PASS:", superAdminAiPass);
    }

    console.log("\n================ SUMMARY ================");
    console.log("CHECK 1 (Database Today Count):", dbCheckPass ? "PASS" : "FAIL");
    console.log("CHECK 3 (AI Today Schedule):", aiTodayPass ? "PASS" : "FAIL");
    console.log("CHECK 4 (Channel Filter Contract):", channelPass ? "PASS" : "FAIL");
    console.log("CHECK 5 (Clinical Notes Resolution):", notesPass ? "PASS" : "FAIL");
    console.log("CHECK 6 (Patient Discovery):", patDiscPass ? "PASS" : "FAIL");
    console.log("CHECK 7 (Shared Records Selection):", sharedRecPass ? "PASS" : "FAIL");
    console.log("CHECK 8 (Clinical Chat):", chatPass ? "PASS" : "FAIL");
    console.log("CHECK 9 (Patient AI):", patientAiPass ? "PASS" : "FAIL");
    console.log("CHECK 9 (Admin AI):", adminAiPass ? "PASS" : "FAIL");
    console.log("CHECK 9 (Super Admin AI):", superAdminAiPass ? "PASS" : "FAIL");

    process.exit(0);
}

runSmoke().catch(err => {
    console.error("Smoke check error:", err);
    process.exit(1);
});
