import {
	AppError,
	BadRequestError,
	ForbiddenError,
	UnauthorizedError,
} from "../../utils/errors.js";
import { BloodGroup, Gender, Role, type User as PrismaUser } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../../lib/prisma.js";

export interface RegisterDto {
	email: string;
	password: string;
	firstName: string;
	lastName: string;
	phone?: string;
	role: Role;
	isActive?: boolean;
	patient?: {
		medicalRecordNumber?: string;
		firstName?: string;
		lastName?: string;
		gender?: Gender;
		dateOfBirth?: Date | string;
		bloodGroup?: BloodGroup | null;
		phone?: string | null;
		email?: string | null;
		address?: string | null;
		emergencyContactName?: string | null;
		emergencyContactPhone?: string | null;
		allergies?: string[];
		chronicConditions?: string[];
	};
}

export interface TokenPair {
	accessToken: string;
	refreshToken: string;
	user: User;
}

export type User = Omit<PrismaUser, "passwordHash">;

type RefreshTokenPayload = {
	userId: string;
	role: Role;
	email: string;
};

type AccessTokenPayload = RefreshTokenPayload;

type StoredRefreshToken = {
	id: string;
	tokenHash: string;
	expiresAt: Date;
};

export class AuthService {
	async register(data: RegisterDto): Promise<User> {
		const passwordHash = await bcrypt.hash(data.password, 12);

		const patientData = data.role === Role.PATIENT ? data.patient : undefined;
		const patientDateOfBirth = patientData?.dateOfBirth;
		const patientGender = patientData?.gender;

		if (data.role === Role.PATIENT && (!patientGender || !patientDateOfBirth)) {
			throw new BadRequestError(
				"Patient registration requires gender and dateOfBirth",
			);
		}

		const createdUser = await prisma.user.create({
			data: {
				email: data.email,
				passwordHash,
				role: data.role,
				firstName: data.firstName,
				lastName: data.lastName,
				phone: data.phone,
				isActive: data.isActive ?? true,
				patient:
					data.role === Role.PATIENT
						? {
							create: {
								medicalRecordNumber:
									patientData?.medicalRecordNumber ??
									`MRN-${Date.now()}-${this.createId().slice(0, 8)}`,
								firstName: patientData?.firstName ?? data.firstName,
								lastName: patientData?.lastName ?? data.lastName,
								gender: patientGender!,
								dateOfBirth: new Date(patientDateOfBirth!),
								bloodGroup: patientData?.bloodGroup,
								phone: patientData?.phone ?? data.phone ?? null,
								email: patientData?.email ?? data.email,
								address: patientData?.address ?? null,
								emergencyContactName: patientData?.emergencyContactName ?? null,
								emergencyContactPhone: patientData?.emergencyContactPhone ?? null,
								allergies: patientData?.allergies ?? [],
								chronicConditions: patientData?.chronicConditions ?? [],
							},
						}
						: undefined,
			},
		});

		return this.stripPasswordHash(createdUser);
	}

	async login(email: string, password: string): Promise<TokenPair> {
		const user = await prisma.user.findUnique({
			where: { email },
		});

		if (!user) {
			throw new UnauthorizedError("Invalid email or password");
		}

		const passwordMatches = await bcrypt.compare(password, user.passwordHash);

		if (!passwordMatches) {
			throw new UnauthorizedError("Invalid email or password");
		}

		if (!user.isActive) {
			throw new ForbiddenError("User account is inactive");
		}

		const { accessToken, refreshToken } = await this.generateTokenPair(
			user.id,
			user.role,
			user.email,
		);

		await prisma.refreshToken.create({
			data: {
				userId: user.id,
				tokenHash: await bcrypt.hash(refreshToken, 12),
				expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
			},
		});

		return {
			accessToken,
			refreshToken,
			user: this.stripPasswordHash(user),
		};
	}

