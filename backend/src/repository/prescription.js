import PrescriptionModel from "../model/prescription.js";

export const createPrescription = async (data) => {
    return await PrescriptionModel.create(data);
};

export const getPrescriptionById = async (id) => {
    return await PrescriptionModel.findById(id)
        .populate({
            path: "doctorId",
            populate: {
                path: "userId",
                select: "name email phone profileImage"
            }
        })
        .populate({
            path: "patientId",
            populate: {
                path: "userId",
                select: "name email phone profileImage"
            }
        })
        .populate("organizationId", "name")
        .populate("appointmentId", "appointmentDate startTime endTime consultationType status");
};

export const getPrescriptionByAppointmentId = async (appointmentId) => {
    return await PrescriptionModel.findOne({ appointmentId })
        .populate({
            path: "doctorId",
            populate: {
                path: "userId",
                select: "name email phone profileImage"
            }
        })
        .populate({
            path: "patientId",
            populate: {
                path: "userId",
                select: "name email phone profileImage"
            }
        })
        .populate("organizationId", "name");
};

export const getPrescriptionsByPatientId = async (patientId) => {
    return await PrescriptionModel.find({ patientId })
        .populate({
            path: "doctorId",
            populate: {
                path: "userId",
                select: "name email phone profileImage"
            }
        })
        .populate("organizationId", "name")
        .populate("appointmentId", "appointmentDate startTime endTime reason consultationType")
        .sort({ createdAt: -1 });
};

export const getPrescriptionsByDoctorId = async (doctorId) => {
    return await PrescriptionModel.find({ doctorId })
        .populate({
            path: "doctorId",
            populate: {
                path: "userId",
                select: "name email phone profileImage"
            }
        })
        .populate({
            path: "patientId",
            populate: {
                path: "userId",
                select: "name email phone profileImage"
            }
        })
        .populate("organizationId", "name")
        .populate("appointmentId", "appointmentDate startTime endTime reason consultationType")
        .sort({ createdAt: -1 });
};

export const updatePrescriptionById = async (id, data) => {
    return await PrescriptionModel.findByIdAndUpdate(
        id,
        { $set: data },
        { returnDocument: "after", runValidators: true }
    );
};
