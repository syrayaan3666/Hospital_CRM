import type { NextFunction, Request, Response, RequestHandler } from "express";
import { Role } from "@prisma/client";

const forbidden = (res: Response, message: string) =>
	res.status(403).json({ message });

export const requireRole = (...roles: Role[]): RequestHandler => {
	return (req: Request, res: Response, next: NextFunction) => {
		if (!req.user) {
			return res.status(401).json({ message: "Authentication required" });
		}

		if (!roles.includes(req.user.role)) {
			return forbidden(
				res,
				`Insufficient permissions. Allowed roles: ${roles.join(", ")}`,
			);
		}

		return next();
	};
};

