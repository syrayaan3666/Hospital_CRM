'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useParams } from 'next/navigation';
import AuthGuard from '../../../../components/AuthGuard';
import DashboardLayout from '../../../../components/DashboardLayout';
import apiClient from '../../../../lib/axios';
import type { Appointment, Consultation, ApiResponse, Patient } from '../../../../types';

export default function ConsultationPage() {
  const router = useRouter();
  const params = useParams();
  const appointmentId = params?.appointmentId ?? '';

  const [appointment, setAppointment] = useState<Appointment | null>(null);
  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const [apptRes, consultRes] = await Promise.all([
          apiClient.get<ApiResponse<Appointment>>(`/appointments/${appointmentId}`),
          apiClient.get<ApiResponse<Consultation>>(`/consultations/appointment/${appointmentId}`).catch((err) => {
            if (err.response && err.response.status === 404) return null;
            throw err;
          }),
        ]);

        if (!mounted) return;
        setAppointment(apptRes.data.data);
        setConsultation(consultRes ? consultRes.data.data : null);
      } catch (error) {
        console.error(error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    if (appointmentId) load();

    return () => {
      mounted = false;
    };
  }, [appointmentId]);

  const patient = appointment?.patient;

  const age = useMemo(() => {
    if (!patient) return null;
    const diff = Date.now() - new Date(patient.dateOfBirth).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24 * 365));
  }, [patient]);

  const handleComplete = async () => {
    if (!appointment) return;
    setSaving(true);
    try {
      // Save consultation
      const payload = consultation ?? { appointmentId, doctorId: appointment.doctorId, patientId: appointment.patientId, chiefComplaint: '' };
      const res = await apiClient.post<ApiResponse<Consultation>>('/consultations', payload);
      const consultationId = res.data.data.id;

      // For simplicity prescriptions/labs are not separately posted here in this minimal implementation

      await apiClient.patch(`/appointments/${appointment.id}/status`, { status: 'COMPLETED' });
      router.push('/doctor/dashboard');
    } catch (error) {
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <AuthGuard allowedRoles={["DOCTOR"]}>
        <DashboardLayout>
          <div className="min-h-[300px] flex items-center justify-center">Loading...</div>
        </DashboardLayout>
      </AuthGuard>
    );
  }

  if (!appointment) {
    return (
      <AuthGuard allowedRoles={["DOCTOR"]}>
        <DashboardLayout>
          <div>Appointment not found</div>
        </DashboardLayout>
      </AuthGuard>
    );
  }

  const isLocked = consultation?.isLocked ?? false;

  return (
    <AuthGuard allowedRoles={["DOCTOR"]}>
      <DashboardLayout>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <aside className="col-span-1 rounded border p-4">
            <h3 className="text-lg font-semibold">{patient?.firstName} {patient?.lastName}</h3>
            <div className="text-sm text-gray-600">Age: {age} | Gender: {patient?.gender}</div>
            <div className="mt-3">
              <div className="font-medium">Blood Group</div>
              <div className="text-sm">{patient?.bloodGroup ?? 'N/A'}</div>
            </div>

            {patient?.allergies && patient.allergies.length > 0 ? (
              <div className="mt-4 rounded border border-red-200 bg-red-50 p-3">
                <div className="font-semibold text-red-700">⚠ Patient has known allergies: {patient.allergies.join(', ')}</div>
              </div>
            ) : null}

            <div className="mt-4">
              <div className="font-medium">Chronic Conditions</div>
              <div className="text-sm">{(patient?.chronicConditions && patient.chronicConditions.length > 0) ? patient.chronicConditions.join(', ') : 'None'}</div>
            </div>

            <div className="mt-4">
              <div className="font-medium">Emergency Contact</div>
              <div className="text-sm">{patient?.emergencyContactName ?? 'N/A'} {patient?.emergencyContactPhone ? `(${patient.emergencyContactPhone})` : ''}</div>
            </div>
          </aside>

          <section className="col-span-2 rounded border p-4">
            {isLocked ? (
              <div className="text-center text-gray-600">This record is locked and cannot be edited</div>
            ) : (
              <div>
                <h4 className="mb-2 text-lg font-semibold">Consultation</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium">Chief Complaint</label>
                    <textarea defaultValue={consultation?.chiefComplaint ?? ''} className="mt-1 w-full rounded border p-2" />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium">Blood Pressure</label>
                      <input defaultValue={consultation?.vitals?.bp ?? ''} className="mt-1 w-full rounded border p-2" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium">Temperature (°F)</label>
                      <input type="number" defaultValue={consultation?.vitals?.temperature ?? undefined} className="mt-1 w-full rounded border p-2" />
                    </div>
                  </div>

                  <div className="mt-4 flex gap-2">
                    <button onClick={() => {}} className="rounded bg-gray-200 px-4 py-2">Save Draft</button>
                    <button onClick={handleComplete} disabled={saving} className="rounded bg-blue-600 px-4 py-2 text-white">{saving ? 'Saving...' : 'Complete Consultation'}</button>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </DashboardLayout>
    </AuthGuard>
  );
}
