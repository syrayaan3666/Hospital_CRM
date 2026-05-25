import {
	LabOrderStatus,
	Role,
	Prisma,
	type LabOrder as PrismaLabOrder,
	type LabResult as PrismaLabResult,
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

export type LabOrderWithPatient = Prisma.AppointmentGetPayload<{
	include: {
		patient: {
			select: {
				id: true;
				firstName: true;
				lastName: true;
			};
		};
	};
}>;

export type LabOrderResult = PrismaLabOrder & {
	patient: {
		firstName: string;
		lastName: string;
	};
};

export type LabResultWithOrder = PrismaLabResult & {
	labOrder: {
		testName: string;
		orderedAt: Date;
	};
	fileUrl: string | null;
};

const ALLOWED_PENDING_ROLES: Role[] = [Role.LAB_STAFF, Role.ADMIN, Role.DOCTOR, Role.PATIENT];

export class LabService {
	async getPendingOrders(
		requestingRole: Role,
		requestingUserId: string,
	): Promise<LabOrderResult[]> {
		if (!ALLOWED_PENDING_ROLES.includes(requestingRole)) {
			throw new ForbiddenError("You are not allowed to view lab orders");
		}

		if (requestingRole === Role.LAB_STAFF || requestingRole === Role.ADMIN) {
			return prisma.labOrder.findMany({
				where: {
					status: {
						not: LabOrderStatus.RESULT_READY,
					},
				},
				include: {
					patient: {
						select: {
							firstName: true,
							lastName: true,
						},
					},
				},
				orderBy: {
					orderedAt: "asc",
				},
			});
		}

		if (requestingRole === Role.DOCTOR) {
			const doctor = await prisma.doctor.findUnique({
				where: { userId: requestingUserId },
				select: { id: true },
			});

			if (!doctor) {
				throw new NotFoundError("Doctor profile not found");
			}

			return prisma.labOrder.findMany({
				where: {
					doctorId: doctor.id,
					status: {
						not: LabOrderStatus.RESULT_READY,
					},
				},
				include: {
					patient: {
						select: {
							firstName: true,
							lastName: true,
						},
					},
				},
				orderBy: {
					orderedAt: "asc",
				},
			});
		}

		const patient = await prisma.patient.findUnique({
			where: { userId: requestingUserId },
			select: { id: true },
		});

		if (!patient) {
			throw new NotFoundError("Patient profile not found");
		}

		return prisma.labOrder.findMany({
			where: {
				patientId: patient.id,
				status: {
					not: LabOrderStatus.RESULT_READY,
				},
			},
			include: {
				patient: {
					select: {
						firstName: true,
						lastName: true,
					},
				},
			},
			orderBy: {
				orderedAt: "asc",
			},
		});
	}

	async updateOrderStatus(
		orderId: string,
		newStatus: LabOrderStatus,
		requestingUserId: string,
		requestingRole: Role,
	): Promise<PrismaLabOrder> {
		if (requestingRole !== Role.LAB_STAFF && requestingRole !== Role.ADMIN) {
			throw new ForbiddenError("Only lab staff or admin can update lab order status");
		}

		const order = await prisma.labOrder.findUnique({
			where: { id: orderId },
			select: {
				id: true,
				status: true,
				patientId: true,
				testName: true,
			},
		});

		if (!order) {
			throw new NotFoundError("Lab order not found");
		}

		const VALID_TRANSITIONS: Record<LabOrderStatus, LabOrderStatus[]> = {
			[LabOrderStatus.ORDERED]: [LabOrderStatus.SAMPLE_COLLECTED],
			[LabOrderStatus.SAMPLE_COLLECTED]: [LabOrderStatus.PROCESSING],
			[LabOrderStatus.PROCESSING]: [LabOrderStatus.RESULT_READY],
			[LabOrderStatus.RESULT_READY]: [],
		};

		if (!VALID_TRANSITIONS[order.status].includes(newStatus)) {
			throw new BadRequestError(`Cannot transition from ${order.status} to ${newStatus}`);
		}

		return prisma.$transaction(async (tx) => {
			const updatedOrder = await tx.labOrder.update({
				where: { id: orderId },
				data: { status: newStatus },
			});

			void createAuditLog(
				requestingUserId,
				"LAB_ORDER_STATUS_UPDATED",
				"LabOrder",
				updatedOrder.id,
				{
					fromStatus: order.status,
					toStatus: newStatus,
					testName: order.testName,
				},
				SYSTEM_AUDIT_REQUEST,
			);

			return updatedOrder;
		});
	}

	async uploadResult(
		orderId: string,
		fileUrl: string,
		notes: string,
		uploadedByUserId: string,
		uploadedByRole: Role,
	): Promise<PrismaLabResult> {
		if (uploadedByRole !== Role.LAB_STAFF && uploadedByRole !== Role.ADMIN) {
			throw new ForbiddenError("Only lab staff or admin can upload lab results");
		}

		const existingResult = await prisma.labResult.findUnique({
			where: { labOrderId: orderId },
		});

		if (existingResult) {
			throw new ConflictError("A result already exists for this lab order");
		}

		const order = await prisma.labOrder.findUnique({
			where: { id: orderId },
			include: {
				patient: {
					select: {
						userId: true,
					},
				},
			},
		});

		if (!order) {
			throw new NotFoundError("Lab order not found");
		}

		if (order.status !== LabOrderStatus.PROCESSING) {
			throw new BadRequestError("Lab order must be in PROCESSING status before uploading a result");
		}

		return prisma.$transaction(async (tx) => {
			const lockedExistingResult = await tx.labResult.findUnique({
				where: { labOrderId: orderId },
			});

			if (lockedExistingResult) {
				throw new ConflictError("A result already exists for this lab order");
			}

			const result = await tx.labResult.create({
				data: {
					labOrderId: order.id,
					resultName: order.testName,
					resultValue: notes,
					resultFileUrl: fileUrl,
					remarks: notes,
				},
			});

			await tx.labOrder.update({
				where: { id: orderId },
				data: {
					status: LabOrderStatus.RESULT_READY,
					resultReadyAt: new Date(),
				},
			});

			if (order.patient.userId) {
				await tx.notification.create({
					data: {
						userId: order.patient.userId,
						title: "Lab result ready",
						message: `Your lab result for ${order.testName} is ready`,
						type: "LAB_RESULT_READY",
					},
				});
			}

			void createAuditLog(
				uploadedByUserId,
				"LAB_RESULT_UPLOADED",
				"LabResult",
				result.id,
				{
					labOrderId: order.id,
					testName: order.testName,
					fileUrl,
				},
				SYSTEM_AUDIT_REQUEST,
			);

			return result;
		});
	}

	async getResultsForPatient(
		patientId: string,
		requestingUserId: string,
		requestingRole: Role,
	): Promise<LabResultWithOrder[]> {
		if (
			requestingRole !== Role.PATIENT &&
			requestingRole !== Role.DOCTOR &&
			requestingRole !== Role.ADMIN &&
			requestingRole !== Role.LAB_STAFF
		) {
			throw new ForbiddenError("You are not allowed to access lab results");
		}

		if (requestingRole === Role.PATIENT) {
			const patient = await prisma.patient.findUnique({
				where: { userId: requestingUserId },
				select: { id: true },
			});

			if (!patient || patient.id !== patientId) {
				throw new ForbiddenError("You are not allowed to access these lab results");
			}
		}

		const results = await prisma.labResult.findMany({
			where: {
				labOrder: {
					patientId,
				},
			},
			include: {
				labOrder: {
					select: {
						testName: true,
						orderedAt: true,
					},
				},
			},
			orderBy: {
				uploadedAt: "desc",
			},
		});

		return results.map((result) => ({
			...result,
			fileUrl: result.resultFileUrl,
			// TODO: replace fileUrl with S3 signed URL generation before production
		}));
	}
}
