import AppointmentModel from "../model/appointment.js";
import mongoose from "mongoose";
import { formatDoctorName } from "../util/formatters.js";
export const createAppointment = async (data) => {

    return await AppointmentModel.create(data);

};
export const getAppointmentById = async (id) => {

    return await AppointmentModel.findById(id)
        .populate({
            path: "patientId",
            populate: {
                path: "userId",
                select: "name email phone profileImage"
            }
        })
        .populate({
            path: "doctorId",
            populate: {
                path: "userId",
                select: "name email phone profileImage"
            }
        })

        .populate(
            "departmentId",
            "name description"
        )
        .populate(
            "organizationId",
            "name address organizationLogo logo"
        );

};
export const getAppointmentsByPatientId = async (
    patientId,
    filter = {}
) => {

    return await AppointmentModel.find({
        patientId,
        ...filter
    })
        .populate({
            path: "patientId",
            populate: {
                path: "userId",
                select: "name email phone profileImage"
            }
        })
        .populate({
            path: "doctorId",
            populate: {
                path: "userId",
                select: "name email phone profileImage"
            }
        })

        .populate(
            "departmentId",
            "name"
        )

        .populate(
            "organizationId",
            "name address organizationLogo logo"
        )

        .sort({
            appointmentDate: -1,
            startTime: -1
        });

};
export const getAppointmentsByDoctorId = async (
    doctorId,
    filter = {}
) => {

    return await AppointmentModel.find({
        doctorId,
        ...filter
    })

        .populate({
            path: "patientId",
            populate: {
                path: "userId",
                select: "name email phone profileImage"
            }
        })
        .populate({
            path: "doctorId",
            populate: {
                path: "userId",
                select: "name email phone profileImage"
            }
        })

        .populate(
            "departmentId",
            "name"
        )

        .sort({
            appointmentDate: 1,
            startTime: 1
        });

};
export const getClinicAppointments = async (
    organizationId,
    filter = {},
    page = 1,
    limit = 10
) => {

    const finalFilter = {
        organizationId,
        ...filter
    };


    const skip =
        (page - 1) * limit;


    const [
        appointments,
        total
    ] = await Promise.all([

        AppointmentModel.find(finalFilter)

            .populate({
                path: "patientId",
                populate: {
                    path: "userId",
                    select: "name email phone profileImage"
                }
            })

            .populate({
                path: "doctorId",
                populate: {
                    path: "userId",
                    select: "name email phone profileImage"
                }
            })

            .populate(
                "departmentId",
                "name"
            )

            .sort({
                appointmentDate: -1,
                startTime: -1
            })

            .skip(skip)

            .limit(limit),


        AppointmentModel.countDocuments(
            finalFilter
        )

    ]);


    return {

        appointments,

        pagination: {

            total,

            page,

            limit,

            totalPages: Math.ceil(
                total / limit
            ),

            hasNextPage:
                page * limit < total,

            hasPreviousPage:
                page > 1

        }

    };

};
export const getBookedSlots = async (
    doctorId,
    appointmentDate
) => {

    return await AppointmentModel.find({
        doctorId,
        appointmentDate,
        status: "booked"
    })

        .select(
            "startTime endTime"
        );

};
export const updateAppointmentById = async (
    id,
    data
) => {

    return await AppointmentModel.findByIdAndUpdate(
        id,
        {
            $set: data
        },
        {
            returnDocument: 'after',
            runValidators: true
        }
    );

};
export const findAppointment = async (filter) => {
    return await AppointmentModel.findOne(filter)
        .populate({
            path: "patientId",
            populate: {
                path: "userId",
                select: "name email phone profileImage"
            }
        })

        .populate({
            path: "doctorId",
            populate: {
                path: "userId",
                select: "name email phone profileImage"
            }
        })

        .populate(
            "departmentId",
            "name description"
        )
        .populate(
            "organizationId",
            "name address"
        );
};
export const getClinicAppointmentStats = async (organizationId) => {
    try {
        if (!organizationId) {
            return {
                overview: { total: 0, booked: 0, completed: 0, cancelled: 0 },
                todayAppointments: 0,
                thisWeekAppointments: 0,
                upcomingConsultations: 0,
                thisWeekRevenue: 0,
                thisMonthRevenue: 0,
                totalDoctors: 0,
                doctorsAvailableToday: 0,
                totalDepartments: 0,
                totalPatients: 0,
                doctorRevenueThisMonth: []
            };
        }

        const orgIdObj = typeof organizationId === 'object' && organizationId?._id 
            ? organizationId._id 
            : new mongoose.Types.ObjectId(organizationId.toString());

        const now = new Date();
        
        // Date boundaries
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);
        
        const todayEnd = new Date(now);
        todayEnd.setHours(23, 59, 59, 999);

        // Start of current week (Monday)
        const currentDay = now.getDay();
        const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() + distanceToMonday);
        startOfWeek.setHours(0, 0, 0, 0);

        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);

        // Start of current month (1st of month)
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

        const DoctorModel = (await import("../model/doctor.js")).default;
        const DepartmentModel = (await import("../model/department.js")).default;
        const PaymentModel = (await import("../model/payment.js")).default;

        // Fetch doctors for organization
        const doctorsList = await DoctorModel.find({ organizationId: orgIdObj })
            .populate("userId", "name email phone isActive")
            .populate("departmentId", "name");

        const totalDoctors = doctorsList.length;

        // Doctors available today
        const todayWeekday = now.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
        const doctorsAvailableToday = doctorsList.filter((doc) => {
            if (doc.userId?.isActive === false) return false;
            const schedule = Array.isArray(doc.available) ? doc.available : [];
            const todayItem = schedule.find(
                (a) => (a.day || a.dayOfWeek || a.dayName || "").toLowerCase() === todayWeekday
            );
            return Boolean(todayItem?.isAvailable);
        }).length;

        const [totalDepartments, distinctPatients] = await Promise.all([
            DepartmentModel.countDocuments({ organizationId: orgIdObj }).catch(() => 0),
            AppointmentModel.distinct("patientId", { organizationId: orgIdObj }).catch(() => [])
        ]);

        // Aggregate appointment stats
        const apptStats = await AppointmentModel.aggregate([
            { $match: { organizationId: orgIdObj } },
            {
                $facet: {
                    overview: [
                        {
                            $group: {
                                _id: null,
                                total: { $sum: 1 },
                                booked: { $sum: { $cond: [{ $eq: ["$status", "booked"] }, 1, 0] } },
                                completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
                                cancelled: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } }
                            }
                        }
                    ],
                    today: [
                        { $match: { appointmentDate: { $gte: todayStart, $lte: todayEnd } } },
                        { $count: "count" }
                    ],
                    thisWeek: [
                        { $match: { appointmentDate: { $gte: startOfWeek, $lte: endOfWeek } } },
                        { $count: "count" }
                    ],
                    upcoming: [
                        { $match: { appointmentDate: { $gte: todayStart }, status: "booked" } },
                        { $count: "count" }
                    ]
                }
            }
        ]).catch(() => []);

        const firstResult = apptStats[0] || {};
        const overviewData = firstResult.overview?.[0] || { total: 0, booked: 0, completed: 0, cancelled: 0 };
        const todayAppointments = firstResult.today?.[0]?.count || 0;
        const thisWeekAppointments = firstResult.thisWeek?.[0]?.count || 0;
        const upcomingConsultations = firstResult.upcoming?.[0]?.count || 0;

        // Fetch all payment records with status = "paid" for the organization as single source of truth
        const allPayments = await PaymentModel.find({
            organizationId: orgIdObj,
            status: "paid"
        }).populate("appointmentId").catch(() => []);

        // Filter paid payments by paidAt (or createdAt) for week and month
        const thisWeekPaidPayments = allPayments.filter((p) => {
            const pmtDate = p.paidAt || p.createdAt;
            if (!pmtDate) return false;
            const d = new Date(pmtDate);
            return d >= startOfWeek && d <= endOfWeek;
        });

        const thisMonthPaidPayments = allPayments.filter((p) => {
            const pmtDate = p.paidAt || p.createdAt;
            if (!pmtDate) return false;
            const d = new Date(pmtDate);
            return d >= startOfMonth && d <= endOfMonth;
        });

        const thisWeekRevenue = thisWeekPaidPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        const thisMonthRevenue = thisMonthPaidPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

        // Doctor-wise Revenue & Appointment Performance This Month
        const monthAppts = await AppointmentModel.find({
            organizationId: orgIdObj,
            appointmentDate: { $gte: startOfMonth, $lte: endOfMonth }
        });

        const doctorMap = new Map();
        doctorsList.forEach((doc) => {
            const docUser = typeof doc.userId === 'object' ? doc.userId : {};
            const imgUrl =
                docUser?.profileImage?.url ||
                (typeof docUser?.profileImage === 'string' ? docUser.profileImage : '') ||
                docUser?.profilePicture?.url ||
                (typeof docUser?.profilePicture === 'string' ? docUser.profilePicture : '') ||
                doc?.profileImage?.url ||
                (typeof doc?.profileImage === 'string' ? doc.profileImage : '') ||
                null;

            doctorMap.set(doc._id.toString(), {
                doctorId: doc._id.toString(),
                doctorName: formatDoctorName(docUser?.name || doc.name || "Medical Specialist"),
                profileImage: imgUrl,
                departmentName: doc.departmentId?.name || "General Medicine",
                totalAppointments: 0,
                paidAppointments: 0,
                revenue: 0
            });
        });

        // Count total appointments per doctor for the current month
        monthAppts.forEach((appt) => {
            const docIdStr = appt.doctorId?._id ? appt.doctorId._id.toString() : appt.doctorId?.toString();
            if (docIdStr && doctorMap.has(docIdStr)) {
                doctorMap.get(docIdStr).totalAppointments += 1;
            }
        });

        // Calculate paid appointments and revenue per doctor for current month strictly from paid payment records
        thisMonthPaidPayments.forEach((p) => {
            const appt = p.appointmentId;
            const docIdStr = p.doctorId?.toString() || (appt?.doctorId?._id ? appt.doctorId._id.toString() : appt?.doctorId?.toString());
            if (docIdStr && doctorMap.has(docIdStr)) {
                const item = doctorMap.get(docIdStr);
                item.paidAppointments += 1;
                item.revenue += Number(p.amount) || 0;
            }
        });

        const doctorRevenueThisMonth = Array.from(doctorMap.values());

        return {
            overview: overviewData,
            todayAppointments,
            thisWeekAppointments,
            upcomingConsultations,
            thisWeekRevenue,
            thisMonthRevenue,
            totalDoctors,
            doctorsAvailableToday,
            totalDepartments,
            totalPatients: Array.isArray(distinctPatients) ? distinctPatients.length : 0,
            doctorRevenueThisMonth
        };
    } catch (error) {
        console.error("Error in getClinicAppointmentStats:", error.message);
        return {
            overview: { total: 0, booked: 0, completed: 0, cancelled: 0 },
            todayAppointments: 0,
            thisWeekAppointments: 0,
            upcomingConsultations: 0,
            thisWeekRevenue: 0,
            thisMonthRevenue: 0,
            totalDoctors: 0,
            doctorsAvailableToday: 0,
            totalDepartments: 0,
            totalPatients: 0,
            doctorRevenueThisMonth: []
        };
    }
};

export const updateMeetingDetails = async (id, onlineMeetingData) => {
    return await AppointmentModel.findByIdAndUpdate(
        id,
        {
            $set: {
                onlineMeeting: onlineMeetingData
            }
        },
        {
            returnDocument: 'after',
            runValidators: true
        }
    );
};