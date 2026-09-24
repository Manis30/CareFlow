import React, { useState } from 'react';
import { AlertTriangle, Clock, Calendar, Building2, Video, Stethoscope, X } from 'lucide-react';
import Button from '../common/Button';
import { formatDate } from '../../utils/formatDate';
import { formatTime } from '../../utils/formatTime';
import { checkCancellationEligibility } from '../../utils/appointmentCancellationUtils';

const CancelAppointmentModal = ({
  isOpen,
  onClose,
  onConfirm,
  appointment,
  loading = false
}) => {
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState('');

  if (!isOpen || !appointment) return null;

  const doctor = appointment.doctorId ?? appointment.doctor ?? null;
  const org = appointment.organizationId ?? appointment.organization ?? null;
  const doctorName = doctor?.userId?.name || doctor?.name || 'Assigned Doctor';
  const doctorSpec = doctor?.specialization || 'Specialist';
  const orgName = org?.name || 'CarePlus Medical Center';

  const cancellationInfo = checkCancellationEligibility(appointment);
  const eligibility = {
    isEligible: cancellationInfo.canCancel,
    message: cancellationInfo.message
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!eligibility.isEligible) return;

    if (!reason.trim()) {
      setReasonError('Please provide a reason for cancelling your appointment.');
      return;
    }

    setReasonError('');
    onConfirm(reason.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto animate-fade-in font-sans">
      <div className="relative w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden my-8">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100 shadow-2xs">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Cancel Appointment?</h3>
              <p className="text-xs text-slate-500">Please review appointment details before cancelling</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Eligibility Warning Banner */}
          {!eligibility.isEligible && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5 font-medium">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>{eligibility.message}</span>
            </div>
          )}

          {/* Appointment Summary Box */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-200/60">
              <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-700 font-bold text-xs flex items-center justify-center border border-teal-200 shrink-0">
                Dr
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">Dr. {doctorName}</h4>
                <p className="text-[11px] text-teal-600 font-medium flex items-center gap-1 mt-0.5">
                  <Stethoscope className="w-3 h-3" />
                  {doctorSpec}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2 text-slate-700 font-semibold">
                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{formatDate(appointment.appointmentDate)}</span>
              </div>

              <div className="flex items-center gap-2 text-slate-700 font-semibold">
                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{formatTime(appointment.startTime)}</span>
              </div>

              <div className="flex items-center gap-2 text-slate-700 font-semibold truncate col-span-2">
                {appointment.consultationType === 'online' ? (
                  <>
                    <Video className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                    <span>Online Video Consultation</span>
                  </>
                ) : (
                  <>
                    <Building2 className="w-3.5 h-3.5 text-teal-500 shrink-0" />
                    <span className="truncate">{orgName}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Cancellation Reason Textarea */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-800">
              Reason for Cancellation <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (reasonError) setReasonError('');
              }}
              disabled={loading || !eligibility.isEligible}
              placeholder="e.g. Personal emergency, feeling better, scheduling conflict..."
              className={`w-full rounded-xl border p-3 text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all ${
                reasonError ? 'border-rose-500 bg-rose-50/20' : 'border-slate-300 bg-white'
              }`}
            />
            {reasonError && <p className="text-[11px] text-rose-600 font-medium">{reasonError}</p>}
          </div>

          {/* Action Footer */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={onClose}
              disabled={loading}
            >
              Keep Appointment
            </Button>
            <Button
              type="submit"
              variant="danger"
              size="md"
              loading={loading}
              disabled={loading || !eligibility.isEligible}
            >
              Cancel Appointment
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CancelAppointmentModal;
