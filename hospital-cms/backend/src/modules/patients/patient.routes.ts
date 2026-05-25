import { Router, type NextFunction, type Request, type Response } from "express";
import { Role } from "@prisma/client";
import { authenticate } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/rbac.middleware.js";
import { prisma } from "../../lib/prisma.js";

const router = Router();

router.get(
	'/search',
	authenticate,
	requireRole(Role.DOCTOR, Role.RECEPTIONIST, Role.ADMIN),
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const q = String(req.query.q ?? '');

			const patients = await prisma.patient.findMany({
				where: {
					OR: [
						{ firstName: { contains: q, mode: 'insensitive' } },
						{ lastName: { contains: q, mode: 'insensitive' } },
						{ phone: { contains: q, mode: 'insensitive' } },
					],
				},
				orderBy: { firstName: 'asc' },
			});

			return res.json({ success: true, data: patients });
		} catch (error) {
			next(error);
		}
	},
);

router.get(
	"/count",
	authenticate,
	requireRole(Role.ADMIN, Role.RECEPTIONIST),
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

router.get(
	'/:id',
	authenticate,
	requireRole(Role.DOCTOR, Role.ADMIN, Role.RECEPTIONIST),
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const id = String(req.params.id);
			const patient = await prisma.patient.findUnique({ where: { id } });

			if (!patient) {
				return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Patient not found' } });
			}

			return res.json({ success: true, data: patient });
		} catch (error) {
			next(error);
		}
	},
);

export { router as patientRouter };