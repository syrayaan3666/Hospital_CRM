'use client';

import { useEffect, useMemo, useState } from 'react';
import { Fragment } from 'react';
import { ChevronDown, ChevronUp, CreditCard, Loader2, ReceiptText } from 'lucide-react';
import AuthGuard from '../../../components/AuthGuard';
import DashboardLayout from '../../../components/DashboardLayout';
import apiClient from '../../../lib/axios';
import {
  type ApiEnvelope,
  type BillRecord,
  type PatientRecord,
  getBillStatusClass,
  toCurrency,
  toShortDate,
} from '../shared';

interface BillsState {
  patient: PatientRecord | null;
  bills: BillRecord[];
  loading: boolean;
  error: string | null;
}

export default function PatientBillsPage() {
  return (
    <AuthGuard allowedRoles={['PATIENT']}>
      <DashboardLayout>
        <PatientBillsContent />
      </DashboardLayout>
    </AuthGuard>
  );
}

function PatientBillsContent() {
  const [state, setState] = useState<BillsState>({
    patient: null,
    bills: [],
    loading: true,
    error: null,
  });
  const [expandedBillId, setExpandedBillId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async (): Promise<void> => {
      setState((current) => ({ ...current, loading: true, error: null }));

      try {
        const patientResponse = await apiClient.get<ApiEnvelope<PatientRecord>>('/patients/me');
        const patient = patientResponse.data.data;
        const billsResponse = await apiClient.get<ApiEnvelope<BillRecord[]>>(`/billing/bills/patient/${patient.id}`);

        if (!active) {
          return;
        }

        setState({
          patient,
          bills: billsResponse.data.data,
          loading: false,
          error: null,
        });
      } catch (error) {
        if (!active) {
          return;
        }

        setState({
          patient: null,
          bills: [],
          loading: false,
          error: error instanceof Error ? error.message : 'Unable to load bills',
        });
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  const outstandingBills = useMemo(() => state.bills.filter((bill) => bill.status !== 'PAID'), [state.bills]);
  const outstandingTotal = useMemo(
    () =>
      outstandingBills.reduce((sum, bill) => {
        const balance = Number(bill.totalAmount ?? 0) - Number(bill.amountPaid ?? 0);
        return sum + Math.max(balance, 0);
      }, 0),
    [outstandingBills],
  );

  const paidTotal = useMemo(
    () =>
      state.bills.reduce((sum, bill) => {
        return sum + Number(bill.amountPaid ?? 0);
      }, 0),
    [state.bills],
  );

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900">Bills</h2>
            <p className="mt-1 text-sm text-slate-500">Review invoices, payment status, and bill item details.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <SummaryCard label="Outstanding" value={toCurrency(outstandingTotal)} />
            <SummaryCard label="Paid" value={toCurrency(paidTotal)} />
            <SummaryCard label="Bills" value={String(state.bills.length)} />
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
        ) : state.bills.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Bill Number</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Paid Amount</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {state.bills.map((bill) => {
                  const expanded = expandedBillId === bill.id;
                  const balance = Math.max(Number(bill.totalAmount ?? 0) - Number(bill.amountPaid ?? 0), 0);

                  return (
                    <Fragment key={bill.id}>
                      <tr>
                        <td className="px-4 py-4 font-medium text-slate-900">{bill.billNumber}</td>
                        <td className="px-4 py-4 text-slate-600">{toShortDate(bill.issuedAt)}</td>
                        <td className="px-4 py-4 text-slate-600">{toCurrency(bill.totalAmount)}</td>
                        <td className="px-4 py-4 text-slate-600">{toCurrency(bill.amountPaid)}</td>
                        <td className="px-4 py-4">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${getBillStatusClass(bill.status)}`}>
                            {bill.status}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <button
                            type="button"
                            onClick={() => setExpandedBillId((current) => (current === bill.id ? null : bill.id))}
                            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                            View Details
                          </button>
                        </td>
                      </tr>
                      {expanded ? (
                        <tr>
                          <td colSpan={6} className="bg-slate-50 px-4 py-4">
                            <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
                              <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                                <div className="flex items-center gap-2 text-slate-900">
                                  <CreditCard className="h-4 w-4" />
                                  <h3 className="font-semibold">Summary</h3>
                                </div>
                                <dl className="mt-3 space-y-2 text-sm text-slate-600">
                                  <DetailLine label="Bill number" value={bill.billNumber} />
                                  <DetailLine label="Issued" value={toShortDate(bill.issuedAt)} />
                                  <DetailLine label="Total" value={toCurrency(bill.totalAmount)} />
                                  <DetailLine label="Paid" value={toCurrency(bill.amountPaid)} />
                                  <DetailLine label="Balance" value={toCurrency(balance)} />
                                </dl>
                              </div>

                              <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                                <div className="flex items-center gap-2 text-slate-900">
                                  <ReceiptText className="h-4 w-4" />
                                  <h3 className="font-semibold">Bill Items</h3>
                                </div>
                                <div className="mt-3 space-y-3">
                                  {bill.billItems.length > 0 ? (
                                    bill.billItems.map((item) => (
                                      <div key={item.id} className="rounded-xl border border-slate-200 p-3">
                                        <p className="font-semibold text-slate-900">{item.description}</p>
                                        <p className="text-sm text-slate-600">
                                          {item.quantity} x {toCurrency(item.unitPrice)}
                                        </p>
                                        <p className="text-sm font-semibold text-slate-900">{toCurrency(item.amount)}</p>
                                      </div>
                                    ))
                                  ) : (
                                    <p className="text-sm text-slate-500">No line items available.</p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-slate-50 px-3 py-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Loading bills...
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center">
      <ReceiptText className="h-10 w-10 text-slate-400" />
      <h3 className="mt-4 text-lg font-semibold text-slate-900">No bills yet</h3>
      <p className="mt-2 max-w-md text-sm text-slate-500">Invoices and payment records will appear here once a bill is generated for you.</p>
    </div>
  );
}
