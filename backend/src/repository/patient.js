import PatientModel from "../model/patient.js";
export const createPatient = async (data) => {

    return await PatientModel.create(data);
};
export const getPatientByUserId = async (userId) => {

    return await PatientModel.findOne({
        userId
    })
    .populate(
        "userId",
        "name email phone profileImage isActive"
    );
};
export const updatePatientByUserId = async (
    userId,
    data
) => {

    return await PatientModel.findOneAndUpdate(
        {
            userId
        },
        data,
        {
            returnDocument: "after"
        }
    )
    .populate(
        "userId",
        "name email phone profileImage"
    );
};
export const getPatientById = async (id) => {

    return await PatientModel.findById(id)
        .populate(
            "userId",
            "name email phone profileImage"
        );
};