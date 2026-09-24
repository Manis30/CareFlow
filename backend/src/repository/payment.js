import PaymentModel from "../model/payment.js";
import { generateBusinessId } from "../util/idGenerator.js";

export const createPayment = async (data) => {
    if (!data.businessId) {
        data.businessId = generateBusinessId("PAY");
    }
    return await PaymentModel.create(data);
};
export const getPaymentByAppointmentId = async (
    appointmentId
) => {
    return await PaymentModel.findOne({
        appointmentId
    });
};
export const updatePaymentByAppointmentId = async (
    appointmentId,
    data
) => {
    return await PaymentModel.findOneAndUpdate(
        {
            appointmentId
        },
        data,
        {
            new: true
        }
    );
};
export const getPaymentsByPatientId = async (
    patientId
) => {
    return await PaymentModel.find({
        patientId
    })
        .populate({
            path: "appointmentId",
            populate: [
                {
                    path: "doctorId",
                    populate: {
                        path: "userId",
                        select: "name email phone profileImage"
                    }
                },
                {
                    path: "departmentId",
                    select: "name"
                }
            ]
        })
        .sort({
            createdAt: -1
        });

};