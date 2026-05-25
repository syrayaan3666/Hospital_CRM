import type { AppointmentStatus, AppointmentType, BillStatus, BloodGroup, Gender } from '../../types';

export interface ReceptionDepartment {
	id: string;
	name: string;
	description: string | null;
	code?: string;
}

export interface ReceptionPatient {
	id: string;
	patientCode?: string;
	medicalRecordNumber?: string;
	firstName: string;
	lastName: string;
	dateOfBirth: string;
	gender: Gender;
	bloodGroup: BloodGroup | string | null;
	phone: string | null;
	address?: string | null;
	emergencyContactName?: string | null;
	emergencyContactPhone?: string | null;
	allergies: string[];
	chronicConditions: string[];
	user?: {
		id: string;
		email: string;
		role: string;
		firstName: string;
		lastName: string;
	};
}

export interface ReceptionDoctor {
	id: string;
	firstName: string;
	lastName: string;
	specialization: string;
	consultationFee: number | string;
	availableDays: string[];
	startTime: string;
	endTime: string;
	slotDurationMinutes: number;
	departmentId?: string;
	department?: ReceptionDepartment;
}

export interface ReceptionAppointment {
	id: string;
	appointmentNumber?: string;
	patientId: string;
	doctorId: string;
	departmentId: string;
	appointmentType: AppointmentType;
	status: AppointmentStatus;
	scheduledAt: string;
	durationMinutes: number;
	reason: string;
	notes: string | null;
	cancellationReason: string | null;
	createdAt: string;
	patient: ReceptionPatient;
	doctor: ReceptionDoctor & { department: ReceptionDepartment };
	department: ReceptionDepartment;
}

export interface ReceptionBillItem {
	id?: string;
	description: string;
	quantity: number;
	unitPrice: number | string;
	amount?: number | string;
}

export interface ReceptionBill {
	id: string;
	billNumber: string;
	patientId: string;
	appointmentId: string | null;
	status: BillStatus;
	paymentMethod: string | null;
	issuedAt: string | null;
	paidAt: string | null;
	subtotal: number | string;
	taxAmount: number | string;
	totalAmount: number | string;
	amountPaid: number | string;
	notes: string | null;
	createdAt: string;
	billItems: ReceptionBillItem[];
	appointment?: ReceptionAppointment | null;
	patient?: ReceptionPatient | null;
}

export interface ApiEnvelope<T> {
	success: boolean;
	data: T;
}

export const bloodGroupOptions: BloodGroup[] = [
	'A_POS',
	'A_NEG',
	'B_POS',
	'B_NEG',
	'AB_POS',
	'AB_NEG',
	'O_POS',
	'O_NEG',
];

export function formatDateInputValue(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');
	return `${year}-${month}-${day}`;
}

export function formatDateTime(value: string | Date | null | undefined): string {
	if (!value) return '--';
	const date = typeof value === 'string' ? new Date(value) : value;
	if (Number.isNaN(date.getTime())) return '--';
	return new Intl.DateTimeFormat('en-IN', {
		day: '2-digit',
		month: 'short',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	}).format(date);
}

export function formatTime(value: string | Date | null | undefined): string {
	if (!value) return '--';
	const date = typeof value === 'string' ? new Date(value) : value;
	if (Number.isNaN(date.getTime())) return '--';
	return new Intl.DateTimeFormat('en-IN', {
		hour: '2-digit',
		minute: '2-digit',
	}).format(date);
}

export function toCurrency(value: string | number | null | undefined): string {
	const amount = Number(value ?? 0);
	return new Intl.NumberFormat('en-IN', {
		style: 'currency',
		currency: 'INR',
		maximumFractionDigits: 0,
	}).format(Number.isFinite(amount) ? amount : 0);
}

export function calculateAge(dateOfBirth: string): number {
	const diff = Date.now() - new Date(dateOfBirth).getTime();
	return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24 * 365)));
}

export function getAppointmentStatusClass(status: AppointmentStatus): string {
	switch (status) {
		case 'SCHEDULED': return 'bg-blue-50 text-blue-700 ring-blue-100';
		case 'CONFIRMED': return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
		case 'IN_PROGRESS': return 'bg-amber-50 text-amber-700 ring-amber-100';
		case 'COMPLETED': return 'bg-slate-100 text-slate-700 ring-slate-200';
		case 'CANCELLED': return 'bg-rose-50 text-rose-700 ring-rose-100';
		default: return 'bg-gray-100 text-gray-700 ring-gray-200';
	}
}

export function getBillStatusClass(status: BillStatus): string {
	switch (status) {
		case 'DRAFT': return 'bg-gray-100 text-gray-700 ring-gray-200';
		case 'ISSUED': return 'bg-blue-50 text-blue-700 ring-blue-100';
		case 'PAID': return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
		case 'PARTIALLY_PAID': return 'bg-amber-50 text-amber-700 ring-amber-100';
		case 'CANCELLED': return 'bg-rose-50 text-rose-700 ring-rose-100';
		default: return 'bg-gray-100 text-gray-700 ring-gray-200';
	}
}
