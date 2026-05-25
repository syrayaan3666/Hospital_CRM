import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import winston from "winston";
import { AppError } from "./utils/errors.js";
import { auditMiddleware } from "./middleware/audit.middleware.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { patientRouter } from "./modules/patients/patient.routes.js";
import { departmentRouter } from "./modules/departments/department.routes.js";
import { doctorRouter } from "./modules/doctors/doctor.routes.js";
import { appointmentRouter } from "./modules/appointments/appointment.routes.js";
import { consultationRouter } from "./modules/consultations/consultation.routes.js";
import { labRouter } from "./modules/lab/lab.routes.js";
import { billRouter } from "./modules/billing/bill.routes.js";
import { notificationRouter } from "./modules/notifications/notification.routes.js";
import { adminRouter } from "./modules/admin/admin.routes.js";

export const app = express();

const logger = winston.createLogger({
	level: "info",
	format: winston.format.combine(
		winston.format.timestamp(),
		winston.format.errors({ stack: true }),
		winston.format.json(),
	),
	transports: [new winston.transports.Console()],
});

const authLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 20,
});

app.use(helmet());
const allowedOrigins = new Set([
	process.env.FRONTEND_URL,
	"http://localhost:3000",
	"http://localhost:3001",
].filter((origin): origin is string => Boolean(origin)));
app.use(
	cors({
		origin: (origin, callback) => {
			if (!origin || allowedOrigins.has(origin)) {
				callback(null, true);
				return;
			}

			callback(new Error(`CORS blocked for origin ${origin}`));
		},
		credentials: true,
		methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
	}),
);
app.use(express.json());
app.use(cookieParser());
app.use("/api/auth", authLimiter);
app.use(auditMiddleware());

app.use("/api/auth", authRouter);
app.use("/api/patients", patientRouter);
app.use("/api/departments", departmentRouter);
app.use("/api/doctors", doctorRouter);
app.use("/api/appointments", appointmentRouter);
app.use("/api/consultations", consultationRouter);
app.use("/api/lab", labRouter);
app.use("/api/billing", billRouter);
app.use("/api/notifications", notificationRouter);
app.use("/api/admin", adminRouter);

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
	logger.error("Unhandled application error", { error });

	if (error instanceof AppError) {
		return res.status(error.statusCode).json({
			success: false,
			error: {
				code: error.constructor.name,
				message: error.message,
			},
		});
	}

	return res.status(500).json({
		success: false,
		error: {
			code: "INTERNAL_ERROR",
			message: "Something went wrong",
		},
	});
});

export default app;
