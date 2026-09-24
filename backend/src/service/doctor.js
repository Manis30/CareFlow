import {
    createDoctor,
    getAllDoctors,
    getDoctorByUserId,
    updateDoctorByUserId,
    getDoctorById,
    updateDoctorById,
    deactivateDoctor
} from "../repository/doctor.js";
import {
    registerService,
    updateProfileImageService
} from "./user.js";
import { updateUser, deactivateUser } from "../repository/user.js";
import uploadToCloudinary from "../util/uploadToCloudinary.js";
import { AppError } from "../middleware/errorHandler.js";
import { getOrganizationRepo } from "../repository/organization.js";
import validateDoctorAvailability from "../util/validateDoctorAvailability.js";
import DoctorModel from "../model/doctor.js";
import DepartmentModel from "../model/department.js";
import { getOrCreateGeneralDepartment } from "../repository/department.js";
import AppointmentModel from "../model/appointment.js";
import { getPatientByUserId } from "../repository/patient.js";
import { parseTimeToMinutes, doTimeRangesOverlap, formatDateKey } from "../util/appointmentTimeUtils.js";

const resolveDepartmentAssignment = async (organizationId, rawDeptIds, rawDeptId) => {
    let inputIds = [];
    if (Array.isArray(rawDeptIds)) {
        inputIds = rawDeptIds;
    } else if (typeof rawDeptIds === "string" && rawDeptIds.trim()) {
        try {
            const parsed = JSON.parse(rawDeptIds);
            inputIds = Array.isArray(parsed) ? parsed : [rawDeptIds];
        } catch (e) {
            inputIds = [rawDeptIds];
        }
    } else if (rawDeptId) {
        inputIds = [rawDeptId];
    }

    inputIds = inputIds.map((id) => String(id).trim()).filter(Boolean);

    let orgDepts = await DepartmentModel.find({
        organizationId,
        isActive: { $ne: false }
    });

    if (!orgDepts || orgDepts.length === 0) {
        const generalDept = await getOrCreateGeneralDepartment(organizationId);
        orgDepts = generalDept ? [generalDept] : [];
    }

    if (inputIds.length === 0 || !orgDepts || orgDepts.length === 0) {
        const defaultDept = (orgDepts && orgDepts[0]) || (await getOrCreateGeneralDepartment(organizationId));
        return {
            departmentIds: defaultDept ? [defaultDept._id] : [],
            departments: defaultDept ? [defaultDept.name] : ["General"],
            departmentId: defaultDept ? defaultDept._id : null
        };
    }

    const orgDeptMap = new Map(orgDepts.map((d) => [d._id.toString(), d]));
    const validDepts = [];

    for (const idStr of inputIds) {
        if (!orgDeptMap.has(idStr)) {
            throw new AppError(
                400,
                "Selected department does not belong to your organization or is inactive."
            );
        }
        validDepts.push(orgDeptMap.get(idStr));
    }

    const validDeptIds = validDepts.map((d) => d._id);
    const validNames = validDepts.map((d) => d.name);

    return {
        departmentIds: validDeptIds,
        departments: validNames,
        departmentId: validDeptIds[0] || null
    };
};

const formatMinutesToHHMM = (mins) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const formatMinutesTo12Hour = (mins) => {
  let h = Math.floor(mins / 60);
  const m = mins % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
};

const DAYS_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const buildInitialDoctorAvailability = (orgWorkingHours) => {
    if (Array.isArray(orgWorkingHours) && orgWorkingHours.length > 0) {
        return orgWorkingHours.map((w) => {
            const dayName = String(w.day || '').toLowerCase().trim();
            const isOpen = w.isOpen !== false && w.status !== 'CLOSED';
            return {
                day: dayName,
                isAvailable: isOpen,
                open: w.open || '09:00',
                close: w.close || w.clode || '17:00'
            };
        });
    }

    return DAYS_ORDER.map((day) => ({
        day,
        isAvailable: day !== 'sunday',
        open: '09:00',
        close: '17:00'
    }));
};

