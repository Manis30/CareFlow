import { AppError } from "../../middleware/errorHandler.js";
import { screenEmergencySymptoms } from "./deterministicSafety.js";
import { TOOL_DEFINITIONS } from "./tools.js";
import { generateStructuredContent, getGeminiModelName } from "./geminiClient.js";
import { extractIntent } from "./intentRouter.js";
import AIAuditLogModel from "../../model/aiAuditLog.js";
import AIChatHistoryModel from "../../model/aiChatHistory.js";

/**
 * Master AI Gateway Service for CareFlow Healthcare Platform.
 * Strictly supports 4 roles: patient, doctor, admin (organization_admin), and super_admin.
 * 
 * Unified Workflow:
 * 1. Deterministic Emergency Safety Screening (Unbypassable hard-stop policy)
 * 2. Intent Routing & Entity Resolution (if prompt is free-text)
 * 3. Clarification Check (if required fields missing or confidence < 0.75)
 * 4. Role Authorization Check
 * 5. Execution & Routing Branching:
 *    a) Pure Data Tools: Execute service & template output directly (0 LLM synthesis calls).
 *    b) Write Tools: Confirmation gate check (isWrite === true).
 *    c) Generative Tools: Execute retrieval & pass to Gemini synthesis for natural-language answer.
 * 6. Audit Logging (records modelUsed, confidence, clarifyingQuestionTriggered, latencyMs).
 */

import { checkGroundingGuardrail } from "./groundingGuardrail.js";

import { formatDoctorName } from "../../util/formatters.js";

export const PURE_DATA_TOOLS = [
    "getMyAppointments",
    "getPlatformStats",
    "getClinicStats",
    "getHealthcareAnalytics",
    "getPaymentStats",
    "getSystemHealthTrends",
    "getMyPrescriptions",
    "getMyMedicalRecords",
    "searchDoctors",
    "getDoctorAvailability",
    "getOrganizationRoster",
    "classifySpecialtyFromSymptoms",
    "summarizeAppointmentContext",
    "draftClinicalNotes",
    "draftPrescription",
    "getDoctorLeave",
    "getMyDoctorProfile"
];

const ORDINALS = ["First", "Second", "Third", "Fourth", "Fifth"];

