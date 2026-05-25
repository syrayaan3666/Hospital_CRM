'use client';

import { useEffect, useMemo, useState } from 'react';
import AuthGuard from '../../../components/AuthGuard';
import DashboardLayout from '../../../components/DashboardLayout';
import apiClient from '../../../lib/axios';
import type { ApiEnvelope, LabDoctor, LabOrderRecord } from '../shared';
import { formatDateTime, labStatusClassMap } from '../shared';

type TabKey = 'pending' | 'completed';

export default function LabOrdersPage() {
	const [orders, setOrders] = useState<LabOrderRecord[]>([]);
	const [doctors, setDoctors] = useState<LabDoctor[]>([]);
	const [loading, setLoading] = useState<boolean>(true);
	const [activeTab, setActiveTab] = useState<TabKey>('pending');
	const [query, setQuery] = useState<string>('');

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
		return () => { mounted = false; };
	}, []);

	const doctorNameById = useMemo(() => {
		const map = new Map<string, string>();
		for (const doctor of doctors) {
			map.set(doctor.id, `${doctor.firstName} ${doctor.lastName}`);
		}
		return map;
	}, [doctors]);

	const filteredOrders = useMemo(() => {
		const normalized = query.trim().toLowerCase();
		const sorted = [...orders].sort((left, right) => right.orderedAt.localeCompare(left.orderedAt));

		if (!normalized) return sorted;

		return sorted.filter((order) => {
			const patientName = `${order.patient.firstName} ${order.patient.lastName}`.toLowerCase();
			const testName = order.testName.toLowerCase();
			return patientName.includes(normalized) || testName.includes(normalized);
		});
	}, [orders, query]);

	const pendingOrders = filteredOrders.filter((order) => order.status !== 'RESULT_READY');
	const completedOrders = filteredOrders.filter((order) => order.status === 'RESULT_READY');

	const openResult = (fileUrl: string | null | undefined) => {
		if (!fileUrl) return;
		window.open(fileUrl, '_blank', 'noopener,noreferrer');
	};

	if (loading) {
		return (
			<AuthGuard allowedRoles={['LAB_STAFF']}>
				<DashboardLayout>
					<div className="min-h-[300px] flex items-center justify-center">Loading lab orders...</div>
				</DashboardLayout>
			</AuthGuard>
		);
	}

	return (
		<AuthGuard allowedRoles={['LAB_STAFF']}>
			<DashboardLayout>
				<div className="space-y-6">
					<div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
						<div className="flex gap-3 rounded-xl border border-gray-200 bg-gray-50 p-1">
							<button type="button" onClick={() => setActiveTab('pending')} className={`rounded-lg px-4 py-2 text-sm font-semibold ${activeTab === 'pending' ? 'bg-sky-600 text-white' : 'text-gray-700 hover:bg-white'}`}>Pending</button>
							<button type="button" onClick={() => setActiveTab('completed')} className={`rounded-lg px-4 py-2 text-sm font-semibold ${activeTab === 'completed' ? 'bg-sky-600 text-white' : 'text-gray-700 hover:bg-white'}`}>Completed</button>
						</div>

						<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by patient or test name" className="w-full max-w-md rounded-xl border border-gray-300 px-3 py-2" />
					</div>

					{activeTab === 'pending' ? (
						<div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
							<div className="overflow-x-auto">
								<table className="min-w-full divide-y divide-gray-200 text-sm">
									<thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
										<tr>
											<th className="px-5 py-3">Patient Name</th>
											<th className="px-5 py-3">Test Name</th>
											<th className="px-5 py-3">Doctor</th>
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
												<td className="px-5 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${labStatusClassMap[order.status]}`}>{order.status}</span></td>
												<td className="px-5 py-4">
													{order.status === 'ORDERED' ? (
														<button type="button" onClick={() => void apiClient.patch(`/lab/orders/${order.id}/status`, { newStatus: 'SAMPLE_COLLECTED', status: 'SAMPLE_COLLECTED' }).then(loadData)} className="rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-sky-700">Collect Sample</button>
													) : order.status === 'SAMPLE_COLLECTED' ? (
														<button type="button" onClick={() => void apiClient.patch(`/lab/orders/${order.id}/status`, { newStatus: 'PROCESSING', status: 'PROCESSING' }).then(loadData)} className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-violet-700">Mark Processing</button>
													) : order.status === 'PROCESSING' ? (
														<span className="text-xs text-gray-500">Upload result from dashboard</span>
													) : null}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
					) : (
						<div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
							<div className="overflow-x-auto">
								<table className="min-w-full divide-y divide-gray-200 text-sm">
									<thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
										<tr>
											<th className="px-5 py-3">Patient</th>
											<th className="px-5 py-3">Test</th>
											<th className="px-5 py-3">Doctor</th>
											<th className="px-5 py-3">Date</th>
											<th className="px-5 py-3">Result Notes</th>
											<th className="px-5 py-3">Action</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-gray-100 bg-white">
										{completedOrders.map((order) => (
											<tr key={order.id}>
												<td className="px-5 py-4 font-medium text-gray-900">{order.patient.firstName} {order.patient.lastName}</td>
												<td className="px-5 py-4 text-gray-700">{order.testName}</td>
												<td className="px-5 py-4 text-gray-700">{doctorNameById.get(order.doctorId) ?? order.doctorId}</td>
												<td className="px-5 py-4 text-gray-700">{formatDateTime(order.orderedAt)}</td>
												<td className="px-5 py-4 text-gray-700">{order.resultNotes ?? order.instructions ?? '--'}</td>
												<td className="px-5 py-4">
													<button type="button" onClick={() => openResult(order.resultFileUrl)} disabled={!order.resultFileUrl} className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50">View Result</button>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
					)}
				</div>
			</DashboardLayout>
		</AuthGuard>
	);
}
