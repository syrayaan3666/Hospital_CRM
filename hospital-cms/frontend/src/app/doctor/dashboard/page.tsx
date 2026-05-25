'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import AuthGuard from '../../../components/AuthGuard';
import DashboardLayout from '../../../components/DashboardLayout';
import apiClient from '../../../lib/axios';
import type { Appointment, ApiResponse, Doctor } from '../../../types';

function formatDate(date: Date) {
  return date.toLocaleDateString();
}

export default function DoctorDashboardPage() {
  const router = useRouter();
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const today = new Date().toISOString().slice(0, 10);
        const [docRes, apptRes] = await Promise.all([
          apiClient.get<ApiResponse<Doctor>>('/doctors/me'),
          apiClient.get<ApiResponse<Appointment[]>>(`/appointments/doctor?date=${today}`),
        ]);

        if (!mounted) return;
        setDoctor(docRes.data.data);
        const items = apptRes.data.data
          .slice()
          .sort((a, b) => String(a.slotTime ?? '').localeCompare(String(b.slotTime ?? '')));
        setAppointments(items);
      } catch (error) {
        console.error(error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, []);

  const headerDate = useMemo(() => formatDate(new Date()), []);

  const handleStart = async (apptId: string) => {
    try {
      await apiClient.patch(`/appointments/${apptId}/status`, { status: 'IN_PROGRESS' });
      router.push(`/doctor/consultation/${apptId}`);
    } catch (error) {
      console.error(error);
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

  return (
    <AuthGuard allowedRoles={["DOCTOR"]}>
      <DashboardLayout>
        <div>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-2xl font-semibold">Today, {headerDate}</h2>
            <div className="text-sm text-gray-600">Total: {appointments.length}</div>
          </div>

          {appointments.length === 0 ? (
            <div className="p-6 text-center text-gray-500">No appointments scheduled for today.</div>
          ) : (
            <div className="space-y-3">
              {appointments.map((a) => (
                <div key={a.id} className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-lg font-medium">
                        {a.patient?.firstName} {a.patient?.lastName} <span className="text-sm text-gray-500">({Math.floor((Date.now() - new Date(a.patient?.dateOfBirth ?? '').getTime()) / (1000 * 60 * 60 * 24 * 365))}y)</span>
                      </div>
                      <div className="text-sm text-gray-600">{a.reason ?? 'No reason provided'}</div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-medium">{a.slotTime}</div>
                      <div className="mt-2 flex gap-2">
                        {a.status === 'SCHEDULED' || a.status === 'CONFIRMED' ? (
                          <button onClick={() => handleStart(a.id)} className="rounded bg-blue-600 px-3 py-1 text-white">Start Consultation</button>
                        ) : null}

                        {a.status === 'IN_PROGRESS' ? (
                          <button onClick={() => router.push(`/doctor/consultation/${a.id}`)} className="rounded bg-green-600 px-3 py-1 text-white">Continue</button>
                        ) : null}

                        {a.status === 'COMPLETED' ? (
                          <button onClick={() => router.push(`/doctor/consultation/${a.id}`)} className="rounded bg-gray-600 px-3 py-1 text-white">View Record</button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DashboardLayout>
    </AuthGuard>
  );
}
