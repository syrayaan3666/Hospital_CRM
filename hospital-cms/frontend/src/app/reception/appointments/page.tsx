'use client';

import { useEffect, useMemo, useState } from 'react';
import AuthGuard from '../../../components/AuthGuard';
import DashboardLayout from '../../../components/DashboardLayout';
import apiClient from '../../../lib/axios';
import type { ApiEnvelope, ReceptionAppointment, ReceptionDoctor, ReceptionPatient, ReceptionDepartment } from '../shared';
import { formatDateInputValue, formatTime, getAppointmentStatusClass } from '../shared';

type TabKey = 'book' | 'schedule';

interface BookingState {
	patientQuery: string;
	patientResults: ReceptionPatient[];
	selectedPatient: ReceptionPatient | null;
	departments: ReceptionDepartment[];
	doctors: ReceptionDoctor[];
	selectedDepartmentId: string;
	selectedDoctorId: string;
	selectedDate: string;
	availableSlots: string[];
	selectedSlot: string;
	reason: string;
	loading: boolean;
	submitting: boolean;
	error: string | null;
}

const initialBookingState: BookingState = {
	patientQuery: '',
	patientResults: [],
	selectedPatient: null,
	departments: [],
	doctors: [],
	selectedDepartmentId: '',
	selectedDoctorId: '',
	selectedDate: formatDateInputValue(new Date()),
	availableSlots: [],
	selectedSlot: '',
	reason: '',
	loading: false,
	submitting: false,
	error: null,
};

