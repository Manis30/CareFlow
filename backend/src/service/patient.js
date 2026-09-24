import {
    createPatient,
    getPatientByUserId,
    updatePatientByUserId,
    getPatientById
} from "../repository/patient.js";
import { updateUser, getUserById } from "../repository/user.js";
import { registerService } from "./user.js";
import uploadToCloudinary from "../util/uploadToCloudinary.js";
import { createToken, tokenHash } from "../util/token.js";

const parseBackendAddress = (addrInput) => {
    if (!addrInput) return null;
    let parsed = addrInput;
    if (typeof addrInput === 'string') {
        try {
            parsed = JSON.parse(addrInput);
        } catch (e) {
            return { street: addrInput.trim(), city: '', state: '', pincode: '' };
        }
    }
    if (typeof parsed === 'object' && parsed !== null) {
        return {
            street: parsed.street ? String(parsed.street).trim() : '',
            city: parsed.city ? String(parsed.city).trim() : '',
            state: parsed.state ? String(parsed.state).trim() : '',
            pincode: parsed.pincode ? String(parsed.pincode).trim() : ''
        };
    }
    return null;
};

export const createPatientService = async (
    data,
    file
) => {
    let profileImage = null;

    if (file) {
        profileImage = await uploadToCloudinary(
            file.buffer,
            "careflow/profile-images",
            "image"
        );
    }

    const user = await registerService({
        name: data.name,
        email: data.email,
        phone: data.phone,
        password: data.password,
        role: "patient",
        mustResetPassword: false,
        profileImage
    });

    let patient;
    try {
        const parsedAddr = parseBackendAddress(data.address);
        patient = await createPatient({
            userId: user._id,
            dateOfBirth: data.dateOfBirth,
            gender: data.gender || "other",
            bloodGroup: data.bloodGroup || "A+",
            address: parsedAddr || { street: typeof data.address === 'string' ? data.address : '', city: '', state: '', pincode: '' },
            emergencyContact: data.emergencyContact,
            allergies: data.allergies
        });
    } catch (err) {
        const UserModel = (await import("../model/user.js")).default;
        await UserModel.findByIdAndDelete(user._id).catch(() => {});
        throw err;
    }

    // Generate auth tokens for immediate auto-login
    const accessToken = createToken({ id: user._id, role: user.role, organizationId: user.organizationId }, process.env.JWT_ACCESS_SECRET, '15m');
    const refreshToken = createToken({ id: user._id }, process.env.JWT_REFRESH_SECRET, '30d');
    const refreshTokenHash = await tokenHash(refreshToken);
    const updatedUser = await updateUser(user._id, { refreshTokenHash });

    return {
        user: updatedUser || user,
        patient,
        accessToken,
        refreshToken
    };
};

export const getMyPatientProfileService = async (userId) => {
    let patient = await getPatientByUserId(userId);
    if (!patient) {
        const UserModel = (await import("../model/user.js")).default;
        const user = await UserModel.findById(userId);
        if (user && user.role === 'patient') {
            await createPatient({
                userId: user._id,
                gender: 'other',
                bloodGroup: 'A+'
            });
            patient = await getPatientByUserId(userId);
        }
    }
    return patient;
};

export const updateMyPatientProfileService = async (
    userId,
    data,
    file
) => {
    let profileImage = null;
    if (file) {
        profileImage = await uploadToCloudinary(
            file.buffer,
            "careflow/profile-images",
            "image"
        );
    }

    const patient = await getPatientByUserId(userId);
    if (!patient) {
        return null;
    }

    const userData = {};
    if (data.name) userData.name = data.name;
    if (data.phone) userData.phone = data.phone;
    if (profileImage) userData.profileImage = profileImage;

    if (Object.keys(userData).length > 0) {
        await updateUser(userId, userData);
    }

    const patientData = {};
    if (data.dateOfBirth) patientData.dateOfBirth = data.dateOfBirth;
    if (data.gender) patientData.gender = data.gender;
    if (data.bloodGroup) patientData.bloodGroup = data.bloodGroup;
    if (data.address) {
        const parsedAddr = parseBackendAddress(data.address);
        if (parsedAddr) {
            patientData.address = parsedAddr;
        }
    }
    if (data.allergies !== undefined) patientData.allergies = data.allergies;

    if (Object.keys(patientData).length > 0) {
        await updatePatientByUserId(userId, patientData);
    }

    return await getPatientByUserId(userId);
};

export const getPatientService = async (id) => {
    return await getPatientById(id);
};