import {AppError} from "../middleware/errorHandler.js";
import {
    createDoctorService,
    getAllDoctorsService,
    getMyDoctorProfileService,
    updateMyAvailabilityService,
    getDoctorService,
    getDoctorAvailableSlotsService,
    updateDoctorService,
    deleteDoctorService,
    addDoctorLeaveService,
    getDoctorLeaveService,
    getMyDoctorLeaveService,
    deleteDoctorLeaveService
} from "../service/doctor.js";
export const createDoctorController = async (req, res) => {
    const organizationId = req.user.organizationId;
    const result = await createDoctorService(
        req.body,
        organizationId,
        req.file
    );
    res.status(201).json({
        success: true,
        message: "Doctor created successfully",
        data: result
    });
};

export const getAllDoctorsController = async (req, res) => {
    const isPatientOrSuperAdmin = req.user?.role === "patient" || req.user?.role === "super_admin";
    const organizationId = isPatientOrSuperAdmin
        ? req.query.organizationId
        : (req.user?.organizationId || req.query.organizationId);
    const city = req.query.city;
    const specialty = req.query.specialty || req.query.department;
    const result = await getAllDoctorsService(organizationId, city, specialty);
    res.status(200).json({
        success: true,
        message: "Doctors fetched successfully",
        data: result
    });
};
export const getMyDoctorProfileController = async (req, res) => {
    const userId = req.user.id;
    const result = await getMyDoctorProfileService(userId);
    if (!result) {
        throw new AppError(404, "Doctor profile not found");
    }
    res.status(200).json({
        success: true,
        data: result
    });
};
export const updateMyAvailabilityController = async (req, res) => {

    const userId = req.user.id;

    const result = await updateMyAvailabilityService(
        userId,
        req.body.available
    );

    if (!result) {
        throw new AppError(404, "Doctor profile not found");
    }

    res.status(200).json({
        success: true,
        message: "Availability updated successfully",
        data: result
    });
};
export const getDoctorController = async (req, res) => {
    const { id } = req.params;
    const isPatientOrSuperAdmin = req.user?.role === "patient" || req.user?.role === "super_admin";
    const organizationId = isPatientOrSuperAdmin ? null : req.user.organizationId;
    const result = await getDoctorService(id, organizationId);
    if (!result) {
        throw new AppError(404, "Doctor not found");
    }
    res.status(200).json({
        success: true,
        data: result
    });
};
export const updateDoctorController = async (req, res) => {
    const { id } = req.params;
    const organizationId = req.user.organizationId;
    const result = await updateDoctorService(
        id,
        organizationId,
        req.body,
        req.file
    );
    if (!result) {
        throw new AppError(404, "Doctor not found");
    }
    res.status(200).json({
        success: true,
        message: "Doctor updated successfully",
        data: result
    });
};

export const getDoctorAvailableSlotsController = async (req, res) => {
    const { id } = req.params;
    const { date } = req.query;
    const patientUserId = req.user?.id || req.user?._id;

    const result = await getDoctorAvailableSlotsService(id, date, patientUserId);
    res.status(200).json({
        success: true,
        data: result
    });
};

export const deleteDoctorController = async (req, res) => {
    const { id } = req.params;
    const organizationId = req.user.organizationId;
    const result = await deleteDoctorService(id, organizationId);
    if (!result) {
        throw new AppError(
            404,
            "Doctor not found or already inactive"
        );
    }
    res.status(200).json({
        success: true,
        message: "Doctor deactivated successfully"
    });
};

// Section 6: Doctor Leave Controllers
export const addDoctorLeaveController = async (req, res) => {
    const doctorUserId = req.user.id || req.user._id;
    const result = await addDoctorLeaveService(doctorUserId, req.body);
    res.status(201).json({
        success: true,
        message: result.message,
        data: result
    });
};

export const getMyDoctorLeaveController = async (req, res) => {
    const doctorUserId = req.user.id || req.user._id;
    const result = await getMyDoctorLeaveService(doctorUserId);
    res.status(200).json({
        success: true,
        data: result
    });
};

export const getDoctorLeaveController = async (req, res) => {
    const { id } = req.params;
    const result = await getDoctorLeaveService(id);
    res.status(200).json({
        success: true,
        data: result
    });
};

export const deleteDoctorLeaveController = async (req, res) => {
    const doctorUserId = req.user.id || req.user._id;
    const { leaveId } = req.params;
    const result = await deleteDoctorLeaveService(doctorUserId, leaveId);
    res.status(200).json({
        success: true,
        message: result.message,
        data: result
    });
};