import { Router, type NextFunction, type Request, type Response } from "express";
import { Role } from "@prisma/client";
import { authenticate } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/rbac.middleware.js";
import { prisma } from "../../lib/prisma.js";

const router = Router();

router.get(
	"/count",
	authenticate,
	requireRole(Role.ADMIN),
	async (_req: Request, res: Response, next: NextFunction) => {
		try {
			const count = await prisma.patient.count();
			return res.json({ success: true, data: { count } });
		} catch (error) {
			next(error);
		}
	},
);

router.get(
	"/me",
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const patient = await prisma.patient.findUnique({
				where: { userId: req.user!.userId },
				include: {
					user: {
						select: {
							id: true,
							email: true,
							role: true,
							firstName: true,
							lastName: true,
						},
					},
				},
			});

			if (!patient) {
				return res.status(404).json({
					success: false,
					error: {
						code: "NOT_FOUND",
						message: "Patient profile not found",
					},
				});
			}

			return res.json({ success: true, data: patient });
		} catch (error) {
			next(error);
		}
	},
);

export { router as patientRouter };