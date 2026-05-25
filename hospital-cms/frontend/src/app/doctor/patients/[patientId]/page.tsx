'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import AuthGuard from '../../../../components/AuthGuard';
import DashboardLayout from '../../../../components/DashboardLayout';
import apiClient from '../../../../lib/axios';
import type { Patient, Consultation, ApiResponse } from '../../../../types';

export default function PatientDetailsPage() {
  const params = useParams();
  const patientId = params?.patientId ?? '';

  const [patient, setPatient] = useState<Patient | null>(null);
  const [timeline, setTimeline] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [pRes, tRes] = await Promise.all([
          apiClient.get<ApiResponse<Patient>>(`/patients/${patientId}`),
          apiClient.get<ApiResponse<Consultation[]>>(`/consultations/patient/${patientId}/timeline`),
        ]);
        if (!mounted) return;
        setPatient(pRes.data.data);
        setTimeline(tRes.data.data);
      } catch (error) {
        console.error(error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    if (patientId) load();
    return () => {
      mounted = false;
    };
  }, [patientId]);

  const age = useMemo(() => {
    if (!patient) return null;
    const diff = Date.now() - new Date(patient.dateOfBirth).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24 * 365));
  }, [patient]);

  if (loading) {
    return (
      <AuthGuard allowedRoles={["DOCTOR"]}>
        <DashboardLayout>
          <div className="min-h-[300px] flex items-center justify-center">Loading...</div>
        </DashboardLayout>
      </AuthGuard>
    );
  }

  if (!patient) {
    return (
      <AuthGuard allowedRoles={["DOCTOR"]}>
        <DashboardLayout>
          <div>Patient not found</div>
        </DashboardLayout>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard allowedRoles={["DOCTOR"]}>
      <DashboardLayout>
        <div className="space-y-4">
          <div className="rounded border p-4">
            <h3 className="text-lg font-semibold">{patient.firstName} {patient.lastName}</h3>
            <div className="text-sm text-gray-600">Age: {age} • Phone: {patient.phone}</div>
            <div className="mt-2">Allergies: {patient.allergies.length > 0 ? patient.allergies.join(', ') : 'None'}</div>
            <div>Chronic: {patient.chronicConditions.length > 0 ? patient.chronicConditions.join(', ') : 'None'}</div>
          </div>

          <div>
            <h4 className="mb-2 text-lg font-semibold">Consultation Timeline</h4>
            <div className="space-y-2">
              {timeline.map((c) => (
                <div key={c.id} className="rounded border p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{new Date(c.createdAt).toLocaleString()}</div>
                      <div className="text-sm text-gray-600">{c.diagnosis ?? 'No diagnosis'} — {c.chiefComplaint}</div>
                    </div>
                    <div className="text-sm">Vitals: {c.vitals ? Object.entries(c.vitals).map(([k, v]) => `${k}:${v}`).join(' | ') : 'N/A'}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DashboardLayout>
    </AuthGuard>
  );
}
