import {
	AppointmentStatus,
	BillStatus,
	PaymentMethod,
	Prisma,
	Role,
} from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import {
	BadRequestError,
	ConflictError,
	ForbiddenError,
	NotFoundError,
} from "../../utils/errors";

export interface BillItemDto {
	description: string;
	quantity: number;
	unitPrice: number;
}

export interface RevenueReport {
	totalBills: number;
	totalRevenue: number;
	outstandingAmount: number;
	billsByStatus: Record<BillStatus, number>;
}

export type Bill = Prisma.BillGetPayload<{
	include: {
		billItems: true;
		patient: true;
		appointment: true;
		consultation: true;
	};
}>;

const TAX_RATE = 0.18;

const BILL_INCLUDE = {
	billItems: true,
	patient: true,
	appointment: true,
	consultation: true,
} as const;

export class BillService {
	async createDraftBill(
		appointmentId: string,
		createdByUserId: string,
		tx: Prisma.TransactionClient = prisma,
	): Promise<Bill> {
		const existingBill = await tx.bill.findUnique({
			where: { appointmentId },
		});

		if (existingBill) {
			throw new ConflictError("A bill already exists for this appointment");
		}

		const appointment = await tx.appointment.findUnique({
			where: { id: appointmentId },
			include: {
				doctor: {
					select: {
						consultationFee: true,
					},
				},
				patient: {
					select: {
						id: true,
					},
				},
				consultation: {
					select: {
						id: true,
					},
				},
			},
		});

		if (!appointment) {
			throw new NotFoundError("Appointment not found");
		}

		if (appointment.status !== AppointmentStatus.COMPLETED) {
			throw new BadRequestError("Appointment must be COMPLETED before creating a bill");
		}

		const billNumber = await this.generateBillNumber(tx);
		const consultationFee = new Prisma.Decimal(appointment.doctor.consultationFee);
		const subtotal = consultationFee;
		const taxAmount = subtotal.mul(TAX_RATE);
		const totalAmount = subtotal.add(taxAmount);

		const bill = await tx.bill.create({
			data: {
				billNumber,
				patientId: appointment.patient.id,
				appointmentId,
				consultationId: appointment.consultation?.id ?? null,
				status: BillStatus.DRAFT,
				subtotal,
				discountAmount: new Prisma.Decimal(0),
				taxAmount,
				totalAmount,
				amountPaid: new Prisma.Decimal(0),
				billItems: {
					create: {
						description: "Consultation Fee",
						quantity: 1,
						unitPrice: consultationFee,
						amount: consultationFee,
					},
				},
			},
			include: BILL_INCLUDE,
		});

		await tx.auditLog.create({
			data: {
				userId: createdByUserId,
				action: "BILL_DRAFT_CREATED",
				entityName: "Bill",
				entityId: bill.id,
				details: {
					appointmentId,
					billNumber,
					totalAmount: bill.totalAmount.toString(),
				},
			},
		});

		return bill;
	}

