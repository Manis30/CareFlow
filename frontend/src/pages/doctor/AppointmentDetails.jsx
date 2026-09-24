import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  XCircle,
  FileText,
  ClipboardList,
  User,
  Mail,
  Phone,
  Droplet,
  Clock,
  Calendar,
  Stethoscope,
  Eye,
  Download,
  MapPin,
  Sparkles
} from 'lucide-react';
import {
  getAppointmentByIdApi,
  completeAppointmentApi,
  cancelAppointmentByDoctorApi
} from '../../api/appointment';
import { getPrescriptionByAppointmentApi, createPrescriptionApi } from '../../api/prescription';
import { getMyMedicalRecordsApi } from '../../api/medicalRecord';
import { CardSkeleton } from '../../components/common/Skeleton';
import ErrorState from '../../components/common/ErrorState';
import StatusBadge from '../../components/common/StatusBadge';
import Button from '../../components/common/Button';
import PatientAvatar from '../../components/common/PatientAvatar';
import Modal from '../../components/common/Modal';
import ConfirmModal from '../../components/common/ConfirmModal';
import PrescriptionForm from '../../components/prescription/PrescriptionForm';
import PrescriptionDocView from '../../components/prescription/PrescriptionDocView';
import JoinConsultationButton from '../../components/appointment/JoinConsultationButton';
import PageHeader from '../../components/layout/PageHeader';
import ContentContainer from '../../components/layout/ContentContainer';
import { ClinicalSurface } from '../../components/surfaces/Surfaces';
import PulseIndicator from '../../components/clinical/PulseIndicator';
import { formatDate } from '../../utils/formatDate';
import { formatTime } from '../../utils/formatTime';
import { showSuccessToast, showErrorToast } from '../../utils/toast';
import { checkCancellationEligibility } from '../../utils/appointmentCancellationUtils';
import { handleDownload } from '../../utils/downloadFile';

