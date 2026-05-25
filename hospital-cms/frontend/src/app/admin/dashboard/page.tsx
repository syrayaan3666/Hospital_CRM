'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts';
import { CalendarDays, FlaskConical, IndianRupee, Users } from 'lucide-react';
import apiClient from '../../../lib/axios';
import AuthGuard from '../../../components/AuthGuard';
import DashboardLayout from '../../../components/DashboardLayout';
import type { ApiResponse } from '../../../types';

type KpiValue = string | number;

interface KpiCardState {
  value: KpiValue;
  loading: boolean;
  error: boolean;
}

interface RevenueResponse {
  success: boolean;
  data: {
    totalRevenue: number;
  };
}

interface CountResponse {
  success: boolean;
  data: {
    count: number;
  };
}

interface AppointmentRow {
  id: string;
  patient?: { firstName: string; lastName: string };
  doctor?: { firstName: string; lastName: string };
  scheduledAt?: string;
  appointmentDate?: string;
  slotTime?: string;
  status: string;
}

const weeklyAppointments = [
  { day: 'Mon', value: 4 },
  { day: 'Tue', value: 7 },
  { day: 'Wed', value: 5 },
  { day: 'Thu', value: 9 },
  { day: 'Fri', value: 6 },
  { day: 'Sat', value: 3 },
  { day: 'Sun', value: 1 },
];

const monthlyRevenue = [
  { week: 'Week 1', value: 45000 },
  { week: 'Week 2', value: 62000 },
  { week: 'Week 3', value: 38000 },
  { week: 'Week 4', value: 71000 },
];

const statusClasses: Record<string, string> = {
  SCHEDULED: 'bg-blue-50 text-blue-700',
  CONFIRMED: 'bg-green-50 text-green-700',
  IN_PROGRESS: 'bg-yellow-50 text-yellow-700',
  COMPLETED: 'bg-gray-100 text-gray-700',
  CANCELLED: 'bg-red-50 text-red-700',
};

const kpiSkeleton = 'animate-pulse rounded-md bg-gray-200';

export default function AdminDashboardPage() {
  return (
    <AuthGuard allowedRoles={['ADMIN']}>
      <DashboardLayout>
        <AdminDashboardContent />
      </DashboardLayout>
    </AuthGuard>
  );
}

