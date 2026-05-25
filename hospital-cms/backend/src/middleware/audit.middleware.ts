import type { NextFunction, Request, RequestHandler, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export async function createAuditLog(
	userId: string,
	action: string,
	entityType: string,
	entityId: string,
	details: Record<string, unknown>,
	req: Request,
): Promise<void> {
	try {
		const forwardedFor = req.headers["x-forwarded-for"];
		const forwardedIp = Array.isArray(forwardedFor)
			? forwardedFor[0]
			: typeof forwardedFor === "string"
				? forwardedFor.split(",")[0]?.trim()
				: undefined;
		const ipAddress = req.ip || forwardedIp || "unknown";

		await prisma.auditLog.create({
			data: {
				userId,
				action,
				entityName: entityType,
				entityId,
				details: details as Prisma.InputJsonValue,
				ipAddress,
			},
		});
	} catch (error) {
		console.error("Failed to write audit log", error);
	}
}

export function auditMiddleware(): RequestHandler {
	return (req: Request, res: Response, next: NextFunction) => {
		res.on("finish", () => {
			if (!req.user) {
				return;
			}

			if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
				return;
			}

			const routePath = req.route?.path
				? `${req.baseUrl}${req.route.path}`
				: req.originalUrl;

			void createAuditLog(
				req.user.userId,
				`${req.method} ${routePath}`,
				"HTTP_REQUEST",
				"N/A",
				{
					statusCode: res.statusCode,
					method: req.method,
					path: routePath,
				},
				req,
			);
		});

		next();
	};
}
