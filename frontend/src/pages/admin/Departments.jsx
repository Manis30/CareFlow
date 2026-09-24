import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Edit2,
  Trash2,
  Building,
  ChevronRight,
  Building2,
  Users,
  CheckCircle2,
  Layers,
  ArrowLeft
} from 'lucide-react';
import {
  getDepartmentsApi,
  createDepartmentApi,
  updateDepartmentApi,
  deleteDepartmentApi
} from '../../api/department';
import { getDoctorsApi, deleteDoctorApi } from '../../api/doctor';
import { getAdminAppointmentsApi } from '../../api/appointment';
import { CardSkeleton } from '../../components/common/Skeleton';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Input from '../../components/common/Input';
import Textarea from '../../components/common/Textarea';
import StatusBadge from '../../components/common/StatusBadge';
import ConfirmModal from '../../components/common/ConfirmModal';
import Pagination from '../../components/common/Pagination';
import PageHeader from '../../components/layout/PageHeader';
import ContentContainer from '../../components/layout/ContentContainer';
import StatTile from '../../components/common/StatTile';
import { CareFlowCategoryScorecard, CLINICAL_COLORS } from '../../components/amcharts';
import usePagination from '../../hooks/usePagination';
import { showSuccessToast, showErrorToast } from '../../utils/toast';
import { confirmDelete } from '../../utils/confirmDialog';

