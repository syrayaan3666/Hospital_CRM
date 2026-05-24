import { Router, type NextFunction, type Request, type Response } from "express";
import { NotificationService } from "./notification.service.js";
import { authenticate } from "../../middleware/auth.middleware.js";

const router = Router();
const notificationService = new NotificationService();

router.get(
	"/",
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const result = await notificationService.getNotificationsForUser(req.user!.userId);
			return res.json({ success: true, data: result });
		} catch (error) {
			next(error);
		}
	},
);

router.patch(
	"/:id/read",
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const result = await notificationService.markAsRead(req.params.id, req.user!.userId);
			return res.json({ success: true, data: result });
		} catch (error) {
			next(error);
		}
	},
);

router.patch(
	"/read-all",
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			await notificationService.markAllAsRead(req.user!.userId);
			return res.json({ success: true, data: null });
		} catch (error) {
			next(error);
		}
	},
);

router.get(
	"/unread-count",
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const result = await notificationService.getUnreadCount(req.user!.userId);
			return res.json({ success: true, data: result });
		} catch (error) {
			next(error);
		}
	},
);

export { router as notificationRouter };
