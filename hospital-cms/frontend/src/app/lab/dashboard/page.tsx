'use client';

import { useEffect, useMemo, useState } from 'react';
import AuthGuard from '../../../components/AuthGuard';
import DashboardLayout from '../../../components/DashboardLayout';
import apiClient from '../../../lib/axios';
import type { ApiEnvelope, LabDoctor, LabOrderRecord, LabResultSubmission } from '../shared';
import { formatDateTime, labStatusClassMap, toShortDate } from '../shared';

interface StatusToast {
	message: string;
	type: 'success' | 'error';
}

interface UploadModalState {
	open: boolean;
	order: LabOrderRecord | null;
	fileUrl: string;
	notes: string;
	submitting: boolean;
	error: string | null;
}

const initialUploadState: UploadModalState = {
	open: false,
	order: null,
	fileUrl: '',
	notes: '',
	submitting: false,
	error: null,
};

export default function LabDashboardPage() {
	const [orders, setOrders] = useState<LabOrderRecord[]>([]);
	const [doctors, setDoctors] = useState<LabDoctor[]>([]);
	const [loading, setLoading] = useState<boolean>(true);
	const [uploadModal, setUploadModal] = useState<UploadModalState>(initialUploadState);
	const [toast, setToast] = useState<StatusToast | null>(null);

	const loadData = async () => {
		const [ordersResponse, doctorsResponse] = await Promise.all([
			apiClient.get<ApiEnvelope<LabOrderRecord[]>>('/lab/orders'),
			apiClient.get<ApiEnvelope<LabDoctor[]>>('/doctors'),
		]);

		setOrders(ordersResponse.data.data);
		setDoctors(doctorsResponse.data.data);
	};

	useEffect(() => {
		let mounted = true;

		const run = async () => {
			try {
				await loadData();
			} catch (error) {
				console.error(error);
			} finally {
				if (mounted) setLoading(false);
			}
		};

		run();

		return () => {
			mounted = false;
		};
	}, []);

	const doctorNameById = useMemo(() => {
		const map = new Map<string, string>();
		for (const doctor of doctors) {
			map.set(doctor.id, `${doctor.firstName} ${doctor.lastName}`);
		}
		return map;
	}, [doctors]);

	const todayReadyCount = useMemo(() => {
		const todayKey = new Date().toISOString().slice(0, 10);
		return orders.filter((order) => order.status === 'RESULT_READY' && order.resultReadyAt?.slice(0, 10) === todayKey).length;
	}, [orders]);

	const stats = useMemo(() => ({
		ORDERED: orders.filter((order) => order.status === 'ORDERED').length,
		SAMPLE_COLLECTED: orders.filter((order) => order.status === 'SAMPLE_COLLECTED').length,
		PROCESSING: orders.filter((order) => order.status === 'PROCESSING').length,
		RESULT_READY: todayReadyCount,
	}), [orders, todayReadyCount]);

	const pendingOrders = useMemo(
		() => orders.filter((order) => order.status !== 'RESULT_READY').sort((left, right) => right.orderedAt.localeCompare(left.orderedAt)),
		[orders],
	);

	const refreshOrders = async () => {
		const response = await apiClient.get<ApiEnvelope<LabOrderRecord[]>>('/lab/orders');
		setOrders(response.data.data);
	};

	const updateStatus = async (order: LabOrderRecord, newStatus: 'SAMPLE_COLLECTED' | 'PROCESSING') => {
		try {
			await apiClient.patch(`/lab/orders/${order.id}/status`, { newStatus, status: newStatus });
			await refreshOrders();
		} catch (error) {
			console.error(error);
		}
	};

	const submitResult = async () => {
		if (!uploadModal.order) return;
		setUploadModal((current) => ({ ...current, submitting: true, error: null }));
		try {
			const payload: LabResultSubmission = {
				fileUrl: uploadModal.fileUrl,
				notes: uploadModal.notes,
			};
			await apiClient.post(`/lab/orders/${uploadModal.order.id}/result`, payload);
			setUploadModal(initialUploadState);
			setToast({ message: 'Result uploaded successfully', type: 'success' });
			await refreshOrders();
		} catch (error) {
			setUploadModal((current) => ({ ...current, submitting: false, error: error instanceof Error ? error.message : 'Unable to submit result' }));
			return;
		}
		setUploadModal((current) => ({ ...current, submitting: false }));
	};

	useEffect(() => {
		if (!toast) return;
		const timer = window.setTimeout(() => setToast(null), 2500);
		return () => window.clearTimeout(timer);
	}, [toast]);

	if (loading) {
		return (
			<AuthGuard allowedRoles={['LAB_STAFF']}>
				<DashboardLayout>
					<div className="min-h-[300px] flex items-center justify-center">Loading lab dashboard...</div>
				</DashboardLayout>
			</AuthGuard>
		);
	}

	return (
		<AuthGuard allowedRoles={['LAB_STAFF']}>
			<DashboardLayout>
				<div className="space-y-6">
					<div className="grid gap-4 md:grid-cols-4">
						{[
							{ label: 'Ordered', value: stats.ORDERED, tone: 'bg-amber-50 text-amber-700' },
							{ label: 'Sample Collected', value: stats.SAMPLE_COLLECTED, tone: 'bg-sky-50 text-sky-700' },
							{ label: 'Processing', value: stats.PROCESSING, tone: 'bg-violet-50 text-violet-700' },
							{ label: 'Ready Today', value: stats.RESULT_READY, tone: 'bg-emerald-50 text-emerald-700' },
						].map((item) => (
							<div key={item.label} className={`rounded-2xl border border-gray-200 p-5 shadow-sm ${item.tone}`}>
								<div className="text-xs font-semibold uppercase tracking-[0.28em] opacity-70">{item.label}</div>
								<div className="mt-2 text-3xl font-semibold text-gray-900">{item.value}</div>
							</div>
						))}
					</div>

					<div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
						<div className="border-b border-gray-200 px-5 py-4">
							<h2 className="text-lg font-semibold text-gray-900">Pending Orders</h2>
						</div>
						{pendingOrders.length === 0 ? (
							<div className="p-6 text-sm text-gray-500">No pending lab orders.</div>
						) : (
							<div className="overflow-x-auto">
								<table className="min-w-full divide-y divide-gray-200 text-sm">
									<thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
										<tr>
											<th className="px-5 py-3">Patient Name</th>
											<th className="px-5 py-3">Test Name</th>
											<th className="px-5 py-3">Ordered By</th>
											<th className="px-5 py-3">Ordered At</th>
											<th className="px-5 py-3">Status</th>
											<th className="px-5 py-3">Action</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-gray-100 bg-white">
										{pendingOrders.map((order) => (
											<tr key={order.id}>
												<td className="px-5 py-4 font-medium text-gray-900">{order.patient.firstName} {order.patient.lastName}</td>
												<td className="px-5 py-4 text-gray-700">{order.testName}</td>
												<td className="px-5 py-4 text-gray-700">{doctorNameById.get(order.doctorId) ?? order.doctorId}</td>
												<td className="px-5 py-4 text-gray-700">{formatDateTime(order.orderedAt)}</td>
												<td className="px-5 py-4">
													<span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${labStatusClassMap[order.status]}`}>{order.status}</span>
												</td>
												<td className="px-5 py-4">
													{order.status === 'ORDERED' ? (
														<button type="button" onClick={() => void updateStatus(order, 'SAMPLE_COLLECTED')} className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-700">Collect Sample</button>
													) : order.status === 'SAMPLE_COLLECTED' ? (
														<button type="button" onClick={() => void updateStatus(order, 'PROCESSING')} className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-700">Mark Processing</button>
													) : order.status === 'PROCESSING' ? (
														<button type="button" onClick={() => setUploadModal({ open: true, order, fileUrl: '', notes: '', submitting: false, error: null })} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700">Upload Result</button>
													) : null}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
					</div>
				</div>

				{uploadModal.open && uploadModal.order ? (
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8">
						<div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
							<div className="flex items-center justify-between gap-4">
								<h3 className="text-xl font-semibold text-gray-900">Upload Result</h3>
								<button type="button" onClick={() => setUploadModal(initialUploadState)} className="rounded-full border border-gray-200 px-3 py-1 text-sm font-medium text-gray-600 hover:bg-gray-50">Close</button>
							</div>
							<div className="mt-4 space-y-4">
								<div>
									<label className="block text-sm font-medium text-gray-700">Result File URL</label>
									<input value={uploadModal.fileUrl} onChange={(event) => setUploadModal((current) => ({ ...current, fileUrl: event.target.value }))} placeholder="Enter file URL or upload path" className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2" />
									<p className="mt-1 text-xs text-gray-500">Paste the URL of the uploaded result file (PDF or image).</p>
								</div>
								<div>
									<label className="block text-sm font-medium text-gray-700">Lab Notes</label>
									<textarea value={uploadModal.notes} onChange={(event) => setUploadModal((current) => ({ ...current, notes: event.target.value }))} rows={4} className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2" />
								</div>
								{uploadModal.error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{uploadModal.error}</div> : null}
								<button type="button" onClick={() => void submitResult()} disabled={uploadModal.submitting} className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-70">{uploadModal.submitting ? 'Submitting...' : 'Submit Result'}</button>
							</div>
						</div>
					</div>
				) : null}

				{toast ? (
					<div className={`fixed bottom-5 right-5 z-50 rounded-2xl px-4 py-3 text-sm font-semibold shadow-lg ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
						{toast.message}
					</div>
				) : null}
			</DashboardLayout>
		</AuthGuard>
	);
}
