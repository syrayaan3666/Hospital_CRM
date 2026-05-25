import type { LabOrderStatus } from '../../types';

export interface LabDepartment {
	id: string;
	name: string;
	code: string;
}

export interface LabDoctor {
	id: string;
	firstName: string;
	lastName: string;
	department: LabDepartment;
}

export interface LabOrderPatient {
	firstName: string;
	lastName: string;
}

export interface LabOrderRecord {
	id: string;
	orderNumber: string;
	patientId: string;
	doctorId: string;
	consultationId: string | null;
	testName: string;
	specimenType: string | null;
	instructions: string | null;
	status: LabOrderStatus;
	orderedAt: string;
	sampleCollectedAt: string | null;
	processedAt: string | null;
	resultReadyAt: string | null;
	resultFileUrl?: string | null;
	resultNotes?: string | null;
	createdAt: string;
	updatedAt: string;
	patient: LabOrderPatient;
}

export interface LabResultSubmission {
	fileUrl: string;
	notes: string;
}

export interface ApiEnvelope<T> {
	success: boolean;
	data: T;
}

export const labStatusClassMap: Record<LabOrderStatus, string> = {
	ORDERED: 'bg-amber-50 text-amber-700 ring-amber-100',
	SAMPLE_COLLECTED: 'bg-sky-50 text-sky-700 ring-sky-100',
	PROCESSING: 'bg-violet-50 text-violet-700 ring-violet-100',
	RESULT_READY: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
};

export function formatDateTime(value: string | null | undefined): string {
	if (!value) return '--';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return '--';
	return new Intl.DateTimeFormat('en-IN', {
		day: '2-digit',
		month: 'short',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	}).format(date);
}

export function toShortDate(value: string | null | undefined): string {
	if (!value) return '--';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return '--';
	return new Intl.DateTimeFormat('en-IN', {
		day: '2-digit',
		month: 'short',
		year: 'numeric',
	}).format(date);
}
