import { Router, type NextFunction, type Request, type Response } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { prisma } from "../../lib/prisma.js";

const router = Router();

router.get(
	'/me',
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const doctor = await prisma.doctor.findUnique({
				where: { userId: req.user!.userId },
				include: { department: true },
			});

			if (!doctor) {
				return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Doctor profile not found' } });
			}

			return res.json({ success: true, data: doctor });
		} catch (error) {
			next(error);
		}
	},
);

router.get(
	"/",
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const departmentId = req.query.departmentId ? String(req.query.departmentId) : undefined;

			const doctors = await prisma.doctor.findMany({
				where: departmentId ? { departmentId } : undefined,
				include: {
					department: true,
				},
				orderBy: [
					{ department: { name: "asc" } },
					{ firstName: "asc" },
					{ lastName: "asc" },
				],
			});

			return res.json({ success: true, data: doctors });
		} catch (error) {
			next(error);
		}
	},
);

export { router as doctorRouter };