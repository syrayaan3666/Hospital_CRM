import {
	AppointmentStatus,
	AppointmentType,
	Prisma,
} from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import {
	BadRequestError,
	ConflictError,
	NotFoundError,
} from "../../utils/errors.js";
import { BillService } from "../billing/bill.service.js";
import { createAuditLog } from "../../middleware/audit.middleware.js";
import type { Request } from "express";

const SYSTEM_AUDIT_REQUEST = { ip: "system", headers: {} } as Request;

export interface BookAppointmentDto {
	patientId: string;
	doctorId: string;
	appointmentType: AppointmentType;
	scheduledAt: Date | string;
	durationMinutes?: number;
	reason: string;
	notes?: string;
}

export type AppointmentWithRelations = Prisma.AppointmentGetPayload<{
	include: {
		patient: true;
		doctor: {
			include: {
				department: true;
			};
		};
		department: true;
	};
}>;

type DoctorSchedule = {
	id: string;
	departmentId: string;
	startTime: string;
	endTime: string;
	slotDurationMinutes: number;
	availableDays: string[];
};

const WEEKDAY_NAMES = [
	"SUNDAY",
	"MONDAY",
	"TUESDAY",
	"WEDNESDAY",
	"THURSDAY",
	"FRIDAY",
	"SATURDAY",
];

export class AppointmentService {
	constructor(private readonly billService = new BillService()) {}

	async getAvailableSlots(doctorId: string, date: Date | string): Promise<string[]> {
		const requestedDate = this.toDate(date);
		const doctor = await this.getDoctorSchedule(prisma, doctorId);
		this.assertDoctorAvailableOnDate(doctor, requestedDate);

		const slots = this.generateSlots(
			doctor.startTime,
			doctor.endTime,
			doctor.slotDurationMinutes,
		);

		const appointments = await prisma.appointment.findMany({
			where: {
				doctorId,
				scheduledAt: {
					gte: this.startOfDay(requestedDate),
					lt: this.endOfDay(requestedDate),
				},
				status: {
					not: AppointmentStatus.CANCELLED,
				},
			},
			select: {
				scheduledAt: true,
				durationMinutes: true,
			},
		});

		return slots.filter((slot) => {
			const slotStart = this.combineDateAndTime(requestedDate, slot);
			const slotEnd = this.addMinutes(slotStart, doctor.slotDurationMinutes);

			return !appointments.some((appointment) => {
				const appointmentStart = appointment.scheduledAt;
				const appointmentEnd = this.addMinutes(
					appointmentStart,
					appointment.durationMinutes,
				);

				return this.intervalsOverlap(
					slotStart,
					slotEnd,
					appointmentStart,
					appointmentEnd,
				);
			});
		});
	}