const parseAppointmentEndTime = (dateStr, timeStr) => {
  if (!dateStr || !timeStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateFormatted = `${year}-${month}-${day}`;

    let hours = 0;
    let minutes = 0;

    const timeMatch = String(timeStr).match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (timeMatch) {
      hours = parseInt(timeMatch[1], 10);
      minutes = parseInt(timeMatch[2], 10);
      const period = timeMatch[3]?.toUpperCase();

      if (period === 'PM' && hours < 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
    } else {
      return null;
    }

    const hoursStr = String(hours).padStart(2, '0');
    const minsStr = String(minutes).padStart(2, '0');

    const fullIso = `${dateFormatted}T${hoursStr}:${minsStr}:00`;
    const resultDate = new Date(fullIso);
    return isNaN(resultDate.getTime()) ? null : resultDate.getTime();
  } catch (e) {
    return null;
  }
};

const DoctorAppointmentDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [appointment, setAppointment] = useState(null);
  const [prescription, setPrescription] = useState(null);
  const [medicalRecords, setMedicalRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [meetingProvider, setMeetingProvider] = useState('google_meet');
  const [meetingLink, setMeetingLink] = useState('');

  // Active Tab ('details', 'prescription', 'records')
  const [activeSubTab, setActiveSubTab] = useState('details');

  // Prescription Modal State
  const [isPrescriptionModalOpen, setIsPrescriptionModalOpen] = useState(false);
  const [prescriptionLoading, setPrescriptionLoading] = useState(false);
  const [prescriptionError, setPrescriptionError] = useState('');

  // Cancellation State
  const [cancelModal, setCancelModal] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    fetchAppointmentData();
  }, [id]);

  const fetchAppointmentData = async () => {
    try {
      setLoading(true);
      setError('');
      const apptRes = await getAppointmentByIdApi(id);
      if (apptRes.data) {
        setAppointment(apptRes.data);
        if (apptRes.data.onlineMeeting) {
          setMeetingProvider(apptRes.data.onlineMeeting.provider || 'google_meet');
          setMeetingLink(apptRes.data.onlineMeeting.meetingLink || '');
        }
      }

      // Fetch Prescription if exists
      try {
        const presRes = await getPrescriptionByAppointmentApi(id);
        if (presRes.data) setPrescription(presRes.data);
      } catch (e) {
        setPrescription(null);
      }

      // Fetch Doctor-Authorized Medical Records for this patient
      try {
        const recordsRes = await getMyMedicalRecordsApi();
        if (recordsRes.data && apptRes.data) {
          const currentPatientId = (
            apptRes.data.patientId?._id || 
            apptRes.data.patientId || 
            ''
          ).toString();

          const patientRecords = recordsRes.data.filter((rec) => {
            const recPatientId = (
              rec.patientId?._id || 
              rec.patientId || 
              ''
            ).toString();
            return recPatientId === currentPatientId;
          });

          setMedicalRecords(patientRecords);
        } else {
          setMedicalRecords([]);
        }
      } catch (e) {
        setMedicalRecords([]);
      }
    } catch (err) {
      setError(err.message || 'Failed to load appointment details');
    } finally {
      setLoading(false);
    }
  };

  const endTimeMs = parseAppointmentEndTime(appointment?.appointmentDate, appointment?.endTime);
  const canComplete = appointment?.status === 'booked' && endTimeMs !== null && nowMs >= endTimeMs;

  const handleComplete = async () => {
    if (!canComplete) return;
    try {
      setLoading(true);
      await completeAppointmentApi(id);
      showSuccessToast('Consultation concluded successfully.');
      fetchAppointmentData();
    } catch (err) {
      showErrorToast(err.message || 'Failed to complete appointment');
      setLoading(false);
    }
  };

  const handleCancelByDoctor = async (reason) => {
    try {
      setCancelLoading(true);
      await cancelAppointmentByDoctorApi(id, reason);
      setCancelModal(false);
      showSuccessToast('Appointment cancelled successfully.');
      fetchAppointmentData();
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Failed to cancel appointment';
      showErrorToast(errMsg);
    } finally {
      setCancelLoading(false);
    }
  };

  const handleCreatePrescription = async (formData) => {
    try {
      setPrescriptionLoading(true);
      setPrescriptionError('');
      await createPrescriptionApi(id, formData);
      setIsPrescriptionModalOpen(false);
      showSuccessToast('Prescription issued successfully');
      fetchAppointmentData();
    } catch (err) {
      setPrescriptionError(err.message || 'Failed to create prescription');
    } finally {
      setPrescriptionLoading(false);
    }
  };

  if (loading) {
    return (
      <ContentContainer className="space-y-6 pb-12">
        <PageHeader
          title="Consultation Details"
          subtitle="Loading consultation information and patient record..."
          backButton={{
            label: 'Back to Schedule',
            onClick: () => navigate('/doctor/appointments')
          }}
        />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            <CardSkeleton count={2} />
          </div>
          <div className="lg:col-span-4 space-y-5">
            <CardSkeleton count={1} />
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

  const patient = appointment.patientId || {};
  const patientName = patient.userId?.name || patient.name || 'Patient';
  const patientEmail = patient.userId?.email || patient.email || 'N/A';
  const patientPhone = patient.userId?.phone || patient.phone || 'N/A';
  const patientGender = patient.gender || patient.userId?.gender || 'N/A';
  const patientBloodGroup = patient.bloodGroup || patient.userId?.bloodGroup || 'N/A';

  const cancellationInfo = checkCancellationEligibility(appointment);
  const isOnline = appointment.consultationType === 'online';
  const isCompleted = appointment.status === 'completed';
  const isCancelled = appointment.status === 'cancelled';
  const isInProgress = appointment.status === 'in_progress' || appointment.consultationStartedAt;

  return (
    <ContentContainer className="space-y-6 pb-12">
      {/* 1. Page Header with Back Button */}
      <PageHeader
        title="Consultation Details"
        subtitle={`Appointment #${id.slice(-6).toUpperCase()} · Clinical review & consultation management`}
        backButton={{
          label: 'Back to Schedule',
          onClick: () => navigate('/doctor/appointments')
        }}
        actions={
          <div className="flex items-center gap-3">
            <StatusBadge status={appointment.status} />
            {cancellationInfo.canCancel && !isInProgress && (
              <Button
                variant="outline"
                size="sm"
                icon={XCircle}
                onClick={() => setCancelModal(true)}
                className="text-rose-600 border-slate-200 hover:bg-rose-50 rounded-xl"
              >
                Cancel Session
              </Button>
            )}
          </div>
        }
      />

      {/* 2. Workspace Grid: Left 8 cols & Right 4 cols */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Consultation Area: Left 8 cols */}
        <div className="lg:col-span-8 space-y-6">
          {/* Patient Profile Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-5 pb-5 border-b border-slate-100">
              <div className="flex items-start gap-4">
                <PatientAvatar
                  patient={appointment.patientId}
                  name={patientName}
                  size="xl"
                  className="border-2 border-slate-200 shrink-0"
                />
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">
                    Patient Profile
                  </span>
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                    {patientName}
                  </h3>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500 pt-1 font-medium">
                    <span className="flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {patientEmail}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {patientPhone}
                    </span>
                    <span className="flex items-center gap-1.5 capitalize">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {patientGender}
                    </span>
                    {patientBloodGroup !== 'N/A' && (
                      <span className="inline-flex items-center gap-1 font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100">
                        <Droplet className="w-3 h-3 text-rose-600 shrink-0" />
                        Blood: {patientBloodGroup}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Consultation Status Callout */}
              <div className="shrink-0 self-start sm:self-center">
                {isCompleted ? (
                  <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <span className="text-xs font-bold block leading-tight">
                        Consultation Concluded
                      </span>
                      <span className="text-[10px] text-emerald-600 font-medium">
                        Clinical record finalized
                      </span>
                    </div>
                  </div>
                ) : isCancelled ? (
                  <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800">
                    <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <div>
                      <span className="text-xs font-bold block leading-tight">Cancelled</span>
                      <span className="text-[10px] text-rose-600 font-medium">
                        Session discontinued
                      </span>
                    </div>
                  </div>
                ) : isOnline ? (
                  <div className="space-y-2">
                    <JoinConsultationButton
                      appointment={appointment}
                      meetingUrl={
                        meetingLink ||
                        appointment.meeting?.meetingUrl ||
                        appointment.onlineMeeting?.meetingUrl ||
                        appointment.onlineMeeting?.meetingLink
                      }
                      className="rounded-xl px-4 py-2.5"
                    />
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-800 text-xs font-semibold">
                    <MapPin className="w-4 h-4 text-slate-500" />
                    <span>In-Clinic Consultation</span>
                  </div>
                )}
              </div>
            </div>

            {/* Visit Details Matrix */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-1">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  CONSULTATION DATE
                </span>
                <span className="text-xs sm:text-sm font-semibold text-slate-900 flex items-center gap-1.5 mt-1">
                  <Calendar className="w-3.5 h-3.5 text-blue-600" />
                  {formatDate(appointment.appointmentDate)}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  APPOINTED WINDOW
                </span>
                <span className="text-xs sm:text-sm font-semibold text-slate-900 flex items-center gap-1.5 mt-1">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  {formatTime(appointment.startTime)} – {formatTime(appointment.endTime)}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  CHANNEL
                </span>
                <div className="mt-1">
                  <StatusBadge status={appointment.consultationType} />
                </div>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  STATUS
                </span>
                <div className="mt-1">
                  <StatusBadge status={appointment.status} />
                </div>
              </div>
            </div>

            {/* Visit Reason Section */}
            <div className="pt-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                REASON / CHIEF COMPLAINT
              </span>
              <p className="text-xs sm:text-sm font-medium text-slate-800 bg-slate-50 p-3.5 rounded-xl border border-slate-200/70">
                "{appointment.reason || 'General health evaluation and clinical follow-up.'}"
              </p>
            </div>
          </div>

          {/* Subtabs for Clinical Workflow */}
          <div className="flex border-b border-slate-200 gap-6 text-xs font-semibold text-slate-500">
            <button
              onClick={() => setActiveSubTab('details')}
              className={`pb-3 border-b-2 cursor-pointer transition-all ${
                activeSubTab === 'details'
                  ? 'border-blue-600 text-blue-600 font-bold'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              Consultation Notes
            </button>
            <button
              onClick={() => setActiveSubTab('prescription')}
              className={`pb-3 border-b-2 cursor-pointer flex items-center gap-1.5 transition-all ${
                activeSubTab === 'prescription'
                  ? 'border-blue-600 text-blue-600 font-bold'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              <ClipboardList className="w-4 h-4 text-blue-600" />
              <span>Prescription Slip</span>
              {prescription && <span className="w-2 h-2 rounded-full bg-blue-600" />}
            </button>
            <button
              onClick={() => setActiveSubTab('records')}
              className={`pb-3 border-b-2 cursor-pointer flex items-center gap-1.5 transition-all ${
                activeSubTab === 'records'
                  ? 'border-blue-600 text-blue-600 font-bold'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              <FileText className="w-4 h-4 text-blue-600" />
              <span>Shared Records ({medicalRecords.length})</span>
            </button>
          </div>

          {/* Tab Panes */}
          {activeSubTab === 'details' && (
            <div className="space-y-4">
              <ClinicalSurface className="p-6 space-y-4 rounded-xl border border-slate-200 bg-white">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h4 className="text-base font-bold text-slate-900">
                      Consultation Flow & Actions
                    </h4>
                    <p className="text-xs text-slate-500 font-medium">
                      {isInProgress
                        ? 'Consultation is active. You can launch or rejoin the video room using the link above.'
                        : isCompleted
                        ? 'This consultation is concluded. You may generate or review the patient prescription.'
                        : 'Scheduled session. Video room opens 5 minutes prior to appointment start time.'}
                    </p>
                  </div>
                  {isCompleted && (
                    <Button
                      variant="primary"
                      icon={ClipboardList}
                      size="sm"
                      onClick={() => setIsPrescriptionModalOpen(true)}
                      className="rounded-xl shrink-0 font-semibold"
                    >
                      {prescription ? 'Edit Prescription' : 'Issue Prescription'}
                    </Button>
                  )}
                </div>

                {isInProgress && (
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900">
                    <PulseIndicator active size="md" color="#2563EB" />
                    <div className="text-xs font-medium">
                      <span className="font-bold block">Live Consultation in Progress</span>
                      <span className="text-blue-700">
                        Patient is connected or eligible to connect via video stream.
                      </span>
                    </div>
                  </div>
                )}
              </ClinicalSurface>
            </div>
          )}

          {activeSubTab === 'prescription' && (
            <div className="space-y-4">
              {prescription ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      OFFICIAL MEDICAL PRESCRIPTION
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      icon={ClipboardList}
                      onClick={() => setIsPrescriptionModalOpen(true)}
                      className="rounded-xl"
                    >
                      Update Prescription
                    </Button>
                  </div>
                  <PrescriptionDocView prescription={prescription} />
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-white p-10 text-center space-y-4 shadow-xs">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto border border-blue-100">
                    <ClipboardList className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-900">
                      No Prescription Issued Yet
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto font-medium">
                      You can generate digital prescriptions with medication dosages, diagnosis, and
                      clinical notes once the consultation is concluded.
                    </p>
                  </div>
                  {isCompleted ? (
                    <Button
                      variant="primary"
                      icon={ClipboardList}
                      onClick={() => setIsPrescriptionModalOpen(true)}
                      className="rounded-xl font-semibold"
                    >
                      Create Digital Prescription
                    </Button>
                  ) : (
                    <p className="text-xs text-amber-700 font-semibold">
                      Prescription authoring is enabled once the consultation is completed.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {activeSubTab === 'records' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-base font-bold text-slate-900">
                    Patient Medical Records
                  </h4>
                  <p className="text-xs text-slate-500 font-medium">
                    Diagnostic reports and records shared by {patientName}
                  </p>
                </div>
                <span className="text-xs font-bold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                  {medicalRecords.length} Documents
                </span>
              </div>

              {medicalRecords.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-10 text-center space-y-2 bg-white">
                  <div className="w-12 h-12 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center mx-auto border border-slate-200">
                    <FileText className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">No Shared Records</h4>
                  <p className="text-xs text-slate-500 font-medium">
                    The patient has not attached prior medical records to this profile.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {medicalRecords.map((rec) => {
                    const recordTypeLabel = (rec.recordType || 'DOCUMENT').replace(/_/g, ' ');
                    return (
                      <div
                        key={rec._id}
                        className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col justify-between space-y-4 shadow-xs hover:border-blue-400 transition-all"
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100 uppercase tracking-wider">
                              {recordTypeLabel}
                            </span>
                            <span className="text-[11px] text-slate-400 font-medium">
                              {formatDate(rec.createdAt)}
                            </span>
                          </div>

                          <div className="flex items-start gap-3">
                            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                              <FileText className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <h5 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                                {rec.title}
                              </h5>
                              <p className="text-[11px] text-slate-500 truncate mt-0.5 font-medium">
                                {rec.description || 'Clinical report'}
                              </p>
                            </div>
                          </div>
                        </div>

                        {rec.file?.url && (
                          <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                            <a
                              href={rec.file.url}
                              target="_blank"
                              rel="noreferrer"
                              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-semibold transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              View
                            </a>
                            <button
                              type="button"
                              onClick={() => handleDownload(rec.file?.url, rec.title)}
                              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
                            >
                              <Download className="w-3.5 h-3.5" />
                              Download
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sidebar Summary: Right 4 cols */}
        <div className="lg:col-span-4 space-y-5">
          {/* Consultation Summary Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <h4 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-blue-600" />
              Consultation Summary
            </h4>

            <div className="space-y-3 text-xs font-medium">
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Appointment ID</span>
                <span className="font-semibold text-slate-900">
                  #{id.slice(-8).toUpperCase()}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Modality</span>
                <span className="font-semibold text-slate-900 capitalize">
                  {appointment.consultationType} Consultation
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Consultation Fee</span>
                <span className="font-semibold text-slate-900">
                  ₹{appointment.doctorFee || appointment.doctorId?.consultationFee || 0}
                </span>
              </div>
              <div className="flex justify-between py-1.5 border-b border-slate-100">
                <span className="text-slate-500">Payment Status</span>
                <span className="font-semibold text-emerald-600">
                  {appointment.paymentStatus || 'Verified'}
                </span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-500">Prescription</span>
                <span className="font-semibold text-slate-900">
                  {prescription ? 'Issued' : 'Pending'}
                </span>
              </div>
            </div>

            {canComplete && (
              <div className="pt-3 border-t border-slate-100">
                <Button
                  variant="primary"
                  className="w-full rounded-xl"
                  icon={CheckCircle2}
                  onClick={handleComplete}
                >
                  Conclude Consultation
                </Button>
              </div>
            )}
          </div>

          {/* Quick Clinical Guidance Card */}
          <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-5 space-y-2.5 shadow-xs">
            <div className="flex items-center gap-2 text-xs font-bold text-blue-900 uppercase tracking-wider">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span>Clinical Protocol</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed font-normal">
              Ensure all clinical observations and prescription recommendations are finalized prior
              to closing the consultation record. Digital prescriptions become immediately accessible
              in the patient's medical records.
            </p>
          </div>
        </div>
      </div>

      {/* Prescription Modal */}
      <Modal
        isOpen={isPrescriptionModalOpen}
        onClose={() => setIsPrescriptionModalOpen(false)}
        title="Issue Clinical Prescription"
        subtitle={`Official prescription for ${patientName}`}
        headerIcon={ClipboardList}
        maxWidth="max-w-4xl"
      >
        <PrescriptionForm
          onSubmit={handleCreatePrescription}
          onCancel={() => setIsPrescriptionModalOpen(false)}
          loading={prescriptionLoading}
          error={prescriptionError}
        />
      </Modal>

      {/* Cancel Confirmation Modal */}
      <ConfirmModal
        isOpen={cancelModal}
        onClose={() => setCancelModal(false)}
        onConfirm={handleCancelByDoctor}
        title="Cancel Clinical Consultation"
        message="Please provide a clinical or scheduling reason for cancelling this session. The patient will be notified automatically."
        requireReason
        reasonLabel="Cancellation Reason"
        variant="danger"
        loading={cancelLoading}
      />
    </ContentContainer>
  );
};

export default DoctorAppointmentDetails;