export default function ReceptionAppointmentsPage() {
	const [activeTab, setActiveTab] = useState<TabKey>('book');
	const [book, setBook] = useState<BookingState>(initialBookingState);
	const [schedule, setSchedule] = useState<ReceptionAppointment[]>([]);
	const [loadingSchedule, setLoadingSchedule] = useState<boolean>(true);

	const todayKey = useMemo(() => formatDateInputValue(new Date()), []);

	const updateBook = (patch: Partial<BookingState>) => {
		setBook((current) => ({ ...current, ...patch }));
	};

	const loadDependencies = async () => {
		const [departmentsRes, doctorsRes] = await Promise.all([
			apiClient.get<ApiEnvelope<ReceptionDepartment[]>>('/departments'),
			apiClient.get<ApiEnvelope<ReceptionDoctor[]>>('/doctors'),
		]);

		updateBook({ departments: departmentsRes.data.data, doctors: doctorsRes.data.data });
	};

	const loadSchedule = async () => {
		const response = await apiClient.get<ApiEnvelope<ReceptionAppointment[]>>('/appointments/doctor');
		setSchedule(response.data.data.filter((item) => item.scheduledAt.slice(0, 10) === todayKey).sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt)));
	};

	useEffect(() => {
		let mounted = true;
		const run = async () => {
			try {
				await Promise.all([loadDependencies(), loadSchedule()]);
			} catch (error) {
				console.error(error);
			} finally {
				if (mounted) setLoadingSchedule(false);
			}
		};
		run();
		return () => { mounted = false; };
	}, [todayKey]);

	const searchPatients = async (query: string) => {
		updateBook({ patientQuery: query, loading: true, error: null });
		try {
			if (!query.trim()) {
				updateBook({ patientResults: [], loading: false });
				return;
			}
			const response = await apiClient.get<ApiEnvelope<ReceptionPatient[]>>(`/patients/search?q=${encodeURIComponent(query)}`);
			updateBook({ patientResults: response.data.data, loading: false });
		} catch (error) {
			updateBook({ loading: false, error: error instanceof Error ? error.message : 'Unable to search patients' });
		}
	};

	const loadSlots = async (doctorId: string, dateValue: string) => {
		if (!doctorId) {
			updateBook({ availableSlots: [], selectedSlot: '' });
			return;
		}

		const response = await apiClient.get<ApiEnvelope<string[]>>(`/appointments/slots?doctorId=${doctorId}&date=${dateValue}`);
		updateBook({ availableSlots: response.data.data, selectedSlot: response.data.data[0] ?? '' });
	};

	const submitBooking = async () => {
		if (!book.selectedPatient) {
			updateBook({ error: 'Select a patient first' });
			return;
		}
		if (!book.selectedDoctorId || !book.selectedSlot) {
			updateBook({ error: 'Select a doctor and slot' });
			return;
		}

		updateBook({ submitting: true, error: null });
		try {
			await apiClient.post('/appointments', {
				patientId: book.selectedPatient.id,
				doctorId: book.selectedDoctorId,
				appointmentType: 'ONLINE',
				scheduledAt: `${book.selectedDate}T${book.selectedSlot}:00`,
				reason: book.reason || 'Reception booking',
			});
			setBook(initialBookingState);
			await loadSchedule();
			setActiveTab('schedule');
		} catch (error) {
			updateBook({ submitting: false, error: error instanceof Error ? error.message : 'Unable to book appointment' });
			return;
		}
		updateBook({ submitting: false });
	};

	const selectedDoctor = book.doctors.find((doctor) => doctor.id === book.selectedDoctorId) ?? null;

	return (
		<AuthGuard allowedRoles={['RECEPTIONIST']}>
			<DashboardLayout>
				<div className="space-y-6">
					<div className="flex flex-wrap gap-3 rounded-2xl border border-gray-200 bg-white p-2 shadow-sm">
						<button type="button" onClick={() => setActiveTab('book')} className={`rounded-xl px-4 py-2 text-sm font-semibold ${activeTab === 'book' ? 'bg-sky-600 text-white' : 'text-gray-700 hover:bg-gray-50'}`}>Book Appointment</button>
						<button type="button" onClick={() => setActiveTab('schedule')} className={`rounded-xl px-4 py-2 text-sm font-semibold ${activeTab === 'schedule' ? 'bg-sky-600 text-white' : 'text-gray-700 hover:bg-gray-50'}`}>Today's Schedule</button>
					</div>

					{activeTab === 'book' ? (
						<div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
							<div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
								<h2 className="text-lg font-semibold text-gray-900">Step 0 - Select Patient</h2>
								<div className="mt-4">
									<input value={book.patientQuery} onChange={(event) => void searchPatients(event.target.value)} placeholder="Search by name or phone" className="w-full rounded-xl border border-gray-300 px-3 py-2" />
								</div>
								<div className="mt-4 space-y-2">
									{book.patientResults.map((patient) => (
										<button key={patient.id} type="button" onClick={() => updateBook({ selectedPatient: patient })} className={`w-full rounded-xl border px-4 py-3 text-left transition ${book.selectedPatient?.id === patient.id ? 'border-sky-300 bg-sky-50' : 'border-gray-200 hover:bg-gray-50'}`}>
											<div className="font-semibold text-gray-900">{patient.firstName} {patient.lastName}</div>
											<div className="text-sm text-gray-600">{patient.patientCode ?? patient.medicalRecordNumber ?? patient.id} • {patient.phone ?? 'No phone'}</div>
										</button>
									))}
								</div>

								<div className="mt-6 grid gap-4 md:grid-cols-2">
									<label className="block text-sm font-medium text-gray-700">Department<select value={book.selectedDepartmentId} onChange={(event) => {
										const departmentId = event.target.value;
										updateBook({ selectedDepartmentId: departmentId, selectedDoctorId: '', availableSlots: [], selectedSlot: '' });
										const filteredDoctors = departmentId ? book.doctors.filter((doctor) => doctor.departmentId === departmentId) : book.doctors;
										if (filteredDoctors.length === 1) {
											updateBook({ selectedDoctorId: filteredDoctors[0].id });
											void loadSlots(filteredDoctors[0].id, book.selectedDate);
										}
									}} className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2"><option value="">Select department</option>{book.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></label>
									<label className="block text-sm font-medium text-gray-700">Doctor<select value={book.selectedDoctorId} onChange={(event) => {
										const doctorId = event.target.value;
										updateBook({ selectedDoctorId: doctorId, availableSlots: [], selectedSlot: '' });
										void loadSlots(doctorId, book.selectedDate);
									}} className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2"><option value="">Select doctor</option>{book.doctors.filter((doctor) => !book.selectedDepartmentId || doctor.departmentId === book.selectedDepartmentId).map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.firstName} {doctor.lastName}</option>)}</select></label>
									<label className="block text-sm font-medium text-gray-700">Date<input type="date" value={book.selectedDate} onChange={(event) => {
										const nextDate = event.target.value;
										updateBook({ selectedDate: nextDate, availableSlots: [], selectedSlot: '' });
										if (book.selectedDoctorId) {
											void loadSlots(book.selectedDoctorId, nextDate);
										}
									}} className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2" /></label>
									<label className="block text-sm font-medium text-gray-700">Slot<select value={book.selectedSlot} onChange={(event) => updateBook({ selectedSlot: event.target.value })} className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2"><option value="">Select slot</option>{book.availableSlots.map((slot) => <option key={slot} value={slot}>{slot}</option>)}</select></label>
								</div>
								<label className="mt-4 block text-sm font-medium text-gray-700">Reason<textarea value={book.reason} onChange={(event) => updateBook({ reason: event.target.value })} className="mt-2 w-full rounded-xl border border-gray-300 px-3 py-2" rows={4} /></label>
								<div className="mt-5 flex flex-wrap gap-3">
									<button type="button" onClick={() => void submitBooking()} disabled={book.submitting} className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-70">{book.submitting ? 'Submitting...' : 'Submit Appointment'}</button>
									<button type="button" onClick={() => setBook(initialBookingState)} className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700">Reset</button>
								</div>
								{book.error ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{book.error}</div> : null}
							</div>

							<div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
								<h2 className="text-lg font-semibold text-gray-900">Current Selection</h2>
								<div className="mt-4 space-y-3 text-sm text-gray-700">
									<div><span className="font-medium">Patient:</span> {book.selectedPatient ? `${book.selectedPatient.firstName} ${book.selectedPatient.lastName}` : 'None'}</div>
									<div><span className="font-medium">Doctor:</span> {selectedDoctor ? `${selectedDoctor.firstName} ${selectedDoctor.lastName}` : 'None'}</div>
									<div><span className="font-medium">Date:</span> {book.selectedDate || '--'}</div>
									<div><span className="font-medium">Slot:</span> {book.selectedSlot || '--'}</div>
									<div><span className="font-medium">Reason:</span> {book.reason || '--'}</div>
								</div>
							</div>
						</div>
					) : (
						<div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
							<div className="border-b border-gray-200 px-5 py-4">
								<h2 className="text-lg font-semibold text-gray-900">Today's Schedule</h2>
							</div>
							{loadingSchedule ? (
								<div className="p-6 text-sm text-gray-500">Loading schedule...</div>
							) : schedule.length === 0 ? (
								<div className="p-6 text-sm text-gray-500">No appointments today.</div>
							) : (
								<div className="overflow-x-auto">
									<table className="min-w-full divide-y divide-gray-200 text-sm">
										<thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
											<tr>
												<th className="px-5 py-3">Time</th>
												<th className="px-5 py-3">Patient</th>
												<th className="px-5 py-3">Doctor</th>
												<th className="px-5 py-3">Department</th>
												<th className="px-5 py-3">Reason</th>
												<th className="px-5 py-3">Status</th>
											</tr>
										</thead>
										<tbody className="divide-y divide-gray-100 bg-white">
											{schedule.map((appointment) => (
												<tr key={appointment.id}>
													<td className="px-5 py-4 font-medium text-gray-900">{formatTime(appointment.scheduledAt)}</td>
													<td className="px-5 py-4">{appointment.patient.firstName} {appointment.patient.lastName}</td>
													<td className="px-5 py-4">{appointment.doctor.firstName} {appointment.doctor.lastName}</td>
													<td className="px-5 py-4">{appointment.department.name}</td>
													<td className="px-5 py-4">{appointment.reason}</td>
													<td className="px-5 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${getAppointmentStatusClass(appointment.status)}`}>{appointment.status}</span></td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							)}
						</div>
					)}
				</div>
			</DashboardLayout>
		</AuthGuard>
	);
}
