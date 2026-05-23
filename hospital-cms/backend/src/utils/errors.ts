export class AppError extends Error {
	public readonly statusCode: number;
	public readonly isOperational: boolean;

	constructor(message: string, statusCode: number) {
		super(message);

		this.name = this.constructor.name;
		this.statusCode = statusCode;
		this.isOperational = true;

		Object.setPrototypeOf(this, new.target.prototype);
		const captureStackTrace = (Error as ErrorConstructor & {
			captureStackTrace?: (targetObject: object, constructorOpt?: Function) => void;
		}).captureStackTrace;

		captureStackTrace?.(this, this.constructor);
	}
}

export class BadRequestError extends AppError {
	constructor(message: string) {
		super(message, 400);
	}
}

export class UnauthorizedError extends AppError {
	constructor(message: string) {
		super(message, 401);
	}
}

export class ForbiddenError extends AppError {
	constructor(message: string) {
		super(message, 403);
	}
}

export class NotFoundError extends AppError {
	constructor(message: string) {
		super(message, 404);
	}
}

export class ConflictError extends AppError {
	constructor(message: string) {
		super(message, 409);
	}
}
