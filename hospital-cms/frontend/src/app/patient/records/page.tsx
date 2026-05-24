'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, FileClock, Loader2, NotebookText } from 'lucide-react';
import AuthGuard from '../../../components/AuthGuard';
import DashboardLayout from '../../../components/DashboardLayout';
import apiClient from '../../../lib/axios';
import {
  type ApiEnvelope,
  type ConsultationTimelineRecord,
  type PatientRecord,
  getAppointmentStatusClass,
  getLabStatusClass,
  toLongDateTime,
  toShortDate,
} from '../shared';

interface TimelineState {
  patient: PatientRecord | null;
  consultations: ConsultationTimelineRecord[];
  loading: boolean;
  error: string | null;
}

export default function PatientRecordsPage() {
  return (
    <AuthGuard allowedRoles={['PATIENT']}>
      <DashboardLayout>
        <PatientRecordsContent />
      </DashboardLayout>
    </AuthGuard>
  );
}

function PatientRecordsContent() {
  const [state, setState] = useState<TimelineState>({
    patient: null,
    consultations: [],
    loading: true,
    error: null,
  });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async (): Promise<void> => {
      setState((current) => ({ ...current, loading: true, error: null }));

      try {
        const patientResponse = await apiClient.get<ApiEnvelope<PatientRecord>>('/patients/me');
        const patient = patientResponse.data.data;
        const timelineResponse = await apiClient.get<ApiEnvelope<ConsultationTimelineRecord[]>>(
          `/consultations/patient/${patient.id}/timeline`,
        );

        if (!active) {
          return;
        }

        setState({
          patient,
          consultations: timelineResponse.data.data,
          loading: false,
          error: null,
        });
      } catch (error) {
        if (!active) {
          return;
        }

        setState({
          patient: null,
          consultations: [],
          loading: false,
          error: error instanceof Error ? error.message : 'Unable to load medical history',
        });
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  const summaryCount = useMemo(() => state.consultations.length, [state.consultations.length]);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Medical History</h2>
            <p className="mt-1 text-sm text-slate-500">A chronological timeline of consultations and treatment notes.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700">
            <FileClock className="h-4 w-4" />
            {summaryCount} records
          </div>
        </div>
      </section>

      {state.error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {state.error}
        </div>
      ) : null}

      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
        {state.loading ? (
          <LoadingState />
        ) : state.consultations.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-4">
            {state.consultations.map((consultation) => {
              const doctorName = `${consultation.doctor.firstName} ${consultation.doctor.lastName}`.trim();
              const isExpanded = expandedId === consultation.id;

              return (
                <article key={consultation.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/80">
                  <button
                    type="button"
                    onClick={() => setExpandedId((current) => (current === consultation.id ? null : consultation.id))}
                    className="flex w-full items-start justify-between gap-4 p-5 text-left transition hover:bg-slate-100/80"
                  >
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                          {toShortDate(consultation.consultationAt)}
                        </span>
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${getAppointmentStatusClass(consultation.appointment.status)}`}>
                          {consultation.appointment.status}
                        </span>
                      </div>
                      <h3 className="text-lg font-semibold text-slate-900">{doctorName}</h3>
                      <p className="text-sm text-slate-600">{consultation.doctor.specialization} · {consultation.doctor.department.name}</p>
                      <p className="max-w-3xl text-sm text-slate-500">{consultation.symptoms}</p>
                    </div>
                    <div className="flex items-center gap-2 text-slate-500">
                      {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </div>
                  </button>

                  {isExpanded ? (
                    <div className="border-t border-slate-200 bg-white p-5">
                      <div className="grid gap-4 lg:grid-cols-2">
                        <DetailCard title="Consultation Details">
                          <DetailRow label="Date" value={toLongDateTime(consultation.consultationAt)} />
                          <DetailRow label="Chief complaint" value={consultation.symptoms} />
                          <DetailRow label="Diagnosis" value={consultation.diagnosis ?? '—'} />
                          <DetailRow label="Notes" value={consultation.notes ?? '—'} />
                          <DetailRow label="Locked" value={consultation.isLocked ? 'Yes' : 'No'} />
                        </DetailCard>

                        <DetailCard title="Vitals">
                          {consultation.vitals ? (
                            <dl className="grid gap-3 sm:grid-cols-2">
                              {Object.entries(consultation.vitals).map(([key, value]) => (
                                <div key={key} className="rounded-xl bg-slate-50 p-3">
                                  <dt className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{key}</dt>
                                  <dd className="mt-1 text-sm font-semibold text-slate-900">{String(value)}</dd>
                                </div>
                              ))}
                            </dl>
                          ) : (
                            <EmptyInline message="No vitals recorded." />
                          )}
                        </DetailCard>
                      </div>

                      <div className="mt-4 grid gap-4 lg:grid-cols-2">
                        <DetailCard title="Prescriptions">
                          {consultation.prescription ? (
                            <div className="space-y-3">
                              <div className="rounded-xl bg-slate-50 p-3">
                                <p className="text-sm font-semibold text-slate-900">{consultation.prescription.prescriptionNumber}</p>
                                <p className="text-xs text-slate-500">Issued {toShortDate(consultation.prescription.issuedAt)}</p>
                              </div>
                              {consultation.prescription.items.map((item) => (
                                <div key={item.id} className="rounded-xl border border-slate-200 p-3">
                                  <p className="font-semibold text-slate-900">{item.medicineName}</p>
                                  <p className="text-sm text-slate-600">
                                    {item.dosage} · {item.frequency} · {item.durationDays} day(s)
                                  </p>
                                  <p className="text-sm text-slate-500">Quantity: {item.quantity}</p>
                                  {item.instructions ? <p className="mt-1 text-sm text-slate-500">{item.instructions}</p> : null}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <EmptyInline message="No prescription attached." />
                          )}
                        </DetailCard>

                        <DetailCard title="Lab Orders">
                          {consultation.labOrders.length > 0 ? (
                            <div className="space-y-3">
                              {consultation.labOrders.map((order) => (
                                <div key={order.id} className="rounded-xl border border-slate-200 p-3">
                                  <p className="font-semibold text-slate-900">{order.testName}</p>
                                  <p className="text-sm text-slate-500">Ordered {toShortDate(order.orderedAt)}</p>
                                  <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${getLabStatusClass(order.status)}`}>
                                    {order.status}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <EmptyInline message="No lab tests were ordered." />
                          )}
                        </DetailCard>
                      </div>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {state.patient ? (
        <section className="rounded-3xl bg-slate-950 p-5 text-white shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold">Patient Snapshot</h3>
              <p className="text-sm text-white/70">{state.patient.firstName} {state.patient.lastName} · MRN {state.patient.medicalRecordNumber}</p>
            </div>
            <Link href="/patient/appointments/book" className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100">
              <NotebookText className="h-4 w-4" />
              Book Follow-up
            </Link>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Loading medical history...
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center">
      <NotebookText className="h-10 w-10 text-slate-400" />
      <h3 className="mt-4 text-lg font-semibold text-slate-900">No consultations yet</h3>
      <p className="mt-2 max-w-md text-sm text-slate-500">Your completed visits will show up here with diagnosis, prescriptions, and notes.</p>
    </div>
  );
}

function DetailCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</h4>
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-white p-3 ring-1 ring-slate-200">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</span>
      <span className="text-sm font-medium text-slate-900">{value}</span>
    </div>
  );
}

function EmptyInline({ message }: { message: string }) {
  return <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">{message}</p>;
}
