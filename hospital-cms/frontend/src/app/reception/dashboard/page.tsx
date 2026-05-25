'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import AuthGuard from '../../../components/AuthGuard';
import DashboardLayout from '../../../components/DashboardLayout';
import apiClient from '../../../lib/axios';
import type { ApiEnvelope, ReceptionAppointment, ReceptionDoctor, ReceptionPatient } from '../shared';
import { formatDateInputValue, formatTime, getAppointmentStatusClass } from '../shared';

interface TodayCountResponse {
	count: number;
}

interface PatientsCountResponse {
	count: number;
}

interface WalkInState {
	open: boolean;
	query: string;
	patientResults: ReceptionPatient[];
	selectedPatient: ReceptionPatient | null;
	doctors: ReceptionDoctor[];
	selectedDoctorId: string;
	selectedDate: string;
	availableSlots: string[];
	selectedSlot: string;
	reason: string;
	loading: boolean;
	submitting: boolean;
	error: string | null;
}

const initialWalkInState: WalkInState = {
	open: false,
	query: '',
	patientResults: [],
	selectedPatient: null,
	doctors: [],
	selectedDoctorId: '',
	selectedDate: formatDateInputValue(new Date()),
	availableSlots: [],
	selectedSlot: '',
	reason: '',
	loading: false,
	submitting: false,
	error: null,
};

function getTodayDateKey(dateValue: string): string {
	return dateValue.slice(0, 10);
}