	async refreshTokens(refreshToken: string): Promise<TokenPair> {
		const payload = this.verifyRefreshToken(refreshToken);

		const storedTokens = await prisma.refreshToken.findMany({
			where: {
				userId: payload.userId,
				revokedAt: null,
			},
		});

		const matchedToken = await this.findMatchingRefreshToken(
			refreshToken,
			storedTokens,
		);

		if (!matchedToken) {
			throw new UnauthorizedError("Refresh token is invalid or revoked");
		}

		if (matchedToken.expiresAt.getTime() <= Date.now()) {
			throw new UnauthorizedError("Refresh token has expired");
		}

		const user = await prisma.user.findUnique({
			where: { id: payload.userId },
		});

		if (!user) {
			throw new UnauthorizedError("User not found");
		}

		if (!user.isActive) {
			throw new ForbiddenError("User account is inactive");
		}

		const { accessToken, refreshToken: nextRefreshToken } =
			await this.generateTokenPair(user.id, user.role, user.email);

		await prisma.$transaction([
			prisma.refreshToken.update({
				where: { id: matchedToken.id },
				data: { revokedAt: new Date() },
			}),
			prisma.refreshToken.create({
				data: {
					userId: user.id,
					tokenHash: await bcrypt.hash(nextRefreshToken, 12),
					expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
				},
			}),
		]);

		return {
			accessToken,
			refreshToken: nextRefreshToken,
			user: this.stripPasswordHash(user),
		};
	}

	async logout(refreshToken: string): Promise<void> {
		const payload = this.verifyRefreshToken(refreshToken);

		const storedTokens = await prisma.refreshToken.findMany({
			where: {
				userId: payload.userId,
				revokedAt: null,
			},
		});

		const matchedToken = await this.findMatchingRefreshToken(
			refreshToken,
			storedTokens,
		);

		if (!matchedToken) {
			throw new UnauthorizedError("Refresh token is invalid or revoked");
		}

		await prisma.refreshToken.update({
			where: { id: matchedToken.id },
			data: { revokedAt: new Date() },
		});
	}

	private async generateTokenPair(
		userId: string,
		role: Role,
		email: string,
	): Promise<{ accessToken: string; refreshToken: string }> {
		const accessPayload: AccessTokenPayload = { userId, role, email };
		const refreshPayload: RefreshTokenPayload & { jti: string } = {
			userId,
			role,
			email,
			jti: this.createId(),
		};

		const jwtSecret = this.requireEnv("JWT_SECRET");
		const jwtRefreshSecret = this.requireEnv("JWT_REFRESH_SECRET");

		return {
			accessToken: jwt.sign(accessPayload, jwtSecret, { expiresIn: "15m" }),
			refreshToken: jwt.sign(refreshPayload, jwtRefreshSecret, { expiresIn: "7d" }),
		};
	}

	private verifyRefreshToken(refreshToken: string): RefreshTokenPayload {
		const jwtRefreshSecret = this.requireEnv("JWT_REFRESH_SECRET");

		try {
			const payload = jwt.verify(
				refreshToken,
				jwtRefreshSecret,
			) as RefreshTokenPayload;
			return {
				userId: payload.userId,
				role: payload.role,
				email: payload.email,
			};
		} catch {
			throw new UnauthorizedError("Refresh token is invalid or expired");
		}
	}

	private async findMatchingRefreshToken(
		refreshToken: string,
		tokens: StoredRefreshToken[],
	) {
		for (const token of tokens) {
			if (await bcrypt.compare(refreshToken, token.tokenHash)) {
				return token;
			}
		}

		return null;
	}

	private stripPasswordHash(user: PrismaUser): User {
		const { passwordHash, ...safeUser } = user;
		return safeUser;
	}

	private requireEnv(name: string): string {
		const value = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env[name];

		if (!value) {
			throw new AppError(`${name} is not configured`, 500);
		}

		return value;
	}

	private createId(): string {
		return `${Date.now()}-${Math.random().toString(16).slice(2)}-${Math.random().toString(16).slice(2)}`;
	}
}
