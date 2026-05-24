export type Role = 'PATIENT' | 'DOCTOR' | 'RECEPTIONIST' | 'LAB_STAFF' | 'ADMIN';

export type AppointmentStatus = 'SCHEDULED' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export type AppointmentType = 'ONLINE' | 'WALK_IN';

export type LabOrderStatus = 'ORDERED' | 'SAMPLE_COLLECTED' | 'PROCESSING' | 'RESULT_READY';

export type BillStatus = 'DRAFT' | 'ISSUED' | 'PAID' | 'PARTIALLY_PAID' | 'CANCELLED';

export type PaymentMethod = 'CASH' | 'CARD' | 'UPI';

export type Gender = 'MALE' | 'FEMALE' | 'OTHER';

export type BloodGroup = 'A_POS' | 'A_NEG' | 'B_POS' | 'B_NEG' | 'AB_POS' | 'AB_NEG' | 'O_POS' | 'O_NEG';

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  name: string;
}

export interface TokenPair {
  accessToken: string;
  user: AuthUser;
}

export interface Patient {
  id: string;
  userId: string;
  patientCode: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: Gender;
  bloodGroup: BloodGroup | null;
  phone: string;
  address: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  allergies: string[];
  chronicConditions: string[];
  createdAt: string;
}

export interface Department {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

export interface Doctor {
  id: string;
  userId: string;
  departmentId: string;
  department?: Department;
  firstName: string;
  lastName: string;
  specialization: string;
  qualification: string;
  consultationFee: number;
  availableDays: string[];
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
}

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  patient?: Patient;
  doctor?: Doctor;
  appointmentDate: string;
  slotTime: string;
  status: AppointmentStatus;
  type: AppointmentType;
  reason: string | null;
  cancellationReason: string | null;
  createdAt: string;
}

export interface Consultation {
  id: string;
  appointmentId: string;
  doctorId: string;
  patientId: string;
  chiefComplaint: string;
  diagnosis: string | null;
  icdCode: string | null;
  notes: string | null;
  vitals: {
    bp?: string;
    temperature?: number;
    weight?: number;
    height?: number;
    pulse?: number;
    spo2?: number;
  } | null;
  isLocked: boolean;
  prescriptions?: Prescription[];
  labOrders?: LabOrder[];
  createdAt: string;
}

export interface Prescription {
  id: string;
  consultationId: string;
  patientId: string;
  doctorId: string;
  issuedAt: string;
  items?: PrescriptionItem[];
}

export interface PrescriptionItem {
  id: string;
  prescriptionId: string;
  drugName: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string | null;
}

export interface LabOrder {
  id: string;
  consultationId: string;
  patientId: string;
  doctorId: string;
  testName: string;
  status: LabOrderStatus;
  orderedAt: string;
  result?: LabResult;
}

export interface LabResult {
  id: string;
  labOrderId: string;
  fileUrl: string;
  notes: string | null;
  uploadedAt: string;
}

export interface Bill {
  id: string;
  patientId: string;
  appointmentId: string;
  billNumber: string;
  status: BillStatus;
  subtotal: number;
  tax: number;
  total: number;
  paidAmount: number;
  paymentMethod: PaymentMethod | null;
  items?: BillItem[];
  createdAt: string;
}

export interface BillItem {
  id: string;
  billId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
