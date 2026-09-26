import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  CalendarDays,
  Clock,
  Stethoscope,
  Video,
  MapPin,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Building2,
  ArrowLeft,
  ShieldCheck,
  User,
  DollarSign
} from 'lucide-react';
import { getDoctorsApi, getDoctorByIdApi, getDoctorAvailableSlotsApi } from '../../api/doctor';
import { createAppointmentApi, validateAppointmentSlotApi } from '../../api/appointment';
import { createOnlineBookingOrderApi, verifyAndCreateOnlineAppointmentApi } from '../../api/payment';
import Loader from '../../components/common/Loader';
import { CardSkeleton } from '../../components/common/Skeleton';
import OrganizationLogo from '../../components/common/OrganizationLogo';
import ErrorState from '../../components/common/ErrorState';
import Button from '../../components/common/Button';
import ContentContainer from '../../components/layout/ContentContainer';
import PageHeader from '../../components/layout/PageHeader';
import { formatTime } from '../../utils/formatTime';
import { formatCurrency, formatDoctorName } from '../../utils/formatters';

const getErrorMessage = (err, fallbackMessage = 'Something went wrong. Please try again.') => {
  return err?.response?.data?.message || err?.message || fallbackMessage;
};

const normalizeDoctor = (rawDoc) => {
  if (!rawDoc) return null;
  const doc = rawDoc.doctor || rawDoc;
  const docId = doc._id || doc.id;
  if (!docId) return null;

  const departmentId = doc.departmentId?._id
    ? doc.departmentId._id.toString()
    : doc.departmentId
    ? doc.departmentId.toString()
    : Array.isArray(doc.departmentIds) && doc.departmentIds[0]
    ? (doc.departmentIds[0]._id || doc.departmentIds[0]).toString()
    : null;

  const organizationId = doc.organizationId?._id
    ? doc.organizationId._id.toString()
    : doc.organizationId
    ? doc.organizationId.toString()
    : null;

  const rawName = doc.userId?.name || doc.name || 'Doctor';
  const cleanName = formatDoctorName(rawName);

  return {
    _id: docId.toString(),
    id: docId.toString(),
    name: cleanName,
    rawName,
    specialization:
      doc.specialization ||
      (Array.isArray(doc.departments) ? doc.departments[0] : 'General Practitioner'),
    departmentId,
    organizationId,
    consultationFee: doc.consultationFee || 500,
    organizationIdObj:
      doc.organizationId && typeof doc.organizationId === 'object' ? doc.organizationId : null,
    departmentIdObj:
      doc.departmentId && typeof doc.departmentId === 'object' ? doc.departmentId : null,
    raw: doc
  };
};

