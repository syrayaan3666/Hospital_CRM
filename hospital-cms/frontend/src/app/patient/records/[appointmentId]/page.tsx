'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Loader2, NotebookText } from 'lucide-react';
import AuthGuard from '../../../../components/AuthGuard';
import DashboardLayout from '../../../../components/DashboardLayout';
import apiClient from '../../../../lib/axios';
import {
  type ApiEnvelope,
  type ConsultationTimelineRecord,
  toLongDateTime,
  toShortDate,
  toTime,
} from '../../shared';

export default function PatientAppointmentRecordPage() {
  return (
    <AuthGuard allowedRoles={['PATIENT']}>
      <DashboardLayout>
        <PatientAppointmentRecordContent />
      </DashboardLayout>
    </AuthGuard>
  );
}

function PatientAppointmentRecordContent() {
  const params = useParams<{ appointmentId?: string | string[] }>();
  const appointmentId = Array.isArray(params.appointmentId) ? params.appointmentId[0] ?? '' : params.appointmentId ?? '';
  const [record, setRecord] = useState<ConsultationTimelineRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async (): Promise<void> => {
      if (!appointmentId) {
        setError('Appointment id is missing.');
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const response = await apiClient.get<ApiEnvelope<ConsultationTimelineRecord>>(
          `/consultations/appointment/${appointmentId}`,
        );

        if (!active) {
          return;
        }

        setRecord(response.data.data);
        setError(null);
      } catch (loadError) {
        if (!active) {
          return;
        }

        setRecord(null);
        setError(loadError instanceof Error ? loadError.message : 'Unable to load consultation details');
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
  }, [appointmentId]);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Consultation Record</h2>
            <p className="mt-1 text-sm text-slate-500">Detailed view for the selected appointment.</p>
          </div>
          <Link href="/patient/records" className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
            <ArrowLeft className="h-4 w-4" />
            Back to timeline
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
          <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading record...
          </div>
        ) : record ? (
          <div className="space-y-6">
            <div className="rounded-2xl bg-slate-50 p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Doctor</p>
              <h3 className="mt-2 text-xl font-semibold text-slate-900">
                {record.doctor.firstName} {record.doctor.lastName}
              </h3>
              <p className="text-sm text-slate-600">{record.doctor.specialization} · {record.doctor.department.name}</p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <InfoCard title="Appointment Details">
                <InfoRow label="Consultation date" value={toLongDateTime(record.consultationAt)} />
                <InfoRow label="Appointment date" value={toShortDate(record.appointment.scheduledAt)} />
                <InfoRow label="Appointment time" value={toTime(record.appointment.scheduledAt)} />
                <InfoRow label="Chief complaint" value={record.symptoms} />
                <InfoRow label="Diagnosis" value={record.diagnosis ?? '—'} />
                <InfoRow label="Status" value={record.appointment.status} />
              </InfoCard>

              <InfoCard title="Vitals">
                {record.vitals ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {Object.entries(record.vitals).map(([key, value]) => (
                      <div key={key} className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{key}</p>
                        <p className="mt-1 text-sm font-semibold text-slate-900">{String(value)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">No vitals recorded.</p>
                )}
              </InfoCard>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <InfoCard title="Notes">
                <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">{record.notes ?? 'No notes added.'}</p>
              </InfoCard>

              <InfoCard title="Prescriptions">
                {record.prescription ? (
                  <div className="space-y-3">
                    {record.prescription.items.map((item) => (
                      <div key={item.id} className="rounded-xl border border-slate-200 p-3">
                        <p className="font-semibold text-slate-900">{item.medicineName}</p>
                        <p className="text-sm text-slate-600">{item.dosage} · {item.frequency} · {item.durationDays} day(s)</p>
                        <p className="text-sm text-slate-500">Quantity: {item.quantity}</p>
                        {item.instructions ? <p className="mt-1 text-sm text-slate-500">{item.instructions}</p> : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">No prescription attached to this consultation.</p>
                )}
              </InfoCard>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-center gap-2 text-slate-900">
                <NotebookText className="h-5 w-5" />
                <h3 className="text-base font-semibold">Lab Orders</h3>
              </div>
              <div className="mt-4 space-y-3">
                {record.labOrders.length > 0 ? (
                  record.labOrders.map((order) => (
                    <div key={order.id} className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
                      <p className="font-semibold text-slate-900">{order.testName}</p>
                      <p className="text-sm text-slate-500">Ordered {toShortDate(order.orderedAt)}</p>
                      <p className="text-sm text-slate-600">Status: {order.status}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-500">No lab tests were ordered for this visit.</p>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function InfoCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</h3>
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-900">{value}</p>
    </div>
  );
}
