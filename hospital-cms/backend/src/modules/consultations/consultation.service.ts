import {
	AppointmentStatus,
	Role,
	LabOrderStatus,
	Prisma,
	type Consultation as PrismaConsultation,
	type Prescription as PrismaPrescription,
	type PrescriptionItem as PrismaPrescriptionItem,
	type LabOrder as PrismaLabOrder,
} from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import {
	BadRequestError,
	ConflictError,
	ForbiddenError,
	NotFoundError,
} from "../../utils/errors.js";
import { createAuditLog } from "../../middleware/audit.middleware.js";
import type { Request } from "express";

const SYSTEM_AUDIT_REQUEST = { ip: "system", headers: {} } as Request;

export interface CreateConsultationDto {
	appointmentId: string;
	symptoms: string;
	diagnosis?: string | null;
	notes?: string | null;
	vitals?: Record<string, unknown>;
}

export interface PrescriptionItemDto {
	medicineName: string;
	dosage: string;
	frequency: string;
	durationDays: number;
	quantity: number;
	instructions?: string | null;
}

export type ConsultationWithDetails = Prisma.ConsultationGetPayload<{
	include: {
		patient: true;
		doctor: {
			include: {
				department: true;
			};
		};
		appointment: true;
		prescription: {
			include: {
				items: true;
			};
		};
		labOrders: true;
	};
}>;

export type ConsultationResult = ConsultationWithDetails & {
	allergyWarning: string[];
};

export type PrescriptionWithItems = Prisma.PrescriptionGetPayload<{
	include: {
		items: true;
	};
}>;

export type LabOrderRecord = PrismaLabOrder;

const CONSULTATION_INCLUDE = {
	patient: true,
	doctor: {
		include: {
			department: true,
		},
	},
	appointment: true,
	prescription: {
		include: {
			items: true,
		},
	},
	labOrders: true,
} as const;

export class ConsultationService {
	async createConsultation(
		data: CreateConsultationDto,
		doctorUserId: string,
	): Promise<ConsultationResult> {
		const doctor = await prisma.doctor.findUnique({
			where: { userId: doctorUserId },
			select: { id: true, userId: true },
		});

		if (!doctor) {
			throw new NotFoundError("Doctor profile not found");
		}

		const appointment = await prisma.appointment.findUnique({
			where: { id: data.appointmentId },
			include: {
				patient: true,
			},
		});

		if (!appointment) {
			throw new NotFoundError("Appointment not found");
		}

		if (appointment.doctorId !== doctor.id) {
			throw new ForbiddenError("Appointment does not belong to this doctor");
		}

		if (appointment.status !== AppointmentStatus.IN_PROGRESS) {
			throw new BadRequestError("Appointment must be IN_PROGRESS before creating a consultation");
		}

		const existingConsultation = await prisma.consultation.findUnique({
			where: { appointmentId: data.appointmentId },
		});

		if (existingConsultation) {
			throw new ConflictError("A consultation already exists for this appointment");
		}

		const patient = await prisma.patient.findUnique({
			where: { id: appointment.patientId },
			select: {
				id: true,
				allergies: true,
			},
		});

		if (!patient) {
			throw new NotFoundError("Patient not found");
		}

		const consultation = await prisma.$transaction(async (tx) => {
			const created = await tx.consultation.create({
				data: {
					appointmentId: appointment.id,
					patientId: appointment.patientId,
					doctorId: doctor.id,
					consultationAt: new Date(),
					vitals: data.vitals ? (data.vitals as Prisma.InputJsonValue) : Prisma.DbNull,
					symptoms: data.symptoms,
					diagnosis: data.diagnosis ?? null,
					notes: data.notes ?? null,
				},
				include: CONSULTATION_INCLUDE,
			});

			void createAuditLog(
				doctorUserId,
				"CONSULTATION_CREATED",
				"Consultation",
				created.id,
				{
					appointmentId: appointment.id,
					patientId: appointment.patientId,
					doctorId: doctor.id,
					vitals: data.vitals ?? null,
				},
				SYSTEM_AUDIT_REQUEST,
			);

			return created;
		});

		return {
			...(consultation as ConsultationWithDetails),
			allergyWarning: patient.allergies,
		};
	}

