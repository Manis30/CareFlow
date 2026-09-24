import DoctorModel from "../model/doctor.js";
import UserModel from "../model/user.js";
import DepartmentModel from "../model/department.js";
import OrganizationModel from "../model/organization.js";

export const createDoctor = async (data) => {
    return await DoctorModel.create(data);
};

export const getAllDoctors = async (organizationId, city, specialty) => {
    const targetOrgId = (organizationId && organizationId !== 'undefined' && organizationId !== 'null' && String(organizationId).trim())
        ? String(organizationId).trim()
        : null;

    const query = {};
    if (targetOrgId) {
        query.organizationId = targetOrgId;
    }

    const doctors = await DoctorModel.find(query)
    .populate(
        "userId",
        "name email phone profileImage isActive createdAt"
    )
    .populate(
        "departmentId",
        "name"
    )
    .populate(
        "departmentIds",
        "name"
    )
    .populate(
        "organizationId",
        "name email phone address workingHours status organizationLogo logo"
    )
    .sort({ createdAt: -1 });

    return doctors.filter((doc) => {
        const userActive = doc.userId?.isActive !== false;
        const orgActive = doc.organizationId?.status !== "suspended";

        let cityMatches = true;
        if (city && city.trim()) {
            const orgCity = doc.organizationId?.address?.city;
            cityMatches = orgCity && String(orgCity).trim().toLowerCase() === String(city).trim().toLowerCase();
        }

        let orgMatches = true;
        if (targetOrgId) {
            const docOrgId = doc.organizationId?._id ? doc.organizationId._id.toString() : doc.organizationId?.toString();
            orgMatches = docOrgId === targetOrgId;
        }

        let specialtyMatches = true;
        if (specialty && String(specialty).trim()) {
            const cleanSpec = String(specialty).trim().toLowerCase();
            const specStr = String(doc.specialization || '').toLowerCase();
            const deptName = String(doc.departmentId?.name || '').toLowerCase();
            const deptsArr = (doc.departments || []).map(d => String(d).toLowerCase());

            specialtyMatches = specStr.includes(cleanSpec) || deptName.includes(cleanSpec) || deptsArr.some(d => d.includes(cleanSpec));
        }

        return userActive && orgActive && cityMatches && orgMatches && specialtyMatches;
    });
};

export const getDoctorByUserId = async (userId) => {
    return await DoctorModel.findOne({
        userId
    })
    .populate(
        "userId",
        "name email phone profileImage isActive createdAt"
    )
    .populate(
        "departmentId",
        "name"
    )
    .populate(
        "departmentIds",
        "name"
    )
    .populate(
        "organizationId",
        "name email phone address workingHours status organizationLogo logo"
    );
};

export const updateDoctorByUserId = async (
    userId,
    data
) => {
    return await DoctorModel.findOneAndUpdate(
        {
            userId
        },
        data,
        {
            returnDocument: 'after'
        }
    );
};

export const getDoctorById = async (
    id,
    organizationId
) => {
    let doc = null;
    if (organizationId) {
        doc = await DoctorModel.findOne({
            _id: id,
            organizationId
        })
        .populate("userId", "name email phone profileImage isActive createdAt")
        .populate("departmentId", "name")
        .populate("departmentIds", "name")
        .populate("organizationId", "name email phone address workingHours status organizationLogo logo");
    }

    if (!doc) {
        doc = await DoctorModel.findById(id)
        .populate("userId", "name email phone profileImage isActive createdAt")
        .populate("departmentId", "name")
        .populate("departmentIds", "name")
        .populate("organizationId", "name email phone address workingHours status organizationLogo logo");
    }

    return doc;
};

export const updateDoctorById = async (
    id,
    organizationId,
    data
) => {
    return await DoctorModel.findOneAndUpdate(
        {
            _id: id,
            organizationId
        },
        data,
        {
            returnDocument: 'after'
        }
    );
};

export const deactivateDoctor = async (
    id,
    organizationId
) => {
    return await DoctorModel.findOneAndUpdate(
        {
            _id: id,
            organizationId
        },
        {
            $set: { updatedAt: new Date() }
        },
        {
            returnDocument: 'after'
        }
    );
};