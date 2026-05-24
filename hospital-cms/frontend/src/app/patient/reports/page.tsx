'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Download, FlaskConical, Loader2 } from 'lucide-react';
import AuthGuard from '../../../components/AuthGuard';
import DashboardLayout from '../../../components/DashboardLayout';
import apiClient from '../../../lib/axios';
import {
  type ApiEnvelope,
  type LabResultRecord,
  type PatientRecord,
  toShortDate,
  toTime,
} from '../shared';

export default function PatientReportsPage() {
  return (
    <AuthGuard allowedRoles={['PATIENT']}>
      <DashboardLayout>
        <PatientReportsContent />
      </DashboardLayout>
    </AuthGuard>
  );
}

function PatientReportsContent() {
  const [patient, setPatient] = useState<PatientRecord | null>(null);
  const [results, setResults] = useState<LabResultRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async (): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        const patientResponse = await apiClient.get<ApiEnvelope<PatientRecord>>('/patients/me');
        const currentPatient = patientResponse.data.data;
        const resultsResponse = await apiClient.get<ApiEnvelope<LabResultRecord[]>>(
          `/lab/results/patient/${currentPatient.id}`,
        );

        if (!active) {
          return;
        }

        setPatient(currentPatient);
        setResults(resultsResponse.data.data);
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(loadError instanceof Error ? loadError.message : 'Unable to load reports');
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

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Lab Reports</h2>
            <p className="mt-1 text-sm text-slate-500">Download finalized lab reports and review the result metadata.</p>
          </div>
          <div className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700">
            {patient ? `${patient.firstName} ${patient.lastName}` : 'Patient'}
          </div>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}

      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
        {loading ? (
          <LoadingState />
        ) : results.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-3">
            {results.map((result) => (
              <article key={result.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <FlaskConical className="h-4 w-4 text-sky-600" />
                      <h3 className="text-base font-semibold text-slate-900">{result.labOrder.testName}</h3>
                    </div>
                    <p className="text-sm text-slate-600">{result.resultName} {result.unit ? `· ${result.unit}` : ''}</p>
                    <p className="text-sm text-slate-500">Uploaded {toShortDate(result.uploadedAt)} at {toTime(result.uploadedAt)}</p>
                    {result.resultValue ? <p className="text-sm font-semibold text-slate-900">Result: {result.resultValue}</p> : null}
                  </div>

                  {result.fileUrl ? (
                    <Link
                      href={result.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      <Download className="h-4 w-4" />
                      Download
                    </Link>
                  ) : (
                    <span className="text-sm text-slate-400">No file attached</span>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Loading reports...
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center">
      <FlaskConical className="h-10 w-10 text-slate-400" />
      <h3 className="mt-4 text-lg font-semibold text-slate-900">No lab reports yet</h3>
      <p className="mt-2 max-w-md text-sm text-slate-500">Once a report is uploaded and marked ready, it will appear here for download.</p>
    </div>
  );
}