export default function ReceptionDashboardPage() {
	const [todayCount, setTodayCount] = useState<number>(0);
	const [patientCount, setPatientCount] = useState<number>(0);
	const [appointments, setAppointments] = useState<ReceptionAppointment[]>([]);
	const [loading, setLoading] = useState<boolean>(true);
	const [walkIn, setWalkIn] = useState<WalkInState>(initialWalkInState);

	const todayKey = useMemo(() => formatDateInputValue(new Date()), []);

	const loadDashboard = async () => {
		const [todayRes, patientsRes, appointmentsRes] = await Promise.all([
			apiClient.get<ApiEnvelope<TodayCountResponse>>('/appointments/today-count'),
			apiClient.get<ApiEnvelope<PatientsCountResponse>>('/patients/count'),
			apiClient.get<ApiEnvelope<ReceptionAppointment[]>>('/appointments/doctor'),
		]);

		setTodayCount(todayRes.data.data.count);
		setPatientCount(patientsRes.data.data.count);
		const filtered = appointmentsRes.data.data
			.filter((item) => getTodayDateKey(item.scheduledAt) === todayKey)
			.sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt));
		setAppointments(filtered);
	};

	useEffect(() => {
		let mounted = true;

		const run = async () => {
			try {
				await loadDashboard();
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
	}, [todayKey]);

	const updateWalkIn = (patch: Partial<WalkInState>) => {
		setWalkIn((current) => ({ ...current, ...patch }));
	};

	const searchPatients = async (query: string) => {
		updateWalkIn({ query, loading: true, error: null });
		try {
			if (!query.trim()) {
				updateWalkIn({ patientResults: [], loading: false });
				return;
			}

			const response = await apiClient.get<ApiEnvelope<ReceptionPatient[]>>(`/patients/search?q=${encodeURIComponent(query)}`);
			updateWalkIn({ patientResults: response.data.data, loading: false });
		} catch (error) {
			updateWalkIn({ loading: false, error: error instanceof Error ? error.message : 'Unable to search patients' });
		}
	};

	const loadSlots = async (doctorId: string) => {
		if (!doctorId) {
			updateWalkIn({ availableSlots: [], selectedSlot: '' });
			return;
		}

		const response = await apiClient.get<ApiEnvelope<string[]>>(`/appointments/slots?doctorId=${doctorId}&date=${walkIn.selectedDate}`);
		updateWalkIn({ availableSlots: response.data.data, selectedSlot: response.data.data[0] ?? '' });
	};

	const openWalkInModal = async () => {
		setWalkIn({ ...initialWalkInState, open: true, selectedDate: formatDateInputValue(new Date()), loading: true });
		try {
			const doctorsResponse = await apiClient.get<ApiEnvelope<ReceptionDoctor[]>>('/doctors');
			setWalkIn((current) => ({ ...current, open: true, doctors: doctorsResponse.data.data, loading: false }));
		} catch (error) {
			setWalkIn((current) => ({ ...current, open: true, loading: false, error: error instanceof Error ? error.message : 'Unable to load doctors' }));
		}
	};

	const submitWalkIn = async () => {
		if (!walkIn.selectedPatient || !walkIn.selectedDoctorId || !walkIn.selectedSlot) {
			updateWalkIn({ error: 'Select a patient, doctor, and slot' });
			return;
		}

		updateWalkIn({ submitting: true, error: null });
		try {
			await apiClient.post('/appointments', {
				patientId: walkIn.selectedPatient.id,
				doctorId: walkIn.selectedDoctorId,
				appointmentType: 'WALK_IN',
				scheduledAt: `${walkIn.selectedDate}T${walkIn.selectedSlot}:00`,
				reason: walkIn.reason || 'Walk-in appointment',
			});
			setWalkIn(initialWalkInState);
			await loadDashboard();
		} catch (error) {
			updateWalkIn({ submitting: false, error: error instanceof Error ? error.message : 'Unable to book walk-in appointment' });
			return;
		}
		updateWalkIn({ submitting: false });
	};

	const handleStatusUpdate = async (appointmentId: string, status: 'CONFIRMED') => {
		await apiClient.patch(`/appointments/${appointmentId}/status`, { status });
		await loadDashboard();
	};

	return (
		<AuthGuard allowedRoles={['RECEPTIONIST']}>
			<DashboardLayout>
				<div className="space-y-6">
					<div className="grid gap-4 md:grid-cols-2">
						<div className="rounded-2xl bg-gradient-to-br from-sky-600 to-cyan-500 p-5 text-white shadow-lg shadow-sky-200/40">
							<div className="text-sm uppercase tracking-[0.3em] text-white/70">Today's Appointments</div>
							<div className="mt-2 text-4xl font-semibold">{todayCount}</div>
						</div>
						<div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-500 p-5 text-white shadow-lg shadow-emerald-200/40">
							<div className="text-sm uppercase tracking-[0.3em] text-white/70">Total Patients</div>
							<div className="mt-2 text-4xl font-semibold">{patientCount}</div>
						</div>
					</div>

					<div className="flex flex-wrap gap-3">
						<Link href="/reception/register" className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800">
							Register New Patient
						</Link>
						<Link href="/reception/appointments" className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 transition hover:bg-gray-50">
							Book Appointment
						</Link>
						<button type="button" onClick={openWalkInModal} className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700 transition hover:bg-sky-100">
							Walk-in Appointment
						</button>
					</div>

					<div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
						<div className="border-b border-gray-200 px-5 py-4">
							<h2 className="text-lg font-semibold text-gray-900">Today's Schedule</h2>
						</div>
						{loading ? (
							<div className="p-6 text-sm text-gray-500">Loading schedule...</div>
						) : appointments.length === 0 ? (
							<div className="p-6 text-sm text-gray-500">No appointments scheduled today.</div>
						) : (
							<div className="overflow-x-auto">
								<table className="min-w-full divide-y divide-gray-200 text-sm">
									<thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
										<tr>
											<th className="px-5 py-3">Time</th>
											<th className="px-5 py-3">Patient</th>
											<th className="px-5 py-3">Doctor</th>
											<th className="px-5 py-3">Department</th>
											<th className="px-5 py-3">Status</th>
											<th className="px-5 py-3">Action</th>
										</tr>
									</thead>
									<tbody className="divide-y divide-gray-100 bg-white">
										{appointments.map((appointment) => (
											<tr key={appointment.id} className="align-top">
												<td className="px-5 py-4 font-medium text-gray-900">{formatTime(appointment.scheduledAt)}</td>
												<td className="px-5 py-4 text-gray-700">
													{appointment.patient.firstName} {appointment.patient.lastName}
													<div className="text-xs text-gray-500">{appointment.patient.phone ?? 'No phone'}</div>
												</td>
												<td className="px-5 py-4 text-gray-700">{appointment.doctor.firstName} {appointment.doctor.lastName}</td>
												<td className="px-5 py-4 text-gray-700">{appointment.department.name}</td>
												<td className="px-5 py-4">
													<span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${getAppointmentStatusClass(appointment.status)}`}>
														{appointment.status}
													</span>
												</td>
												<td className="px-5 py-4">
													{appointment.status === 'SCHEDULED' ? (
														<button type="button" onClick={() => handleStatusUpdate(appointment.id, 'CONFIRMED')} className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-100">
															Check In
														</button>
													) : appointment.status === 'CONFIRMED' ? (
														<span className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Mark Arrived</span>
													) : appointment.status === 'COMPLETED' ? (
														<Link href={`/reception/billing/${appointment.id}`} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-100">
															Bill
														</Link>
													) : (
														<span className="text-xs text-gray-500">--</span>
													)}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						)}
					</div>
				</div>

				{walkIn.open ? (
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-8">
						<div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
							<div className="flex items-center justify-between gap-4">
								<h3 className="text-xl font-semibold text-gray-900">Walk-in Appointment</h3>
								<button type="button" onClick={() => setWalkIn(initialWalkInState)} className="rounded-full border border-gray-200 px-3 py-1 text-sm font-medium text-gray-600 hover:bg-gray-50">
									Close
								</button>
							</div>

							<div className="mt-5 grid gap-6 lg:grid-cols-2">
								<div className="space-y-4">
									<label className="block text-sm font-medium text-gray-700">
										Search patient by name or phone
										<input
											value={walkIn.query}
											onChange={(event) => {
												const value = event.target.value;
												updateWalkIn({ query: value });
												void searchPatients(value);
											}}
											placeholder="Search patients"
											className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2"
										/>
									</label>

									<div className="max-h-72 space-y-2 overflow-y-auto rounded-2xl border border-gray-200 p-3">
										{walkIn.patientResults.length === 0 ? (
											<div className="text-sm text-gray-500">Search to find a patient.</div>
										) : walkIn.patientResults.map((patient) => (
											<button key={patient.id} type="button" onClick={() => updateWalkIn({ selectedPatient: patient })} className={`w-full rounded-xl border px-3 py-3 text-left transition ${walkIn.selectedPatient?.id === patient.id ? 'border-sky-300 bg-sky-50' : 'border-gray-200 hover:bg-gray-50'}`}>
												<div className="font-semibold text-gray-900">{patient.firstName} {patient.lastName}</div>
												<div className="text-sm text-gray-600">{patient.patientCode ?? patient.medicalRecordNumber ?? patient.id}</div>
												<div className="text-xs text-gray-500">{patient.phone ?? 'No phone'}</div>
											</button>
										))}
									</div>
								</div>

								<div className="space-y-4">
									<label className="block text-sm font-medium text-gray-700">
										Select doctor
										<select
											value={walkIn.selectedDoctorId}
											onChange={(event) => {
												const doctorId = event.target.value;
												updateWalkIn({ selectedDoctorId: doctorId });
												void loadSlots(doctorId);
											}}
											className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2"
										>
											<option value="">Select doctor</option>
											{walkIn.doctors.map((doctor) => (
												<option key={doctor.id} value={doctor.id}>{doctor.firstName} {doctor.lastName} - {doctor.department?.name ?? doctor.specialization}</option>
											))}
										</select>
									</label>

									<label className="block text-sm font-medium text-gray-700">
										Date (today only)
										<input value={walkIn.selectedDate} readOnly className="mt-2 w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2" />
									</label>

									<label className="block text-sm font-medium text-gray-700">
										Select slot
										<select value={walkIn.selectedSlot} onChange={(event) => updateWalkIn({ selectedSlot: event.target.value })} className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2">
											<option value="">Select slot</option>
											{walkIn.availableSlots.map((slot) => (
												<option key={slot} value={slot}>{slot}</option>
											))}
										</select>
									</label>

									<label className="block text-sm font-medium text-gray-700">
										Reason
										<textarea value={walkIn.reason} onChange={(event) => updateWalkIn({ reason: event.target.value })} rows={4} className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2" />
									</label>

									{walkIn.error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{walkIn.error}</div> : null}

									<button type="button" onClick={() => void submitWalkIn()} disabled={walkIn.submitting} className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-70">
										{walkIn.submitting ? 'Submitting...' : 'Submit Walk-in'}
									</button>
								</div>
							</div>
						</div>
					</div>
				) : null}
			</DashboardLayout>
		</AuthGuard>
	);
}
