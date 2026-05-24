import { Router, type NextFunction, type Request, type Response } from "express";
import { AuthService } from "./auth.service.js";
import { authenticate } from "../../middleware/auth.middleware.js";

const router = Router();
const authService = new AuthService();

const cookieOptions = {
	httpOnly: true,
	sameSite: "lax" as const,
	secure: process.env.NODE_ENV === "production",
	path: "/",
};

router.post("/register", async (req: Request, res: Response, next: NextFunction) => {
	try {
		const result = await authService.register(req.body);
		return res.status(201).json({ success: true, data: result });
	} catch (error) {
		next(error);
	}
});

router.post("/login", async (req: Request, res: Response, next: NextFunction) => {
	try {
		const { email, password } = req.body;
		const result = await authService.login(email, password);
		res.cookie("refreshToken", result.refreshToken, cookieOptions);
		return res.json({ success: true, data: result });
	} catch (error) {
		next(error);
	}
});

router.post("/refresh", async (req: Request, res: Response, next: NextFunction) => {
	try {
		const refreshToken = req.cookies?.refreshToken;
		const result = await authService.refreshTokens(refreshToken);
		res.cookie("refreshToken", result.refreshToken, cookieOptions);
		return res.json({ success: true, data: result });
	} catch (error) {
		next(error);
	}
});

router.post(
	"/logout",
	authenticate,
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const refreshToken = req.cookies?.refreshToken;
			await authService.logout(refreshToken);
			res.clearCookie("refreshToken", { ...cookieOptions, maxAge: undefined });
			return res.json({ success: true, data: null });
		} catch (error) {
			next(error);
		}
	},
);

export { router as authRouter };
