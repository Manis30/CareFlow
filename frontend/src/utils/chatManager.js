import { resolveDoctorName } from './resolveDoctorName';
import { resolveProfileImage } from './resolveProfileImage';
import { formatPatientName, formatSpecialization } from './formatters';

/**
 * Builds a stable participant-based conversation key:
 * - Patient side: 'doctor:<doctorId>'
 * - Doctor side: 'patient:<patientId>'
 */
export const buildConversationKey = (appt, currentRole) => {
  if (!appt) return null;

  if (currentRole === 'patient') {
    const docObj = appt.doctorId || appt.doctor;
    const docId = typeof docObj === 'object' ? (docObj?._id || docObj?.id) : docObj;
    return docId ? `doctor:${docId}` : (appt._id ? `appt:${appt._id}` : null);
  } else {
    const patObj = appt.patientId || appt.patient;
    const patId = typeof patObj === 'object' ? (patObj?._id || patObj?.id) : patObj;
    return patId ? `patient:${patId}` : (appt._id ? `appt:${appt._id}` : null);
  }
};

/**
 * Safely parses timestamps into numerical epoch ms.
 */
export const parseMessageTime = (ts) => {
  if (!ts) return 0;
  if (typeof ts === 'number') return ts;
  const parsed = new Date(ts).getTime();
  return isNaN(parsed) ? 0 : parsed;
};

/**
 * Formats timestamp for conversation sidebar (e.g., "2:35 PM" or "Aug 24").
 */
export const formatChatTime = (ts) => {
  if (!ts) return '';
  const date = new Date(ts);
  if (isNaN(date.getTime())) return '';

  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

/**
 * Sorts conversation items descending by lastMessageAt (newest active conversation first at index 0).
 */
export const sortConversationsByLatest = (conversations) => {
  if (!Array.isArray(conversations)) return [];
  return [...conversations].sort((a, b) => parseMessageTime(b.lastMessageAt) - parseMessageTime(a.lastMessageAt));
};

/**
 * Single source of truth for updating or inserting a message into conversation list.
 * Updates lastMessageText, lastMessageAt, and immediately moves conversation to Index 0.
 */
export const upsertConversationMessage = (conversations, newMsg, currentRole, apptLookupMap = new Map()) => {
  if (!newMsg) return conversations;

  const apptId = newMsg.appointmentId ? newMsg.appointmentId.toString() : null;
  const msgPatientId = newMsg.patientId ? newMsg.patientId.toString() : null;
  const msgDoctorId = newMsg.doctorId ? newMsg.doctorId.toString() : null;
  const msgTime = parseMessageTime(newMsg.createdAt) || Date.now();
  const textPreview = newMsg.message || (newMsg.attachment?.url ? 'Attachment file' : 'New message');

  // Find target conversation matching participant IDs or appointment ID
  const targetIndex = conversations.findIndex((c) => {
    if (currentRole === 'patient') {
      if (msgDoctorId && c.doctorId?.toString() === msgDoctorId) return true;
    } else if (currentRole === 'doctor') {
      if (msgPatientId && c.patientId?.toString() === msgPatientId) return true;
    }
    return (
      c.appointmentIds?.some((id) => id.toString() === apptId) ||
      c.latestApptId?.toString() === apptId
    );
  });

  if (targetIndex !== -1) {
    const updatedList = [...conversations];
    const targetConv = {
      ...updatedList[targetIndex],
      lastMessageText: textPreview,
      lastMessageAt: msgTime
    };

    // Remove from existing position and insert at top (index 0)
    updatedList.splice(targetIndex, 1);
    return sortConversationsByLatest([targetConv, ...updatedList]);
  }

  // If conversation doesn't exist in state yet, build from appt lookup
  const appt = apptLookupMap.get(apptId);
  if (appt) {
    const key = buildConversationKey(appt, currentRole);
    const docObj = appt.doctorId || appt.doctor;
    const patObj = appt.patientId || appt.patient;

    const participantName =
      currentRole === 'patient'
        ? resolveDoctorName(appt)
        : formatPatientName(patObj?.userId?.name || patObj?.name || appt.patientName || 'Patient');

    const profileImage =
      currentRole === 'patient'
        ? resolveProfileImage(docObj)
        : resolveProfileImage(patObj);

    const newConv = {
      key,
      doctorId: typeof docObj === 'object' ? (docObj?._id || docObj?.id) : docObj,
      patientId: typeof patObj === 'object' ? (patObj?._id || patObj?.id) : patObj,
      latestApptId: appt._id,
      appointmentIds: [appt._id],
      participantName,
      doctorName: currentRole === 'patient' ? participantName : null,
      patientName: currentRole === 'doctor' ? participantName : null,
      profileImage,
      specialization: formatSpecialization(docObj?.specialization || appt.departmentId?.name),
      lastMessageText: textPreview,
      lastMessageAt: msgTime,
      appointments: [appt]
    };

    return sortConversationsByLatest([newConv, ...conversations]);
  }

  return conversations;
};