	async addBillItem(
		billId: string,
		item: BillItemDto,
		requestingRole: Role,
	): Promise<Bill> {
		if (requestingRole !== Role.RECEPTIONIST && requestingRole !== Role.ADMIN) {
			throw new ForbiddenError("Only receptionist or admin can add bill items");
		}

		return prisma.$transaction(async (tx) => {
			const bill = await tx.bill.findUnique({
				where: { id: billId },
				include: {
					billItems: true,
				},
			});

			if (!bill) {
				throw new NotFoundError("Bill not found");
			}

			if (bill.status === BillStatus.PAID || bill.status === BillStatus.CANCELLED) {
				throw new BadRequestError("Cannot add items to a paid or cancelled bill");
			}

			if (bill.status !== BillStatus.DRAFT && bill.status !== BillStatus.ISSUED) {
				throw new BadRequestError("Bill must be DRAFT or ISSUED to add items");
			}

			await tx.billItem.create({
				data: {
					billId,
					description: item.description,
					quantity: item.quantity,
					unitPrice: new Prisma.Decimal(item.unitPrice),
					amount: new Prisma.Decimal(item.unitPrice).mul(item.quantity),
				},
			});

			const allItems = await tx.billItem.findMany({
				where: { billId },
			});

			const subtotal = allItems.reduce(
				(sum, currentItem) => sum.add(currentItem.amount),
				new Prisma.Decimal(0),
			);
			const taxAmount = subtotal.mul(TAX_RATE);
			const totalAmount = subtotal.add(taxAmount);
			const amountPaid = bill.amountPaid;

			const updatedBill = await tx.bill.update({
				where: { id: billId },
				data: {
					subtotal,
					taxAmount,
					totalAmount,
				},
				include: BILL_INCLUDE,
			});

			await tx.auditLog.create({
				data: {
					action: "BILL_ITEM_ADDED",
					entityName: "Bill",
					entityId: updatedBill.id,
					details: {
						billId,
						description: item.description,
						quantity: item.quantity,
						unitPrice: item.unitPrice,
					},
				},
			});

			return {
				...updatedBill,
				amountPaid,
			};
		});
	}

	async issueBill(
		billId: string,
		requestingUserId: string,
		requestingRole: Role,
	): Promise<Bill> {
		if (requestingRole !== Role.RECEPTIONIST && requestingRole !== Role.ADMIN) {
			throw new ForbiddenError("Only receptionist or admin can issue bills");
		}

		return prisma.$transaction(async (tx) => {
			const bill = await tx.bill.findUnique({
				where: { id: billId },
				include: {
					patient: true,
				},
			});

			if (!bill) {
				throw new NotFoundError("Bill not found");
			}

			if (bill.status !== BillStatus.DRAFT) {
				throw new BadRequestError("Only draft bills can be issued");
			}

			const updatedBill = await tx.bill.update({
				where: { id: billId },
				data: {
					status: BillStatus.ISSUED,
					issuedAt: new Date(),
				},
				include: BILL_INCLUDE,
			});

			if (bill.patient.userId) {
				await tx.notification.create({
					data: {
						userId: bill.patient.userId,
						title: "Bill issued",
						message: `Your bill ${updatedBill.billNumber} of ₹${updatedBill.totalAmount.toString()} is ready for payment`,
						type: "BILL_ISSUED",
					},
				});
			}

			await tx.auditLog.create({
				data: {
					userId: requestingUserId,
					action: "BILL_ISSUED",
					entityName: "Bill",
					entityId: updatedBill.id,
					details: {
						billNumber: updatedBill.billNumber,
						amount: updatedBill.totalAmount.toString(),
					},
				},
			});

			return updatedBill;
		});
	}

	async recordPayment(
		billId: string,
		amount: number,
		method: PaymentMethod,
		requestingRole: Role,
	): Promise<Bill> {
		if (requestingRole !== Role.RECEPTIONIST && requestingRole !== Role.ADMIN) {
			throw new ForbiddenError("Only receptionist or admin can record payments");
		}

		if (amount <= 0) {
			throw new BadRequestError("Payment amount must be greater than zero");
		}

		return prisma.$transaction(async (tx) => {
			const bill = await tx.bill.findUnique({
				where: { id: billId },
				include: {
					billItems: true,
				},
			});

			if (!bill) {
				throw new NotFoundError("Bill not found");
			}

			if (bill.status === BillStatus.PAID || bill.status === BillStatus.CANCELLED) {
				throw new BadRequestError("Cannot record payment for a paid or cancelled bill");
			}

			if (bill.status !== BillStatus.ISSUED && bill.status !== BillStatus.PARTIALLY_PAID) {
				throw new BadRequestError("Bill must be ISSUED or PARTIALLY_PAID to record payment");
			}

			const paymentAmount = new Prisma.Decimal(amount);
			const nextPaidAmount = new Prisma.Decimal(bill.amountPaid).add(paymentAmount);

			if (nextPaidAmount.gt(bill.totalAmount)) {
				throw new BadRequestError("Payment would exceed the total bill amount");
			}

			const updatedBill = await tx.bill.update({
				where: { id: billId },
				data: {
					amountPaid: nextPaidAmount,
					status: nextPaidAmount.gte(bill.totalAmount)
						? BillStatus.PAID
						: BillStatus.PARTIALLY_PAID,
					paymentMethod: method,
					paidAt: nextPaidAmount.gte(bill.totalAmount) ? new Date() : bill.paidAt,
				},
				include: BILL_INCLUDE,
			});

			await tx.auditLog.create({
				data: {
					action: "BILL_PAYMENT_RECORDED",
					entityName: "Bill",
					entityId: updatedBill.id,
					details: {
						amount,
						method,
						paidAmount: nextPaidAmount.toString(),
					},
				},
			});

			return updatedBill;
		});
	}

