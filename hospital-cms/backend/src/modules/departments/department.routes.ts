import { Router, type NextFunction, type Request, type Response } from "express";
import { authenticate } from "../../middleware/auth.middleware.js";
import { prisma } from "../../lib/prisma.js";

const router = Router();

router.get(
	"/",
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const includeAll = String(req.query.all ?? "").toLowerCase() === "true";
			const departments = await prisma.department.findMany({
				where: includeAll ? undefined : ({ isActive: true } as unknown as never),
				orderBy: { name: "asc" },
			});

			return res.json({ success: true, data: departments });
		} catch (error) {
			next(error);
		}
	},
);

export { router as departmentRouter };