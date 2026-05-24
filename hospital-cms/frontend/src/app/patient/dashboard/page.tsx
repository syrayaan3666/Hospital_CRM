'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ComponentType } from 'react';
import Link from 'next/link';
import { ArrowRight, CalendarPlus, Download, FileText, FlaskConical, Loader2, Receipt, ShieldCheck } from 'lucide-react';
import AuthGuard from '../../../components/AuthGuard';
import DashboardLayout from '../../../components/DashboardLayout';
import apiClient from '../../../lib/axios';
import useAuthStore from '../../../store/auth.store';
import {
  type ApiEnvelope,
  type AppointmentRecord,
  type BillRecord,
  type LabResultRecord,
  type PatientRecord,
  formatDateInputValue,
  getAppointmentStatusClass,
  getBillStatusClass,
  toCurrency,
  toLongDateTime,
  toShortDate,
  toTime,
} from '../shared';

interface DashboardDataState {
  patient: PatientRecord | null;
  appointments: AppointmentRecord[];
  results: LabResultRecord[];
  bills: BillRecord[];
  loading: boolean;
  error: string | null;
}

function emptyDashboardState(): DashboardDataState {
  return {
    patient: null,
    appointments: [],
    results: [],
    bills: [],
    loading: true,
    error: null,
  };
}

export default function PatientDashboardPage() {
  return (
    <AuthGuard allowedRoles={['PATIENT']}>
      <DashboardLayout>
        <PatientDashboardContent />
      </DashboardLayout>
    </AuthGuard>
  );
}