	async addPrescription(
		consultationId: string,
		items: PrescriptionItemDto[],
		doctorUserId: string,
	): Promise<PrescriptionWithItems> {
		const doctor = await this.getDoctorByUserId(doctorUserId);
		const consultation = await this.getConsultationOwnedByDoctor(consultationId, doctor.id);

		if (consultation.isLocked) {
			throw new ForbiddenError("Consultation is locked and cannot be edited");
		}

		return prisma.$transaction(async (tx) => {
			const consultationForWrite = await tx.consultation.findUnique({
				where: { id: consultationId },
				select: {
					id: true,
					doctorId: true,
					patientId: true,
					isLocked: true,
				},
			});

			if (!consultationForWrite) {
				throw new NotFoundError("Consultation not found");
			}

			if (consultationForWrite.doctorId !== doctor.id) {
				throw new ForbiddenError("Consultation does not belong to this doctor");
			}

			if (consultationForWrite.isLocked) {
				throw new ForbiddenError("Consultation is locked and cannot be edited");
			}

			const prescription = await tx.prescription.create({
				data: {
					prescriptionNumber: this.createNumber("RX"),
					consultationId,
					patientId: consultationForWrite.patientId,
					doctorId: doctor.id,
					remarks: null,
					items: {
						create: items.map((item) => ({
							medicineName: item.medicineName,
							dosage: item.dosage,
							frequency: item.frequency,
							durationDays: item.durationDays,
							quantity: item.quantity,
							instructions: item.instructions ?? null,
						})),
					},
				},
				include: {
					items: true,
				},
			});

			void createAuditLog(
				doctorUserId,
				"PRESCRIPTION_CREATED",
				"Prescription",
				prescription.id,
				{
					consultationId,
					itemCount: items.length,
				},
				SYSTEM_AUDIT_REQUEST,
			);

			return prescription;
		});
	}

	async orderLabTests(
		consultationId: string,
		tests: string[],
		doctorUserId: string,
	): Promise<LabOrderRecord[]> {
		const doctor = await this.getDoctorByUserId(doctorUserId);
		const consultation = await this.getConsultationOwnedByDoctor(consultationId, doctor.id);

		if (consultation.isLocked) {
			throw new ForbiddenError("Consultation is locked and cannot be edited");
		}

		return prisma.$transaction(async (tx) => {
			const consultationForWrite = await tx.consultation.findUnique({
				where: { id: consultationId },
				select: {
					id: true,
					doctorId: true,
					patientId: true,
					isLocked: true,
				},
			});

			if (!consultationForWrite) {
				throw new NotFoundError("Consultation not found");
			}

			if (consultationForWrite.doctorId !== doctor.id) {
				throw new ForbiddenError("Consultation does not belong to this doctor");
			}

			if (consultationForWrite.isLocked) {
				throw new ForbiddenError("Consultation is locked and cannot be edited");
			}

			const createdOrders: LabOrderRecord[] = [];

			for (const testName of tests) {
				const labOrder = await tx.labOrder.create({
					data: {
						orderNumber: this.createNumber("LAB"),
						patientId: consultationForWrite.patientId,
						doctorId: doctor.id,
						consultationId,
						testName,
						status: LabOrderStatus.ORDERED,
					},
				});

				createdOrders.push(labOrder);
			}

			const labStaffUsers = await tx.user.findMany({
				where: { role: Role.LAB_STAFF },
				select: { id: true },
			});

			await Promise.all(
				labStaffUsers.map((user) =>
					tx.notification.create({
						data: {
							userId: user.id,
							title: "New lab tests ordered",
							message: `Lab tests ordered for consultation ${consultationId}`,
							type: "LAB_ORDER_CREATED",
						},
					}),
				),
			);

			void createAuditLog(
				doctorUserId,
				"LAB_TESTS_ORDERED",
				"Consultation",
				consultationId,
				{
					consultationId,
					tests,
				},
				SYSTEM_AUDIT_REQUEST,
			);

			return createdOrders;
		});
	}