export const createDoctorService = async (
    data,
    organizationId,
    file
) => {
    const organization = await getOrganizationRepo(organizationId);
    if (!organization) {
        throw new AppError(400, "Invalid organizationId");
    }
    let profileImage = null;
    if (file) {
        profileImage = await uploadToCloudinary(
            file.buffer,
            "doctors"
        );
    }
    if (typeof data.available === "string") {
        try {
            data.available = JSON.parse(data.available);
        } catch (e) {
            data.available = null;
        }
    }

    if (!data.available || !Array.isArray(data.available) || data.available.length === 0) {
        data.available = buildInitialDoctorAvailability(organization.workingHours);
    }

    validateDoctorAvailability(
        data.available,
        organization.workingHours
    );

    const deptAssignment = await resolveDepartmentAssignment(
        organizationId,
        data.departmentIds,
        data.departmentId
    );

    const user = await registerService({
        name: data.name,
        email: data.email,
        password: data.password,
        phone: data.phone,
        role: "doctor",
        organizationId: organizationId,
        mustResetPassword: true,
        profileImage
    });

    const doctor = await createDoctor({
        userId: user._id,
        organizationId: organizationId,
        departmentId: deptAssignment.departmentId,
        departmentIds: deptAssignment.departmentIds,
        departments: deptAssignment.departments,
        gender: data.gender || "Male",
        specialization: data.specialization,
        qualification: data.qualification,
        consultationFee: data.consultationFee,
        available: data.available
    });
    return doctor;
};
export const getAllDoctorsService = async (organizationId, city, specialty) => {
    return await getAllDoctors(organizationId, city, specialty);
};
export const getMyDoctorProfileService = async (userId) => {
    return await getDoctorByUserId(userId);
};
export const updateMyAvailabilityService = async (userId, availableInput) => {
    let available = availableInput;
    if (typeof available === "string") {
        try {
            available = JSON.parse(available);
        } catch (e) {
            throw new AppError(400, "Invalid JSON format for doctor availability");
        }
    }

    const doctor = await getDoctorByUserId(userId);
    if (!doctor) {
        throw new AppError(404, "Doctor profile not found");
    }

    const organization = await getOrganizationRepo(doctor.organizationId._id || doctor.organizationId);
    if (organization) {
        validateDoctorAvailability(available, organization.workingHours);
    }

    return await updateDoctorByUserId(userId, { available });
};

export const getDoctorService = async (id, organizationId) => {
    return await getDoctorById(id, organizationId);
};

