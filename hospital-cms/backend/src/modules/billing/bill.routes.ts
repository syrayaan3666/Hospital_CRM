import { Router, type NextFunction, type Request, type Response } from "express";
import { PaymentMethod, Role } from "@prisma/client";
import { BillService } from "./bill.service.js";
import { authenticate } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/rbac.middleware.js";

const router = Router();
const billService = new BillService();

router.post(
	"/bills/:appointmentId/draft",
	authenticate,
	requireRole(Role.RECEPTIONIST, Role.ADMIN),
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const result = await billService.createDraftBill(req.params.appointmentId, req.user!.userId);
			return res.status(201).json({ success: true, data: result });
		} catch (error) {
			next(error);
		}
	},
);

router.post(
	"/bills/:id/items",
	authenticate,
	requireRole(Role.RECEPTIONIST, Role.ADMIN),
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const result = await billService.addBillItem(req.params.id, req.body, req.user!.role);
			return res.json({ success: true, data: result });
		} catch (error) {
			next(error);
		}
	},
);

router.patch(
	"/bills/:id/issue",
	authenticate,
	requireRole(Role.RECEPTIONIST, Role.ADMIN),
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const result = await billService.issueBill(req.params.id, req.user!.userId, req.user!.role);
			return res.json({ success: true, data: result });
		} catch (error) {
			next(error);
		}
	},
);

router.post(
	"/bills/:id/payment",
	authenticate,
	requireRole(Role.RECEPTIONIST, Role.ADMIN),
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const result = await billService.recordPayment(
				req.params.id,
				req.body.amount,
				req.body.method as PaymentMethod,
				req.user!.role,
			);
			return res.json({ success: true, data: result });
		} catch (error) {
			next(error);
		}
	},
);

router.get(
	"/bills/patient/:patientId",
	authenticate,
	requireRole(Role.PATIENT, Role.RECEPTIONIST, Role.ADMIN),
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const result = await billService.getBillsByPatient(
				req.params.patientId,
				req.user!.userId,
				req.user!.role,
			);
			return res.json({ success: true, data: result });
		} catch (error) {
			next(error);
		}
	},
);

router.get(
	"/revenue/daily",
	authenticate,
	requireRole(Role.ADMIN),
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const date = new Date(String(req.query.date ?? new Date().toISOString()));
			const result = await billService.getDailyRevenue(date, req.user!.role);
			return res.json({ success: true, data: result });
		} catch (error) {
			next(error);
		}
	},
);

export { router as billRouter };