	async lockConsultation(consultationId: string): Promise<void> {
		await prisma.consultation.update({
			where: { id: consultationId },
			data: { isLocked: true },
		});
	}

	async getConsultationByAppointment(
		appointmentId: string,
		requestingUserId: string,
		requestingRole: Role,
	): Promise<ConsultationWithDetails> {
		const consultation = await prisma.consultation.findUnique({
			where: { appointmentId },
			include: CONSULTATION_INCLUDE,
		});

		if (!consultation) {
			throw new NotFoundError("Consultation not found");
		}

		await this.assertConsultationAccess(consultation, requestingUserId, requestingRole);

		return consultation;
	}

	async getPatientTimeline(
		patientId: string,
		requestingUserId: string,
		requestingRole: Role,
	): Promise<ConsultationWithDetails[]> {
		await this.assertPatientTimelineAccess(patientId, requestingUserId, requestingRole);

		return prisma.consultation.findMany({
			where: { patientId },
			include: CONSULTATION_INCLUDE,
			orderBy: { createdAt: "desc" },
		});
	}

	private async getDoctorByUserId(doctorUserId: string) {
		const doctor = await prisma.doctor.findUnique({
			where: { userId: doctorUserId },
			select: { id: true, userId: true },
		});

		if (!doctor) {
			throw new NotFoundError("Doctor profile not found");
		}

		return doctor;
	}

	private async getConsultationOwnedByDoctor(consultationId: string, doctorId: string) {
		const consultation = await prisma.consultation.findUnique({
			where: { id: consultationId },
			select: {
				id: true,
				doctorId: true,
				patientId: true,
				isLocked: true,
			},
		});

		if (!consultation) {
			throw new NotFoundError("Consultation not found");
		}

		if (consultation.doctorId !== doctorId) {
			throw new ForbiddenError("Consultation does not belong to this doctor");
		}

		return consultation;
	}

	private async assertConsultationAccess(
		consultation: ConsultationWithDetails,
		requestingUserId: string,
		requestingRole: Role,
	): Promise<void> {
		switch (requestingRole) {
			case Role.ADMIN:
				return;
			case Role.PATIENT: {
				const patient = await prisma.patient.findUnique({
					where: { userId: requestingUserId },
					select: { id: true },
				});

				if (!patient || consultation.patientId !== patient.id) {
					throw new ForbiddenError("You are not allowed to access this consultation");
				}

				return;
			}
			case Role.DOCTOR: {
				const doctor = await prisma.doctor.findUnique({
					where: { userId: requestingUserId },
					select: { id: true },
				});

				if (!doctor || consultation.doctorId !== doctor.id) {
					throw new ForbiddenError("You are not allowed to access this consultation");
				}

				return;
			}
			default:
				throw new ForbiddenError("You are not allowed to access this consultation");
		}
	}

	private async assertPatientTimelineAccess(
		patientId: string,
		requestingUserId: string,
		requestingRole: Role,
	): Promise<void> {
		switch (requestingRole) {
			case Role.ADMIN:
				return;
			case Role.PATIENT: {
				const patient = await prisma.patient.findUnique({
					where: { userId: requestingUserId },
					select: { id: true },
				});

				if (!patient || patient.id !== patientId) {
					throw new ForbiddenError("You are not allowed to access this patient timeline");
				}

				return;
			}
			case Role.DOCTOR:
				return;
			default:
				throw new ForbiddenError("You are not allowed to access this patient timeline");
		}
	}

	private createNumber(prefix: string): string {
		return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
	}
}
