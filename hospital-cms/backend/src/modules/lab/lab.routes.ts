import { Router, type NextFunction, type Request, type Response } from "express";
import { LabOrderStatus, Role } from "@prisma/client";
import { LabService } from "./lab.service.js";
import { authenticate } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/rbac.middleware.js";
import { prisma } from "../../lib/prisma.js";

const router = Router();
const labService = new LabService();

router.get(
	"/pending-count",
	authenticate,
	requireRole(Role.ADMIN),
	async (_req: Request, res: Response, next: NextFunction) => {
		try {
			const count = await prisma.labOrder.count({
				where: {
					status: {
						not: LabOrderStatus.RESULT_READY,
					},
				},
			});

			return res.json({ success: true, data: { count } });
		} catch (error) {
			next(error);
		}
	},
);

router.get(
	"/orders",
	authenticate,
	requireRole(Role.LAB_STAFF, Role.DOCTOR, Role.ADMIN, Role.PATIENT),
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const result = await labService.getPendingOrders(req.user!.role, req.user!.userId);
			return res.json({ success: true, data: result });
		} catch (error) {
			next(error);
		}
	},
);

router.patch(
	"/orders/:id/status",
	authenticate,
	requireRole(Role.LAB_STAFF, Role.ADMIN),
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const result = await labService.updateOrderStatus(
				String(req.params.id),
				req.body.status as LabOrderStatus,
				req.user!.userId,
				req.user!.role,
			);
			return res.json({ success: true, data: result });
		} catch (error) {
			next(error);
		}
	},
);

router.post(
	"/orders/:id/result",
	authenticate,
	requireRole(Role.LAB_STAFF, Role.ADMIN),
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const result = await labService.uploadResult(
				String(req.params.id),
				req.body.fileUrl,
				req.body.notes,
				req.user!.userId,
				req.user!.role,
			);
			return res.status(201).json({ success: true, data: result });
		} catch (error) {
			next(error);
		}
	},
);

router.get(
	"/results/patient/:patientId",
	authenticate,
	requireRole(Role.PATIENT, Role.DOCTOR, Role.ADMIN, Role.LAB_STAFF),
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const result = await labService.getResultsForPatient(
				String(req.params.patientId),
				req.user!.userId,
				req.user!.role,
			);
			return res.json({ success: true, data: result });
		} catch (error) {
			next(error);
		}
	},
);

export { router as labRouter };
