import { formatDoctorName } from './formatName';

/**
 * Safely resolves the real doctor's display name from populated appointment, chat, or card structures.
 * Inspects:
 *   - appointment.doctorId.userId.name
 *   - appointment.doctorId.user.name
 *   - appointment.doctorId.name
 *   - appointment.doctor.userId.name
 *   - appointment.doctor.name
 *   - appointment.doctorName
 */
export const resolveDoctorName = (entity) => {
  if (!entity) return 'Dr. Unknown';

  if (typeof entity === 'string') {
    return formatDoctorName(entity);
  }

  const docObj = entity.doctorId || entity.doctor || entity;

  let rawName = '';
  if (typeof docObj === 'object' && docObj !== null) {
    rawName =
      docObj.userId?.name ||
      docObj.user?.name ||
      docObj.name ||
      entity.doctorName ||
      entity.name ||
      '';
  } else if (entity.doctorName) {
    rawName = entity.doctorName;
  }

  if (!rawName) return 'Dr. Assigned';

  return formatDoctorName(rawName);
};

export default resolveDoctorName;
