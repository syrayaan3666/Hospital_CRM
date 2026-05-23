import type { NextFunction, Request, Response, RequestHandler } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { Role } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export interface AuthenticatedUser {
	userId: string;
	role: Role;
	email: string;
}

declare global {
	namespace Express {
		interface Request {
			user?: AuthenticatedUser;
		}
	}
}

type TokenPayload = AuthenticatedUser & JwtPayload;

const unauthorized = (res: Response, message: string) =>
	res.status(401).json({ message });

const extractBearerToken = (header: string | undefined): string | null => {
	if (!header?.startsWith("Bearer ")) {
		return null;
	}

	const token = header.slice(7).trim();
	return token.length > 0 ? token : null;
};

export const authenticate: RequestHandler = async (
	req: Request,
	res: Response,
	next: NextFunction,
) => {
	const token = extractBearerToken(req.headers.authorization);

	if (!token) {
		return unauthorized(res, "Authorization token is missing or invalid");
	}

	const secret = process.env.JWT_SECRET;

	if (!secret) {
		return res.status(500).json({ message: "JWT_SECRET is not configured" });
	}

	let payload: TokenPayload;

	try {
		const decoded = jwt.verify(token, secret);

		if (typeof decoded !== "object" || decoded === null) {
			return unauthorized(res, "Authorization token is missing or invalid");
		}

		payload = decoded as TokenPayload;

		if (
			typeof payload.userId !== "string" ||
			typeof payload.role !== "string" ||
			typeof payload.email !== "string"
		) {
			return unauthorized(res, "Authorization token is missing or invalid");
		}
	} catch {
		return unauthorized(res, "Authorization token is missing or invalid");
	}

	const user = await prisma.user.findUnique({
		where: { id: payload.userId },
		select: {
			id: true,
			role: true,
			email: true,
			isActive: true,
		},
	});

	if (!user || !user.isActive) {
		return unauthorized(res, "User not found or inactive");
	}

	req.user = {
		userId: user.id,
		role: user.role,
		email: user.email,
	};

	return next();
};

