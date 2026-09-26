import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  ArrowLeft,
  Video,
  FileHeart,
  Pill,
  Upload,
  Building2,
  MapPin,
  XCircle
} from 'lucide-react';
import {
  getAppointmentByIdApi,
  cancelAppointmentApi,
  getOnlineMeetingApi
} from '../../api/appointment';
import { getPrescriptionByAppointmentApi } from '../../api/prescription';
import { getMedicalRecordsByAppointmentApi } from '../../api/medicalRecord';
import { getPaymentByAppointmentIdApi } from '../../api/payment';
import { useAuth } from '../../context/AuthContext';
import ErrorState from '../../components/common/ErrorState';
import StatusBadge from '../../components/common/StatusBadge';
import Button from '../../components/common/Button';
import ContentContainer from '../../components/layout/ContentContainer';
import PageHeader from '../../components/layout/PageHeader';
import ClinicLocationMap from '../../components/common/ClinicLocationMap';
import PrescriptionDocView from '../../components/prescription/PrescriptionDocView';
import JoinConsultationButton from '../../components/appointment/JoinConsultationButton';
import UploadRecordModal from '../../components/medicalRecord/UploadRecordModal';
import CancelAppointmentModal from '../../components/appointment/CancelAppointmentModal';
import { CardSkeleton } from '../../components/common/Skeleton';
import { formatDate } from '../../utils/formatDate';
import { formatTime } from '../../utils/formatTime';
import { formatCurrency, formatDoctorName } from '../../utils/formatters';
import { checkCancellationEligibility } from '../../utils/appointmentCancellationUtils';

