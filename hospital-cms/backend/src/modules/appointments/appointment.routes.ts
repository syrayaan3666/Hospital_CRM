import { Router, type NextFunction, type Request, type Response } from "express";
import { AppointmentStatus, Role } from "@prisma/client";
import { AppointmentService } from "./appointment.service.js";
import { authenticate } from "../../middleware/auth.middleware.js";
import { requireRole } from "../../middleware/rbac.middleware.js";
import { prisma } from "../../lib/prisma.js";
import { BadRequestError } from "../../utils/errors.js";

const router = Router();
const appointmentService = new AppointmentService();

router.get(
	"/slots",
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const doctorId = String(req.query.doctorId ?? "");
			const date = String(req.query.date ?? "");
			const result = await appointmentService.getAvailableSlots(doctorId, date);
			return res.json({ success: true, data: result });
		} catch (error) {
			next(error);
		}
	},
);

router.post(
	"/",
	authenticate,
	requireRole(Role.PATIENT, Role.RECEPTIONIST, Role.ADMIN),
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const result = await appointmentService.bookAppointment(req.body, req.user!.userId);
			return res.status(201).json({ success: true, data: result });
		} catch (error) {
			next(error);
		}
	},
);

router.patch(
	"/:id/status",
	authenticate,
	requireRole(Role.DOCTOR, Role.RECEPTIONIST, Role.ADMIN),
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const result = await appointmentService.updateStatus(
				String(req.params.id),
				req.body.status as AppointmentStatus,
				req.user!.userId,
				req.body.reason,
			);
			return res.json({ success: true, data: result });
		} catch (error) {
			next(error);
		}
	},
);

router.get(
	"/today-count",
	authenticate,
	requireRole(Role.ADMIN, Role.RECEPTIONIST),
	async (_req: Request, res: Response, next: NextFunction) => {
		try {
			const start = new Date();
			start.setHours(0, 0, 0, 0);

			const end = new Date(start);
			end.setHours(23, 59, 59, 999);

			const count = await prisma.appointment.count({
				where: {
					scheduledAt: {
						gte: start,
						lte: end,
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
	"/doctor",
	authenticate,
	requireRole(Role.DOCTOR, Role.ADMIN, Role.RECEPTIONIST),
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const date = String(req.query.date ?? "");

			if (req.user!.role === Role.DOCTOR) {
				const doctor = await prisma.doctor.findUnique({
					where: { userId: req.user!.userId },
					select: { id: true },
				});

				if (!doctor) {
					throw new BadRequestError("Doctor profile not found");
				}

				const result = await appointmentService.getAppointmentsByDoctor(doctor.id, date);
				return res.json({ success: true, data: result });
			}

			const appointments = await prisma.appointment.findMany({
				include: {
					patient: true,
					doctor: {
						include: {
							department: true,
						},
					},
					department: true,
				},
				orderBy: {
					scheduledAt: "asc",
				},
			});

			return res.json({ success: true, data: appointments });
		} catch (error) {
			next(error);
		}
	},
);

router.get(
	"/patient",
	authenticate,
	requireRole(Role.PATIENT, Role.RECEPTIONIST, Role.ADMIN),
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			let patientId = String(req.query.patientId ?? "");

			if (req.user!.role === Role.PATIENT) {
				const patient = await prisma.patient.findUnique({
					where: { userId: req.user!.userId },
					select: { id: true },
				});

				if (!patient) {
					throw new BadRequestError("Patient profile not found");
				}

				patientId = patient.id;
			}

			const result = await appointmentService.getAppointmentsByPatient(patientId);
			return res.json({ success: true, data: result });
		} catch (error) {
			next(error);
		}
	},
);

router.get(
	"/:id",
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const id = String(req.params.id);
			const appointment = await prisma.appointment.findUnique({
				where: { id },
				include: {
					patient: { include: { user: { select: { firstName: true, lastName: true, email: true } } } },
					doctor: { include: { user: { select: { firstName: true, lastName: true, email: true } }, department: true } },
				},
			});

			if (!appointment) {
				return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Appointment not found' } });
			}

			return res.json({ success: true, data: appointment });
		} catch (error) {
			next(error);
		}
	},
);

export { router as appointmentRouter };
