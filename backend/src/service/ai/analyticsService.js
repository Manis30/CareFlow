import mongoose from 'mongoose';
import OrganizationModel from '../../model/organization.js';
import AppointmentModel from '../../model/appointment.js';
import DoctorModel from '../../model/doctor.js';
import PatientModel from '../../model/patient.js';
import UserModel from '../../model/user.js';
import DepartmentModel from '../../model/department.js';
import PaymentModel from '../../model/payment.js';

const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
];

const DAY_NAMES = [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];

export const parseDatePeriod = (dateRangeType = 'this_month', customStart = null, customEnd = null, referenceDate = new Date()) => {
    const now = new Date(referenceDate);
    let start = null;
    let end = null;
    let label = 'All Time';
    let type = dateRangeType;

    const lower = String(dateRangeType || '').toLowerCase();

    if (customStart || customEnd) {
        start = customStart ? new Date(customStart) : new Date(now.getFullYear(), 0, 1);
        start.setHours(0, 0, 0, 0);
        end = customEnd ? new Date(customEnd) : new Date(now);
        end.setHours(23, 59, 59, 999);
        label = `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
        type = 'custom';
    } else if (lower === 'today') {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        label = `Today (${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})`;
    } else if (lower === 'yesterday') {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
        label = `Yesterday (${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})`;
    } else if (lower === 'this_week' || lower === 'thisweek') {
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        start = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0, 0);
        end = new Date(now);
        label = `This Week (${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })})`;
    } else if (lower === 'last_week' || lower === 'lastweek' || lower === 'past_7_days') {
        end = new Date(now);
        start = new Date(now);
        start.setDate(now.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        label = 'Past 7 Days';
    } else if (lower === 'this_month' || lower === 'thismonth') {
        start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        label = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;
    } else if (lower === 'last_month' || lower === 'lastmonth') {
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        label = `${MONTH_NAMES[start.getMonth()]} ${start.getFullYear()}`;
    } else if (lower === 'last_3_months' || lower === 'past_3_months' || lower === '3_months') {
        start = new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        label = `Past 3 Months (${MONTH_NAMES[start.getMonth()]} - ${MONTH_NAMES[end.getMonth()]} ${end.getFullYear()})`;
    } else if (lower === 'last_6_months' || lower === 'past_6_months' || lower === '6_months') {
        start = new Date(now.getFullYear(), now.getMonth() - 5, 1, 0, 0, 0, 0);
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        label = `Past 6 Months (${MONTH_NAMES[start.getMonth()]} - ${MONTH_NAMES[end.getMonth()]} ${end.getFullYear()})`;
    } else if (lower === 'past_30_days') {
        end = new Date(now);
        start = new Date(now);
        start.setDate(now.getDate() - 30);
        start.setHours(0, 0, 0, 0);
        label = 'Past 30 Days';
    } else if (lower === 'this_year') {
        start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
        end = new Date(now);
        label = `Year ${now.getFullYear()}`;
    } else {
        for (let m = 0; m < 12; m++) {
            const mName = MONTH_NAMES[m].toLowerCase();
            if (lower.includes(mName)) {
                const yMatch = lower.match(/\b(20\d\d)\b/);
                const yr = yMatch ? parseInt(yMatch[1], 10) : now.getFullYear();
                start = new Date(yr, m, 1, 0, 0, 0, 0);
                end = new Date(yr, m + 1, 0, 23, 59, 59, 999);
                label = `${MONTH_NAMES[m]} ${yr}`;
                type = 'specific_month';
                break;
            }
        }
    }

    if (!start || !end) {
        start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        end = new Date(now);
        label = `${MONTH_NAMES[now.getMonth()]} ${now.getFullYear()}`;
        type = 'this_month';
    }

    const durationMs = end.getTime() - start.getTime();
    const prevEnd = new Date(start.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - durationMs);
    let prevLabel = 'Previous Period';

    if (type === 'this_month' || type === 'last_month' || type === 'specific_month') {
        const pMonthDate = new Date(start.getFullYear(), start.getMonth() - 1, 1);
        prevLabel = `${MONTH_NAMES[pMonthDate.getMonth()]} ${pMonthDate.getFullYear()}`;
    } else if (type === 'this_week') {
        prevLabel = 'Last Week';
    } else if (type === 'today') {
        prevLabel = 'Yesterday';
    }

    return {
        type,
        start,
        end,
        label,
        previous: {
            start: prevStart,
            end: prevEnd,
            label: prevLabel
        }
    };
};

export const calculateMathSafely = (current, previous) => {
    const curr = Number(current) || 0;
    const prev = Number(previous) || 0;
    const diff = curr - prev;

    let percent = null;
    let text = '';

    if (prev === 0) {
        if (curr === 0) {
            percent = 0;
            text = 'No change (0 in both periods)';
        } else {
            percent = null;
            text = `${curr} recorded (none in previous period)`;
        }
    } else {
        percent = Number(((diff / prev) * 100).toFixed(1));
        text = `${diff >= 0 ? '+' : ''}${diff} (${percent >= 0 ? '+' : ''}${percent}%)`;
    }

    return {
        current: curr,
        previous: prev,
        difference: diff,
        percentageChange: percent,
        trend: diff > 0 ? 'up' : diff < 0 ? 'down' : 'neutral',
        comparisonText: text
    };
};

export const calculateRate = (numerator, denominator) => {
    const num = Number(numerator) || 0;
    const den = Number(denominator) || 0;
    if (den === 0) {
        return { rate: 0, text: '0.0%' };
    }
    const rate = Number(((num / den) * 100).toFixed(1));
    return { rate, text: `${rate}%` };
};

/**
 * Executes a controlled analytics query based on a structured plan and authenticated user scope.
 */
export const executeHealthcareAnalytics = async (user, plan = {}) => {
    const isSuperAdmin = user?.role === 'super_admin';
    const userOrgId = user?.organizationId?._id || user?.organizationId || null;

    // 1. Strict Tenant Isolation
    let effectiveOrgId = null;
    let scopeLabel = 'Platform-Wide (All Organizations)';

    if (!isSuperAdmin) {
        if (!userOrgId) {
            return {
                title: 'Clinic Operational Analytics',
                scope: 'Restricted Context',
                period: 'Current',
                source: 'Access Control',
                primaryMetric: { label: 'Accessible Records', value: 0 },
                summary: 'Access denied: Your account is not associated with an authorized clinic organization.'
            };
        }
        effectiveOrgId = new mongoose.Types.ObjectId(String(userOrgId));
        const orgDoc = await OrganizationModel.findById(effectiveOrgId).select('name').lean();
        scopeLabel = orgDoc?.name || 'Assigned Organization';
    } else {
        if (plan.organizationId) {
            try {
                effectiveOrgId = new mongoose.Types.ObjectId(String(plan.organizationId));
                const orgDoc = await OrganizationModel.findById(effectiveOrgId).select('name').lean();
                if (orgDoc) scopeLabel = orgDoc.name;
            } catch (e) {
                effectiveOrgId = null;
            }
        }
    }

    // 2. Resolve Date Range
    const period = parseDatePeriod(plan.dateRange || plan.timeframe || 'this_month', plan.startDate, plan.endDate);

    // 3. Dispatch to Specific Metric Handler
    const metricType = (plan.metric || plan.intent || 'overview').toLowerCase();

    let result = null;
    // A. ORGANIZATIONS / CLINIC GROWTH & COUNTS (Super Admin only for cross-org)
    if (metricType.includes('org') || metricType.includes('clinic')) {
        result = await handleOrganizationAnalytics(user, period, plan, isSuperAdmin, effectiveOrgId, scopeLabel);
    }
    // B. APPOINTMENT GROWTH / RATES / RANKINGS / COUNTS
    else if (metricType.includes('appointment') || metricType.includes('visit') || metricType.includes('booking') || metricType.includes('cancellation') || metricType.includes('completion') || metricType.includes('rate')) {
        result = await handleAppointmentAnalytics(user, period, plan, effectiveOrgId, scopeLabel);
    }
    // C. DOCTORS / WORKLOAD / SPECIALTIES
    else if (metricType.includes('doctor') || metricType.includes('specialty') || metricType.includes('workload')) {
        result = await handleDoctorAnalytics(user, period, plan, effectiveOrgId, scopeLabel);
    }
    // D. PATIENTS
    else if (metricType.includes('patient')) {
        result = await handlePatientAnalytics(user, period, plan, effectiveOrgId, scopeLabel);
    }
    // E. REVENUE / PAYMENTS
    else if (metricType.includes('payment') || metricType.includes('revenue') || metricType.includes('money')) {
        result = await handleRevenueAnalytics(user, period, plan, effectiveOrgId, scopeLabel);
    }
    // F. DEFAULT: PLATFORM OR CLINIC COMPREHENSIVE OVERVIEW
    else {
        result = await handleOverviewAnalytics(user, period, plan, isSuperAdmin, effectiveOrgId, scopeLabel);
    }

    if (result) {
        result.isAnalytics = true;
        result.groundedNarrative = result.summary || result.groundedNarrative || '';
    }
    return result;
};

const handleOrganizationAnalytics = async (user, period, plan, isSuperAdmin, effectiveOrgId, scopeLabel) => {
    if (!isSuperAdmin && !effectiveOrgId) {
        return {
            title: 'Organization Analytics',
            scope: scopeLabel,
            period: period.label,
            source: 'Organizations',
            primaryMetric: { label: 'Organizations', value: 0 },
            summary: 'Access restricted to your authorized clinic.'
        };
    }

    const totalOrgs = await OrganizationModel.countDocuments();
    const approvedOrgs = await OrganizationModel.countDocuments({ status: { $in: ['APPROVED', 'approved', 'ACTIVE', 'active'] } });
    const pendingOrgs = await OrganizationModel.countDocuments({ status: { $in: ['PENDING_REVIEW', 'pending_review', 'PENDING', 'pending'] } });
    const suspendedOrgs = await OrganizationModel.countDocuments({ status: { $in: ['SUSPENDED', 'suspended'] } });

    // Organizations created in current period vs previous period
    const currentNewOrgs = await OrganizationModel.countDocuments({
        createdAt: { $gte: period.start, $lte: period.end }
    });
    const previousNewOrgs = await OrganizationModel.countDocuments({
        createdAt: { $gte: period.previous.start, $lte: period.previous.end }
    });

    const growthMath = calculateMathSafely(currentNewOrgs, previousNewOrgs);

    // List recent clinics
    const orgList = await OrganizationModel.find()
        .sort({ createdAt: -1 })
        .limit(6)
        .select('name city address status createdAt')
        .lean();

    const ranking = orgList.map(o => ({
        name: o.name,
        value: o.status || 'Active',
        secondary: o.address?.city || 'Location N/A',
        date: o.createdAt ? new Date(o.createdAt).toLocaleDateString() : ''
    }));

    let narrative = '';
    const pLower = (plan.prompt || '').toLowerCase();

    if (pLower.includes('how many clinics') || pLower.includes('how many organizations') || pLower.includes('active organizations') || pLower.includes('active clinics')) {
        narrative = `There are currently ${approvedOrgs} active organizations registered on the platform (${totalOrgs} total tenants including ${pendingOrgs} pending review and ${suspendedOrgs} suspended).`;
    } else if (pLower.includes('added') || pLower.includes('new clinic') || pLower.includes('created') || pLower.includes('growth')) {
        if (currentNewOrgs === 0) {
            narrative = `No new organizations were created during ${period.label}. In ${period.previous.label}, ${previousNewOrgs} organization(s) were added. The platform has ${approvedOrgs} active organizations.`;
        } else {
            narrative = `${currentNewOrgs} new organization(s) were added during ${period.label}, compared with ${previousNewOrgs} in ${period.previous.label} (${growthMath.comparisonText}). The platform has ${approvedOrgs} active organizations in total.`;
        }
    } else {
        narrative = `Platform organization overview for ${period.label}: ${approvedOrgs} active clinics out of ${totalOrgs} total. Growth: ${growthMath.comparisonText}.`;
    }

    return {
        title: 'Platform Organization Analytics',
        scope: scopeLabel,
        period: period.label,
        source: 'Organizations',
        primaryMetric: {
            label: 'Active Organizations',
            value: approvedOrgs,
            change: growthMath.difference,
            percentageChange: growthMath.percentageChange,
            trend: growthMath.trend
        },
        supportingMetrics: [
            { label: 'Total Registered', value: totalOrgs },
            { label: 'Pending Review', value: pendingOrgs },
            { label: 'Suspended', value: suspendedOrgs },
            { label: 'New This Period', value: currentNewOrgs }
        ],
        comparison: {
            currentPeriod: period.label,
            currentValue: currentNewOrgs,
            previousPeriod: period.previous.label,
            previousValue: previousNewOrgs,
            difference: growthMath.difference,
            percentageChange: growthMath.percentageChange
        },
        ranking,
        summary: narrative
    };
};

const handleAppointmentAnalytics = async (user, period, plan, effectiveOrgId, scopeLabel) => {
    const filter = {
        appointmentDate: { $gte: period.start, $lte: period.end }
    };
    if (effectiveOrgId) {
        filter.organizationId = effectiveOrgId;
    }

    const prevFilter = {
        appointmentDate: { $gte: period.previous.start, $lte: period.previous.end }
    };
    if (effectiveOrgId) {
        prevFilter.organizationId = effectiveOrgId;
    }

    const total = await AppointmentModel.countDocuments(filter);
    const prevTotal = await AppointmentModel.countDocuments(prevFilter);
    const growthMath = calculateMathSafely(total, prevTotal);

    const completed = await AppointmentModel.countDocuments({
        ...filter,
        status: { $in: ['COMPLETED', 'completed'] }
    });
    const cancelled = await AppointmentModel.countDocuments({
        ...filter,
        status: { $in: ['CANCELLED', 'cancelled'] }
    });
    // Section 4: Explicit NO_SHOW count — previously lumped into activeQueue
    const noShow = await AppointmentModel.countDocuments({
        ...filter,
        status: { $in: ['NO_SHOW', 'no_show'] }
    });
    // activeQueue excludes COMPLETED, CANCELLED, and NO_SHOW (they are all terminal statuses)
    const activeQueue = await AppointmentModel.countDocuments({
        ...filter,
        status: { $nin: ['COMPLETED', 'completed', 'CANCELLED', 'cancelled', 'NO_SHOW', 'no_show'] }
    });

    const completionRate = calculateRate(completed, total);
    const cancellationRate = calculateRate(cancelled, total);
    const noShowRate = calculateRate(noShow, total);

    const promptLower = (plan.prompt || '').toLowerCase();
    const isSuperAdmin = user.role === 'super_admin';

    // Grouping breakdowns
    let ranking = [];
    let rankingTitle = 'Performance Breakdown';
    let busiestDayName = null;

    // Check if grouping by clinic
    if ((isSuperAdmin && !effectiveOrgId) && (plan.groupBy === 'clinic' || plan.groupBy === 'organization' || promptLower.includes('clinic') || promptLower.includes('cancellation rate') || promptLower.includes('grew the most') || promptLower.includes('grew the fastest') || promptLower.includes('rank'))) {
        rankingTitle = 'Clinic Appointment Distribution';
        const agg = await AppointmentModel.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: '$organizationId',
                    total: { $sum: 1 },
                    completed: {
                        $sum: { $cond: [{ $in: ['$status', ['COMPLETED', 'completed']] }, 1, 0] }
                    },
                    cancelled: {
                        $sum: { $cond: [{ $in: ['$status', ['CANCELLED', 'cancelled']] }, 1, 0] }
                    }
                }
            },
            {
                $lookup: {
                    from: 'organizations',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'org'
                }
            },
            { $unwind: { path: '$org', preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    name: { $ifNull: ['$org.name', 'General Clinic'] },
                    total: 1,
                    completed: 1,
                    cancelled: 1,
                    cancellationRate: {
                        $cond: [
                            { $gt: ['$total', 0] },
                            { $multiply: [{ $divide: ['$cancelled', '$total'] }, 100] },
                            0
                        ]
                    }
                }
            }
        ]);

        if (promptLower.includes('highest cancellation') || promptLower.includes('most cancelled') || plan.sort === 'cancellation_rate') {
            agg.sort((a, b) => b.cancellationRate - a.cancellationRate);
        } else if (plan.sort === 'fewest' || promptLower.includes('fewest') || promptLower.includes('least')) {
            agg.sort((a, b) => a.total - b.total);
        } else {
            agg.sort((a, b) => b.total - a.total);
        }

        ranking = agg.map(item => ({
            name: item.name,
            value: item.total,
            secondary: (item.total > 0 ? ((item.total / (total || 1)) * 100).toFixed(1) : '0') + '% of total',
            details: `${item.completed} completed, ${item.cancelled} cancelled (${item.cancellationRate.toFixed(1)}% rate)`
        }));
    } else if (plan.groupBy === 'doctor' || promptLower.includes('which doctor') || promptLower.includes('busiest doctor') || promptLower.includes('highest workload') || promptLower.includes('doctor volume')) {
        rankingTitle = 'Top Doctor Appointment Workload';
        const agg = await AppointmentModel.aggregate([
            { $match: filter },
            { $group: { _id: '$doctorId', total: { $sum: 1 } } },
            { $sort: { total: -1 } },
            { $limit: 6 },
            {
                $lookup: {
                    from: 'doctors',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'doc'
                }
            },
            { $unwind: { path: '$doc', preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: 'users',
                    localField: 'doc.userId',
                    foreignField: '_id',
                    as: 'u'
                }
            },
            { $unwind: { path: '$u', preserveNullAndEmptyArrays: true } }
        ]);

        ranking = agg.map(a => ({
            name: a.u?.name ? 'Dr. ' + a.u.name.replace(/^Dr\.?\s+/i, '') : 'Specialist',
            value: a.total,
            secondary: a.doc?.specialization || 'General Practice'
        }));
    } else if (plan.groupBy === 'department' || promptLower.includes('department')) {
        rankingTitle = 'Appointments by Department';
        const agg = await AppointmentModel.aggregate([
            { $match: filter },
            { $group: { _id: '$departmentId', total: { $sum: 1 } } },
            { $sort: { total: -1 } },
            { $limit: 6 },
            {
                $lookup: {
                    from: 'departments',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'dept'
                }
            },
            { $unwind: { path: '$dept', preserveNullAndEmptyArrays: true } }
        ]);

        ranking = agg.map(a => ({
            name: a.dept?.name || 'General Department',
            value: a.total,
            secondary: ((a.total / (total || 1)) * 100).toFixed(1) + '% of visits'
        }));
    } else if (plan.groupBy === 'specialty' || promptLower.includes('specialty') || promptLower.includes('most booked') || promptLower.includes('popular')) {
        rankingTitle = 'Most Booked Specialties';
        const agg = await AppointmentModel.aggregate([
            { $match: filter },
            {
                $lookup: {
                    from: 'doctors',
                    localField: 'doctorId',
                    foreignField: '_id',
                    as: 'doc'
                }
            },
            { $unwind: { path: '$doc', preserveNullAndEmptyArrays: true } },
            { $group: { _id: { $ifNull: ['$doc.specialization', 'General Medicine'] }, total: { $sum: 1 } } },
            { $sort: { total: -1 } },
            { $limit: 6 }
        ]);

        ranking = agg.map(a => ({
            name: a._id,
            value: a.total,
            secondary: ((a.total / (total || 1)) * 100).toFixed(1) + '% of visits'
        }));
    } else if (plan.groupBy === 'dayOfWeek' || promptLower.includes('busiest day') || promptLower.includes('day of week') || promptLower.includes('which day')) {
        rankingTitle = 'Appointments by Day of Week';
        const agg = await AppointmentModel.aggregate([
            { $match: filter },
            { $group: { _id: { $dayOfWeek: '$appointmentDate' }, total: { $sum: 1 } } },
            { $sort: { total: -1 } }
        ]);

        ranking = agg.map(a => ({
            name: DAY_NAMES[a._id - 1] || 'Day ' + a._id,
            value: a.total,
            secondary: ((a.total / (total || 1)) * 100).toFixed(1) + '% of visits'
        }));

        if (ranking.length > 0) {
            busiestDayName = ranking[0].name;
        }
    }

    // Trend calculation for multi-month queries
    let trend = [];
    if (period.type === 'last_3_months' || period.type === 'last_6_months' || promptLower.includes('3 months') || promptLower.includes('6 months') || promptLower.includes('trend')) {
        const monthsBack = promptLower.includes('6 months') ? 6 : 3;
        const trendStart = new Date(period.end.getFullYear(), period.end.getMonth() - (monthsBack - 1), 1);
        const trendAgg = await AppointmentModel.aggregate([
            {
                $match: {
                    appointmentDate: { $gte: trendStart, $lte: period.end },
                    ...(effectiveOrgId ? { organizationId: effectiveOrgId } : {})
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$appointmentDate' },
                        month: { $month: '$appointmentDate' }
                    },
                    total: { $sum: 1 },
                    completed: {
                        $sum: { $cond: [{ $in: ['$status', ['COMPLETED', 'completed']] }, 1, 0] }
                    }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);

        trend = trendAgg.map(t => ({
            label: `${MONTH_NAMES[t._id.month - 1].substring(0, 3)} ${t._id.year}`,
            value: t.total,
            completed: t.completed
        }));
    }

    // Grounded Narrative Synthesis
    let narrative = '';
    if (total === 0) {
        narrative = `No appointment records were found for ${period.label}` + (effectiveOrgId ? ` in ${scopeLabel}.` : ` across the platform.`);
    } else if (promptLower.includes('no-show') || promptLower.includes('no show') || promptLower.includes('noshow')) {
        narrative = `The no-show rate for ${period.label} is ${noShowRate.text} (${noShow} no-show${noShow !== 1 ? 's' : ''} out of ${total} total appointments). Of the remaining appointments: ${completed} completed (${completionRate.text}) and ${cancelled} cancelled (${cancellationRate.text}).`;
    } else if (promptLower.includes('completion rate')) {
        narrative = `The appointment completion rate for ${period.label} is ${completionRate.text} (${completed} completed out of ${total} total appointments).`;
    } else if (promptLower.includes('cancellation rate') || promptLower.includes('cancelled')) {
        if (ranking.length > 0 && promptLower.includes('highest cancellation')) {
            const topCancelClinic = ranking[0];
            narrative = `${topCancelClinic.name} had the highest cancellation rate at ${topCancelClinic.details}. Platform-wide cancellation rate was ${cancellationRate.text} (${cancelled} cancelled out of ${total} total).`;
        } else {
            narrative = `The cancellation rate for ${period.label} is ${cancellationRate.text} (${cancelled} cancelled out of ${total} total appointments).`;
        }
    } else if (promptLower.includes('which clinic has the most') || promptLower.includes('most appointments')) {
        if (ranking.length > 0) {
            const topClinic = ranking[0];
            narrative = `${topClinic.name} recorded the most appointments in ${period.label} with ${topClinic.value} bookings (${topClinic.secondary}). Total appointments: ${total}.`;
        } else {
            narrative = `Total appointments for ${period.label}: ${total}.`;
        }
    } else if (promptLower.includes('fewest')) {
        if (ranking.length > 0) {
            const fewestClinic = ranking[ranking.length - 1] || ranking[0];
            narrative = `${fewestClinic.name} recorded the fewest appointments in ${period.label} with ${fewestClinic.value} bookings (${fewestClinic.secondary}). Total appointments: ${total}.`;
        } else {
            narrative = `Total appointments for ${period.label}: ${total}.`;
        }
    } else if (promptLower.includes('busiest day') && busiestDayName) {
        narrative = `${busiestDayName} was the busiest day of the week for appointments during ${period.label} with ${ranking[0].value} bookings.`;
    } else if (promptLower.includes('compare') || promptLower.includes('growth') || promptLower.includes('what changed')) {
        narrative = `In ${period.label}, there were ${total} appointments compared with ${prevTotal} in ${period.previous.label} (${growthMath.comparisonText}). Of these, ${completed} were completed (${completionRate.text}) and ${cancelled} were cancelled (${cancellationRate.text}).`;
    } else {
        narrative = `Recorded ${total} appointment(s) during ${period.label}: ${completed} completed (${completionRate.text}), ${cancelled} cancelled (${cancellationRate.text}), ${noShow} no-show${noShow !== 1 ? 's' : ''} (${noShowRate.text}), and ${activeQueue} upcoming. Growth vs ${period.previous.label}: ${growthMath.comparisonText}.`;
    }

    return {
        title: 'Appointment Analytics',
        scope: scopeLabel,
        period: period.label,
        source: 'Appointments',
        primaryMetric: (promptLower.includes('cancellation rate') || plan.rateType === 'cancellation')
            ? {
                label: 'Cancellation Rate',
                value: cancellationRate.text,
                change: null,
                percentageChange: null,
                trend: cancellationRate.rate > 20 ? 'up' : 'neutral'
            }
            : (promptLower.includes('completion rate') || plan.rateType === 'completion')
            ? {
                label: 'Completion Rate',
                value: completionRate.text,
                change: null,
                percentageChange: null,
                trend: completionRate.rate >= 80 ? 'up' : 'down'
            }
            : (promptLower.includes('no-show') || promptLower.includes('no show') || promptLower.includes('noshow'))
            ? {
                label: 'No-Show Rate',
                value: noShowRate.text,
                change: null,
                percentageChange: null,
                trend: noShowRate.rate > 10 ? 'up' : 'neutral'
            }
            : {
                label: 'Total Appointments',
                value: total,
                change: growthMath.difference,
                percentageChange: growthMath.percentageChange,
                trend: growthMath.trend
            },
        supportingMetrics: [
            { label: 'Completed', value: completed, rate: completionRate.text },
            { label: 'Cancelled', value: cancelled, rate: cancellationRate.text },
            { label: 'No-Shows', value: noShow, rate: noShowRate.text },
            { label: 'Active Queue', value: activeQueue },
            { label: 'Completion Rate', value: completionRate.text }
        ],
        comparison: {
            currentPeriod: period.label,
            currentValue: total,
            previousPeriod: period.previous.label,
            previousValue: prevTotal,
            difference: growthMath.difference,
            percentageChange: growthMath.percentageChange
        },
        rankingTitle,
        ranking,
        trend,
        summary: narrative
    };
};

const handleDoctorAnalytics = async (user, period, plan, effectiveOrgId, scopeLabel) => {
    const docQuery = effectiveOrgId ? { organizationId: effectiveOrgId } : {};
    const totalDoctors = await DoctorModel.countDocuments(docQuery);

    const agg = await DoctorModel.aggregate([
        { $match: docQuery },
        { $group: { _id: { $ifNull: ['$specialization', 'General Medicine'] }, count: { $sum: 1 } } },
        { $sort: { count: -1 } }
    ]);

    const ranking = agg.map(a => ({
        name: a._id,
        value: a.count,
        secondary: ((a.count / (totalDoctors || 1)) * 100).toFixed(1) + '% of medical staff'
    }));

    const narrative = `There are ${totalDoctors} medical doctor(s) registered ` + (effectiveOrgId ? `at ${scopeLabel}` : 'across the platform') + `. Leading specialty: ${ranking[0]?.name || 'General Medicine'} (${ranking[0]?.value || 0} doctors).`;

    return {
        title: 'Doctor Staff & Specialty Analytics',
        scope: scopeLabel,
        period: period.label,
        source: 'Doctors Ledger',
        primaryMetric: {
            label: 'Registered Doctors',
            value: totalDoctors
        },
        supportingMetrics: [
            { label: 'Specialties Represented', value: ranking.length }
        ],
        rankingTitle: 'Staff by Specialty',
        ranking,
        summary: narrative
    };
};

const handlePatientAnalytics = async (user, period, plan, effectiveOrgId, scopeLabel) => {
    let totalPatients = 0;
    let newPatientsCurrent = 0;
    let newPatientsPrevious = 0;

    if (effectiveOrgId) {
        const patientIds = await AppointmentModel.distinct('patientId', { organizationId: effectiveOrgId });
        totalPatients = patientIds.length;

        const currentAppts = await AppointmentModel.find({
            organizationId: effectiveOrgId,
            createdAt: { $gte: period.start, $lte: period.end }
        }).distinct('patientId');
        newPatientsCurrent = currentAppts.length;

        const prevAppts = await AppointmentModel.find({
            organizationId: effectiveOrgId,
            createdAt: { $gte: period.previous.start, $lte: period.previous.end }
        }).distinct('patientId');
        newPatientsPrevious = prevAppts.length;
    } else {
        totalPatients = await PatientModel.countDocuments();
        newPatientsCurrent = await PatientModel.countDocuments({
            createdAt: { $gte: period.start, $lte: period.end }
        });
        newPatientsPrevious = await PatientModel.countDocuments({
            createdAt: { $gte: period.previous.start, $lte: period.previous.end }
        });
    }

    const growthMath = calculateMathSafely(newPatientsCurrent, newPatientsPrevious);

    const narrative = `Total registered patients: ${totalPatients}. During ${period.label}, ${newPatientsCurrent} new patient(s) joined, compared with ${newPatientsPrevious} in ${period.previous.label} (${growthMath.comparisonText}).`;

    return {
        title: 'Patient Demographics & Growth',
        scope: scopeLabel,
        period: period.label,
        source: 'Patients Directory',
        primaryMetric: {
            label: 'Total Patients',
            value: totalPatients,
            change: growthMath.difference,
            percentageChange: growthMath.percentageChange,
            trend: growthMath.trend
        },
        supportingMetrics: [
            { label: 'New This Period', value: newPatientsCurrent },
            { label: 'Prior Period New', value: newPatientsPrevious }
        ],
        comparison: {
            currentPeriod: period.label,
            currentValue: newPatientsCurrent,
            previousPeriod: period.previous.label,
            previousValue: newPatientsPrevious,
            difference: growthMath.difference,
            percentageChange: growthMath.percentageChange
        },
        summary: narrative
    };
};

const handleRevenueAnalytics = async (user, period, plan, effectiveOrgId, scopeLabel) => {
    const filter = {
        createdAt: { $gte: period.start, $lte: period.end }
    };
    if (effectiveOrgId) filter.organizationId = effectiveOrgId;

    const prevFilter = {
        createdAt: { $gte: period.previous.start, $lte: period.previous.end }
    };
    if (effectiveOrgId) prevFilter.organizationId = effectiveOrgId;

    const currentAgg = await PaymentModel.aggregate([
        { $match: filter },
        {
            $group: {
                _id: null,
                totalCollected: {
                    $sum: { $cond: [{ $in: ['$status', ['PAID', 'paid']] }, '$amount', 0] }
                },
                totalPending: {
                    $sum: { $cond: [{ $in: ['$status', ['PAYMENT_PENDING', 'pending', 'CREATED']] }, '$amount', 0] }
                },
                totalRefunded: {
                    $sum: { $cond: [{ $in: ['$status', ['REFUNDED', 'refunded']] }, { $ifNull: ['$refundAmount', '$amount'] }, 0] }
                },
                count: { $sum: 1 }
            }
        }
    ]);

    const prevAgg = await PaymentModel.aggregate([
        { $match: prevFilter },
        {
            $group: {
                _id: null,
                totalCollected: {
                    $sum: { $cond: [{ $in: ['$status', ['PAID', 'paid']] }, '$amount', 0] }
                }
            }
        }
    ]);

    const collected = currentAgg[0]?.totalCollected || 0;
    const pending = currentAgg[0]?.totalPending || 0;
    const refunded = currentAgg[0]?.totalRefunded || 0;
    const prevCollected = prevAgg[0]?.totalCollected || 0;
    const growthMath = calculateMathSafely(collected, prevCollected);

    const narrative = `Total revenue collected for ${period.label}: ₹${collected.toLocaleString()} (${growthMath.comparisonText} vs ₹${prevCollected.toLocaleString()} in ${period.previous.label}). Pending: ₹${pending.toLocaleString()}, Refunded: ₹${refunded.toLocaleString()}.`;

    return {
        title: 'Financial & Revenue Analytics',
        scope: scopeLabel,
        period: period.label,
        source: 'Payments Ledger',
        primaryMetric: {
            label: 'Total Revenue Collected',
            value: '₹' + collected.toLocaleString(),
            change: growthMath.difference,
            percentageChange: growthMath.percentageChange,
            trend: growthMath.trend
        },
        supportingMetrics: [
            { label: 'Pending Collections', value: '₹' + pending.toLocaleString() },
            { label: 'Refunds Issued', value: '₹' + refunded.toLocaleString() }
        ],
        comparison: {
            currentPeriod: period.label,
            currentValue: '₹' + collected.toLocaleString(),
            previousPeriod: period.previous.label,
            previousValue: '₹' + prevCollected.toLocaleString(),
            difference: growthMath.difference,
            percentageChange: growthMath.percentageChange
        },
        summary: narrative
    };
};

const handleOverviewAnalytics = async (user, period, plan, isSuperAdmin, effectiveOrgId, scopeLabel) => {
    const apptResult = await handleAppointmentAnalytics(user, period, plan, effectiveOrgId, scopeLabel);

    if (isSuperAdmin && !effectiveOrgId) {
        const totalOrgs = await OrganizationModel.countDocuments();
        const approvedOrgs = await OrganizationModel.countDocuments({ status: { $in: ['APPROVED', 'approved', 'ACTIVE', 'active'] } });
        const totalDoctors = await DoctorModel.countDocuments();
        const totalPatients = await PatientModel.countDocuments();

        const narrative = `Platform Overview for ${period.label}: ${approvedOrgs} active clinics, ${totalDoctors} doctors, and ${totalPatients} registered patients. Total appointments in period: ${apptResult.primaryMetric.value} (${apptResult.supportingMetrics[0].value} completed, ${apptResult.supportingMetrics[1].value} cancelled).`;

        return {
            title: 'Platform Operational Intelligence Overview',
            scope: scopeLabel,
            period: period.label,
            source: 'Platform Operations Mesh',
            primaryMetric: apptResult.primaryMetric,
            supportingMetrics: [
                { label: 'Active Clinics', value: approvedOrgs },
                { label: 'Registered Doctors', value: totalDoctors },
                { label: 'Registered Patients', value: totalPatients },
                ...apptResult.supportingMetrics
            ],
            comparison: apptResult.comparison,
            rankingTitle: apptResult.rankingTitle,
            ranking: apptResult.ranking,
            trend: apptResult.trend,
            summary: narrative
        };
    }

    return apptResult;
};