import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import {
  getSuperAdminDoctorByIdApi,
  getSuperAdminAppointmentsApi
} from '../../api/superAdmin';
import { CardSkeleton } from '../../components/common/Skeleton';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import Button from '../../components/common/Button';
import ContentContainer from '../../components/layout/ContentContainer';
import DoctorDetailsContent from '../../components/doctor/DoctorDetailsContent';

const SuperAdminDoctorDetailsPage = () => {
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

      const res = await getSuperAdminDoctorByIdApi(id);
      
      const doctorData =
        res?.data?.doctor ||
        res?.data?.data?.doctor ||
        res?.data?.data ||
        res?.data ||
        res;

      if (doctorData && (doctorData._id || doctorData.userId || doctorData.specialization)) {
        setDoctor(doctorData);
      } else {
        setError('Doctor details not found.');
        setDoctor(null);
      }

      try {
        const apptsRes = await getSuperAdminAppointmentsApi({ doctorId: id, limit: 100 });
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
      setError(err.message || 'Failed to fetch doctor details.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <ContentContainer maxWidth="7xl">
        <div className="space-y-6">
          <div className="h-8 w-64 bg-slate-200 rounded-lg animate-pulse mb-6" />
          <CardSkeleton count={1} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <CardSkeleton count={4} />
          </div>
          <CardSkeleton count={1} />
        </div>
      </ContentContainer>
    );
  }

  if (error) {
    return (
      <ContentContainer maxWidth="7xl">
        <div className="py-8 space-y-4">
          <ErrorState message={error} onRetry={fetchDoctorDetails} />
          <div className="flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/super-admin/doctors')}
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
        <div className="py-8">
          <EmptyState
            title="Doctor Not Found"
            description="The requested doctor profile does not exist or was removed."
            actionText="Back to Doctors"
            onAction={() => navigate('/super-admin/doctors')}
          />
        </div>
      </ContentContainer>
    );
  }

  return (
    <ContentContainer maxWidth="7xl">
      <DoctorDetailsContent
        doctor={doctor}
        appointments={appointments}
        stats={stats}
        breadcrumbCategory="Platform Operations"
        backRoute="/super-admin/doctors"
        onViewAllAppointments={() => navigate('/super-admin/appointments')}
      />
    </ContentContainer>
  );
};

export default SuperAdminDoctorDetailsPage;