function PatientDashboardContent() {
  const { user } = useAuthStore();
  const [state, setState] = useState<DashboardDataState>(emptyDashboardState);

  useEffect(() => {
    let active = true;

    const loadDashboard = async (): Promise<void> => {
      setState(emptyDashboardState());

      try {
        const patientResponse = await apiClient.get<ApiEnvelope<PatientRecord>>('/patients/me');
        const patient = patientResponse.data.data;

        if (!active) {
          return;
        }

        const [appointmentsResult, resultsResult, billsResult] = await Promise.allSettled([
          apiClient.get<ApiEnvelope<AppointmentRecord[]>>('/appointments/patient'),
          apiClient.get<ApiEnvelope<LabResultRecord[]>>(`/lab/results/patient/${patient.id}`),
          apiClient.get<ApiEnvelope<BillRecord[]>>(`/billing/bills/patient/${patient.id}`),
        ]);

        if (!active) {
          return;
        }

        setState({
          patient,
          appointments:
            appointmentsResult.status === 'fulfilled' ? appointmentsResult.value.data.data : [],
          results: resultsResult.status === 'fulfilled' ? resultsResult.value.data.data : [],
          bills: billsResult.status === 'fulfilled' ? billsResult.value.data.data : [],
          loading: false,
          error: null,
        });
      } catch (error) {
        if (!active) {
          return;
        }

        setState({
          patient: null,
          appointments: [],
          results: [],
          bills: [],
          loading: false,
          error: error instanceof Error ? error.message : 'Unable to load dashboard',
        });
      }
    };

    void loadDashboard();

    return () => {
      active = false;
    };
  }, []);

  const firstName = useMemo(() => {
    const fullName = user?.name?.trim() ?? 'Patient';
    return fullName.length > 0 ? fullName.split(/\s+/)[0] : 'Patient';
  }, [user?.name]);

  const patientName = useMemo(() => {
    if (!state.patient) {
      return firstName;
    }

    return `${state.patient.firstName} ${state.patient.lastName}`.trim();
  }, [firstName, state.patient]);

  const upcomingAppointments = useMemo(() => {
    return state.appointments
      .filter((appointment) => appointment.status === 'SCHEDULED' || appointment.status === 'CONFIRMED')
      .sort((left, right) => new Date(left.scheduledAt).getTime() - new Date(right.scheduledAt).getTime())
      .slice(0, 3);
  }, [state.appointments]);

  const recentResults = useMemo(() => state.results.slice(0, 3), [state.results]);

  const outstandingBills = useMemo(() => {
    return state.bills.filter((bill) => bill.status !== 'PAID');
  }, [state.bills]);

  const outstandingTotal = useMemo(() => {
    return outstandingBills.reduce((sum, bill) => {
      const totalAmount = Number(bill.totalAmount ?? 0);
      const amountPaid = Number(bill.amountPaid ?? 0);
      return sum + Math.max(totalAmount - amountPaid, 0);
    }, 0);
  }, [outstandingBills]);

  const nextAppointment = upcomingAppointments[0] ?? null;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-sky-600 via-indigo-600 to-cyan-700 text-white shadow-xl shadow-sky-950/10">
        <div className="grid gap-6 px-6 py-7 lg:grid-cols-[1.4fr_0.9fr] lg:px-8">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/85">
              <ShieldCheck className="h-3.5 w-3.5" />
              Patient Portal
            </div>
            <div>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Welcome back, {patientName}</h2>
              <p className="mt-2 max-w-2xl text-sm text-white/80 sm:text-base">
                Your appointments, lab reports, and bills are all in one place. Keep an eye on the next visit and recent care updates.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/patient/appointments/book"
                className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-sky-700 transition hover:bg-slate-100"
              >
                <CalendarPlus className="h-4 w-4" />
                Book New Appointment
              </Link>
              <Link
                href="/patient/bills"
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15"
              >
                <Receipt className="h-4 w-4" />
                View Bills
              </Link>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            <StatPill label="Upcoming" value={upcomingAppointments.length} />
            <StatPill label="Outstanding" value={toCurrency(outstandingTotal)} />
            <StatPill label="Next Visit" value={nextAppointment ? toShortDate(nextAppointment.scheduledAt) : '—'} />
          </div>
        </div>
      </section>

      {state.error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {state.error}
        </div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-3">
        <article className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100 xl:col-span-2">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Upcoming Appointments</h3>
              <p className="text-sm text-slate-500">Your next three confirmed or scheduled visits.</p>
            </div>
            <Link href="/patient/appointments" className="inline-flex items-center gap-2 text-sm font-semibold text-sky-700 hover:text-sky-800">
              View all
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {state.loading ? (
            <LoadingPanel label="Loading appointments" />
          ) : upcomingAppointments.length === 0 ? (
            <EmptyState
              icon={CalendarPlus}
              title="No upcoming appointments"
              description="When you book a visit, it will appear here with the doctor name, date, and time."
            />
          ) : (
            <div className="space-y-3">
              {upcomingAppointments.map((appointment) => {
                const doctorName = `${appointment.doctor.firstName} ${appointment.doctor.lastName}`.trim();
                return (
                  <div key={appointment.id} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 transition hover:border-sky-200 hover:bg-sky-50/60">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <p className="font-semibold text-slate-900">{doctorName}</p>
                        <p className="text-sm text-slate-500">{appointment.department.name} · {appointment.doctor.specialization}</p>
                        <p className="text-sm text-slate-500">{toShortDate(appointment.scheduledAt)} · {toTime(appointment.scheduledAt)}</p>
                      </div>
                      <div className="flex flex-col items-start gap-2 sm:items-end">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${getAppointmentStatusClass(appointment.status)}`}>
                          {appointment.status}
                        </span>
                        <span className="text-xs text-slate-500">{appointment.appointmentType}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </article>

        <article className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Recent Lab Results</h3>
              <p className="text-sm text-slate-500">Latest reports available for download.</p>
            </div>
            <Link href="/patient/records" className="inline-flex items-center gap-2 text-sm font-semibold text-sky-700 hover:text-sky-800">
              History
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {state.loading ? (
            <LoadingPanel label="Loading results" />
          ) : recentResults.length === 0 ? (
            <EmptyState
              icon={FlaskConical}
              title="No lab results yet"
              description="Your completed lab reports will appear here once they are marked ready."
            />
          ) : (
            <div className="space-y-3">
              {recentResults.map((result) => (
                <div key={result.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <p className="font-semibold text-slate-900">{result.labOrder.testName}</p>
                      <p className="text-sm text-slate-500">{toShortDate(result.uploadedAt)} · {toTime(result.uploadedAt)}</p>
                      {result.resultName ? <p className="text-sm text-slate-600">{result.resultName}</p> : null}
                    </div>
                    {result.fileUrl ? (
                      <a
                        href={result.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Download
                      </a>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      <section className="grid gap-6 xl:grid-cols-3">
        <article className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-100 xl:col-span-2">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Outstanding Bills</h3>
              <p className="text-sm text-slate-500">Bills that still need attention.</p>
            </div>
            <Link href="/patient/bills" className="inline-flex items-center gap-2 text-sm font-semibold text-sky-700 hover:text-sky-800">
              Open bills
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {state.loading ? (
            <LoadingPanel label="Loading bills" />
          ) : outstandingBills.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="All bills are settled"
              description="Once a new bill is issued, it will show here together with the outstanding balance."
            />
          ) : (
            <div className="space-y-3">
              {outstandingBills.slice(0, 3).map((bill) => {
                const balance = Math.max(Number(bill.totalAmount ?? 0) - Number(bill.amountPaid ?? 0), 0);
                return (
                  <div key={bill.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <p className="font-semibold text-slate-900">{bill.billNumber}</p>
                        <p className="text-sm text-slate-500">Issued {toShortDate(bill.issuedAt)}</p>
                      </div>
                      <div className="flex flex-col items-start gap-2 sm:items-end">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${getBillStatusClass(bill.status)}`}>
                          {bill.status}
                        </span>
                        <p className="text-sm font-semibold text-slate-900">{toCurrency(balance)} due</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </article>

        <article className="rounded-3xl bg-slate-950 p-5 text-white shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Quick Snapshot</h3>
              <p className="text-sm text-white/70">A compact overview of your care</p>
            </div>
          </div>

          <div className="mt-5 space-y-3 text-sm">
            <div className="rounded-2xl bg-white/5 p-4">
              <p className="text-white/60">Medical Record</p>
              <p className="mt-1 font-semibold">{state.patient?.medicalRecordNumber ?? '--'}</p>
            </div>
            <div className="rounded-2xl bg-white/5 p-4">
              <p className="text-white/60">Date of Birth</p>
              <p className="mt-1 font-semibold">{toShortDate(state.patient?.dateOfBirth)}</p>
            </div>
            <div className="rounded-2xl bg-white/5 p-4">
              <p className="text-white/60">Last Updated</p>
              <p className="mt-1 font-semibold">{state.patient ? formatDateInputValue(new Date(state.patient.createdAt)) : '--'}</p>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}

interface StatPillProps {
  label: string;
  value: string | number;
}

function StatPill({ label, value }: StatPillProps) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

interface EmptyStateProps {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
}

function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex min-h-[180px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm ring-1 ring-slate-200">
        <Icon className="h-5 w-5" />
      </div>
      <h4 className="mt-4 text-base font-semibold text-slate-900">{title}</h4>
      <p className="mt-2 max-w-sm text-sm text-slate-500">{description}</p>
    </div>
  );
}

function LoadingPanel({ label }: { label: string }) {
  return (
    <div className="flex min-h-[180px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}
