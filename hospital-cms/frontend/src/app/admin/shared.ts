export interface AdminUserRow {
	id: string;
	email: string;
	role: string;
	isActive: boolean;
	createdAt: string;
	firstName: string;
	lastName: string;
	phone: string | null;
}

export interface AdminDepartmentRow {
	id: string;
	name: string;
	code: string;
	description: string | null;
	isActive: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface AdminDoctorRow {
	id: string;
	firstName: string;
	lastName: string;
	specialization: string;
	licenseNumber: string;
	consultationFee: string | number;
	startTime: string;
	endTime: string;
	slotDurationMinutes: number;
	availableDays: string[];
	yearsOfExperience: number | null;
	phone: string | null;
	email: string | null;
	bio: string | null;
	department: {
		id: string;
		name: string;
		code: string;
		description: string | null;
	};
	user?: {
		id: string;
		email: string;
		role: string;
		isActive: boolean;
	};
}

export interface AdminAuditLogRow {
	id: string;
	action: string;
	entityName: string;
	entityId: string;
	details: Record<string, unknown> | unknown[] | string | number | boolean | null;
	ipAddress: string | null;
	userAgent: string | null;
	createdAt: string;
	user: {
		id: string;
		email: string;
		firstName: string;
		lastName: string;
		role: string;
	} | null;
}

export const formatDate = (value: string | Date): string =>
	new Date(value).toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});

export const formatDateTime = (value: string | Date): string =>
	new Date(value).toLocaleString(undefined, {
		dateStyle: "medium",
		timeStyle: "short",
	});

export const formatMoney = (value: string | number): string =>
	new Intl.NumberFormat(undefined, {
		style: "currency",
		currency: "INR",
		maximumFractionDigits: 2,
	}).format(Number(value));

export const formatPersonName = (firstName: string, lastName: string): string =>
	[firstName, lastName].filter(Boolean).join(" ") || "--";

export const joinDays = (days: string[]): string => (days.length > 0 ? days.join(", ") : "--");