export const templatePureDataResponse = (toolName, result) => {
    if (!result) return "No data returned for your request.";

    if (toolName === "getDoctorLeave") {
        if (!result.doctorId) {
            return result.message || "Unable to determine which doctor's leave schedule you requested.";
        }
        const docName = formatDoctorName(result.doctorName) || "Doctor";
        let dateStatus = "";
        if (result.queryDate) {
            dateStatus = result.isOnLeaveOnDate
                ? `\n• Status on ${result.queryDate}: ON LEAVE`
                : `\n• Status on ${result.queryDate}: Not on leave (Available for consultation)`;
        }
        if (!result.leave || result.leave.length === 0) {
            return `Leave Schedule for ${docName}:${dateStatus}\n• No scheduled leave periods on record.`;
        }
        const leaveItems = result.leave.map((l, i) =>
            `  ${i + 1}. ${l.startDate} to ${l.endDate} — Reason: ${l.reason || 'Personal / Time-off'}`
        ).join("\n");
        return `Leave Schedule for ${docName}:${dateStatus}\n• Scheduled Leave Periods (${result.totalLeavePeriods}):\n${leaveItems}`;
    }

    if (toolName === "getMyDoctorProfile") {
        if (!result || result.success === false) {
            return result?.message || "Doctor profile not found for the authenticated account.";
        }
        return `Doctor Profile:\n• Name: ${result.doctorName || 'Doctor'}\n• Department: ${result.departmentName || 'General Medicine'}\n• Specialty: ${result.specialization || 'Specialist'}\n• Clinic / Organization: ${result.organizationName || 'CareFlow Clinic'}\n\n${result.message || ''}`.trim();
    }

    if (toolName === "getPlatformStats") {
        const stats = result.overview || result.stats || result;
        const growthStr = result.growth ? `\n• Growth: ${result.growth.comparisonText}` : '';
        let groupStr = '';
        if (result.byDepartment) groupStr += '\n• By Department: ' + Object.entries(result.byDepartment).map(([k, v]) => `${k}: ${v}`).join(', ');
        if (result.byDayOfWeek) groupStr += '\n• By Day of Week: ' + Object.entries(result.byDayOfWeek).map(([k, v]) => `${k}: ${v}`).join(', ');
        if (result.byDoctor) groupStr += '\n• By Doctor: ' + Object.entries(result.byDoctor).map(([k, v]) => `${k}: ${v}`).join(', ');
        if (result.bySpecialty) groupStr += '\n• By Specialty: ' + Object.entries(result.bySpecialty).map(([k, v]) => `${k}: ${v}`).join(', ');

        return `Platform Statistics:\n• Active Clinics/Organizations: ${stats.totalOrganizations ?? stats.activeOrganizations ?? 0}\n• Total Patients: ${stats.totalPatients ?? 0}\n• Total Appointments: ${stats.totalAppointments ?? 0}${growthStr}${groupStr}`;
    }

    if (toolName === "getClinicStats") {
        const rangeStr = (result.startDate || result.endDate) ? ` (${result.startDate || 'Start'} to ${result.endDate || 'Today'})` : '';
        let clinicBreakdownStr = '';
        if (result.byClinic && Object.keys(result.byClinic).length > 0) {
            clinicBreakdownStr = '\n• Breakdown by Clinic:\n' + Object.entries(result.byClinic).map(([cName, stats]) =>
                `  - ${cName}: Total ${stats.total} (Completed: ${stats.completed}, Cancelled: ${stats.cancelled}, No-Shows: ${stats.noShow ?? 0}, Active Queue: ${stats.activeQueue})`
            ).join('\n');
        }
        let groupStr = '';
        if (result.byDepartment) groupStr += '\n• By Department:\n' + Object.entries(result.byDepartment).map(([k, v]) => `  - ${k}: ${v} appointment(s)`).join('\n');
        if (result.byDayOfWeek) groupStr += '\n• By Day of Week:\n' + Object.entries(result.byDayOfWeek).map(([k, v]) => `  - ${k}: ${v} booking(s)`).join('\n');
        if (result.byDoctor) groupStr += '\n• By Doctor:\n' + Object.entries(result.byDoctor).map(([k, v]) => `  - ${k}: ${v} appointment(s)`).join('\n');
        if (result.bySpecialty) groupStr += '\n• By Doctor Specialty:\n' + Object.entries(result.bySpecialty).map(([k, v]) => `  - ${k}: ${v} appointment(s)`).join('\n');

        return `Clinic Operational Metrics${rangeStr}:\n• Total Appointments: ${result.totalAppointments ?? 0}\n• Completed: ${result.completedAppointments ?? 0}\n• Cancelled: ${result.cancelledAppointments ?? 0}\n• No-Shows: ${result.noShowAppointments ?? 0} (${result.noShowRate ?? '0%'})\n• Active Queue: ${result.activeQueueLength ?? 0}${groupStr}${clinicBreakdownStr}`;
    }

    if (toolName === "getHealthcareAnalytics") {
        if (!result) return "No healthcare analytics records found for the requested period.";
        if (result.groundedNarrative) return result.groundedNarrative;
        if (result.summary) return result.summary;
        const metricName = result.primaryMetric?.label || "Metric";
        const val = result.primaryMetric?.value ?? 0;
        return `${result.title || 'Healthcare Analytics'} (${result.period || 'Current Period'}): ${metricName} is ${val}.`;
    }

    if (toolName === "getPaymentStats") {
        const rangeStr = (result.startDate || result.endDate) ? ` (${result.startDate || 'Start'} to ${result.endDate || 'Today'})` : '';
        const deptStr = result.byDepartment && Object.keys(result.byDepartment).length > 0
            ? '\n• Revenue by Department: ' + Object.entries(result.byDepartment).map(([dept, amt]) => `${dept}: ₹${Number(amt).toLocaleString('en-IN')}`).join(', ')
            : '';
        const total = Number(result.totalCollected ?? result.totalRevenue ?? 0).toLocaleString('en-IN');
        const paid = result.paidCount ?? result.completedPaymentsCount ?? 0;
        const pending = Number(result.pendingAmount ?? result.pendingPaymentsAmount ?? 0).toLocaleString('en-IN');
        const pendingCount = result.pendingCount ?? result.pendingPaymentsCount ?? 0;
        const refunded = Number(result.refundedAmount ?? result.refundedPaymentsAmount ?? 0).toLocaleString('en-IN');
        const refundedCount = result.refundedCount ?? result.refundedPaymentsCount ?? 0;
        return `Payment & Revenue Summary${rangeStr}:\n• Total Collected: ₹${total} (${paid} paid)\n• Pending Payments: ₹${pending} (${pendingCount} pending)\n• Refunded: ₹${refunded} (${refundedCount} refunded)${deptStr}`;
    }

    if (toolName === "getSystemHealthTrends") {
        return `System Health & Performance Trends:\n• Database Status: ${result.dbStatus || 'connected'} (${result.dbLatencyMs ?? 0}ms latency)\n• Process Uptime: ${result.processUptimeSeconds ?? 0}s\n• Heap Memory Usage: ${result.heapUsedMb ?? 0} MB`;
    }

    if (toolName === "getMyAppointments") {
        const list = Array.isArray(result) ? result : [];
        if (list.length === 0) return "You currently have no scheduled appointments.";

        const countText = `You have ${list.length} appointment${list.length > 1 ? 's' : ''}.`;
        const details = [];

        const cap = Math.min(list.length, 5);
        for (let i = 0; i < cap; i++) {
            const appt = list[i];
            const patientName = appt.patientName || appt.patientId?.userId?.name || appt.patientId?.name || "Patient";
            const dateStr = appt.appointmentDate ? new Date(appt.appointmentDate).toISOString().split('T')[0] : 'scheduled date';
            const timeStr = appt.startTime || 'scheduled time';
            const reason = appt.reasonForVisit || appt.reason || appt.triageInfo?.chiefComplaint || "Not specified";
            const label = ORDINALS[i] || `#${i + 1}`;

            details.push(`${label}: ${patientName} at ${timeStr} on ${dateStr} — reason: ${reason}.`);
        }

        let responseStr = `${countText} ${details.join(" ")}`;
        if (list.length > 5) {
            responseStr += ` ...and ${list.length - 5} more appointment(s).`;
        }

        return responseStr;
    }

    if (toolName === "searchDoctors") {
        const docList = Array.isArray(result) ? result : (result.doctors || []);
        const specialtyStr = result.specialty ? `${result.specialty} ` : '';
        const orgNameStr = result.organizationName ? ` in ${result.organizationName}` : '';
        if (docList.length === 0) return `No ${specialtyStr}doctors found matching your query criteria${orgNameStr}.`;

        const formattedNames = docList.slice(0, 3).map(d => {
            const rawName = d.userId?.name || d.name || "Specialist";
            return formatDoctorName(rawName);
        }).join(", ");

        return `Found ${docList.length} matching ${specialtyStr}doctor(s)${orgNameStr}: ${formattedNames}${docList.length > 3 ? '...' : ''}.`;
    }

    if (toolName === "getDoctorAvailability") {
        const targetDate = result.date || 'today';
        const list = result.doctors || (result.availability ? result.availability : []);
        if (!list || list.length === 0) {
            return `No doctor availability schedules found for ${targetDate}.`;
        }

        const details = list.map(d => {
            const dName = d.doctorName || "Doctor";
            const spec = d.specialization ? ` (${d.specialization})` : '';
            if (!d.isAvailable || d.slotCount === 0) {
                return `• ${dName}${spec}: Not available on ${targetDate}.`;
            }
            const slotsText = (d.availableSlots || []).map(s => s.label || `${s.start}-${s.end}`).join(", ");
            return `• ${dName}${spec}: ${d.slotCount} available slot(s) — [${slotsText}]`;
        });

        return `Doctor Availability Schedule for ${targetDate}:\n${details.join("\n")}`;
    }

    if (toolName === "getOrganizationRoster") {
        const orgs = result.organizations || [];
        if (orgs.length === 0) {
            return "No clinic or organization roster data found.";
        }

        const scopeStr = result.scope === "platform-wide" ? "Platform-Wide Clinic Roster" : "Clinic Organization Roster";
        const orgSummaries = orgs.map(org => {
            const docCountStr = `${org.doctorCount} doctor(s)`;
            if (org.doctors && org.doctors.length > 0) {
                const docListStr = org.doctors.map(d => `${d.name} (${d.specialization})`).join(", ");
                return `• ${org.name} (${org.city}): ${docCountStr} — [${docListStr}]`;
            }
            return `• ${org.name} (${org.city}): ${docCountStr} — [No assigned doctors]`;
        });

        return `${scopeStr} (${result.totalOrganizations} clinic(s), ${result.totalDoctors} doctor(s) total):\n${orgSummaries.join("\n")}`;
    }

    if (toolName === "getMyPrescriptions") {
        const list = Array.isArray(result) ? result : [];
        if (list.length === 0) return "You currently have no prescriptions on record.";

        const details = list.map((p, idx) => {
            const docName = p.doctorId?.userId?.name || p.doctorId?.name || "Doctor";
            const dateStr = p.createdAt ? new Date(p.createdAt).toISOString().split('T')[0] : "N/A";
            const meds = Array.isArray(p.medicines) ? p.medicines.map(m =>
                `${m.medicineName || m.name || 'Medicine'} (${m.dosage || 'N/A'}, ${m.frequency || 'N/A'})`
            ).join(", ") : "No medicines specified";

            const label = ORDINALS[idx] || `#${idx + 1}`;
            return `${label}: Diagnosis: ${p.diagnosis || "N/A"} by ${docName} on ${dateStr} — Medicines: ${meds}.`;
        });

        return `You have ${list.length} prescription record(s). ${details.join(" ")}`;
    }

    if (toolName === "classifySpecialtyFromSymptoms") {
        if (result.isEmergency) {
            return result.escalationMessage || "Emergency detected. Please contact local emergency services immediately.";
        }
        let response = result.guidanceText || `Based on your symptoms, we recommend consulting a specialist in ${result.matchedSpecialty || 'General Medicine'}.`;
        if (result.doctors && result.doctors.length > 0) {
            const docList = result.doctors.slice(0, 3).map(d => `• ${formatDoctorName(d.name) || 'Doctor'} (${d.specialization})`).join("\n");
            response += `\n\nAvailable specialist(s) in our clinic:\n${docList}\n\nWould you like to book an appointment with one of these doctors? Please let me know your preferred date.`;
        } else {
            response += `\n\nWould you like to view general clinic availability or check another date?`;
        }
        return response;
    }

    if (toolName === "summarizeAppointmentContext") {
        return `PRE-VISIT CLINICAL BRIEF:\n• Patient: ${result.patientName || 'Patient'}\n• Chief Complaint / Reason for Visit: ${result.chiefComplaint || 'Not specified'}\n• Medical Records Summary:\n${result.medicalRecordsSummary || 'No past records on file'}\n• Active Prescription History:\n${result.prescriptionSummary || 'No active prescriptions'}`;
    }

    if (toolName === "draftClinicalNotes") {
        return result.draftContent || (result.soapNote ? `SOAP CLINICAL NOTE DRAFT:\n• S: ${result.soapNote.subjective}\n• O: ${result.soapNote.objective}\n• A: ${result.soapNote.assessment}\n• P: ${result.soapNote.plan}` : "Clinical note draft generated.");
    }

    if (toolName === "draftPrescription") {
        const medsStr = (result.medicines || []).map(m => `• ${m.medicineName} — ${m.dosage}, ${m.frequency} for ${m.duration} (${m.instructions})`).join("\n");
        return `PRESCRIPTION DRAFT (Pending Clinician Review & Signature):\nDiagnosis: ${result.diagnosis || 'Clinical evaluation'}\n${medsStr}\n\nDisclaimer: ${result.disclaimer || 'DRAFT ONLY'}`;
    }

    if (toolName === "getMyMedicalRecords") {
        const list = Array.isArray(result) ? result : [];
        return `Retrieved ${list.length} medical record(s).`;
    }

    return typeof result === "object" ? JSON.stringify(result, null, 2) : String(result);
};

export const getAIChatHistoryService = async (userId, organizationId) => {
    if (!userId) return { messages: [] };
    const orgQuery = organizationId || null;
    const history = await AIChatHistoryModel.findOne({ userId, organizationId: orgQuery }).lean();
    return history || { userId, organizationId: orgQuery, messages: [] };
};

export const saveAIChatMessageService = async (userId, organizationId, messageData) => {
    if (!userId) return null;
    const orgQuery = organizationId || null;
    let history = await AIChatHistoryModel.findOne({ userId, organizationId: orgQuery });
    if (!history) {
        history = new AIChatHistoryModel({ userId, organizationId: orgQuery, messages: [] });
    }
    history.messages.push(messageData);
    await history.save();
    return history;
};

import { runOrchestratedWorkflow } from "./orchestrator/agentOrchestrator.js";

export const processAIRequestService = async (user, requestData) => {
    return await runOrchestratedWorkflow(user, requestData);
};
