import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { getDoctorByIdApi } from '../../api/doctor';
import { getAdminAppointmentsApi } from '../../api/appointment';
import Loader from '../../components/common/Loader';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import Button from '../../components/common/Button';
import DoctorDetailsContent from '../../components/doctor/DoctorDetailsContent';
import ContentContainer from '../../components/layout/ContentContainer';

const AdminDoctorDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [doctor, setDoctor] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [stats, setStats] = useState({ total: 0, completed: 0, pending: 0, cancelled: 0 });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (id) {
      fetchDoctorDetails();
    }
  }, [id]);

  const fetchDoctorDetails = async () => {
    try {
      setLoading(true);
      setError('');

      const res = await getDoctorByIdApi(id);

      const doctorData =
        res?.data?.doctor ||
        res?.data?.data?.doctor ||
        res?.data?.data ||
        res?.data ||
        res;

      if (doctorData && (doctorData._id || doctorData.userId || doctorData.specialization)) {
        setDoctor(doctorData);
      } else {
        setError('Doctor profile not found or access denied.');
        setDoctor(null);
      }

      // Fetch Doctor's Appointments
      try {
        const apptsRes = await getAdminAppointmentsApi({ doctorId: id });
        const apptsList =
          apptsRes?.data?.appointments ||
          apptsRes?.data?.data?.appointments ||
          (Array.isArray(apptsRes?.data) ? apptsRes.data : []);

        const apptsArray = Array.isArray(apptsList) ? apptsList : [];
        setAppointments(apptsArray);

        const total = apptsArray.length;
        const completed = apptsArray.filter(a => a?.status === 'completed').length;
        const pending = apptsArray.filter(a => a?.status === 'booked' || a?.status === 'pending').length;
        const cancelled = apptsArray.filter(a => a?.status === 'cancelled').length;

        setStats({ total, completed, pending, cancelled });
      } catch (e) {
        setAppointments([]);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load doctor profile.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <ContentContainer maxWidth="7xl">
        <div className="py-24 flex flex-col items-center justify-center space-y-3">
          <Loader size="lg" />
          <p className="text-xs font-semibold text-slate-500">Loading clinician profile dossier...</p>
        </div>
      </ContentContainer>
    );
  }

  if (error) {
    return (
      <ContentContainer maxWidth="7xl">
        <div className="space-y-4">
          <ErrorState message={error} onRetry={fetchDoctorDetails} />
          <div className="flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/admin/doctors')}
              icon={ArrowLeft}
            >
              Back to Doctors
            </Button>
          </div>
        </div>
      </ContentContainer>
    );
  }

  if (!doctor) {
    return (
      <ContentContainer maxWidth="7xl">
        <EmptyState
          title="Clinician Not Found"
          description="The requested medical specialist profile does not exist or access has been restricted."
          actionText="Back to Registry"
          onAction={() => navigate('/admin/doctors')}
        />
      </ContentContainer>
    );
  }

  return (
    <ContentContainer maxWidth="7xl">
      <DoctorDetailsContent
        doctor={doctor}
        appointments={appointments}
        stats={stats}
        breadcrumbCategory="Clinic Administration"
        backRoute="/admin/doctors"
        onRefresh={fetchDoctorDetails}
        onViewAllAppointments={() => navigate('/admin/appointments')}
      />
    </ContentContainer>
  );
};

export default AdminDoctorDetails;