function AdminDashboardContent() {
  const router = useRouter();
  const [patientsCount, setPatientsCount] = useState<KpiCardState>({ value: '--', loading: true, error: false });
  const [todayAppointments, setTodayAppointments] = useState<KpiCardState>({ value: '--', loading: true, error: false });
  const [monthlyRevenueValue, setMonthlyRevenueValue] = useState<KpiCardState>({ value: '--', loading: true, error: false });
  const [pendingLabResults, setPendingLabResults] = useState<KpiCardState>({ value: '--', loading: true, error: false });
  const [recentAppointments, setRecentAppointments] = useState<AppointmentRow[]>([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const loadDashboard = async () => {
      const today = new Date().toISOString().slice(0, 10);

      try {
        const [patientsResponse, todayAppointmentsResponse, revenueResponse, labResponse, appointmentsResponse] = await Promise.all([
          apiClient.get<CountResponse>('/patients/count'),
          apiClient.get<CountResponse>('/appointments/today-count'),
          apiClient.get<RevenueResponse>(`/billing/revenue/daily?date=${today}`),
          apiClient.get<CountResponse>('/lab/pending-count'),
          apiClient.get<ApiResponse<AppointmentRow[]>>(`/appointments/doctor?date=${today}`),
        ]);

        if (!mounted) {
          return;
        }

        setPatientsCount({ value: patientsResponse.data.data.count, loading: false, error: false });
        setTodayAppointments({ value: todayAppointmentsResponse.data.data.count, loading: false, error: false });
        setMonthlyRevenueValue({ value: revenueResponse.data.data.totalRevenue, loading: false, error: false });
        setPendingLabResults({ value: labResponse.data.data.count, loading: false, error: false });
        setRecentAppointments(appointmentsResponse.data.data);
        setAppointmentsLoading(false);
      } catch {
        if (!mounted) {
          return;
        }

        setPatientsCount({ value: '--', loading: false, error: true });
        setTodayAppointments({ value: '--', loading: false, error: true });
        setMonthlyRevenueValue({ value: '--', loading: false, error: true });
        setPendingLabResults({ value: '--', loading: false, error: true });
        setRecentAppointments([]);
        setAppointmentsLoading(false);
      }
    };

    void loadDashboard();

    return () => {
      mounted = false;
    };
  }, []);

  const cards = useMemo(
    () => [
      {
        label: 'Total Patients',
        value: patientsCount.value,
        loading: patientsCount.loading,
        error: patientsCount.error,
        icon: Users,
        tone: 'bg-blue-50 text-blue-700',
      },
      {
        label: 'Today\'s Appointments',
        value: todayAppointments.value,
        loading: todayAppointments.loading,
        error: todayAppointments.error,
        icon: CalendarDays,
        tone: 'bg-green-50 text-green-700',
      },
      {
        label: 'Monthly Revenue',
        value: monthlyRevenueValue.value,
        loading: monthlyRevenueValue.loading,
        error: monthlyRevenueValue.error,
        icon: IndianRupee,
        tone: 'bg-purple-50 text-purple-700',
      },
      {
        label: 'Pending Lab Results',
        value: pendingLabResults.value,
        loading: pendingLabResults.loading,
        error: pendingLabResults.error,
        icon: FlaskConical,
        tone: 'bg-orange-50 text-orange-700',
      },
    ],
    [monthlyRevenueValue, pendingLabResults, patientsCount, todayAppointments],
  );

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;

          return (
            <article key={card.label} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">{card.label}</p>
                  <div className="mt-3 text-3xl font-semibold text-gray-900">
                    {card.loading ? <div className={`${kpiSkeleton} h-9 w-24`} /> : card.error ? '--' : card.value}
                  </div>
                </div>
                <div className={`flex h-12 w-12 items-center justify-center rounded-full ${card.tone}`}>
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Appointments This Week</h2>
          </div>
          <div className="overflow-x-auto">
            <LineChart width={560} height={288} data={weeklyAppointments}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="day" stroke="#6B7280" />
              <YAxis stroke="#6B7280" />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#2563EB" strokeWidth={3} dot={{ fill: '#2563EB' }} />
            </LineChart>
          </div>
        </article>

        <article className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Revenue This Month</h2>
          </div>
          <div className="overflow-x-auto">
            <BarChart width={560} height={288} data={monthlyRevenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="week" stroke="#6B7280" />
              <YAxis stroke="#6B7280" />
              <Tooltip />
              <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                {monthlyRevenue.map((entry) => (
                  <Cell key={entry.week} fill="#2563EB" />
                ))}
              </Bar>
            </BarChart>
          </div>
        </article>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Recent Appointments</h2>
          <button
            type="button"
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            onClick={() => router.push('/admin/audit')}
          >
            View Audit Logs
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">Patient</th>
                <th className="px-4 py-3 font-medium">Doctor</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Time</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {appointmentsLoading ? (
                <tr>
                  <td className="px-4 py-4 text-gray-500" colSpan={5}>
                    Loading recent appointments...
                  </td>
                </tr>
              ) : recentAppointments.length > 0 ? (
                recentAppointments.map((appointment) => {
                  const scheduled = appointment.scheduledAt ?? appointment.appointmentDate ?? '';
                  const patientName = appointment.patient
                    ? `${appointment.patient.firstName} ${appointment.patient.lastName}`
                    : '--';
                  const doctorName = appointment.doctor
                    ? `${appointment.doctor.firstName} ${appointment.doctor.lastName}`
                    : '--';

                  return (
                    <tr key={appointment.id}>
                      <td className="px-4 py-3">{patientName}</td>
                      <td className="px-4 py-3">{doctorName}</td>
                      <td className="px-4 py-3">{scheduled ? new Date(scheduled).toLocaleDateString() : '--'}</td>
                      <td className="px-4 py-3">{appointment.slotTime ?? (scheduled ? new Date(scheduled).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--')}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses[appointment.status] ?? 'bg-gray-100 text-gray-700'}`}>
                          {appointment.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="px-4 py-4 text-gray-500" colSpan={5}>
                    No recent appointments to show.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => router.push('/admin/doctors/new')}
          className="rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
        >
          Add Doctor
        </button>
        <button
          type="button"
          onClick={() => router.push('/admin/departments/new')}
          className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
        >
          Add Department
        </button>
        <button
          type="button"
          onClick={() => router.push('/admin/audit')}
          className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
        >
          View Audit Logs
        </button>
      </section>
    </div>
  );
}
