import { Prisma, type Notification as PrismaNotification } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { ForbiddenError, NotFoundError } from "../../utils/errors.js";

export type Notification = PrismaNotification;

export class NotificationService {
	async createNotification(
		userId: string,
		title: string,
		message: string,
		type: string,
	): Promise<Notification | null> {
		try {
			return await prisma.notification.create({
				data: {
					userId,
					title,
					message,
					type,
				},
			});
		} catch (error) {
			console.error("Failed to create notification", error);
			return null;
		}
	}

	async getNotificationsForUser(userId: string): Promise<Notification[]> {
		return prisma.notification.findMany({
			where: { userId },
			orderBy: { createdAt: "desc" },
			take: 50,
		});
	}

	async markAsRead(notificationId: string, userId: string): Promise<Notification> {
		const notification = await prisma.notification.findUnique({
			where: { id: notificationId },
		});

		if (!notification) {
			throw new NotFoundError("Notification not found");
		}

		if (notification.userId !== userId) {
			throw new ForbiddenError("You are not allowed to modify this notification");
		}

		return prisma.notification.update({
			where: { id: notificationId },
			data: {
				isRead: true,
				readAt: new Date(),
			},
		});
	}

	async markAllAsRead(userId: string): Promise<void> {
		await prisma.notification.updateMany({
			where: {
				userId,
				isRead: false,
			},
			data: {
				isRead: true,
				readAt: new Date(),
			},
		});
	}

	async getUnreadCount(userId: string): Promise<number> {
		return prisma.notification.count({
			where: {
				userId,
				isRead: false,
			},
		});
	}
}