export const getDoctorAvailableSlotsService = async (doctorId, dateStr, patientUserId = null) => {
  const doctor = await DoctorModel.findById(doctorId)
    .populate("organizationId")
    .populate("userId", "name email isActive");

  if (!doctor || doctor.userId?.isActive === false) {
    throw new AppError(404, "Doctor profile not found or inactive");
  }

  const organization = doctor.organizationId;
  if (!organization || organization.status === "suspended") {
    throw new AppError(400, "Clinic is currently suspended or not available");
  }

  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    throw new AppError(400, "Invalid date format. Expected YYYY-MM-DD");
  }

  // Determine day of week in UTC/ISO
  const dateObj = new Date(dateStr + "T00:00:00.000Z");
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const targetDay = days[dateObj.getUTCDay()];

  // Check Organization Working Setup
  let orgOpenMins = 9 * 60;
  let orgCloseMins = 21 * 60;
  let isOrgOpen = true;

  if (Array.isArray(organization.workingHours) && organization.workingHours.length > 0) {
    const orgDayConfig = organization.workingHours.find(
      (w) => w.day?.toLowerCase() === targetDay
    );

    if (orgDayConfig) {
      if (orgDayConfig.isOpen === false || orgDayConfig.status === "CLOSED") {
        isOrgOpen = false;
      } else {
        const parsedOpen = parseTimeToMinutes(orgDayConfig.open);
        const parsedClose = parseTimeToMinutes(orgDayConfig.close || orgDayConfig.clode);
        if (parsedOpen !== null) orgOpenMins = parsedOpen;
        if (parsedClose !== null) orgCloseMins = parsedClose;
      }
    }
  }

  if (!isOrgOpen) {
    return {
      date: dateStr,
      day: targetDay,
      isAvailable: false,
      reason: "Clinic is closed on this day",
      slots: []
    };
  }

  // Section 6: Check doctor's leave array — if the requested date falls within any leave range, block slots
  if (Array.isArray(doctor.leave) && doctor.leave.length > 0) {
    const targetDateObj = new Date(dateStr + "T00:00:00.000Z");
    const isOnLeave = doctor.leave.some(l => {
      const leaveStart = new Date(l.startDate);
      const leaveEnd = new Date(l.endDate);
      leaveStart.setHours(0, 0, 0, 0);
      leaveEnd.setHours(23, 59, 59, 999);
      return targetDateObj >= leaveStart && targetDateObj <= leaveEnd;
    });
    if (isOnLeave) {
      return {
        date: dateStr,
        day: targetDay,
        isAvailable: false,
        reason: "Doctor is on leave on this date",
        slots: []
      };
    }
  }

  // Check Doctor Availability Setup
  let docOpenMins = null;
  let docCloseMins = null;
  let isDocAvailable = false;

  if (Array.isArray(doctor.available) && doctor.available.length > 0) {
    const docDayConfig = doctor.available.find(
      (a) => a.day?.toLowerCase() === targetDay
    );

    if (docDayConfig && docDayConfig.isAvailable) {
      isDocAvailable = true;
      docOpenMins = parseTimeToMinutes(docDayConfig.open);
      docCloseMins = parseTimeToMinutes(docDayConfig.close);
    }
  }

  if (!isDocAvailable || docOpenMins === null || docCloseMins === null) {
    return {
      date: dateStr,
      day: targetDay,
      isAvailable: false,
      reason: "Doctor is not available on the selected day",
      slots: []
    };
  }

  // Compute Effective Available Window
  const startMins = Math.max(docOpenMins, orgOpenMins);
  const endMins = Math.min(docCloseMins, orgCloseMins);

  if (startMins >= endMins) {
    return {
      date: dateStr,
      day: targetDay,
      isAvailable: false,
      reason: "No overlapping working hours available for this date",
      slots: []
    };
  }

  const slotDuration = 30; // 30 mins per appointment slot

  // Fetch Existing Active Appointments for this Doctor on dateStr
  const allDoctorAppts = await AppointmentModel.find({
    doctorId: doctor._id,
    status: { $ne: "cancelled" }
  });

  const existingAppts = allDoctorAppts.filter((appt) => {
    if (!appt.appointmentDate) return false;
    return formatDateKey(appt.appointmentDate) === dateStr;
  });

  const doctorBookedRanges = existingAppts.map((appt) => ({
    startMins: parseTimeToMinutes(appt.startTime),
    endMins: parseTimeToMinutes(appt.endTime)
  })).filter((r) => r.startMins !== null && r.endMins !== null);

  // Fetch Existing Active Appointments for current Logged-in Patient across ALL doctors/clinics
  let patientBookedRanges = [];
  if (patientUserId) {
    const patient = await getPatientByUserId(patientUserId);
    if (patient) {
      const allPatientAppts = await AppointmentModel.find({
        patientId: patient._id,
        status: { $ne: "cancelled" }
      });

      const patientApptsOnDate = allPatientAppts.filter((appt) => {
        if (!appt.appointmentDate) return false;
        return formatDateKey(appt.appointmentDate) === dateStr;
      });

      patientBookedRanges = patientApptsOnDate.map((appt) => ({
        startMins: parseTimeToMinutes(appt.startTime),
        endMins: parseTimeToMinutes(appt.endTime)
      })).filter((r) => r.startMins !== null && r.endMins !== null);
    }
  }

  // Handle Today's Past Time Slots Filter
  const now = new Date();
  const todayStr = formatDateKey(now);
  const isToday = dateStr === todayStr;
  const currentMins = now.getHours() * 60 + now.getMinutes();

  // Generate Slots
  const slots = [];
  for (let current = startMins; current + slotDuration <= endMins; current += slotDuration) {
    const slotStart = current;
    const slotEnd = current + slotDuration;

    // Filter past times if selected date is today
    if (isToday && slotStart <= currentMins) {
      continue;
    }

    // Check overlap with doctor's booked appointments
    const isDoctorBooked = doctorBookedRanges.some(
      (b) => doTimeRangesOverlap(slotStart, slotEnd, b.startMins, b.endMins)
    );

    // Check overlap with patient's own booked appointments across ANY doctor/clinic
    const isPatientBooked = patientBookedRanges.some(
      (b) => doTimeRangesOverlap(slotStart, slotEnd, b.startMins, b.endMins)
    );

    if (!isDoctorBooked && !isPatientBooked) {
      const startStr = formatMinutesToHHMM(slotStart);
      const endStr = formatMinutesToHHMM(slotEnd);
      const label = `${formatMinutesTo12Hour(slotStart)} - ${formatMinutesTo12Hour(slotEnd)}`;

      slots.push({
        start: startStr,
        end: endStr,
        label,
        available: true
      });
    }
  }

  return {
    date: dateStr,
    day: targetDay,
    isAvailable: slots.length > 0,
    slots
  };
};