const getTodayString = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getTomorrowString = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const y = tomorrow.getFullYear();
  const m = String(tomorrow.getMonth() + 1).padStart(2, '0');
  const d = String(tomorrow.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const PatientBookAppointment = () => {
  const [searchParams] = useSearchParams();
  const initialDoctorId = searchParams.get('doctorId') || '';

  const [doctors, setDoctors] = useState([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState(initialDoctorId);
  const [selectedDoctor, setSelectedDoctor] = useState(null);

  const [consultationType, setConsultationType] = useState('online');
  const [appointmentDate, setAppointmentDate] = useState(() => getTomorrowString());

  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [validatingSlotKey, setValidatingSlotKey] = useState(null);
  const [slotReason, setSlotReason] = useState('');

  const [reason, setReason] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('online');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    fetchDoctors();
  }, []);

  // When selected doctor changes, fetch fresh details
  useEffect(() => {
    if (selectedDoctorId) {
      const match = doctors.find((d) => d._id === selectedDoctorId);
      if (match) {
        setSelectedDoctor(match);
      }
      fetchDoctorDetails(selectedDoctorId);
    }
  }, [selectedDoctorId]);

  // When doctor or date changes, fetch actual slots from backend!
  useEffect(() => {
    if (selectedDoctorId && appointmentDate) {
      fetchAvailableSlots(selectedDoctorId, appointmentDate);
    } else {
      setAvailableSlots([]);
      setSelectedSlot(null);
    }
  }, [selectedDoctorId, appointmentDate]);

  const fetchDoctors = async () => {
    try {
      setLoading(true);
      const res = await getDoctorsApi();
      const list = res.data?.doctors || res.data || [];
      const normalized = list.map(normalizeDoctor).filter(Boolean);
      setDoctors(normalized);

      const targetId = selectedDoctorId || initialDoctorId || (normalized[0] ? normalized[0]._id : '');
      if (targetId) {
        setSelectedDoctorId(targetId);
        const match = normalized.find((d) => d._id === targetId);
        if (match) setSelectedDoctor(match);
      }
    } catch {
      setDoctors([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchDoctorDetails = async (docId) => {
    try {
      const res = await getDoctorByIdApi(docId);
      const docData = res.data?.doctor || res.data;
      if (docData) {
        const norm = normalizeDoctor(docData);
        setSelectedDoctor(norm);
      }
    } catch {
      // Handled: doctor from list is already set
    }
  };

  const fetchAvailableSlots = async (docId, dateStr) => {
    if (!docId || !dateStr) return;
    try {
      setSlotsLoading(true);
      setSlotReason('');
      setSelectedSlot(null);
      const res = await getDoctorAvailableSlotsApi(docId, dateStr);
      const payload = res.data || res;
      const slotsData = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.slots)
        ? payload.slots
        : [];
      setAvailableSlots(slotsData);

      if (slotsData.length === 0) {
        setSlotReason(
          payload?.reason ||
          'No time slots available for this date. Please pick an alternative date.'
        );
      }
    } catch (err) {
      setAvailableSlots([]);
      setSelectedSlot(null);
      setSlotReason(
        err?.response?.data?.message ||
        'No appointment slots available on this date. Please pick an alternative date.'
      );
    } finally {
      setSlotsLoading(false);
    }
  };

  const loadRazorpayScript = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
      } else {
        const script = document.createElement('script');
        script.src = 'https://checkout.razorpay.com/v1/checkout.js';
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
      }
    });
  };

  const handleSelectSlot = async (slot) => {
    if (!slot || !slot.start) return;
    setValidatingSlotKey(slot.start);
    try {
      if (selectedDoctorId && appointmentDate) {
        const valRes = await validateAppointmentSlotApi({
          doctorId: selectedDoctorId,
          appointmentDate,
          startTime: slot.start,
          endTime: slot.end
        });
        const valData = valRes.data || valRes;
        if (valData && valData.available === false) {
          toast.error(valData.message || 'Slot is no longer available.');
          return;
        }
      }
      setSelectedSlot(slot);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Slot is no longer available.'));
    } finally {
      setValidatingSlotKey(null);
    }
  };

  const handleBook = async (e) => {
    e.preventDefault();
    const activeDoctor = doctors.find((d) => d._id === selectedDoctorId) || selectedDoctor;

    if (!activeDoctor || !activeDoctor._id) {
      toast.error('Please select a doctor to continue.');
      return;
    }

    if (!selectedSlot || !selectedSlot.start || !selectedSlot.end) {
      toast.error('Please choose an available appointment time slot.');
      return;
    }

    try {
      setSubmitting(true);

      const bookingPayload = {
        doctorId: activeDoctor._id,
        departmentId: activeDoctor.departmentId || null,
        organizationId: activeDoctor.organizationId,
        consultationType,
        appointmentDate,
        startTime: selectedSlot.start,
        endTime: selectedSlot.end,
        reason: reason ? reason.trim() : '',
        paymentMethod
      };

      if (paymentMethod === 'online') {
        const orderRes = await createOnlineBookingOrderApi(bookingPayload);
        const resPayload = orderRes.data || orderRes;
        const order = resPayload.order;
        const serverBookingPayload = resPayload.bookingPayload || bookingPayload;
        const razorpayKey =
          resPayload.razorpayKeyId ||
          import.meta.env.VITE_RAZORPAY_KEY_ID ||
          'rzp_test_TSMeN2ZVVnNzVP';

        if (!order || !order.id) {
          throw new Error('Failed to create payment order.');
        }

        const loaded = await loadRazorpayScript();
        if (!loaded) {
          throw new Error('Razorpay SDK failed to load. Check your network connection.');
        }

        const options = {
          key: razorpayKey,
          amount: order.amount,
          currency: order.currency || 'INR',
          name: activeDoctor.organizationIdObj?.name || 'CareFlow Healthcare',
          description: `Consultation with ${activeDoctor.name.startsWith('Dr.') ? activeDoctor.name : `Dr. ${activeDoctor.name}`}`,
          order_id: order.id,
          handler: async (response) => {
            try {
              setSubmitting(true);
              const verifyRes = await verifyAndCreateOnlineAppointmentApi({
                bookingPayload: serverBookingPayload,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature
              });
              const createdAppt = verifyRes.data || verifyRes;
              toast.success('Consultation confirmed & payment verified!');
              navigate(`/patient/appointments/${createdAppt._id}`);
            } catch (verifyErr) {
              toast.error(getErrorMessage(verifyErr, 'Payment verification failed.'));
              setSubmitting(false);
            }
          },
          theme: {
            color: '#2563EB'
          }
        };

        const rzp = new window.Razorpay(options);
        rzp.open();
      } else {
        // Cash at clinic
        const res = await createAppointmentApi(bookingPayload);
        const createdAppt = res.data || res;
        toast.success('Consultation scheduled! Please pay at the clinic reception.');
        navigate(`/patient/appointments/${createdAppt._id}`);
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to book consultation.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <ContentContainer maxWidth="5xl">
        <div className="space-y-6">
          <div className="h-8 w-64 bg-slate-200 rounded-lg animate-pulse mb-6" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 space-y-6">
              <CardSkeleton count={3} />
            </div>
            <div className="lg:col-span-5">
              <CardSkeleton count={1} />
            </div>
          </div>
        </div>
      </ContentContainer>
    );
  }

  const activeDoc =
    (selectedDoctor && selectedDoctor._id === selectedDoctorId ? selectedDoctor : null) ||
    doctors.find((d) => d._id === selectedDoctorId) ||
    selectedDoctor ||
    doctors[0] ||
    null;
  const fee = activeDoc?.consultationFee || 500;

  return (
    <ContentContainer maxWidth="5xl" className="space-y-6 pb-12">
      {/* 1. Page Header */}
      <PageHeader
        subtitle="Reserve an appointment with a verified healthcare physician. Select consultation channel, date, and verified time slot."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/patient/doctors')}
            icon={ArrowLeft}
            className="text-xs rounded-xl"
          >
            Back to Catalog
          </Button>
        }
      />

      <form onSubmit={handleBook} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Form Controls (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Step 1: Select Clinician */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-blue-600" />
              1. Select Healthcare Specialist
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  Physician
                </label>
                <select
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(e.target.value)}
                  className="w-full text-xs sm:text-sm font-semibold text-slate-900 bg-white rounded-xl border border-slate-200 py-2.5 px-3.5 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  {doctors.map((doc) => {
                    const docDisplayName = doc.name.startsWith('Dr.') ? doc.name : `Dr. ${doc.name}`;
                    return (
                      <option key={doc._id} value={doc._id}>
                        {docDisplayName} — {doc.specialization}
                      </option>
                    );
                  })}
                </select>
              </div>

              {activeDoc && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-between gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <span className="font-extrabold text-slate-900 block truncate">
                      {activeDoc.name.startsWith('Dr.') ? activeDoc.name : `Dr. ${activeDoc.name}`}
                    </span>
                    <span className="text-[11px] text-blue-600 font-bold block truncate">
                      {activeDoc.specialization}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium block truncate">
                      {activeDoc.organizationIdObj?.name || 'CareFlow Clinic Facility'}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">
                      Fee
                    </span>
                    <span className="text-base font-black text-slate-900">
                      {formatCurrency(fee)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Step 2: Consultation Mode & Date */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-blue-600" />
              2. Modality & Date
            </h3>

            {/* Mode Selector */}
            <div>
              <label className="block font-bold text-slate-700 mb-2 text-xs">
                Consultation Type
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setConsultationType('online')}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    consultationType === 'online'
                      ? 'bg-blue-50 border-blue-500 text-blue-900 shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <Video className="w-4 h-4 text-blue-600" />
                    <span>Online Video Room</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 font-medium">
                    Secure private video consultation from home.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setConsultationType('offline')}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                    consultationType === 'offline'
                      ? 'bg-blue-50 border-blue-500 text-blue-900 shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <MapPin className="w-4 h-4 text-slate-500" />
                    <span>In-Clinic Visit</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 font-medium">
                    In-person consultation at the physical hospital or clinic.
                  </p>
                </button>
              </div>
            </div>

            {/* Date Picker */}
            <div>
              <label className="block font-bold text-slate-700 mb-1.5 text-xs">
                Appointment Date
              </label>
              <input
                type="date"
                value={appointmentDate}
                min={getTodayString()}
                onChange={(e) => setAppointmentDate(e.target.value)}
                className="w-full text-xs sm:text-sm font-semibold text-slate-900 bg-white rounded-xl border border-slate-200 py-2.5 px-3.5 focus:outline-none focus:border-blue-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Step 3: Slot Selection */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              3. Available Time Slot
            </h3>

            {slotsLoading ? (
              <div className="py-6 flex items-center justify-center gap-2 text-xs text-slate-500 font-medium">
                <Loader size="sm" />
                <span>Checking physician schedule...</span>
              </div>
            ) : availableSlots.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                {availableSlots.map((slot, idx) => {
                  const isSelected = selectedSlot?.start === slot.start;
                  const isValidating = validatingSlotKey === slot.start;
                  return (
                    <button
                      key={idx}
                      type="button"
                      disabled={isValidating}
                      onClick={() => handleSelectSlot(slot)}
                      className={`p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer text-center ${
                        isSelected
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-blue-50 hover:border-blue-300'
                      }`}
                    >
                      {formatTime(slot.start)}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-amber-800 bg-amber-50 p-3.5 rounded-xl border border-amber-200 font-medium">
                {slotReason || 'No time slots available for this date. Please pick an alternative date.'}
              </p>
            )}
          </div>

          {/* Step 4: Reason for Visit */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-3">
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-900">
              4. Symptoms / Chief Complaint (Optional)
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe your health symptoms, medical background, or reason for this consultation..."
              className="w-full text-xs sm:text-sm font-medium text-slate-900 bg-white rounded-xl border border-slate-200 p-3.5 focus:outline-none focus:border-blue-500 placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Right: Booking Summary & Payment (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-xl border border-slate-200/80 bg-white p-6 shadow-xs space-y-4 sticky top-20">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 border-b border-slate-100 pb-3">
              Consultation Summary
            </h3>

            <div className="space-y-3 text-xs font-medium">
              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Specialist</span>
                <span className="font-bold text-slate-900">
                  {activeDoc?.name
                    ? (activeDoc.name.startsWith('Dr.') ? activeDoc.name : `Dr. ${activeDoc.name}`)
                    : 'Selected Doctor'}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Specialty</span>
                <span className="font-bold text-blue-600">
                  {activeDoc?.specialization || 'Clinical Care'}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Date</span>
                <span className="font-bold text-slate-900">
                  {appointmentDate}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Time Window</span>
                <span className="font-bold text-slate-900">
                  {selectedSlot
                    ? `${formatTime(selectedSlot.start)} – ${formatTime(selectedSlot.end)}`
                    : 'Not Selected'}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-100">
                <span className="text-slate-500">Channel</span>
                <span className="font-bold text-slate-900 capitalize">
                  {consultationType === 'online' ? 'Online Video' : 'In-Clinic Visit'}
                </span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <span className="font-extrabold text-slate-900 text-sm">Total Fee:</span>
                <span className="text-xl font-black text-slate-900">
                  {formatCurrency(fee)}
                </span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-900">
                Payment Arrangement
              </label>
              <div className="space-y-2 text-xs">
                <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer hover:bg-blue-50/40 transition-colors">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="online"
                    checked={paymentMethod === 'online'}
                    onChange={() => setPaymentMethod('online')}
                    className="accent-blue-600 w-4 h-4"
                  />
                  <div>
                    <span className="font-bold text-slate-900 block">Online Payment (Razorpay)</span>
                    <span className="text-[10px] text-slate-500 block font-medium">
                      UPI, Credit/Debit Card, Netbanking
                    </span>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer hover:bg-blue-50/40 transition-colors">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="cash"
                    checked={paymentMethod === 'cash'}
                    onChange={() => setPaymentMethod('cash')}
                    className="accent-blue-600 w-4 h-4"
                  />
                  <div>
                    <span className="font-bold text-slate-900 block">Pay at Clinic</span>
                    <span className="text-[10px] text-slate-500 block font-medium">
                      Pay reception counter upon arrival
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Submit Action */}
            <div className="pt-2">
              <Button
                type="submit"
                variant="primary"
                size="md"
                className="w-full rounded-xl font-bold shadow-xs py-3"
                loading={submitting}
                disabled={!selectedSlot || submitting}
              >
                {paymentMethod === 'online'
                  ? 'Proceed to Secure Payment'
                  : 'Confirm & Schedule Appointment'}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </ContentContainer>
  );
};

export default PatientBookAppointment;
