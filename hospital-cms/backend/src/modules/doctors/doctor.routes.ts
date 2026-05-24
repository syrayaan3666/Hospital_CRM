import { Router, type NextFunction, type Request, type Response } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { prisma } from "../../lib/prisma.js";

const router = Router();

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