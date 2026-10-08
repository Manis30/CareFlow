import DoctorModel from "../../model/doctor.js";
import DepartmentModel from "../../model/department.js";
import AppointmentModel from "../../model/appointment.js";
import UserModel from "../../model/user.js";
import { formatDoctorName } from "../../util/formatters.js";

/**
 * Parses natural language ordinals (1st, 2nd, most recent, latest, etc.) into 0-based array index.
 * Documented sorting convention: Most recent first (index 0 = newest / most recent).
 */
export const parseOrdinalIndex = (text) => {
    if (!text || typeof text !== "string") return null;
    const pLower = text.toLowerCase().trim();

    // 1st / first / doctor 1 / "1" / "the first doctor" / "first slot" / "slot 1"
    if (
        pLower === "1" ||
        /^(?:doctor|dr\.?|option|slot|number|#)?\s*1$/.test(pLower) ||
        /\b(1st|first|most recent|latest|newest)\b/.test(pLower) ||
        /\b(?:the\s+)?first(?:\s+(?:doctor|slot|one))?\b/.test(pLower)
    ) {
        return 0;
    }

    // 2nd / second / doctor 2 / "2" / "the second doctor" / "second slot" / "slot 2" / "second one"
    if (
        pLower === "2" ||
        /^(?:doctor|dr\.?|option|slot|number|#)?\s*2$/.test(pLower) ||
        /\b(2nd|second)\b/.test(pLower) ||
        /\b(?:the\s+)?second(?:\s+(?:doctor|slot|one))?\b/.test(pLower)
    ) {
        return 1;
    }

    // 3rd / third / doctor 3 / "3" / "the third doctor" / "third slot" / "slot 3" / "third one"
    if (
        pLower === "3" ||
        /^(?:doctor|dr\.?|option|slot|number|#)?\s*3$/.test(pLower) ||
        /\b(3rd|third)\b/.test(pLower) ||
        /\b(?:the\s+)?third(?:\s+(?:doctor|slot|one))?\b/.test(pLower)
    ) {
        return 2;
    }

    // 4th / fourth / doctor 4 / "4" / "fourth slot"
    if (
        pLower === "4" ||
        /^(?:doctor|dr\.?|option|slot|number|#)?\s*4$/.test(pLower) ||
        /\b(4th|fourth)\b/.test(pLower) ||
        /\b(?:the\s+)?fourth(?:\s+(?:doctor|slot|one))?\b/.test(pLower)
    ) {
        return 3;
    }

    // 5th / fifth / doctor 5 / "5" / "fifth slot"
    if (
        pLower === "5" ||
        /^(?:doctor|dr\.?|option|slot|number|#)?\s*5$/.test(pLower) ||
        /\b(5th|fifth)\b/.test(pLower) ||
        /\b(?:the\s+)?fifth(?:\s+(?:doctor|slot|one))?\b/.test(pLower)
    ) {
        return 4;
    }

    if (/\b(last|oldest)\b/.test(pLower)) {
        return -1;
    }

    const match = pLower.match(/\b(?:doctor|dr\.?|option|prescription|record|slot|number|#)\s*(\d+)\b/);
    if (match) {
        const num = parseInt(match[1], 10);
        if (num > 0) return num - 1;
    }

    const standaloneNumber = pLower.match(/^\s*(\d+)\s*$/);
    if (standaloneNumber) {
        const num = parseInt(standaloneNumber[1], 10);
        if (num > 0) return num - 1;
    }

    return null;
};

/**
 * Resolves natural language entity names (doctorName, department, appointmentId) from toolArgs
 * into concrete MongoDB ObjectIds scoped appropriately by role.
 *
 * Section 3: Accepts resolvedContext.lastDoctorList for conversational ordinal resolution.
 * Section 5: Accepts user to enable doctor-role appointment-context resolution.
 *
 * Rules:
 * 1. Scope admin/doctor queries to organizationId; patients can resolve across approved clinics.
 * 2. If doctorName resolves to multiple doctors (ambiguous), do NOT guess.
 *    Return missingRequiredFields and a clarifying question naming choices.
 * 3. Only concrete IDs are passed downstream to tool execution.
 */
export const resolveEntitiesFromToolArgs = async (toolArgs = {}, organizationId = null, user = null, resolvedContext = null) => {
    const args = { ...toolArgs };
    const missingRequiredFields = [];
    let clarificationQuestion = null;

    // 1. RESOLVE DOCTOR ENTITY
    let doctorNameInput = args.doctorName || args.doctor;

    // If doctorName was not keyed but prompt has an ordinal or doctor name ("Dr. X", "the second doctor", "2", etc.)
    if (!doctorNameInput && !args.doctorId) {
        const rawText = args.prompt || "";
        const ordIdx = parseOrdinalIndex(rawText);
        if (ordIdx !== null && resolvedContext?.lastDoctorList && resolvedContext.lastDoctorList.length > 0) {
            doctorNameInput = rawText;
        } else {
            const docMatch = rawText.match(/(?:dr\.?|doctor)\s+([A-Za-z.\s]+?)(?:\s+on|\s+at|\s+for|\s+tomorrow|\s+today|$)/i);
            if (docMatch && docMatch[1].trim().length > 2) {
                doctorNameInput = docMatch[1].trim();
            }
        }
    }

    if (!args.reason && !args.symptoms && args.prompt) {
        const forMatch = args.prompt.match(/\bfor\s+(.+)$/i);
        if (forMatch && forMatch[1].trim().length > 2) {
            args.reason = forMatch[1].trim();
            args.symptoms = forMatch[1].trim();
        }
    }

    if (doctorNameInput && !args.doctorId) {
        const ordinalIdx = parseOrdinalIndex(doctorNameInput);
        const lastDoctorList = resolvedContext?.lastDoctorList || resolvedContext?.doctors;

        if (ordinalIdx !== null && lastDoctorList && lastDoctorList.length > 0) {
            const resolvedIdx = ordinalIdx === -1 ? lastDoctorList.length - 1 : ordinalIdx;
            const resolvedDoc = lastDoctorList[resolvedIdx];
            if (resolvedDoc?.doctorId || resolvedDoc?._id || resolvedDoc?.id) {
                args.doctorId = String(resolvedDoc.doctorId || resolvedDoc._id || resolvedDoc.id);
                args.doctorName = formatDoctorName(resolvedDoc.name || resolvedDoc.doctorName);
                delete args.doctor;
            }
        } else if (lastDoctorList && lastDoctorList.length > 0) {
            // First check against the displayed doctor list from the current conversation
            const cleanSearchName = String(doctorNameInput)
                .replace(/^(?:i\s+want\s+|book\s+with\s+|dr\.?\s+|doctor\s+)+/i, '')
                .trim()
                .toLowerCase();

            const listMatches = lastDoctorList.filter(d => {
                const docName = String(d.name || d.doctorName || "")
                    .replace(/^(?:dr\.?\s+|doctor\s+)+/i, '')
                    .trim()
                    .toLowerCase();
                return docName.includes(cleanSearchName) || cleanSearchName.includes(docName);
            });

            if (listMatches.length === 1) {
                const match = listMatches[0];
                args.doctorId = String(match.doctorId || match._id || match.id);
                args.doctorName = formatDoctorName(match.name || match.doctorName);
                delete args.doctor;
            } else if (listMatches.length > 1) {
                missingRequiredFields.push("doctorId");
                const choices = listMatches.map(d => formatDoctorName(d.name || d.doctorName)).join(", ");
                clarificationQuestion = `I found ${listMatches.length} doctors matching "${doctorNameInput}": ${choices}. Please choose one.`;
            } else {
                // If not in current list, search the database across accredited clinics
                const cleanSearchName = String(doctorNameInput)
                    .replace(/^dr\.?\s+/i, '')
                    .trim()
                    .toLowerCase();

                let doctorFilter = {};
                if (user?.role === "admin" || user?.role === "doctor" || user?.role === "organization_admin") {
                    doctorFilter = organizationId ? { organizationId } : {};
                }

                const doctors = await DoctorModel.find(doctorFilter)
                    .populate("userId", "name email isActive")
                    .populate("departmentId", "name")
                    .populate("organizationId", "name status");

                const activeDoctors = doctors.filter(d =>
                    d.userId &&
                    d.userId.isActive !== false &&
                    d.organizationId?.status !== "suspended"
                );

                const matchedDoctors = activeDoctors.filter(d => {
                    const docName = (d.userId?.name || '').toLowerCase();
                    return docName.includes(cleanSearchName);
                });

                if (matchedDoctors.length === 1) {
                    args.doctorId = matchedDoctors[0]._id.toString();
                    args.doctorName = formatDoctorName(matchedDoctors[0].userId?.name);
                    delete args.doctor;
                } else if (matchedDoctors.length > 1) {
                    missingRequiredFields.push("doctorId");
                    const choices = matchedDoctors.map(d => {
                        const name = d.userId?.name || "Unknown";
                        const deptName = d.departmentId?.name || d.specialization || "General";
                        return `${formatDoctorName(name)} (${deptName})`;
                    }).join(", ");

                    clarificationQuestion = `I found ${matchedDoctors.length} doctors matching "${doctorNameInput}": ${choices}. Please choose one.`;
                } else if (matchedDoctors.length === 0) {
                    missingRequiredFields.push("doctorId");
                    clarificationQuestion = `We couldn't find a doctor matching "${doctorNameInput}". Would you like to view all available doctors?`;
                }
            }
        } else {
            // Normal DB-based resolution
            const cleanSearchName = String(doctorNameInput)
                .replace(/^dr\.?\s+/i, '')
                .trim()
                .toLowerCase();

            let doctorFilter = {};
            // Admins and doctors are strictly scoped to their organization; patients can resolve across approved clinics
            if (user?.role === "admin" || user?.role === "doctor" || user?.role === "organization_admin") {
                doctorFilter = organizationId ? { organizationId } : {};
            }

            const doctors = await DoctorModel.find(doctorFilter)
                .populate("userId", "name email isActive")
                .populate("departmentId", "name")
                .populate("organizationId", "name status");

            const activeDoctors = doctors.filter(d =>
                d.userId &&
                d.userId.isActive !== false &&
                d.organizationId?.status !== "suspended"
            );

            const matchedDoctors = activeDoctors.filter(d => {
                const docName = (d.userId?.name || '').toLowerCase();
                return docName.includes(cleanSearchName);
            });

            if (matchedDoctors.length === 1) {
                args.doctorId = matchedDoctors[0]._id.toString();
                args.doctorName = formatDoctorName(matchedDoctors[0].userId?.name);
                delete args.doctor;
            } else if (matchedDoctors.length > 1) {
                missingRequiredFields.push("doctorId");
                const choices = matchedDoctors.map(d => {
                    const name = d.userId?.name || "Unknown";
                    const deptName = d.departmentId?.name || d.specialization || "General";
                    return `${formatDoctorName(name)} (${deptName})`;
                }).join(", ");

                clarificationQuestion = `I found ${matchedDoctors.length} doctors matching "${doctorNameInput}": ${choices}. Please choose one.`;
            } else if (matchedDoctors.length === 0) {
                missingRequiredFields.push("doctorId");
                clarificationQuestion = `We couldn't find a doctor matching "${doctorNameInput}". Would you like to view all available doctors?`;
            }
        }
    }

    // 2. RESOLVE DEPARTMENT ENTITY
    const deptNameInput = args.departmentName || args.department;
    if (deptNameInput && !args.departmentId) {
        const cleanDeptName = String(deptNameInput).trim().toLowerCase();
        const deptFilter = organizationId ? { organizationId, isActive: { $ne: false } } : { isActive: { $ne: false } };
        const departments = await DepartmentModel.find(deptFilter);

        const matchedDepts = departments.filter(d => d.name.toLowerCase().includes(cleanDeptName));

        if (matchedDepts.length === 1) {
            args.departmentId = matchedDepts[0]._id.toString();
            delete args.departmentName;
            delete args.department;
        } else if (matchedDepts.length > 1) {
            missingRequiredFields.push("departmentId");
            const choices = matchedDepts.map(d => d.name).join(", ");
            clarificationQuestion = `Multiple departments matched "${deptNameInput}": ${choices}. Please specify which department.`;
        }
    }

    // 3. RESOLVE ORDINAL INDEX FOR RECORDS/PRESCRIPTIONS
    if (args.targetIndex === undefined) {
        const rawQuery = args.query || args.prompt || args.ordinal || "";
        const parsedIdx = parseOrdinalIndex(rawQuery);
        if (parsedIdx !== null) {
            args.targetIndex = parsedIdx;
        }
    }

    // 4. DOCTOR-ROLE APPOINTMENT-CONTEXT RESOLUTION
    // ONLY resolve the nearest upcoming appointment automatically when the request requires appointment context.
    // Examples requiring appointment context: "Who is my next patient?", "Who am I seeing next?", "Pre-visit summary", "Summarize next patient".
    // Queries like "What department am I in?", "What is my specialty?", "Show shared records", "Search records for hypertension" MUST NOT inject appointmentId.
    if (user?.role === "doctor") {
        try {
            const DoctorRecord = await DoctorModel.findOne({ userId: user.id || user._id }).lean();
            if (DoctorRecord) {
                // Identity Enforcement: NEVER trust a doctorId supplied by the LLM that conflicts with authenticated doctor identity
                args.doctorId = String(DoctorRecord._id);

                const rawQueryText = String(args.prompt || args.query || "").toLowerCase();
                const toolNameHint = String(args._toolName || toolArgs._toolName || "");
                // Multi-turn context persistence for doctor: resolve pronouns or previously active patient
                const activePatientId = resolvedContext?.patientId || resolvedContext?.agentState?.patientId;
                const activePatientName = resolvedContext?.patientName || resolvedContext?.agentState?.patientName;
                if (!args.patientId && activePatientId) {
                    const hasPronoun = /\b(she|he|her|his|their|the\s+patient|this\s+patient)\b/i.test(rawQueryText);
                    const mentionsNewPatient = /\bpatient\s+([A-Za-z]+)/i.test(rawQueryText) && !rawQueryText.includes(String(activePatientName || "").toLowerCase());
                    if (hasPronoun || !mentionsNewPatient) {
                        args.patientId = String(activePatientId);
                        args.patientName = activePatientName || args.patientName;
                        const activeApptId = resolvedContext?.appointmentId || resolvedContext?.agentState?.appointmentId;
                        if (activeApptId) {
                            args.appointmentId = String(activeApptId);
                        }
                    }
                }

                const appointmentSpecificTools = [
                    "summarizeAppointmentContext",
                    "getAuthorizedPatientHistory",
                    "checkInPatient",
                    "draftClinicalNotes",
                    "draftPrescription"
                ];

                const requiresAppointment = Boolean(
                    args.patientName ||
                    appointmentSpecificTools.includes(toolNameHint) ||
                    /\b(?:next\s+(?:patient|appointment|consultation|visit)|who\s+(?:is\s+my\s+next|am\s+i\s+seeing|is\s+next)|upcoming\s+appointment|pre-?visit|before\s+seeing|prior\s+to\s+seeing|this\s+consultation)\b/i.test(rawQueryText)
                );

                if (!args.appointmentId && requiresAppointment) {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);

                    // Attempt to extract patient name if one was mentioned in prompt
                    let patientNameHint = args.patientName || null;
                    if (!patientNameHint && rawQueryText) {
                        const nameMatch = rawQueryText.match(/(?:patient|chart\s+(?:for|of)|records?\s+(?:for|of)|brief\s+(?:for|of)|note\s+(?:for|of)|prescription\s+(?:for|of)|(?:show|results?)\s+(?:for|of)|look\s+up\s+patient|\bfor\b)\s+([A-Za-z.\s]+?)(?:\s+on|\s+at|\s+with|\s+tomorrow|\s+today|'s|\?|$)/i) ||
                                          rawQueryText.match(/([A-Za-z.\s]+?)'s\s+(?:chart|records|record|history|results|tests|prescriptions|notes|hba1c|vitals)/i);
                        if (nameMatch && nameMatch[1].trim().length > 1) {
                            const candidate = nameMatch[1].trim();
                            if (!/^(the\s+day|today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|appointment|visit|consultation|checkup)$/i.test(candidate)) {
                                patientNameHint = candidate;
                            }
                        }
                    }

                    const apptQuery = {
                        doctorId: DoctorRecord._id,
                        appointmentDate: { $gte: today },
                        status: { $nin: ["CANCELLED", "cancelled", "COMPLETED", "completed"] }
                    };

                    let upcomingAppointments = await AppointmentModel.find(apptQuery)
                        .populate({ path: "patientId", populate: { path: "userId", select: "name" } })
                        .sort({ appointmentDate: 1, startTime: 1 })
                        .limit(10)
                        .lean();

                    if (patientNameHint) {
                        const lowerHint = patientNameHint.toLowerCase();
                        let nameMatches = upcomingAppointments.filter(a => {
                            const pName = (a.patientId?.userId?.name || "").toLowerCase();
                            return pName.includes(lowerHint);
                        });

                        // If not found in upcoming appointments, search across ALL authorized patients for this doctor
                        if (nameMatches.length === 0) {
                            const orgId = DoctorRecord.organizationId?._id || DoctorRecord.organizationId;
                            const allDoctorAppts = await AppointmentModel.find({
                                doctorId: DoctorRecord._id,
                                organizationId: orgId
                            })
                            .populate({ path: "patientId", populate: { path: "userId", select: "name" } })
                            .sort({ appointmentDate: -1 })
                            .limit(25)
                            .lean();

                            const MedicalRecordModel = (await import("../../model/medicalRecord.js")).default;
                            const sharedRecords = await MedicalRecordModel.find({
                                organizationId: orgId,
                                "sharedWith.doctorId": DoctorRecord._id
                            })
                            .populate({ path: "patientId", populate: { path: "userId", select: "name" } })
                            .lean();

                            const patientMap = new Map();
                            for (const a of allDoctorAppts) {
                                if (a.patientId?._id) {
                                    patientMap.set(String(a.patientId._id), {
                                        patientId: String(a.patientId._id),
                                        name: a.patientId.userId?.name || "Patient",
                                        appointmentId: String(a._id)
                                    });
                                }
                            }
                            for (const r of sharedRecords) {
                                if (r.patientId?._id && !patientMap.has(String(r.patientId._id))) {
                                    patientMap.set(String(r.patientId._id), {
                                        patientId: String(r.patientId._id),
                                        name: r.patientId.userId?.name || "Patient",
                                        appointmentId: null
                                    });
                                }
                            }

                            const allAuthorized = Array.from(patientMap.values());
                            const broadMatches = allAuthorized.filter(p => p.name.toLowerCase().includes(lowerHint));

                            if (broadMatches.length === 1) {
                                args.patientId = broadMatches[0].patientId;
                                args.patientName = broadMatches[0].name;
                                if (broadMatches[0].appointmentId) args.appointmentId = broadMatches[0].appointmentId;
                            } else if (broadMatches.length > 1) {
                                missingRequiredFields.push("patientId");
                                const choices = broadMatches.map((p, i) => `${i + 1}. ${p.name}`).join("\n");
                                clarificationQuestion = `I found ${broadMatches.length} patients matching "${patientNameHint}":\n${choices}\nPlease select which patient to view.`;
                            } else {
                                missingRequiredFields.push("patientId");
                                clarificationQuestion = `Patient not found in your authorized clinic records.`;
                            }
                        } else if (nameMatches.length === 1) {
                            args.appointmentId = String(nameMatches[0]._id);
                            args.patientId = String(nameMatches[0].patientId?._id || nameMatches[0].patientId);
                            args.patientName = nameMatches[0].patientId?.userId?.name || args.patientName;
                        } else {
                            missingRequiredFields.push("appointmentId");
                            const choices = nameMatches.map((a, i) => `${i + 1}. ${a.patientId?.userId?.name || 'Patient'} (${new Date(a.appointmentDate).toISOString().split('T')[0]} at ${a.startTime})`).join("\n");
                            clarificationQuestion = `I found ${nameMatches.length} appointments matching "${patientNameHint}":\n${choices}\nPlease select one.`;
                        }
                    } else if (!args.appointmentId && !patientNameHint && upcomingAppointments.length > 0) {
                        args.appointmentId = String(upcomingAppointments[0]._id);
                        args.patientId = String(upcomingAppointments[0].patientId?._id || upcomingAppointments[0].patientId);
                        args.patientName = upcomingAppointments[0].patientId?.userId?.name || args.patientName;
                    }

                    // If no upcoming appointment found with date >= today, check for any active scheduled/booked appointment
                    if (!args.appointmentId && !patientNameHint && !args.patientId) {
                        const anyActiveAppts = await AppointmentModel.find({
                            doctorId: DoctorRecord._id,
                            status: { $nin: ["CANCELLED", "cancelled"] }
                        })
                        .populate({ path: "patientId", populate: { path: "userId", select: "name" } })
                        .sort({ appointmentDate: -1, startTime: -1 })
                        .limit(1)
                        .lean();

                        if (anyActiveAppts.length > 0) {
                            args.appointmentId = String(anyActiveAppts[0]._id);
                            args.patientId = String(anyActiveAppts[0].patientId?._id || anyActiveAppts[0].patientId);
                            args.patientName = anyActiveAppts[0].patientId?.userId?.name || args.patientName;
                        }
                    }

                    if (!args.appointmentId && !args.patientId && (toolNameHint === "summarizeAppointmentContext" || toolNameHint === "getPreVisitBrief" || requiresAppointment)) {
                        missingRequiredFields.push("appointmentId");
                        clarificationQuestion = patientNameHint
                            ? `I couldn't find an appointment for "${patientNameHint}" on your calendar.`
                            : "You do not have any upcoming appointments scheduled on your calendar at this time.";
                    }
                }
            }
        } catch (e) {
            console.warn("[EntityResolver] Doctor appointment-context resolution failed:", e.message);
        }
    }

    return {
        toolArgs: args,
        missingRequiredFields,
        clarificationQuestion
    };
};

export const resolveDoctorUpcomingAppointment = async (user, patientNameHint = null) => {
    const res = await resolveEntitiesFromToolArgs({ patientName: patientNameHint }, null, user);
    return res.toolArgs;
};