export const PatientAppointmentDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [appointment, setAppointment] = useState(null);
  const [payment, setPayment] = useState(null);
  const [prescription, setPrescription] = useState(null);
  const [medicalRecords, setMedicalRecords] = useState([]);
  const [meeting, setMeeting] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState('details'); // 'details' | 'prescription' | 'records' | 'location'

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [cancelModal, setCancelModal] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [uploadModal, setUploadModal] = useState(false);

  useEffect(() => {
    fetchAppointmentData();
  }, [id]);

  const fetchAppointmentData = async () => {
    try {
      setLoading(true);
      setError('');

      const res = await getAppointmentByIdApi(id);
      const appt = res.data;
      setAppointment(appt);

      if (appt) {
        const [pmtRes, rxRes, recRes] = await Promise.all([
          getPaymentByAppointmentIdApi(appt._id).catch(() => ({ data: null })),
          getPrescriptionByAppointmentApi(appt._id).catch(() => ({ data: null })),
          getMedicalRecordsByAppointmentApi(appt._id).catch(() => ({ data: [] }))
        ]);

        if (pmtRes.data) setPayment(pmtRes.data);
        if (rxRes.data) setPrescription(rxRes.data);
        if (recRes.data) setMedicalRecords(recRes.data);

        if (appt.consultationType === 'online' && appt.status !== 'cancelled') {
          getOnlineMeetingApi(appt._id)
            .then((mRes) => {
              if (mRes.data) setMeeting(mRes.data);
            })
            .catch(() => {});
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load consultation records');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelByPatient = async (cancelReason) => {
    try {
      setCancelLoading(true);
      await cancelAppointmentApi(appointment._id, { reason: cancelReason });
      toast.success('Appointment cancelled successfully.');
      setCancelModal(false);
      fetchAppointmentData();
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Cancellation failed.');
    } finally {
      setCancelLoading(false);
    }
  };

  if (loading) {
    return (
      <ContentContainer className="space-y-6 pb-12">
        <div className="h-16 bg-white rounded-xl border border-slate-200/80 p-4 animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 space-y-4">
            <CardSkeleton />
            <CardSkeleton />
          </div>
          <div className="lg:col-span-5 space-y-4">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </div>
      </ContentContainer>
    );
  }

  if (error) {
    return (
      <ContentContainer>
        <div className="py-12">
          <ErrorState message={error} onRetry={fetchAppointmentData} />
        </div>
      </ContentContainer>
    );
  }

  if (!appointment) return null;

  const doctorName = formatDoctorName(
    appointment.doctorId?.userId?.name || appointment.doctorId?.name || 'Doctor'
  );
  const specialty = appointment.doctorId?.specialization || 'Clinical Specialist';
  const clinicName = appointment.organizationId?.name || 'CareFlow Clinic';
  const isOnline = appointment.consultationType === 'online';
  const isCancellable =
    appointment.status === 'booked' && checkCancellationEligibility(appointment);

  const subTabs = [
    { id: 'details', label: 'Clinical Overview' },
    { id: 'prescription', label: `Prescription (${prescription ? '1' : '0'})` },
    { id: 'records', label: `Attached Records (${medicalRecords.length})` },
    ...(!isOnline && appointment.organizationId?.coordinates
      ? [{ id: 'location', label: 'Facility Map' }]
      : [])
  ];

  return (
    <ContentContainer className="space-y-6 pb-12">
      <PageHeader
        title={`Consultation with ${doctorName}`}
        subtitle={`${specialty} · ${formatDate(appointment.appointmentDate)} at ${formatTime(
          appointment.startTime
        )}`}
        badge={<StatusBadge status={appointment.status} />}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/patient/appointments')}
              icon={ArrowLeft}
            >
              Back to Appointments
            </Button>
            {isOnline && appointment.status !== 'cancelled' && (
              <JoinConsultationButton
                appointment={appointment}
              />
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (7 cols): Consultation Content & Subtabs */}
        <div className="lg:col-span-7 space-y-6">
          {/* Subtabs Bar */}
          <div className="flex border-b border-slate-200 gap-6 text-xs font-semibold text-slate-500">
            {subTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSubTab(tab.id)}
                className={`pb-3 transition-all duration-150 border-b-2 cursor-pointer ${
                  activeSubTab === tab.id
                    ? 'border-blue-600 text-blue-600 font-bold'
                    : 'border-transparent hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab 1: Details */}
          {activeSubTab === 'details' && (
            <div className="space-y-6">
              {/* Doctor & Facility Card */}
              <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-3">
                  Clinician & Facility Information
                </h2>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 font-bold text-lg flex items-center justify-center shrink-0 border border-blue-100 shadow-2xs">
                    {doctorName.charAt(0)}
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <h3 className="text-base font-bold text-slate-900">Dr. {doctorName}</h3>
                    <p className="text-xs text-blue-600 font-semibold">{specialty}</p>
                    <p className="text-xs text-slate-500 flex items-center gap-1.5 pt-0.5 font-medium">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>{clinicName}</span>
                    </p>
                  </div>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/70 grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Consultation Channel
                    </span>
                    <span className="font-semibold text-slate-900 flex items-center gap-1 pt-0.5 capitalize">
                      {isOnline ? (
                        <>
                          <Video className="w-3.5 h-3.5 text-blue-600" /> Online Consultation
                        </>
                      ) : (
                        <>
                          <MapPin className="w-3.5 h-3.5 text-slate-500" /> In-Clinic Visit
                        </>
                      )}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Department
                    </span>
                    <span className="font-semibold text-slate-900 block pt-0.5">
                      {appointment.departmentId?.name || specialty}
                    </span>
                  </div>
                </div>
              </div>

              {/* Patient Visit Reason / Clinical Notes */}
              <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-3">
                  Reason for Consultation / Symptoms
                </h2>
                <p className="text-xs sm:text-sm text-slate-800 leading-relaxed font-medium bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                  {appointment.reason || 'No specific symptoms noted at time of booking.'}
                </p>

                {appointment.notes && (
                  <div className="mt-3 pt-3 border-t border-slate-100 space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                      Physician Observations & Summary
                    </span>
                    <p className="text-xs text-slate-700 leading-relaxed italic bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                      "{appointment.notes}"
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 2: Prescription */}
          {activeSubTab === 'prescription' && (
            <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-3">
                Clinical Prescription
              </h2>
              {prescription ? (
                <PrescriptionDocView prescription={prescription} />
              ) : (
                <div className="py-8 text-center space-y-2">
                  <div className="w-12 h-12 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center mx-auto border border-slate-200">
                    <Pill className="w-6 h-6" />
                  </div>
                  <p className="text-xs text-slate-500 font-medium">
                    No prescription generated for this consultation yet.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Records */}
          {activeSubTab === 'records' && (
            <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Attached Medical Records
                </h2>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setUploadModal(true)}
                  icon={Upload}
                >
                  Upload Document
                </Button>
              </div>

              {medicalRecords.length > 0 ? (
                <div className="space-y-2.5">
                  {medicalRecords.map((rec) => (
                    <div
                      key={rec._id}
                      className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 hover:border-slate-300 transition-all flex items-center justify-between text-xs"
                    >
                      <div className="space-y-0.5 truncate">
                        <span className="font-bold text-slate-900 block truncate">
                          {rec.title}
                        </span>
                        <span className="text-[11px] text-slate-500 block font-medium">
                          {rec.documentType} · {formatDate(rec.createdAt)}
                        </span>
                      </div>
                      {rec.fileUrl && (
                        <a
                          href={rec.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-800 hover:bg-slate-50 font-semibold text-xs transition-colors shrink-0"
                        >
                          View File
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center space-y-2">
                  <div className="w-12 h-12 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center mx-auto border border-slate-200">
                    <FileHeart className="w-6 h-6" />
                  </div>
                  <p className="text-xs text-slate-500 font-medium">
                    No clinical documents attached to this consultation yet.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Tab 4: Location Map (If in-clinic) */}
          {activeSubTab === 'location' && appointment.organizationId?.coordinates && (
            <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-3">
                Clinic Location & Directions
              </h2>
              <ClinicLocationMap
                coordinates={appointment.organizationId.coordinates}
                clinicName={clinicName}
                address={appointment.organizationId.address}
              />
            </div>
          )}
        </div>

        {/* Right Column (5 cols): Timings, Billing & Actions */}
        <div className="lg:col-span-5 space-y-6">
          {/* Appointment Schedule Box */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-2.5">
              Appointment Timing
            </h2>
            <div className="space-y-2.5 text-xs font-medium">
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Date</span>
                <span className="font-bold text-slate-900">
                  {formatDate(appointment.appointmentDate)}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Time Window</span>
                <span className="font-bold text-blue-600">
                  {formatTime(appointment.startTime)} – {formatTime(appointment.endTime)}
                </span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Status</span>
                <StatusBadge status={appointment.status} />
              </div>
            </div>
          </div>

          {/* Billing & Transaction Box */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-2.5">
              Billing & Transaction
            </h2>
            <div className="space-y-2.5 text-xs font-medium">
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Payment Status</span>
                <StatusBadge status={payment?.status || appointment.paymentStatus || 'pending'} />
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Payment Method</span>
                <span className="font-bold text-slate-900 capitalize">
                  {payment?.paymentMethod || appointment.paymentMethod || 'Online'}
                </span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-sm font-bold text-slate-900">Amount:</span>
                <span className="text-lg font-bold text-slate-900">
                  {formatCurrency(payment?.amount || appointment.consultationFee || 500)}
                </span>
              </div>
            </div>
          </div>

          {/* Cancellation Control (If eligible) */}
          {isCancellable && (
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200/80 space-y-2">
              <span className="text-xs font-bold text-rose-800 block">
                Manage Appointment
              </span>
              <p className="text-[11px] text-slate-600 font-medium">
                Need to reschedule? You may cancel up to 2 hours before the scheduled slot.
              </p>
              <Button
                variant="danger"
                size="sm"
                onClick={() => setCancelModal(true)}
                icon={XCircle}
                className="w-full text-xs"
              >
                Cancel Appointment
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <CancelAppointmentModal
        isOpen={cancelModal}
        onClose={() => setCancelModal(false)}
        onConfirm={handleCancelByPatient}
        loading={cancelLoading}
      />

      <UploadRecordModal
        isOpen={uploadModal}
        onClose={() => setUploadModal(false)}
        appointmentId={appointment._id}
        onSuccess={() => fetchAppointmentData()}
      />
    </ContentContainer>
  );
};

export default PatientAppointmentDetails;
