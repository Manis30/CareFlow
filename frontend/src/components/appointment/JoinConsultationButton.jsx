import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, Lock, Clock, CheckCircle2, XCircle } from 'lucide-react';

const parseAppointmentTime = (dateStr, timeStr) => {
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

// Production consultation access validation active (5 minutes before appointment start time)
const BYPASS_CONSULTATION_ACCESS_VALIDATION = false;

const JoinConsultationButton = ({ appointment, meetingUrl, onJoin, className = '', compact = false }) => {
  const [accessState, setAccessState] = useState('disabled_before'); // 'completed' | 'cancelled' | 'enabled' | 'disabled_before' | 'disabled_after'
  const navigate = useNavigate();

  useEffect(() => {
    checkAccessWindow();
    const interval = setInterval(() => {
      checkAccessWindow();
    }, 10000); // Refresh every 10s

    return () => clearInterval(interval);
  }, [appointment]);

  const checkAccessWindow = () => {
    if (BYPASS_CONSULTATION_ACCESS_VALIDATION) {
      setAccessState('enabled');
      return;
    }

    if (!appointment) {
      setAccessState('disabled_before');
      return;
    }

    // Priority Status Overrides
    if (appointment.status === 'completed') {
      setAccessState('completed');
      return;
    }

    if (appointment.status === 'cancelled') {
      setAccessState('cancelled');
      return;
    }

    if (!appointment.appointmentDate || !appointment.startTime) {
      setAccessState('enabled');
      return;
    }

    const startTimestamp = parseAppointmentTime(appointment.appointmentDate, appointment.startTime);
    let endTimestamp = parseAppointmentTime(appointment.appointmentDate, appointment.endTime);

    if (!startTimestamp) {
      setAccessState('enabled');
      return;
    }

    if (!endTimestamp) {
      // Default to 30 mins after start if end time missing
      endTimestamp = startTimestamp + 30 * 60 * 1000;
    }

    const accessStart = startTimestamp - 5 * 60 * 1000; // 5 mins before start
    const accessEnd = endTimestamp; // Cutoff at exact scheduled end time
    const now = Date.now();

    if (now < accessStart) {
      setAccessState('disabled_before');
    } else if (now >= accessStart && now < accessEnd) {
      setAccessState('enabled');
    } else {
      setAccessState('disabled_after');
    }
  };

  const handleJoinClick = () => {
    if (onJoin) {
      onJoin();
    } else if (appointment?._id) {
      navigate(`/meeting/${appointment._id}`);
    } else if (meetingUrl) {
      window.open(meetingUrl, '_blank', 'noopener,noreferrer');
    }
  };

  // 1. Completed State
  if (accessState === 'completed') {
    if (compact) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-bold text-xs border border-emerald-200/60">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          Completed
        </span>
      );
    }
    return (
      <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200/80 space-y-1">
        <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Consultation Completed</span>
        </div>
        <p className="text-[11px] text-emerald-700/80 font-medium">
          This appointment has been completed successfully.
        </p>
      </div>
    );
  }

  // 2. Cancelled State
  if (accessState === 'cancelled') {
    if (compact) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 font-bold text-xs border border-rose-200/60">
          <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
          Cancelled
        </span>
      );
    }
    return (
      <div className="p-3.5 rounded-xl bg-rose-50/70 border border-rose-200/80 space-y-1">
        <div className="flex items-center gap-2 text-rose-800 font-bold text-xs">
          <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>Appointment Cancelled</span>
        </div>
        <p className="text-[11px] text-rose-700/80 font-medium">
          This consultation has been cancelled.
        </p>
      </div>
    );
  }

  // 3. Disabled Before Access Window (More than 5 mins before start)
  if (accessState === 'disabled_before') {
    if (compact) {
      return (
        <button
          disabled
          type="button"
          title="Available 5 minutes before scheduled start"
          className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-400 font-bold rounded-xl text-xs cursor-not-allowed border border-slate-200 ${className}`}
        >
          <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>Join</span>
        </button>
      );
    }
    return (
      <div className="space-y-2">
        <button
          disabled
          type="button"
          className={`w-full py-2.5 px-4 bg-slate-100 text-slate-400 font-bold rounded-xl text-xs flex items-center justify-center gap-2 cursor-not-allowed border border-slate-200 ${className}`}
        >
          <Lock className="w-4 h-4 text-slate-400 shrink-0" />
          Join Consultation
        </button>
        <p className="text-[11px] text-amber-700 font-medium flex items-center gap-1">
          <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          Available 5 minutes before your appointment
        </p>
      </div>
    );
  }

  // 4. Disabled After Access Window (More than 5 mins after end)
  if (accessState === 'disabled_after') {
    if (compact) {
      return (
        <button
          disabled
          type="button"
          className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-400 font-bold rounded-xl text-xs cursor-not-allowed border border-slate-200 ${className}`}
        >
          <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>Expired</span>
        </button>
      );
    }
    return (
      <div className="space-y-2">
        <button
          disabled
          type="button"
          className={`w-full py-2.5 px-4 bg-slate-100 text-slate-400 font-bold rounded-xl text-xs flex items-center justify-center gap-2 cursor-not-allowed border border-slate-200 ${className}`}
        >
          <Lock className="w-4 h-4 text-slate-400 shrink-0" />
          Join Consultation
        </button>
        <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          Consultation access has ended.
        </p>
      </div>
    );
  }

  // 5. Active Access Window (5 mins before start -> 5 mins after end)
  return (
    <button
      onClick={handleJoinClick}
      type="button"
      className={`inline-flex items-center justify-center gap-2 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs shadow-xs hover:shadow-md transition-all cursor-pointer ${className}`}
    >
      <Video className="w-4 h-4 text-white shrink-0" />
      <span>Join Consultation</span>
    </button>
  );
};

export default JoinConsultationButton;
