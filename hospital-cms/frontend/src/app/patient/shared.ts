export type AppointmentStatus = 'SCHEDULED' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type AppointmentType = 'ONLINE' | 'WALK_IN';
export type BillStatus = 'DRAFT' | 'ISSUED' | 'PAID' | 'PARTIALLY_PAID' | 'CANCELLED';
export type LabOrderStatus = 'ORDERED' | 'SAMPLE_COLLECTED' | 'PROCESSING' | 'RESULT_READY';

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
}

export interface DepartmentRecord {
  id: string;
  name: string;
  code: string;
  description: string | null;
}

export interface PatientRecord {
  id: string;
  userId: string | null;
  medicalRecordNumber: string;
  firstName: string;
  lastName: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  dateOfBirth: string;
  bloodGroup: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  allergies: string[];
  chronicConditions: string[];
  createdAt: string;
  user?: {
    id: string;
    email: string;
    role: string;
    firstName: string;
    lastName: string;
  };
}

export interface DoctorRecord {
  id: string;
  userId: string | null;
  departmentId: string;
  licenseNumber: string;
  firstName: string;
  lastName: string;
  specialization: string;
  consultationFee: string | number;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  availableDays: string[];
  yearsOfExperience: number | null;
  phone: string | null;
  email: string | null;
  bio: string | null;
  department: DepartmentRecord;
}

export interface AppointmentRecord {
  id: string;
  appointmentNumber: string;
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
  doctor: {
    id: string;
    firstName: string;
    lastName: string;
    specialization: string;
    consultationFee: string | number;
    department: DepartmentRecord;
  };
  department: DepartmentRecord;
}

export interface LabResultRecord {
  id: string;
  labOrderId: string;
  resultName: string;
  resultValue: string;
  unit: string | null;
  referenceRange: string | null;
  remarks: string | null;
  resultFileUrl: string | null;
  fileUrl: string | null;
  uploadedAt: string;
  reportedAt: string;
  labOrder: {
    testName: string;
    orderedAt: string;
  };
}

export interface BillItemRecord {
  id: string;
  billId: string;
  description: string;
  quantity: number;
  unitPrice: string | number;
  amount: string | number;
}

export interface BillRecord {
  id: string;
  billNumber: string;
  patientId: string;
  appointmentId: string | null;
  consultationId: string | null;
  status: BillStatus;
  paymentMethod: string | null;
  issuedAt: string;
  dueAt: string | null;
  paidAt: string | null;
  subtotal: string | number;
  discountAmount: string | number;
  taxAmount: string | number;
  totalAmount: string | number;
  amountPaid: string | number;
  notes: string | null;
  createdAt: string;
  billItems: BillItemRecord[];
  appointment?: AppointmentRecord | null;
}

export interface PrescriptionItemRecord {
  id: string;
  prescriptionId: string;
  medicineName: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  quantity: number;
  instructions: string | null;
}

export interface PrescriptionRecord {
  id: string;
  prescriptionNumber: string;
  consultationId: string;
  patientId: string;
  doctorId: string;
  issuedAt: string;
  remarks: string | null;
  createdAt: string;
  items: PrescriptionItemRecord[];
}

export interface ConsultationTimelineRecord {
  id: string;
  appointmentId: string;
  patientId: string;
  doctorId: string;
  consultationAt: string;
  vitals: Record<string, unknown> | null;
  symptoms: string;
  diagnosis: string | null;
  notes: string | null;
  isLocked: boolean;
  createdAt: string;
  doctor: {
    id: string;
    firstName: string;
    lastName: string;
    specialization: string;
    department: DepartmentRecord;
  };
  appointment: AppointmentRecord;
  prescription: PrescriptionRecord | null;
  labOrders: Array<{
    id: string;
    testName: string;
    status: LabOrderStatus;
    orderedAt: string;
  }>;
}

export function toCurrency(value: string | number | null | undefined): string {
  const amount = Number(value ?? 0);
  const safeAmount = Number.isFinite(amount) ? amount : 0;

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(safeAmount);
}

export function toShortDate(value: string | Date | null | undefined): string {
  if (!value) {
    return '--';
  }

  const date = typeof value === 'string' ? new Date(value) : value;

  if (Number.isNaN(date.getTime())) {
    return '--';
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function toLongDateTime(value: string | Date | null | undefined): string {
  if (!value) {
    return '--';
  }

  const date = typeof value === 'string' ? new Date(value) : value;

  if (Number.isNaN(date.getTime())) {
    return '--';
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function toTime(value: string | Date | null | undefined): string {
  if (!value) {
    return '--';
  }

  const date = typeof value === 'string' ? new Date(value) : value;

  if (Number.isNaN(date.getTime())) {
    return '--';
  }

  return new Intl.DateTimeFormat('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getAppointmentStatusClass(status: AppointmentStatus): string {
  switch (status) {
    case 'SCHEDULED':
      return 'bg-blue-50 text-blue-700 ring-blue-100';
    case 'CONFIRMED':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
    case 'IN_PROGRESS':
      return 'bg-amber-50 text-amber-700 ring-amber-100';
    case 'COMPLETED':
      return 'bg-slate-100 text-slate-700 ring-slate-200';
    case 'CANCELLED':
      return 'bg-rose-50 text-rose-700 ring-rose-100';
    default:
      return 'bg-gray-100 text-gray-700 ring-gray-200';
  }
}

export function getBillStatusClass(status: BillStatus): string {
  switch (status) {
    case 'DRAFT':
      return 'bg-gray-100 text-gray-700 ring-gray-200';
    case 'ISSUED':
      return 'bg-blue-50 text-blue-700 ring-blue-100';
    case 'PAID':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
    case 'PARTIALLY_PAID':
      return 'bg-amber-50 text-amber-700 ring-amber-100';
    case 'CANCELLED':
      return 'bg-rose-50 text-rose-700 ring-rose-100';
    default:
      return 'bg-gray-100 text-gray-700 ring-gray-200';
  }
}

export function getLabStatusClass(status: LabOrderStatus): string {
  switch (status) {
    case 'ORDERED':
      return 'bg-blue-50 text-blue-700 ring-blue-100';
    case 'SAMPLE_COLLECTED':
      return 'bg-cyan-50 text-cyan-700 ring-cyan-100';
    case 'PROCESSING':
      return 'bg-amber-50 text-amber-700 ring-amber-100';
    case 'RESULT_READY':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
    default:
      return 'bg-gray-100 text-gray-700 ring-gray-200';
  }
}