export const Departments = () => {
  const navigate = useNavigate();
  const [departments, setDepartments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [selectedDept, setSelectedDept] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modal & Actions State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, doctor: null });
  const [actionLoading, setActionLoading] = useState(false);

  // Keyboard shortcut: ESC clears active selected department
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedDept(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      const [deptRes, docsRes, apptsRes] = await Promise.allSettled([
        getDepartmentsApi(),
        getDoctorsApi(),
        getAdminAppointmentsApi({ limit: 100 })
      ]);

      if (deptRes.status === 'fulfilled' && deptRes.value?.data) {
        setDepartments(deptRes.value.data);
      }
      if (docsRes.status === 'fulfilled') {
        const docsList = docsRes.value?.data?.doctors || docsRes.value?.data || (Array.isArray(docsRes.value) ? docsRes.value : []);
        setDoctors(Array.isArray(docsList) ? docsList : []);
      }
      if (apptsRes.status === 'fulfilled') {
        const apptsList = apptsRes.value?.data?.appointments || apptsRes.value?.data || (Array.isArray(apptsRes.value) ? apptsRes.value : []);
        setAppointments(Array.isArray(apptsList) ? apptsList : []);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch department data');
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingDept(null);
    setName('');
    setDescription('');
    setIsModalOpen(true);
  };

  const openEditModal = (e, dept) => {
    e.stopPropagation();
    setEditingDept(dept);
    setName(dept.name);
    setDescription(dept.description || '');
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setFormLoading(true);
      if (editingDept) {
        await updateDepartmentApi(editingDept._id, { name, description });
        showSuccessToast('Department updated successfully');
      } else {
        await createDepartmentApi({ name, description });
        showSuccessToast('Department created successfully');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      showErrorToast(err.message || 'Failed to save department');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteDept = async (e, dept) => {
    e.stopPropagation();
    const isConfirmed = await confirmDelete(dept.name);
    if (!isConfirmed) return;

    try {
      await deleteDepartmentApi(dept._id);
      showSuccessToast(`Department "${dept.name}" deleted successfully`);
      if (selectedDept?._id === dept._id) setSelectedDept(null);
      fetchData();
    } catch (err) {
      showErrorToast(err.message || 'Failed to delete department');
    }
  };

  const handleDeactivateDoctor = async () => {
    if (!deleteModal.doctor) return;
    try {
      setActionLoading(true);
      await deleteDoctorApi(deleteModal.doctor._id);
      setDeleteModal({ isOpen: false, doctor: null });
      fetchData();
    } catch (err) {
      alert(err.message || 'Failed to deactivate doctor');
    } finally {
      setActionLoading(false);
    }
  };

  const getDoctorInitials = (doc) => {
    const rawName = doc.userId?.name || doc.name || '';
    if (!rawName) return 'DR';
    const parts = rawName.trim().split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return rawName.slice(0, 2).toUpperCase();
  };

  const isDoctorInDepartment = (doc, targetDept) => {
    if (!doc || !targetDept) return false;
    const targetIdStr = String(targetDept._id || targetDept);
    const targetName = targetDept.name ? String(targetDept.name).toLowerCase() : '';

    const singleDeptId = String(doc.departmentId?._id || doc.departmentId || '');
    if (singleDeptId === targetIdStr) return true;

    if (Array.isArray(doc.departmentIds)) {
      const hasMatch = doc.departmentIds.some((d) => {
        const dIdStr = String(d?._id || d || '');
        return dIdStr === targetIdStr;
      });
      if (hasMatch) return true;
    }

    if (Array.isArray(doc.departments) && targetName) {
      const hasNameMatch = doc.departments.some(
        (nameStr) => String(nameStr || '').toLowerCase() === targetName
      );
      if (hasNameMatch) return true;
    }

    return false;
  };

  // KPIs
  const staffedDepartmentsCount = useMemo(() => {
    return departments.filter((d) => doctors.some((doc) => isDoctorInDepartment(doc, d))).length;
  }, [departments, doctors]);

  const avgDoctorsPerDept = useMemo(() => {
    return departments.length ? (doctors.length / departments.length).toFixed(1) : 0;
  }, [departments, doctors]);

  // Department Intelligence Grid aggregation
  const enrichedDepartments = useMemo(() => {
    return departments.map((dept) => {
      const assignedDoctors = doctors.filter((doc) => isDoctorInDepartment(doc, dept));
      const deptAppts = appointments.filter((a) => {
        const dId = String(a.departmentId?._id || a.departmentId || a.doctorId?.departmentId?._id || a.doctorId?.departmentId || '');
        const dName = a.departmentId?.name || a.doctorId?.departmentId?.name || '';
        return (dId && dId === String(dept._id)) || (dName && dName.toLowerCase() === dept.name?.toLowerCase());
      });
      const completedAppts = deptAppts.filter((a) => (a.status || '').toLowerCase() === 'completed');

      return {
        _id: dept._id,
        name: dept.name,
        description: dept.description,
        doctorCount: assignedDoctors.length,
        appointmentCount: deptAppts.length,
        completedCount: completedAppts.length,
        rawDept: dept
      };
    });
  }, [departments, doctors, appointments]);

  const deptDoctors = selectedDept
    ? doctors.filter((doc) => isDoctorInDepartment(doc, selectedDept))
    : [];

  return (
    <ContentContainer maxWidth="7xl" className="space-y-6">
      <PageHeader
        subtitle={
          selectedDept
            ? `Assigned medical specialists in ${selectedDept.name}`
            : 'Organize, manage, and structure clinic medical specialties.'
        }
        backButton={
          selectedDept ? (
            <Button
              variant="outline"
              size="sm"
              icon={ArrowLeft}
              onClick={() => setSelectedDept(null)}
            >
              Back to Departments
            </Button>
          ) : null
        }
        actions={
          selectedDept ? null : (
            <Button
              variant="primary"
              icon={Plus}
              onClick={openCreateModal}
            >
              Add Department
            </Button>
          )
        }
      />

      {/* 1. KPIs Strip (Only in main view) */}
      {!selectedDept && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <StatTile
            index={0}
            label="Total Departments"
            value={departments.length}
            subtext="Configured specialties"
            icon={Building2}
            color="blue"
          />
          <StatTile
            index={1}
            label="Assigned Clinicians"
            value={doctors.length}
            subtext="Medical specialists"
            icon={Users}
            color="green"
          />
          <StatTile
            index={2}
            label="Staffed Disciplines"
            value={staffedDepartmentsCount}
            subtext={`${departments.length - staffedDepartmentsCount} pending staffing`}
            icon={CheckCircle2}
            color="indigo"
          />
          <StatTile
            index={3}
            label="Clinicians / Dept"
            value={avgDoctorsPerDept}
            subtext="Average allocation"
            icon={Layers}
            color="purple"
          />
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <CardSkeleton count={6} />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchData} />
      ) : selectedDept ? (
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="text-sm sm:text-base font-bold text-slate-900">{selectedDept.name} Clinical Overview</h3>
              <p className="text-xs text-slate-500 font-medium">{selectedDept.description || 'Specialized clinical care and outpatient services'}</p>
            </div>
            <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
              {deptDoctors.length} {deptDoctors.length === 1 ? 'Clinician' : 'Clinicians'}
            </span>
          </div>

          {deptDoctors.length === 0 ? (
            <EmptyState
              title={`No Clinicians in ${selectedDept.name}`}
              description="Register new medical specialists or reassign existing clinicians to this department."
              actionText="Register Clinician"
              onAction={() => navigate('/admin/doctors/add')}
            />
          ) : (
            <DepartmentDoctorsTable
              deptDoctors={deptDoctors}
              navigate={navigate}
              getDoctorInitials={getDoctorInitials}
              setDeleteModal={setDeleteModal}
            />
          )}
        </div>
      ) : departments.length === 0 ? (
        <EmptyState
          title="No Departments Configured"
          description="Create department units to categorize clinical practice areas."
          actionText="Add Department"
          onAction={openCreateModal}
        />
      ) : (
        <CareFlowCategoryScorecard
          items={enrichedDepartments}
          title="Department Operational Intelligence Grid"
          subtitle="Live operational health, consultation throughput, and clinician staffing per department"
          selectedCategory={selectedDept?.name}
          onCategoryClick={(d) => setSelectedDept(d.rawDept || d)}
          showActions={true}
          onEdit={(d) => openEditModal({ stopPropagation: () => {} }, d.rawDept || d)}
          onDelete={(d) => handleDeleteDept({ stopPropagation: () => {} }, d.rawDept || d)}
          onInspectRoster={(d) => setSelectedDept(d.rawDept || d)}
        />
      )}

      {/* Modal for Create / Edit */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingDept ? 'Edit Clinical Department' : 'Create Clinical Department'}
        subtitle="Specify medical specialty name and clinical scope."
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Input
            label="Department Name"
            placeholder="e.g. Cardiology, Pediatrics, Ophthalmology"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <Textarea
            label="Clinical Description"
            placeholder="Clinical scope, facilities, and care focus..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button variant="outline" onClick={() => setIsModalOpen(false)} disabled={formLoading}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={formLoading}>
              Save Department
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, doctor: null })}
        onConfirm={handleDeactivateDoctor}
        title="Deactivate Clinician"
        message={`Are you sure you want to deactivate Dr. ${deleteModal.doctor?.userId?.name || deleteModal.doctor?.name}?`}
        variant="danger"
        loading={actionLoading}
      />
    </ContentContainer>
  );
};