export const updateDoctorService = async (
    id,
    organizationId,
    data,
    file
) => {
    const doctor = await getDoctorById(id, organizationId);
    if (!doctor) {
        throw new AppError(404, "Doctor profile not found");
    }

    let doctorData = {};
    if (file) {
        const uploadedImg = await uploadToCloudinary(
            file.buffer,
            "doctors"
        );
        const docUserId = doctor.userId._id || doctor.userId;
        await updateProfileImageService(docUserId, uploadedImg);
    }
    if (data.departmentIds !== undefined || data.departmentId !== undefined) {
        const deptAssignment = await resolveDepartmentAssignment(
            organizationId,
            data.departmentIds,
            data.departmentId
        );
        doctorData.departmentId = deptAssignment.departmentId;
        doctorData.departmentIds = deptAssignment.departmentIds;
        doctorData.departments = deptAssignment.departments;
    }
    if (data.gender !== undefined) {
        doctorData.gender = data.gender;
    }
    if (data.specialization !== undefined) {
        doctorData.specialization = data.specialization;
    }
    if (data.qualification !== undefined) {
        doctorData.qualification = data.qualification;
    }
    if (data.consultationFee !== undefined) {
        doctorData.consultationFee = data.consultationFee;
    }
    if (data.available !== undefined) {
        if (typeof data.available === "string") {
            try {
                data.available = JSON.parse(data.available);
            } catch (e) {
                throw new AppError(400, "Invalid JSON format for doctor availability");
            }
        }
        const organization = await getOrganizationRepo(organizationId);
        if (organization) {
            validateDoctorAvailability(data.available, organization.workingHours);
        }
        doctorData.available = data.available;
    }
    if (Object.keys(doctorData).length > 0) {
        await updateDoctorById(
            id,
            organizationId,
            doctorData
        );
    }
    return await getDoctorById(id, organizationId);
};

export const deleteDoctorService = async (
    id,
    organizationId
) => {
    const doctor=await getDoctorById(id,organizationId);
    if(!doctor.userId.isActive){
        throw new AppError(404,"Doctor not found or already inactive")
    }
    const user= await deactivateUser(
        doctor.userId._id
    );
    return await getDoctorById(id,organizationId)
};

