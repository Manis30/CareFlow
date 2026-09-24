import React from 'react';
import { Activity, Printer } from 'lucide-react';
import Button from '../common/Button';
import { formatDate } from '../../utils/formatDate';
import {
  formatDoctorName,
  formatName,
  formatOrganizationName,
  formatMedicineName,
  formatSpecialization,
  formatDiagnosis
} from '../../utils/formatters';

const PrescriptionDocView = ({ prescription }) => {
  if (!prescription) return null;

  const handlePrint = () => {
    window.print();
  };

  const doctorObj = prescription.doctorId || {};
  const patientObj = prescription.patientId || {};
  const orgObj = prescription.organizationId || {};

  const rawDoctorName = doctorObj.userId?.name || doctorObj.name || prescription.doctorName;
  const doctorName = formatDoctorName(rawDoctorName, 'Vetrivel Cheliyan');
  const doctorSpec = formatSpecialization(doctorObj.specialization);

  const rawPatientName = patientObj.userId?.name || patientObj.name || prescription.patientName;
  const patientName = formatName(rawPatientName, 'Patient');
  const gender = patientObj.gender || patientObj.userId?.gender || 'N/A';
  const bloodGroup = patientObj.bloodGroup || patientObj.userId?.bloodGroup || 'N/A';

  const clinicName = formatOrganizationName(
    typeof orgObj === 'object' && orgObj?.name ? orgObj.name : 'CarePlus Medical Center'
  );

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-2xs space-y-6 print:border-none print:shadow-none font-sans">
      {/* Print Action Header */}
      <div className="flex justify-between items-center border-b border-slate-100 pb-4 print:hidden">
        <h3 className="text-sm font-semibold text-slate-700">Official Prescription Document</h3>
        <Button variant="outline" size="sm" onClick={handlePrint} icon={Printer}>
          Print Prescription
        </Button>
      </div>

      {/* Header Info */}
      <div className="flex justify-between items-start border-b border-slate-200 pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center text-white font-bold">
              <Activity className="w-5 h-5" />
            </div>
            <span className="text-xl font-extrabold text-slate-800 tracking-tight">{clinicName}</span>
          </div>
          <p className="text-xs text-slate-500">Official Medical Prescription Slip</p>
        </div>

        <div className="text-right text-xs text-slate-600 space-y-1">
          <p className="font-bold text-slate-800">{doctorName}</p>
          <p className="text-teal-700 font-medium">{doctorSpec}</p>
          <p className="text-slate-400">Date: {formatDate(prescription.createdAt)}</p>
        </div>
      </div>

      {/* Patient Meta */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl text-xs">
        <div>
          <span className="text-slate-400 uppercase text-[10px] font-semibold block">Patient Name</span>
          <span className="font-bold text-slate-900">{patientName}</span>
        </div>
        <div>
          <span className="text-slate-400 uppercase text-[10px] font-semibold block">Gender</span>
          <span className="font-bold text-slate-900 capitalize">{gender}</span>
        </div>
        <div>
          <span className="text-slate-400 uppercase text-[10px] font-semibold block">Blood Group</span>
          <span className="font-bold text-slate-900">{bloodGroup}</span>
        </div>
        <div>
          <span className="text-slate-400 uppercase text-[10px] font-semibold block">Diagnosis</span>
          <span className="font-extrabold text-teal-700">{formatDiagnosis(prescription.diagnosis)}</span>
        </div>
      </div>

      {/* Medicines Table */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Rx - Prescribed Medicines</h4>
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Medicine</th>
                <th className="px-4 py-2.5 font-semibold">Dosage</th>
                <th className="px-4 py-2.5 font-semibold">Frequency</th>
                <th className="px-4 py-2.5 font-semibold">Duration</th>
                <th className="px-4 py-2.5 font-semibold">Instructions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {prescription.medicines?.map((med, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-bold text-slate-800">{formatMedicineName(med.medicineName)}</td>
                  <td className="px-4 py-3 text-slate-600">{med.dosage}</td>
                  <td className="px-4 py-3 text-slate-600">{med.frequency}</td>
                  <td className="px-4 py-3 text-slate-600">{med.duration}</td>
                  <td className="px-4 py-3 text-slate-500 italic">{med.instructions || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Notes */}
      {prescription.notes && (
        <div className="p-4 bg-teal-50/40 border border-teal-100 rounded-xl space-y-1">
          <h4 className="text-xs font-bold text-teal-800 uppercase tracking-wider">Doctor Advice & Notes</h4>
          <p className="text-xs text-slate-700 leading-relaxed">{prescription.notes}</p>
        </div>
      )}

      {/* Doctor Signature Block */}
      <div className="pt-8 flex justify-end">
        <div className="text-center border-t border-slate-300 pt-2 w-48">
          <p className="text-xs font-bold text-slate-800">{doctorName}</p>
          <p className="text-[10px] text-slate-400">Authorized Specialist Signature</p>
        </div>
      </div>
    </div>
  );
};

export default PrescriptionDocView;