const DepartmentDoctorsTable = ({
  deptDoctors,
  navigate,
  getDoctorInitials,
  setDeleteModal
}) => {
  const { page, setPage, totalItems, totalPages, paginatedItems } = usePagination(deptDoctors, 10);

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50/80 border-b border-slate-200/80 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left w-16">PROFILE</th>
              <th className="px-4 py-3 text-left">CLINICIAN</th>
              <th className="px-4 py-3 text-left">SPECIALIZATION</th>
              <th className="px-4 py-3 text-left">EMAIL</th>
              <th className="px-4 py-3 text-left">PHONE</th>
              <th className="px-4 py-3 text-left">FEE</th>
              <th className="px-4 py-3 text-center">STATUS</th>
              <th className="px-4 py-3 text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginatedItems.map((doc) => {
              const doctorName = doc.userId?.name || doc.name || 'Doctor';
              const doctorEmail = doc.userId?.email || doc.email || 'N/A';
              const doctorPhone = doc.userId?.phone || doc.phone || 'N/A';
              const profileUrl = doc.userId?.profileImage?.url || doc.profileImage?.url;
              const isActive = doc.userId?.isActive !== false;

              return (
                <tr
                  key={doc._id}
                  onClick={() => navigate(`/admin/doctors/${doc._id}`)}
                  className="hover:bg-slate-50/70 cursor-pointer transition-colors group"
                >
                  <td className="px-4 py-3">
                    <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center border border-blue-200 shrink-0 overflow-hidden shadow-2xs">
                      {profileUrl ? (
                        <img
                          src={profileUrl}
                          alt={doctorName}
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                          className="w-full h-full object-cover"
                        />
                      ) : null}
                      <span className={profileUrl ? 'hidden' : 'block'}>
                        {getDoctorInitials(doc)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-bold text-slate-900">
                    <span className="group-hover:text-blue-600 transition-colors">
                      Dr. {doctorName}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 font-medium">{doc.specialization || 'General'}</td>
                  <td className="px-4 py-3 text-slate-600">{doctorEmail}</td>
                  <td className="px-4 py-3 text-slate-600">{doctorPhone}</td>
                  <td className="px-4 py-3 font-bold text-slate-900">₹{doc.consultationFee || 0}</td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={isActive ? 'active' : 'inactive'} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-rose-600 hover:bg-rose-50"
                      icon={Trash2}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteModal({ isOpen: true, doctor: doc });
                      }}
                    >
                      Deactivate
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="px-4 py-3 border-t border-slate-100">
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={totalItems}
          limit={10}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
};

export default Departments;
