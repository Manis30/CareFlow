import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Stethoscope, Building2, User, Award, CheckCircle2, ArrowLeft } from 'lucide-react';

/**
 * CareFlowWorkforceFlow
 * 
 * Clean Drillable Workforce Flow:
 * Replaces massive 48-node icicle with surgical, interactive workforce hierarchy:
 * Platform Network -> Facility Clinic -> Clinical Specialty -> Practitioner
 */
export const CareFlowWorkforceFlow = ({
  doctors = [],
  facilities = [],
  onDoctorSelect = null,
  className = ''
}) => {
  // Navigation stack: 'all' | orgId | { orgId, deptName }
  const [selectedOrgId, setSelectedOrgId] = useState(null);
  const [selectedDept, setSelectedDept] = useState(null);

  // Group doctors by clinic
  const workforceTree = useMemo(() => {
    if (!doctors || doctors.length === 0) return {};

    const tree = {};
    doctors.forEach((doc) => {
      const orgId = doc.organizationId?._id || doc.organizationId || 'unassigned';
      const orgName = doc.organizationId?.name || 'CareFlow Facility';
      const dept = doc.specialization || doc.departmentId?.name || 'General Medicine';

      if (!tree[orgId]) {
        tree[orgId] = {
          id: orgId,
          name: orgName,
          doctorsCount: 0,
          departments: {}
        };
      }

      tree[orgId].doctorsCount += 1;

      if (!tree[orgId].departments[dept]) {
        tree[orgId].departments[dept] = [];
      }
      tree[orgId].departments[dept].push(doc);
    });

    return tree;
  }, [doctors]);

  const orgList = Object.values(workforceTree);
  const activeOrg = selectedOrgId ? workforceTree[selectedOrgId] : null;
  const activeDeptDoctors = (activeOrg && selectedDept) ? activeOrg.departments[selectedDept] || [] : [];

  return (
    <div className={`p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col ${className}`}>
      {/* Header with Breadcrumb Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
            <Stethoscope className="w-4 h-4 text-blue-600" />
            Clinical Workforce Hierarchy & Distribution
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Drillable clinical practitioner staffing across facility networks & specialties
          </p>
        </div>

        {/* Breadcrumb Trail */}
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200/60">
          <button
            type="button"
            onClick={() => { setSelectedOrgId(null); setSelectedDept(null); }}
            className={`hover:text-blue-600 transition-colors ${!selectedOrgId ? 'text-blue-600' : ''}`}
          >
            All Facilities ({doctors.length})
          </button>

          {activeOrg && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <button
                type="button"
                onClick={() => setSelectedDept(null)}
                className={`hover:text-blue-600 transition-colors truncate max-w-[140px] ${!selectedDept ? 'text-blue-600' : ''}`}
              >
                {activeOrg.name}
              </button>
            </>
          )}

          {selectedDept && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-blue-600 font-bold truncate max-w-[140px]">
                {selectedDept}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Content View with Animated Transitions */}
      <div className="min-h-[280px]">
        <AnimatePresence mode="wait">
          {/* LEVEL 1: Facility Clinics Grid */}
          {!selectedOrgId && (
            <motion.div
              key="facilities"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
            >
              {orgList.map((org) => {
                const deptsCount = Object.keys(org.departments).length;

                return (
                  <div
                    key={org.id}
                    onClick={() => setSelectedOrgId(org.id)}
                    className="p-4 rounded-xl border border-slate-200/90 hover:border-blue-400 hover:shadow-sm bg-slate-50/40 hover:bg-white cursor-pointer transition-all group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                          {org.doctorsCount} Clinicians
                        </span>
                      </div>

                      <h4 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1">
                        {org.name}
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-1">
                        {deptsCount} Clinical Departments
                      </p>
                    </div>

                    <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-blue-600 font-medium">
                      <span>Explore Staff</span>
                      <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                );
              })}
            </motion.div>
          )}

          {/* LEVEL 2: Specialties in Selected Facility */}
          {selectedOrgId && !selectedDept && activeOrg && (
            <motion.div
              key="departments"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              <div className="flex items-center justify-between mb-2">
                <button
                  type="button"
                  onClick={() => setSelectedOrgId(null)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to All Facilities
                </button>
                <span className="text-xs text-slate-500">
                  Select a department to inspect attending physicians
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.entries(activeOrg.departments).map(([deptName, docList]) => (
                  <div
                    key={deptName}
                    onClick={() => setSelectedDept(deptName)}
                    className="p-4 rounded-xl border border-slate-200 hover:border-emerald-400 hover:shadow-sm bg-white cursor-pointer transition-all group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                        <Stethoscope className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                        {docList.length} Attending
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-slate-900 group-hover:text-emerald-600 transition-colors">
                      {deptName}
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-1 truncate">
                      {docList.map(d => d.userId?.name || 'Dr. Specialist').join(', ')}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* LEVEL 3: Attending Physicians Roster in Selected Department */}
          {selectedOrgId && selectedDept && (
            <motion.div
              key="physicians"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              <div className="flex items-center justify-between mb-2">
                <button
                  type="button"
                  onClick={() => setSelectedDept(null)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to {activeOrg.name} Departments
                </button>
                <span className="text-xs text-slate-500">
                  {activeDeptDoctors.length} Specialized Practitioners
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {activeDeptDoctors.map((doc) => {
                  const name = doc.userId?.name || 'Dr. Specialist';
                  const email = doc.userId?.email || '';
                  const fee = doc.consultationFee || 500;
                  const completed = doc.stats?.completedCount || 0;
                  const total = doc.stats?.appointmentsCount || 0;

                  return (
                    <div
                      key={doc._id}
                      onClick={() => onDoctorSelect && onDoctorSelect(doc)}
                      className="p-4 rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow-sm bg-white cursor-pointer transition-all flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 font-bold shrink-0 overflow-hidden border border-slate-200">
                          {doc.userId?.profileImage?.url ? (
                            <img src={doc.userId.profileImage.url} alt={name} className="w-full h-full object-cover" />
                          ) : (
                            name.replace('Dr. ', '').charAt(0)
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-slate-900 truncate">
                            {name}
                          </h4>
                          <p className="text-[11px] text-slate-500 truncate">
                            {doc.qualification || 'MBBS, MD'} • Fee: ₹{fee}
                          </p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {email}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                          {completed} visits
                        </span>
                        <p className="text-[10px] text-slate-400 mt-1">
                          {total > 0 ? `${Math.round((completed/total)*100)}% comp` : 'Ready'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Info */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
        <span>Click any node to navigate or view practitioner profile</span>
        <span>Standardized Shift Rotation</span>
      </div>
    </div>
  );
};

export default CareFlowWorkforceFlow;
