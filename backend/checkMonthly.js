import "dotenv/config";
import mongoose from "mongoose";

async function testMonthlyAgg() {
  await mongoose.connect(process.env.DB_URL);
  const Appointment = mongoose.model("Appointment", new mongoose.Schema({}, { strict: false }));
  const Organization = mongoose.model("Organization", new mongoose.Schema({}, { strict: false }));
  
  const orgs = await Organization.find({ status: { $ne: "rejected" } }).lean();
  const orgMap = Object.fromEntries(orgs.map((o) => [o._id.toString(), o]));
  
  const appointments = await Appointment.find({ organizationId: { $in: orgs.map(o => o._id) } })
    .select("organizationId status patientId appointmentDate")
    .lean();
    
  console.log("Total appointments:", appointments.length);

  // Group by month and clinic
  const clinicMonthMap = {};
  const platformMonthMap = {};
  const allMonthsSet = new Set();

  for (const appt of appointments) {
    if (!appt.appointmentDate || !appt.organizationId) continue;
    const d = new Date(appt.appointmentDate);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    allMonthsSet.add(monthKey);
    const oId = appt.organizationId.toString();

    if (!clinicMonthMap[oId]) clinicMonthMap[oId] = {};
    if (!clinicMonthMap[oId][monthKey]) {
      clinicMonthMap[oId][monthKey] = {
        total: 0,
        completed: 0,
        cancelled: 0,
        scheduled: 0,
        patients: new Set()
      };
    }
    const cStat = clinicMonthMap[oId][monthKey];
    cStat.total++;
    if (appt.status === 'completed') cStat.completed++;
    else if (appt.status === 'cancelled') cStat.cancelled++;
    else cStat.scheduled++;
    if (appt.patientId) cStat.patients.add(appt.patientId.toString());

    if (!platformMonthMap[monthKey]) {
      platformMonthMap[monthKey] = { total: 0, completed: 0 };
    }
    platformMonthMap[monthKey].total++;
    if (appt.status === 'completed') platformMonthMap[monthKey].completed++;
  }

  const sortedMonths = Array.from(allMonthsSet).sort();
  console.log("Sorted months:", sortedMonths);

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const clinicSeries = orgs.map((org) => {
    const oId = org._id.toString();
    const cData = clinicMonthMap[oId] || {};
    
    const monthly = sortedMonths.map((mKey) => {
      const [yearStr, monthStr] = mKey.split('-');
      const monthIdx = parseInt(monthStr, 10) - 1;
      const monthLabel = `${monthNames[monthIdx]} ${yearStr}`;
      const stat = cData[mKey] || { total: 0, completed: 0, cancelled: 0, scheduled: 0, patients: new Set() };
      const successRate = stat.total > 0 ? Number(((stat.completed / stat.total) * 100).toFixed(1)) : 0;
      
      const pStat = platformMonthMap[mKey] || { total: 0, completed: 0 };
      const pRate = pStat.total > 0 ? Number(((pStat.completed / pStat.total) * 100).toFixed(1)) : 0;
      const vsPlatform = Number((successRate - pRate).toFixed(1));

      return {
        monthKey: mKey,
        monthLabel,
        total: stat.total,
        completed: stat.completed,
        cancelled: stat.cancelled,
        scheduled: stat.scheduled,
        patientCount: stat.patients ? stat.patients.size : 0,
        successRate,
        platformSuccessRate: pRate,
        vsPlatform
      };
    });

    const latest = monthly[monthly.length - 1] || {};

    return {
      clinicId: oId,
      name: org.name,
      district: org.address?.district || org.address?.city || 'Tamil Nadu',
      monthly,
      latestSuccessRate: latest.successRate || 0,
      latestVolume: latest.total || 0
    };
  });

  console.log("Clinic Series Summary:");
  clinicSeries.forEach((c) => {
    console.log(`- ${c.name} (${c.district}): Latest ${c.latestSuccessRate}% | Volume ${c.latestVolume}`);
    console.log("  Rates:", c.monthly.map(m => `${m.monthLabel.split(' ')[0]}:${m.successRate}%`).join(', '));
  });

  await mongoose.disconnect();
}

testMonthlyAgg().catch(console.error);