	async getBillsByPatient(
		patientId: string,
		requestingUserId: string,
		requestingRole: Role,
	): Promise<Bill[]> {
		if (
			requestingRole !== Role.PATIENT &&
			requestingRole !== Role.RECEPTIONIST &&
			requestingRole !== Role.ADMIN
		) {
			throw new ForbiddenError("You are not allowed to access bills");
		}

		if (requestingRole === Role.PATIENT) {
			const patient = await prisma.patient.findUnique({
				where: { userId: requestingUserId },
				select: { id: true },
			});

			if (!patient || patient.id !== patientId) {
				throw new ForbiddenError("You are not allowed to access these bills");
			}
		}

		return prisma.bill.findMany({
			where: { patientId },
			include: BILL_INCLUDE,
			orderBy: { createdAt: "desc" },
		});
	}

	async getDailyRevenue(date: Date, requestingRole: Role): Promise<RevenueReport> {
		if (requestingRole !== Role.ADMIN) {
			throw new ForbiddenError("Only admin can access revenue reports");
		}

		const start = new Date(date);
		start.setHours(0, 0, 0, 0);
		const end = new Date(date);
		end.setHours(23, 59, 59, 999);

		const billsByStatus: Record<BillStatus, number> = {
			[BillStatus.DRAFT]: 0,
			[BillStatus.ISSUED]: 0,
			[BillStatus.PAID]: 0,
			[BillStatus.PARTIALLY_PAID]: 0,
			[BillStatus.CANCELLED]: 0,
		};

		const billsForDate = await prisma.bill.findMany({
			where: {
				issuedAt: {
					gte: start,
					lte: end,
				},
			},
			select: {
				status: true,
				totalAmount: true,
				amountPaid: true,
				paidAt: true,
			},
		});

		for (const bill of billsForDate) {
			billsByStatus[bill.status] += 1;
		}

		const totalRevenue = billsForDate
			.filter(
				(bill) =>
					bill.status === BillStatus.PAID &&
					bill.paidAt &&
					bill.paidAt >= start &&
					bill.paidAt <= end,
			)
			.reduce((sum, bill) => sum + bill.totalAmount.toNumber(), 0);

		const outstandingAmount = billsForDate
			.filter(
				(bill) =>
					bill.status === BillStatus.ISSUED || bill.status === BillStatus.PARTIALLY_PAID,
			)
			.reduce(
				(sum, bill) => sum + bill.totalAmount.sub(bill.amountPaid).toNumber(),
				0,
			);

		return {
			totalBills: billsForDate.length,
			totalRevenue,
			outstandingAmount,
			billsByStatus,
		};
	}

	private async generateBillNumber(tx: Prisma.TransactionClient): Promise<string> {
		const year = new Date().getFullYear();
		const prefix = `BILL-${year}-`;
		const count = await tx.bill.count({
			where: {
				billNumber: {
					startsWith: prefix,
				},
			},
		});

		return `${prefix}${String(count + 1).padStart(5, "0")}`;
	}
}
