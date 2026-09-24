import MedicalRecordModel from "../model/medicalRecord.js";
import AppointmentModel from "../model/appointment.js";

export const createMedicalRecord = async (data) => {
    return await MedicalRecordModel.create(data);
};

export const getMedicalRecordById = async (id) => {
    return await MedicalRecordModel.findById(id)
        .populate({
            path: "patientId",
            populate: {
                path: "userId",
                select: "name email phone profileImage"
            }
        })
        .populate({
            path: "sharedWith.doctorId",
            populate: {
                path: "userId",
                select: "name email phone profileImage"
            }
        })
        .populate("uploadedBy", "name email role")
        .populate("organizationId", "name");
};

export const getMedicalRecordsByPatientId = async (patientId) => {
    return await MedicalRecordModel.find({ patientId })
        .populate({
            path: "sharedWith.doctorId",
            populate: {
                path: "userId",
                select: "name email phone profileImage"
            }
        })
        .sort({ createdAt: -1 });
};

export const getMedicalRecordsByAppointmentId = async (appointmentId) => {
    return await MedicalRecordModel.find({ appointmentId })
        .populate({
            path: "patientId",
            populate: {
                path: "userId",
                select: "name email phone profileImage"
            }
        })
        .sort({ createdAt: -1 });
};

export const getMedicalRecordsForDoctor = async (doctorId) => {
    const doctorAppts = await AppointmentModel.find({ doctorId }, "_id");
    const doctorApptIds = doctorAppts.map((a) => a._id);

    return await MedicalRecordModel.find({
        $or: [
            { "sharedWith.doctorId": doctorId },
            { appointmentId: { $in: doctorApptIds } }
        ]
    })
        .populate({
            path: "patientId",
            populate: {
                path: "userId",
                select: "name email phone profileImage"
            }
        })
        .populate("appointmentId", "appointmentDate startTime endTime reason consultationType")
        .sort({ createdAt: -1 });
};

export const updateMedicalRecordById = async (id, data) => {
    return await MedicalRecordModel.findByIdAndUpdate(
        id,
        { $set: data },
        { returnDocument: "after", runValidators: true }
    );
};

export const deleteMedicalRecordById = async (id) => {
    return await MedicalRecordModel.findByIdAndDelete(id);
};

export const shareMedicalRecordWithDoctor = async (id, doctorId) => {
    await MedicalRecordModel.findByIdAndUpdate(
        id,
        {
            $push: {
                sharedWith: { doctorId, sharedAt: new Date() }
            },
            $set: { visibility: "shared" }
        },
        { returnDocument: "after", runValidators: true }
    );
    return await getMedicalRecordById(id);
};

export const revokeMedicalRecordDoctorAccess = async (id, doctorId) => {
    await MedicalRecordModel.findByIdAndUpdate(
        id,
        {
            $pull: {
                sharedWith: { doctorId }
            }
        },
        { returnDocument: "after", runValidators: true }
    );
    return await getMedicalRecordById(id);
};
