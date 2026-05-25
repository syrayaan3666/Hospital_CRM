import { Router, type NextFunction, type Request, type Response } from "express";
import { Role } from "@prisma/client";
import { ConsultationService } from "./consultation.service.js";
import { authenticate } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/rbac.middleware.js";

const router = Router();
const consultationService = new ConsultationService();

router.post(
	"/",
	authenticate,
	requireRole(Role.DOCTOR),
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const result = await consultationService.createConsultation(req.body, req.user!.userId);
			return res.status(201).json({ success: true, data: result });
		} catch (error) {
			next(error);
		}
	},
);

router.post(
	"/:id/prescriptions",
	authenticate,
	requireRole(Role.DOCTOR),
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const result = await consultationService.addPrescription(String(req.params.id), req.body.items, req.user!.userId);
			return res.status(201).json({ success: true, data: result });
		} catch (error) {
			next(error);
		}
	},
);

router.post(
	"/:id/lab-orders",
	authenticate,
	requireRole(Role.DOCTOR),
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const result = await consultationService.orderLabTests(String(req.params.id), req.body.tests, req.user!.userId);
			return res.status(201).json({ success: true, data: result });
		} catch (error) {
			next(error);
		}
	},
);

router.get(
	"/appointment/:appointmentId",
	authenticate,
	requireRole(Role.PATIENT, Role.DOCTOR, Role.ADMIN),
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const result = await consultationService.getConsultationByAppointment(
				String(req.params.appointmentId),
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
	"/patient/:patientId/timeline",
	authenticate,
	requireRole(Role.PATIENT, Role.DOCTOR, Role.ADMIN),
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const result = await consultationService.getPatientTimeline(
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

export { router as consultationRouter };