	async bookAppointment(
		data: BookAppointmentDto,
		createdByUserId: string,
	): Promise<AppointmentWithRelations> {
		const scheduledAt = this.toDate(data.scheduledAt);
		const durationMinutes = data.durationMinutes ?? undefined;

		return prisma.$transaction(
			async (tx) => {
				const doctor = await this.getDoctorSchedule(tx, data.doctorId);
				const patient = await tx.patient.findUnique({
					where: { id: data.patientId },
					select: {
						id: true,
						userId: true,
						firstName: true,
						lastName: true,
					},
				});

				if (!patient) {
					throw new NotFoundError("Patient not found");
				}

				this.assertDoctorAvailableOnDate(doctor, scheduledAt);

				const effectiveDurationMinutes = durationMinutes ?? doctor.slotDurationMinutes;
				await this.assertSlotAvailable(
					tx,
					doctor,
					scheduledAt,
					effectiveDurationMinutes,
				);

				const appointment = await tx.appointment.create({
					data: {
						appointmentNumber: this.createAppointmentNumber(),
						patientId: data.patientId,
						doctorId: data.doctorId,
						departmentId: doctor.departmentId,
						appointmentType: data.appointmentType,
						scheduledAt,
						durationMinutes: effectiveDurationMinutes,
						reason: data.reason,
						notes: data.notes ?? null,
					},
					include: this.appointmentRelationsInclude(),
				});

				await tx.notification.create({
					data: {
						userId: patient.userId ?? null,
						title: "Appointment booked",
						message: `Your appointment for ${this.formatDateTime(scheduledAt)} has been booked.`,
						type: "APPOINTMENT_BOOKED",
					},
				});

				void createAuditLog(
					createdByUserId,
					"APPOINTMENT_BOOKED",
					"Appointment",
					appointment.id,
					{
						action: "book",
						appointmentId: appointment.id,
						patientId: data.patientId,
						doctorId: data.doctorId,
						scheduledAt: appointment.scheduledAt,
					},
					SYSTEM_AUDIT_REQUEST,
				);

				return appointment;
			},
			{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
		);
	}

	async updateStatus(
		appointmentId: string,
		status: AppointmentStatus,
		userId: string,
		reason?: string,
	): Promise<AppointmentWithRelations> {
		return prisma.$transaction(
			async (tx) => {
				const appointment = await tx.appointment.findUnique({
					where: { id: appointmentId },
					include: this.appointmentRelationsInclude(),
				});

				if (!appointment) {
					throw new NotFoundError("Appointment not found");
				}

				this.assertLegalStatusTransition(appointment.status, status, reason);

				const updatedAppointment = await tx.appointment.update({
					where: { id: appointmentId },
					data: {
						status,
						cancellationReason:
							status === AppointmentStatus.CANCELLED ? reason ?? null : appointment.cancellationReason,
					},
					include: this.appointmentRelationsInclude(),
				});

				if (status === AppointmentStatus.COMPLETED) {
					await this.billService.createDraftBill(
						updatedAppointment.id,
						userId,
						tx,
					);
				}

				void createAuditLog(
					userId,
					"APPOINTMENT_STATUS_UPDATED",
					"Appointment",
					updatedAppointment.id,
					{
						appointmentId: updatedAppointment.id,
						fromStatus: appointment.status,
						toStatus: status,
						reason: reason ?? null,
					},
					SYSTEM_AUDIT_REQUEST,
				);

				return updatedAppointment;
			},
			{ isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
		);
	}

	async getAppointmentsByDoctor(
		doctorId: string,
		date: Date | string,
	): Promise<AppointmentWithRelations[]> {
		const requestedDate = this.toDate(date);

		return prisma.appointment.findMany({
			where: {
				doctorId,
				scheduledAt: {
					gte: this.startOfDay(requestedDate),
					lt: this.endOfDay(requestedDate),
				},
			},
			include: this.appointmentRelationsInclude(),
			orderBy: {
				scheduledAt: "asc",
			},
		});
	}

	async getAppointmentsByPatient(
		patientId: string,
	): Promise<AppointmentWithRelations[]> {
		return prisma.appointment.findMany({
			where: { patientId },
			include: this.appointmentRelationsInclude(),
			orderBy: {
				scheduledAt: "desc",
			},
		});
	}

	private async assertSlotAvailable(
		tx: Prisma.TransactionClient,
		doctor: DoctorSchedule,
		scheduledAt: Date,
		durationMinutes: number,
	): Promise<void> {
		const slots = this.generateSlots(
			doctor.startTime,
			doctor.endTime,
			doctor.slotDurationMinutes,
		);
		const requestedSlotTime = this.formatTime(scheduledAt);

		if (!slots.includes(requestedSlotTime)) {
			throw new ConflictError("Requested slot is outside of the doctor's schedule");
		}

		const conflictingAppointments = await tx.appointment.findMany({
			where: {
				doctorId: doctor.id,
				scheduledAt: {
					gte: this.startOfDay(scheduledAt),
					lt: this.endOfDay(scheduledAt),
				},
				status: {
					not: AppointmentStatus.CANCELLED,
				},
			},
			select: {
				scheduledAt: true,
				durationMinutes: true,
			},
		});

		const requestedEnd = this.addMinutes(scheduledAt, durationMinutes);

		const hasConflict = conflictingAppointments.some((appointment) => {
			const appointmentEnd = this.addMinutes(
				appointment.scheduledAt,
				appointment.durationMinutes,
			);

			return this.intervalsOverlap(
				scheduledAt,
				requestedEnd,
				appointment.scheduledAt,
				appointmentEnd,
			);
		});

		if (hasConflict) {
			throw new ConflictError("Requested slot is already booked");
		}
	}

	private assertDoctorAvailableOnDate(doctor: DoctorSchedule, date: Date): void {
		const weekdayName = WEEKDAY_NAMES[date.getDay()];
		const normalizedAvailableDays = doctor.availableDays.map((day) =>
			day.trim().toUpperCase(),
		);

		if (!normalizedAvailableDays.includes(weekdayName)) {
			throw new BadRequestError("Doctor is not available on the selected day");
		}
	}

	private assertLegalStatusTransition(
		currentStatus: AppointmentStatus,
		nextStatus: AppointmentStatus,
		reason?: string,
	): void {
		if (currentStatus === nextStatus) {
			throw new BadRequestError("Appointment is already in the requested status");
		}

		const legalTransitions: Record<AppointmentStatus, AppointmentStatus[]> = {
			[AppointmentStatus.SCHEDULED]: [AppointmentStatus.CONFIRMED, AppointmentStatus.IN_PROGRESS, AppointmentStatus.CANCELLED],
			[AppointmentStatus.CONFIRMED]: [AppointmentStatus.IN_PROGRESS, AppointmentStatus.CANCELLED],
			[AppointmentStatus.IN_PROGRESS]: [AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED],
			[AppointmentStatus.COMPLETED]: [],
			[AppointmentStatus.CANCELLED]: [],
		};

		if (!legalTransitions[currentStatus].includes(nextStatus)) {
			throw new BadRequestError(
				`Illegal status transition from ${currentStatus} to ${nextStatus}`,
			);
		}

		if (nextStatus === AppointmentStatus.CANCELLED && !reason?.trim()) {
			throw new BadRequestError("Cancellation reason is required");
		}
	}

	private async getDoctorSchedule(
		tx: Prisma.TransactionClient | typeof prisma,
		doctorId: string,
	): Promise<DoctorSchedule> {
		const doctor = await tx.doctor.findUnique({
			where: { id: doctorId },
			select: {
				id: true,
				departmentId: true,
				startTime: true,
				endTime: true,
				slotDurationMinutes: true,
				availableDays: true,
			},
		});

		if (!doctor) {
			throw new NotFoundError("Doctor not found");
		}

		return doctor;
	}

	private generateSlots(startTime: string, endTime: string, slotDurationMinutes: number): string[] {
		const startMinutes = this.parseTime(startTime);
		const endMinutes = this.parseTime(endTime);
		const slots: string[] = [];

		for (
			let currentMinutes = startMinutes;
			currentMinutes + slotDurationMinutes <= endMinutes;
			currentMinutes += slotDurationMinutes
		) {
			slots.push(this.formatMinutes(currentMinutes));
		}

		return slots;
	}

	private parseTime(value: string): number {
		const match = /^(\d{2}):(\d{2})$/.exec(value);

		if (!match) {
			throw new BadRequestError(`Invalid time format: ${value}`);
		}

		const hours = Number(match[1]);
		const minutes = Number(match[2]);

		if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
			throw new BadRequestError(`Invalid time value: ${value}`);
		}

		return hours * 60 + minutes;
	}

	private formatMinutes(totalMinutes: number): string {
		const hours = Math.floor(totalMinutes / 60);
		const minutes = totalMinutes % 60;

		return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
	}

	private formatTime(date: Date): string {
		return this.formatMinutes(date.getHours() * 60 + date.getMinutes());
	}

	private combineDateAndTime(date: Date, time: string): Date {
		const [hours, minutes] = time.split(":").map(Number);
		const result = new Date(date);
		result.setHours(hours, minutes, 0, 0);
		return result;
	}

	private toDate(value: Date | string): Date {
		const date = value instanceof Date ? new Date(value) : new Date(value);

		if (Number.isNaN(date.getTime())) {
			throw new BadRequestError("Invalid date value");
		}

		return date;
	}

	private startOfDay(date: Date): Date {
		const result = new Date(date);
		result.setHours(0, 0, 0, 0);
		return result;
	}

	private endOfDay(date: Date): Date {
		const result = new Date(date);
		result.setHours(23, 59, 59, 999);
		return result;
	}

	private addMinutes(date: Date, minutes: number): Date {
		return new Date(date.getTime() + minutes * 60 * 1000);
	}

	private intervalsOverlap(
		startA: Date,
		endA: Date,
		startB: Date,
		endB: Date,
	): boolean {
		return startA < endB && startB < endA;
	}

	private appointmentRelationsInclude() {
		return {
			patient: true,
			doctor: {
				include: {
					department: true,
				},
			},
			department: true,
		} as const;
	}

	private createAppointmentNumber(): string {
		return `APT-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
	}

	private formatDateTime(date: Date): string {
		return `${date.toISOString().slice(0, 10)} ${this.formatTime(date)}`;
	}
}
