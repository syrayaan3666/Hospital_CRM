import { Prisma, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { Router, type NextFunction, type Request, type Response } from "express";
import { prisma } from "../../lib/prisma.js";
import { authenticate } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/rbac.middleware.js";
import { BadRequestError, ConflictError, NotFoundError } from "../../utils/errors.js";

const router = Router();

const userSelect = {
	id: true,
	email: true,
	role: true,
	isActive: true,
	createdAt: true,
	firstName: true,
	lastName: true,
	phone: true,
} as const;

const departmentSelect = {
	id: true,
	name: true,
	code: true,
	description: true,
	isActive: true,
	createdAt: true,
	updatedAt: true,
} as const;

router.get(
	"/users",
	authenticate,
	requireRole(Role.ADMIN),
	async (_req: Request, res: Response, next: NextFunction) => {
		try {
			const users = await prisma.user.findMany({
				select: userSelect,
				orderBy: { createdAt: "desc" },
			});

			return res.json({ success: true, data: users });
		} catch (error) {
			next(error);
		}
	},
);

router.patch(
	"/users/:id/status",
	authenticate,
	requireRole(Role.ADMIN),
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (typeof req.body.isActive !== "boolean") {
				throw new BadRequestError("isActive must be a boolean");
			}

			const user = await prisma.user.update({
				where: { id: String(req.params.id) },
				data: { isActive: req.body.isActive },
				select: userSelect,
			});

			return res.json({ success: true, data: user });
		} catch (error: unknown) {
			if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2025") {
				return next(new NotFoundError("User not found"));
			}

			next(error);
		}
	},
);

router.get(
	"/audit-logs",
	authenticate,
	requireRole(Role.ADMIN),
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const page = Math.max(Number(req.query.page ?? 1) || 1, 1);
			const limit = Math.min(Math.max(Number(req.query.limit ?? 50) || 50, 1), 100);
			const userId = req.query.userId ? String(req.query.userId) : undefined;
			const action = req.query.action ? String(req.query.action).trim() : undefined;
			const entityName = req.query.entityName ? String(req.query.entityName).trim() : undefined;
			const fromDate = req.query.from ? new Date(String(req.query.from)) : undefined;
			const toDate = req.query.to ? new Date(String(req.query.to)) : undefined;

			const where: Prisma.AuditLogWhereInput = {
				...(userId ? { userId } : {}),
				...(action ? { action } : {}),
				...(entityName ? { entityName } : {}),
				...(fromDate || toDate
					? {
						createdAt: {
							...(fromDate ? { gte: fromDate } : {}),
							...(toDate ? { lte: toDate } : {}),
						},
					}
					: {}),
			};

			const [total, items] = await prisma.$transaction([
				prisma.auditLog.count({ where }),
				prisma.auditLog.findMany({
					where,
					include: {
						user: {
							select: {
								id: true,
								email: true,
								firstName: true,
								lastName: true,
								role: true,
							},
						},
					},
					orderBy: { createdAt: "desc" },
					skip: (page - 1) * limit,
					take: limit,
				}),
			]);

			return res.json({
				success: true,
				data: items,
				pagination: {
					total,
					page,
					limit,
					totalPages: Math.max(1, Math.ceil(total / limit)),
				},
			});
		} catch (error) {
			next(error);
		}
	},
);

router.post(
	"/departments",
	authenticate,
	requireRole(Role.ADMIN),
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const name = String(req.body.name ?? "").trim();
			const code = String(req.body.code ?? "").trim().toUpperCase();
			const description = req.body.description ? String(req.body.description).trim() : null;
			const isActive = typeof req.body.isActive === "boolean" ? req.body.isActive : true;

			if (!name || !code) {
				throw new BadRequestError("Department name and code are required");
			}

			const department = await prisma.department.create({
				data: {
					name,
					code,
					description,
					isActive,
				},
				select: departmentSelect,
			});

			return res.status(201).json({ success: true, data: department });
		} catch (error: unknown) {
			if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002") {
				return next(new ConflictError("A department with that name or code already exists"));
			}

			next(error);
		}
	},
);

