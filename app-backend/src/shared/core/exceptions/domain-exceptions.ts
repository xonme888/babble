export abstract class DomainException extends Error {
    /** Minification-safe 식별자: instanceof 대신 이 플래그로 도메인 예외 판별 */
    public readonly isDomainException = true as const
    public readonly errorCode?: string
    public readonly metadata?: Record<string, unknown>
    /** HTTP 상태 코드 (서브클래스에서 오버라이드) */
    public readonly statusCode: number = 400

    constructor(message: string, errorCode?: string, metadata?: Record<string, unknown>) {
        super(message)
        this.name = this.constructor.name
        this.errorCode = errorCode
        this.metadata = metadata
        Object.setPrototypeOf(this, new.target.prototype)
        Error.captureStackTrace(this, this.constructor)
    }
}

export class ValidationException extends DomainException {
    public readonly statusCode = 400
    constructor(message: string, errorCode?: string, metadata?: Record<string, unknown>) {
        super(message, errorCode, metadata)
    }
}

export class ConflictException extends DomainException {
    public readonly statusCode = 409
    constructor(message: string, errorCode?: string, metadata?: Record<string, unknown>) {
        super(message, errorCode, metadata)
    }
}

export class UnauthorizedException extends DomainException {
    public readonly statusCode = 401
    constructor(
        message: string = "Unauthorized access",
        errorCode?: string,
        metadata?: Record<string, unknown>
    ) {
        super(message, errorCode, metadata)
    }
}

export class NotFoundException extends DomainException {
    public readonly statusCode = 404
    constructor(
        message: string = "Resource not found",
        errorCode?: string,
        metadata?: Record<string, unknown>
    ) {
        super(message, errorCode, metadata)
    }

    /** 리소스 타입 + 식별자로 Not Found 예외 생성 */
    static forResource(resource: string, identifier: string): NotFoundException {
        return new NotFoundException(`${resource} with identifier ${identifier} was not found.`)
    }
}

export class ForbiddenException extends DomainException {
    public readonly statusCode = 403
    constructor(
        message: string = "Access denied",
        errorCode?: string,
        metadata?: Record<string, unknown>
    ) {
        super(message, errorCode, metadata)
    }
}

/**
 * Email verification required exception
 * Thrown when user attempts to login without verifying their email
 */
export class EmailNotVerifiedException extends ForbiddenException {
    constructor(email: string, canResendCode: boolean = true, resendCooldownSeconds: number = 60) {
        // Mask email for security (show first character and domain)
        const maskedEmail = email.replace(/^(.)(.*)(@.*)$/, (_, first, middle, domain) => {
            return first + "*".repeat(Math.min(middle.length, 3)) + domain
        })

        super("auth.email_not_verified", "EMAIL_NOT_VERIFIED", {
            email: maskedEmail,
            canResendCode,
            resendAvailableAt: new Date(Date.now() + resendCooldownSeconds * 1000).toISOString(),
        })
    }
}

/**
 * Account suspended exception
 * Thrown when user account has been suspended by admin
 */
export class AccountSuspendedException extends ForbiddenException {
    constructor(reason?: string) {
        super("auth.account_suspended", "ACCOUNT_SUSPENDED", { reason })
    }
}

/**
 * Account locked exception
 * Thrown when account is temporarily locked (e.g., too many failed login attempts)
 */
export class AccountLockedException extends ForbiddenException {
    constructor(unlockAt?: Date) {
        super("auth.account_locked", "ACCOUNT_LOCKED", {
            unlockAt: unlockAt?.toISOString(),
        })
    }
}