// Section 6: Doctor Leave Services
export const addDoctorLeaveService = async (doctorUserId, { startDate, endDate, reason }) => {
    if (!startDate || !endDate) {
        throw new AppError(400, "Both startDate and endDate are required");
    }
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new AppError(400, "Invalid date format for startDate or endDate");
    }
    if (start > end) {
        throw new AppError(400, "startDate cannot be after endDate");
    }

    const doctor = await DoctorModel.findOne({ userId: doctorUserId }).populate("userId", "name");
    if (!doctor) {
        throw new AppError(404, "Doctor profile not found");
    }

    if (!Array.isArray(doctor.leave)) {
        doctor.leave = [];
    }

    const newLeave = {
        startDate: start,
        endDate: end,
        reason: reason || null
    };
    doctor.leave.push(newLeave);
    await doctor.save();

    // Check for existing confirmed/booked appointments in leave period
    const startRange = new Date(start);
    startRange.setHours(0, 0, 0, 0);
    const endRange = new Date(end);
    endRange.setHours(23, 59, 59, 999);

    const overlappingAppointments = await AppointmentModel.find({
        doctorId: doctor._id,
        appointmentDate: { $gte: startRange, $lte: endRange },
        status: { $in: ["BOOKED", "booked", "CONFIRMED", "confirmed", "HELD", "held"] }
    }).populate({ path: "patientId", populate: { path: "userId", select: "_id name" } });

    let socketIo = null;
    try {
        const { getIO } = await import("../config/socket.js");
        socketIo = getIO();
    } catch (e) {
        // Socket not initialized or in testing
    }

    const { createNotificationService } = await import("./notification.js");
    const UserModel = (await import("../model/user.js")).default;
    const orgAdmins = await UserModel.find({
        organizationId: doctor.organizationId,
        role: { $in: ["admin", "organization_admin"] },
        isActive: { $ne: false }
    }).select("_id");

    const doctorName = doctor.userId?.name ? `Dr. ${doctor.userId.name}` : "Doctor";

    for (const appt of overlappingAppointments) {
        appt.needsRescheduling = true;
        await appt.save();

        const dateStr = appt.appointmentDate ? appt.appointmentDate.toISOString().split("T")[0] : "your scheduled date";
        const patientUserId = appt.patientId?.userId?._id || appt.patientId?.userId;

        // 1. Notify patient
        if (patientUserId) {
            try {
                const notif = await createNotificationService({
                    userId: patientUserId,
                    organizationId: doctor.organizationId,
                    title: "Appointment Rescheduling Required",
                    message: `${doctorName} is on leave on ${dateStr}. Please reschedule your appointment.`,
                    type: "APPOINTMENT_RESCHEDULE_NEEDED",
                    metaData: { appointmentId: appt._id, doctorId: doctor._id }
                });
                if (socketIo) {
                    socketIo.to(`user:${patientUserId}`).emit("notification:new", notif);
                }
            } catch (err) {
                console.error("Failed to notify patient of doctor leave:", err.message);
            }
        }

        // 2. Notify organization admin(s)
        for (const admin of orgAdmins) {
            try {
                const notif = await createNotificationService({
                    userId: admin._id,
                    organizationId: doctor.organizationId,
                    title: "Doctor Leave: Appointment Overlap",
                    message: `${doctorName} scheduled leave from ${start.toISOString().split("T")[0]} to ${end.toISOString().split("T")[0]}. Appointment on ${dateStr} requires rescheduling.`,
                    type: "APPOINTMENT_RESCHEDULE_NEEDED",
                    metaData: { appointmentId: appt._id, doctorId: doctor._id, patientId: appt.patientId?._id }
                });
                if (socketIo) {
                    socketIo.to(`user:${admin._id}`).emit("notification:new", notif);
                }
            } catch (err) {
                console.error("Failed to notify admin of doctor leave:", err.message);
            }
        }
    }

    return {
        message: "Leave added successfully",
        leave: doctor.leave,
        flaggedAppointmentsCount: overlappingAppointments.length
    };
};

export const getDoctorLeaveService = async (doctorId) => {
    const doctor = await DoctorModel.findById(doctorId).select("leave userId organizationId").populate("userId", "name");
    if (!doctor) {
        throw new AppError(404, "Doctor not found");
    }
    return {
        doctorId: doctor._id,
        doctorName: doctor.userId?.name || "Doctor",
        leave: doctor.leave || []
    };
};

export const getMyDoctorLeaveService = async (doctorUserId) => {
    const doctor = await DoctorModel.findOne({ userId: doctorUserId }).select("leave userId organizationId").populate("userId", "name");
    if (!doctor) {
        throw new AppError(404, "Doctor profile not found");
    }
    return {
        doctorId: doctor._id,
        doctorName: doctor.userId?.name || "Doctor",
        leave: doctor.leave || []
    };
};

export const deleteDoctorLeaveService = async (doctorUserId, leaveId) => {
    const doctor = await DoctorModel.findOne({ userId: doctorUserId });
    if (!doctor) {
        throw new AppError(404, "Doctor profile not found");
    }
    if (!Array.isArray(doctor.leave)) {
        throw new AppError(404, "Leave record not found");
    }
    const initialLen = doctor.leave.length;
    doctor.leave = doctor.leave.filter(l => l._id.toString() !== leaveId.toString());
    if (doctor.leave.length === initialLen) {
        throw new AppError(404, "Leave record not found");
    }
    await doctor.save();
    return {
        message: "Leave period deleted successfully",
        leave: doctor.leave
    };
};