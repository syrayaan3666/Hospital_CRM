'use client';

import { useEffect, useMemo, useState } from 'react';
import AuthGuard from '../../../../components/AuthGuard';
import DashboardLayout from '../../../../components/DashboardLayout';
import apiClient from '../../../../lib/axios';
import type { ApiEnvelope, ReceptionAppointment, ReceptionBill, ReceptionPatient } from '../../shared';
import { formatDateTime, getBillStatusClass, toCurrency } from '../../shared';

type PaymentMethod = 'CASH' | 'CARD' | 'UPI';

interface AddItemState {
	description: string;
	quantity: string;
	unitPrice: string;
}

interface PaymentState {
	amount: string;
	method: PaymentMethod;
}

const initialAddItemState: AddItemState = {
	description: '',
	quantity: '1',
	unitPrice: '',
};

const initialPaymentState: PaymentState = {
	amount: '',
	method: 'CASH',
};

export default function ReceptionBillingPage({ params }: { params: { appointmentId: string } }) {
	const appointmentId = params.appointmentId;
	const [appointment, setAppointment] = useState<ReceptionAppointment | null>(null);
	const [bill, setBill] = useState<ReceptionBill | null>(null);
	const [loading, setLoading] = useState<boolean>(true);
	const [creating, setCreating] = useState<boolean>(false);
	const [addItem, setAddItem] = useState<AddItemState>(initialAddItemState);
	const [payment, setPayment] = useState<PaymentState>(initialPaymentState);
	const [error, setError] = useState<string | null>(null);

	const patient = appointment?.patient ?? bill?.patient ?? null;
	const billAppointment = bill?.appointment ?? appointment;

	const loadPage = async () => {
		const appointmentResponse = await apiClient.get<ApiEnvelope<ReceptionAppointment>>(`/appointments/${appointmentId}`);
		const currentAppointment = appointmentResponse.data.data;
		const billResponse = await apiClient.get<ApiEnvelope<ReceptionBill[]>>(`/billing/bills/patient/${currentAppointment.patientId}`);
		const matchedBill = billResponse.data.data.find((item) => item.appointmentId === appointmentId) ?? null;
		setAppointment(currentAppointment);
		setBill(matchedBill);
	};

	useEffect(() => {
		let mounted = true;
		const run = async () => {
			try {
				await loadPage();
			} catch (fetchError) {
				console.error(fetchError);
				if (mounted) setError(fetchError instanceof Error ? fetchError.message : 'Unable to load bill');
			} finally {
				if (mounted) setLoading(false);
			}
		};
		run();
		return () => { mounted = false; };
	}, [appointmentId]);

	const subtotal = useMemo(() => Number(bill?.subtotal ?? 0), [bill]);
	const taxAmount = useMemo(() => Number(bill?.taxAmount ?? 0), [bill]);
	const totalAmount = useMemo(() => Number(bill?.totalAmount ?? 0), [bill]);
	const amountPaid = useMemo(() => Number(bill?.amountPaid ?? 0), [bill]);
	const balanceDue = Math.max(0, totalAmount - amountPaid);

	const createBill = async () => {
		setCreating(true);
		setError(null);
		try {
			await apiClient.post(`/billing/bills/${appointmentId}/draft`);
			await loadPage();
		} catch (fetchError) {
			setError(fetchError instanceof Error ? fetchError.message : 'Unable to create bill');
		} finally {
			setCreating(false);
		}
	};

	const addBillItem = async () => {
		setError(null);
		try {
			await apiClient.post(`/billing/bills/${bill?.id}/items`, {
				description: addItem.description,
				quantity: Number(addItem.quantity),
				unitPrice: Number(addItem.unitPrice),
			});
			setAddItem(initialAddItemState);
			await loadPage();
		} catch (fetchError) {
			setError(fetchError instanceof Error ? fetchError.message : 'Unable to add item');
		}
	};

	const recordPayment = async () => {
		setError(null);
		try {
			await apiClient.post(`/billing/bills/${bill?.id}/payment`, {
				amount: Number(payment.amount),
				method: payment.method,
			});
			setPayment(initialPaymentState);
			await loadPage();
		} catch (fetchError) {
			setError(fetchError instanceof Error ? fetchError.message : 'Unable to record payment');
		}
	};

	if (loading) {
		return (
			<AuthGuard allowedRoles={['RECEPTIONIST']}>
				<DashboardLayout>
					<div className="min-h-[300px] flex items-center justify-center">Loading billing screen...</div>
				</DashboardLayout>
			</AuthGuard>
		);
	}

	return (
		<AuthGuard allowedRoles={['RECEPTIONIST']}>
			<DashboardLayout>
				<div className="space-y-6">
					{bill?.status === 'PAID' ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">PAID</div> : null}

					<div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
						<div className="flex flex-wrap items-start justify-between gap-4">
							<div>
								<h2 className="text-2xl font-semibold text-gray-900">Billing</h2>
								<div className="mt-1 text-sm text-gray-600">{bill ? bill.billNumber : 'No bill yet'} • {formatDateTime(bill?.createdAt ?? appointment?.createdAt ?? null)}</div>
								<div className="mt-2 text-sm text-gray-700">Patient: {patient ? `${patient.firstName} ${patient.lastName}` : '--'}</div>
								<div className="text-sm text-gray-700">Doctor: {billAppointment?.doctor ? `${billAppointment.doctor.firstName} ${billAppointment.doctor.lastName}` : '--'}</div>
							</div>
							{bill ? (
								<span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${getBillStatusClass(bill.status)}`}>{bill.status}</span>
							) : (
								<button type="button" onClick={() => void createBill()} disabled={creating} className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-70">{creating ? 'Creating...' : 'Create Bill'}</button>
							)}
						</div>
					</div>

					{bill ? (
						<div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
							<div className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
								<div>
									<div className="mb-3 text-lg font-semibold text-gray-900">Line Items</div>
									<div className="overflow-x-auto rounded-xl border border-gray-200">
										<table className="min-w-full divide-y divide-gray-200 text-sm">
											<thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
												<tr>
													<th className="px-4 py-3">Description</th>
													<th className="px-4 py-3">Quantity</th>
													<th className="px-4 py-3">Unit Price</th>
													<th className="px-4 py-3">Total</th>
												</tr>
											</thead>
											<tbody className="divide-y divide-gray-100 bg-white">
												{bill.billItems.map((item) => (
													<tr key={item.id ?? `${item.description}-${item.quantity}`}>
														<td className="px-4 py-3">{item.description}</td>
														<td className="px-4 py-3">{item.quantity}</td>
														<td className="px-4 py-3">{toCurrency(item.unitPrice)}</td>
														<td className="px-4 py-3">{toCurrency(item.amount ?? Number(item.unitPrice) * item.quantity)}</td>
													</tr>
												))}
											</tbody>
										</table>
									</div>
								</div>

								<div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-5">
									<div className="text-lg font-semibold text-gray-900">Add Item</div>
									<input value={addItem.description} onChange={(event) => setAddItem((current) => ({ ...current, description: event.target.value }))} placeholder="Description" className="w-full rounded-xl border border-gray-300 px-3 py-2" />
									<div className="grid gap-3 md:grid-cols-2">
										<input value={addItem.quantity} onChange={(event) => setAddItem((current) => ({ ...current, quantity: event.target.value }))} type="number" min="1" placeholder="Quantity" className="rounded-xl border border-gray-300 px-3 py-2" />
										<input value={addItem.unitPrice} onChange={(event) => setAddItem((current) => ({ ...current, unitPrice: event.target.value }))} type="number" min="0" placeholder="Unit Price" className="rounded-xl border border-gray-300 px-3 py-2" />
									</div>
									<button type="button" onClick={() => void addBillItem()} className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white">Add Item</button>

									<div className="rounded-xl border border-gray-200 bg-white p-4">
										<div className="text-sm text-gray-500">Subtotal</div>
										<div className="font-semibold text-gray-900">{toCurrency(subtotal)}</div>
										<div className="mt-2 text-sm text-gray-500">Tax (18%)</div>
										<div className="font-semibold text-gray-900">{toCurrency(taxAmount)}</div>
										<div className="mt-2 text-sm text-gray-500">Total</div>
										<div className="font-semibold text-gray-900">{toCurrency(totalAmount)}</div>
										<div className="mt-2 text-sm text-gray-500">Amount Paid</div>
										<div className="font-semibold text-gray-900">{toCurrency(amountPaid)}</div>
										<div className="mt-2 text-sm text-gray-500">Balance Due</div>
										<div className="font-semibold text-gray-900">{toCurrency(balanceDue)}</div>
									</div>

									{bill.status !== 'PAID' ? (
										<div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
											<div className="text-lg font-semibold text-gray-900">Record Payment</div>
											<input value={payment.amount} onChange={(event) => setPayment((current) => ({ ...current, amount: event.target.value }))} type="number" min="0" placeholder="Amount" className="w-full rounded-xl border border-gray-300 px-3 py-2" />
											<select value={payment.method} onChange={(event) => setPayment((current) => ({ ...current, method: event.target.value as PaymentMethod }))} className="w-full rounded-xl border border-gray-300 px-3 py-2">
												<option value="CASH">Cash</option>
												<option value="CARD">Card</option>
												<option value="UPI">UPI</option>
											</select>
											<button type="button" onClick={() => void recordPayment()} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">Record Payment</button>
										</div>
									) : null}
								</div>
							</div>
							</div>
						) : (
							<div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
								<div className="text-sm text-gray-600">No bill exists yet for this appointment.</div>
								<button type="button" onClick={() => void createBill()} disabled={creating} className="mt-4 rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-70">{creating ? 'Creating...' : 'Create Bill'}</button>
							</div>
						)}

					{error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
				</div>
			</DashboardLayout>
		</AuthGuard>
	);
}