router.patch(
	"/departments/:id",
	authenticate,
	requireRole(Role.ADMIN),
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const name = req.body.name ? String(req.body.name).trim() : undefined;
			const code = req.body.code ? String(req.body.code).trim().toUpperCase() : undefined;
			const description = req.body.description === undefined ? undefined : String(req.body.description).trim() || null;
			const isActive = typeof req.body.isActive === "boolean" ? req.body.isActive : undefined;

			const department = await prisma.department.update({
				where: { id: String(req.params.id) },
				data: {
					...(name ? { name } : {}),
					...(code ? { code } : {}),
					...(description !== undefined ? { description } : {}),
					...(isActive !== undefined ? { isActive } : {}),
				},
				select: departmentSelect,
			});

			return res.json({ success: true, data: department });
		} catch (error: unknown) {
			if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2025") {
				return next(new NotFoundError("Department not found"));
			}

			if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002") {
				return next(new ConflictError("A department with that name or code already exists"));
			}

			next(error);
		}
	},
);

router.post(
	"/doctors",
	authenticate,
	requireRole(Role.ADMIN),
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const email = String(req.body.email ?? "").trim().toLowerCase();
			const password = String(req.body.password ?? "");
			const firstName = String(req.body.firstName ?? "").trim();
			const lastName = String(req.body.lastName ?? "").trim();
			const departmentId = String(req.body.departmentId ?? "").trim();
			const specialization = String(req.body.specialization ?? "").trim();
			const licenseNumber = String(req.body.licenseNumber ?? "").trim();
			const consultationFee = Number(req.body.consultationFee);
			const startTime = String(req.body.startTime ?? "09:00").trim();
			const endTime = String(req.body.endTime ?? "17:00").trim();
			const slotDurationMinutes = Number(req.body.slotDurationMinutes ?? 30);
			const yearsOfExperience = req.body.yearsOfExperience === undefined || req.body.yearsOfExperience === ""
				? null
				: Number(req.body.yearsOfExperience);
			const phone = req.body.phone ? String(req.body.phone).trim() : null;
			const bio = req.body.bio ? String(req.body.bio).trim() : null;
			const availableDays = Array.isArray(req.body.availableDays)
				? req.body.availableDays.map((day: unknown) => String(day).trim()).filter(Boolean)
				: String(req.body.availableDays ?? "").split(",").map((day) => day.trim()).filter(Boolean);

			if (!email || !password || !firstName || !lastName || !departmentId || !specialization || !licenseNumber || Number.isNaN(consultationFee)) {
				throw new BadRequestError("Missing required doctor fields");
			}

			const createdDoctor = await prisma.$transaction(async (tx) => {
				const user = await tx.user.create({
					data: {
						email,
						passwordHash: await bcrypt.hash(password, 12),
						role: Role.DOCTOR,
						firstName,
						lastName,
						phone,
						isActive: true,
					},
				});

				return tx.doctor.create({
					data: {
						userId: user.id,
						departmentId,
						licenseNumber,
						firstName,
						lastName,
						specialization,
						consultationFee: new Prisma.Decimal(consultationFee),
						startTime,
						endTime,
						slotDurationMinutes,
						availableDays,
						yearsOfExperience,
						phone,
						email,
						bio,
					},
					include: {
						department: true,
						user: {
							select: {
								id: true,
								email: true,
								role: true,
								isActive: true,
							},
						},
					},
				});
			});

			return res.status(201).json({ success: true, data: createdDoctor });
		} catch (error: unknown) {
			if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2025") {
				return next(new NotFoundError("Department not found"));
			}

			if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002") {
				return next(new ConflictError("A doctor with that email, phone, or license already exists"));
			}

			next(error);
		}
	},
);

export { router as adminRouter };