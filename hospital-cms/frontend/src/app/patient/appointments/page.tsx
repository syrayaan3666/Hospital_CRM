'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarClock, CheckCircle2, CircleAlert, Loader2, XCircle } from 'lucide-react';
import AuthGuard from '../../../components/AuthGuard';
import DashboardLayout from '../../../components/DashboardLayout';
import apiClient from '../../../lib/axios';
import {
  type ApiEnvelope,
  type AppointmentRecord,
  type PatientRecord,
  getAppointmentStatusClass,
  toShortDate,
  toTime,
} from '../shared';

const PAGE_SIZE = 10;

export default function PatientAppointmentsPage() {
  return (
    <AuthGuard allowedRoles={['PATIENT']}>
      <DashboardLayout>
        <PatientAppointmentsContent />
      </DashboardLayout>
    </AuthGuard>
  );
}

function PatientAppointmentsContent() {
  const router = useRouter();
  const [patient, setPatient] = useState<PatientRecord | null>(null);
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async (): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        const meResponse = await apiClient.get<ApiEnvelope<PatientRecord>>('/patients/me');
        const currentPatient = meResponse.data.data;
        const response = await apiClient.get<ApiEnvelope<AppointmentRecord[]>>('/appointments/patient');

        if (!active) {
          return;
        }

        setPatient(currentPatient);
        setAppointments(response.data.data);
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : 'Unable to load appointments');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  const totalPages = Math.max(1, Math.ceil(appointments.length / PAGE_SIZE));
  const currentAppointments = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return appointments.slice(start, start + PAGE_SIZE);
  }, [appointments, page]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const handleCancel = async (appointment: AppointmentRecord): Promise<void> => {
    const reason = window.prompt('Please enter a cancellation reason');

    if (!reason?.trim()) {
      return;
    }

    setRefreshingId(appointment.id);

    try {
      await apiClient.patch(`/appointments/${appointment.id}/status`, {
        status: 'CANCELLED',
        reason: reason.trim(),
      });

      const response = await apiClient.get<ApiEnvelope<AppointmentRecord[]>>('/appointments/patient');
      setAppointments(response.data.data);
    } finally {
      setRefreshingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Appointments</h2>
            <p className="mt-1 text-sm text-slate-500">
              {patient ? `${patient.firstName} ${patient.lastName}` : 'Your'} appointment history, sorted from newest to oldest.
            </p>
          </div>
          <Link
            href="/patient/appointments/book"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            <CalendarClock className="h-4 w-4" />
            Book Appointment
          </Link>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
        {loading ? (
          <LoadingState />
        ) : appointments.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Doctor</th>
                    <th className="px-4 py-3 font-medium">Department</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Time</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {currentAppointments.map((appointment) => {
                    const doctorName = `${appointment.doctor.firstName} ${appointment.doctor.lastName}`.trim();
                    return (
                      <tr key={appointment.id} className="align-top">
                        <td className="px-4 py-4 font-medium text-slate-900">{doctorName}</td>
                        <td className="px-4 py-4 text-slate-600">{appointment.department.name}</td>
                        <td className="px-4 py-4 text-slate-600">{toShortDate(appointment.scheduledAt)}</td>
                        <td className="px-4 py-4 text-slate-600">{toTime(appointment.scheduledAt)}</td>
                        <td className="px-4 py-4 text-slate-600">{appointment.appointmentType}</td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${getAppointmentStatusClass(appointment.status)}`}>
                            {appointment.status}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          {appointment.status === 'SCHEDULED' ? (
                            <button
                              type="button"
                              disabled={refreshingId === appointment.id}
                              onClick={() => void handleCancel(appointment)}
                              className="inline-flex items-center gap-2 rounded-full border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              Cancel
                            </button>
                          ) : appointment.status === 'COMPLETED' ? (
                            <button
                              type="button"
                              onClick={() => router.push(`/patient/records/${appointment.id}`)}
                              className="inline-flex items-center gap-2 rounded-full border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              View Record
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Pagination
              page={page}
              totalPages={totalPages}
              onPrevious={() => setPage((current) => Math.max(1, current - 1))}
              onNext={() => setPage((current) => Math.min(totalPages, current + 1))}
            />
          </div>
        )}
      </section>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Loading appointments...
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center">
      <CircleAlert className="h-10 w-10 text-slate-400" />
      <h3 className="mt-4 text-lg font-semibold text-slate-900">No appointments found</h3>
      <p className="mt-2 max-w-md text-sm text-slate-500">Book a new appointment to see it appear here with doctor, department, and status details.</p>
    </div>
  );
}

interface PaginationProps {
  page: number;
  totalPages: number;
  onPrevious: () => void;
  onNext: () => void;
}

function Pagination({ page, totalPages, onPrevious, onNext }: PaginationProps) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-4 text-sm text-slate-600">
      <p>
        Page {page} of {totalPages}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrevious}
          disabled={page === 1}
          className="rounded-full border border-slate-200 px-3 py-2 font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={page === totalPages}
          className="rounded-full border border-slate-200 px-3 py-2 font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
