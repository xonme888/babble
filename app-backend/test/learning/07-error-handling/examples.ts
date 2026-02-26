export {}

/**
 * 07. 계층화된 예외 처리 시스템 예제
 *
 * 실행: npx ts-node test/learning/07-error-handling/examples.ts
 */

// ============================================================
// 1. DomainException 계층 구현
// ============================================================

/**
 * 모든 도메인 예외의 기본 클래스
 * 이 프로젝트: src/shared/core/exceptions/domain-exceptions.ts
 */
abstract class ExDomainException extends Error {
    /** Minification-safe 식별자 */
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
    }
}

// --- 구체적인 예외 클래스들 ---

class ExValidationException extends ExDomainException {
    public readonly statusCode = 400
}

class ExUnauthorizedException extends ExDomainException {
    public readonly statusCode = 401
    constructor(message: string = "Unauthorized", errorCode?: string) {
        super(message, errorCode)
    }
}

class _ExForbiddenException extends ExDomainException {
    public readonly statusCode = 403
}

class ExNotFoundException extends ExDomainException {
    public readonly statusCode = 404
}

class ExConflictException extends ExDomainException {
    public readonly statusCode = 409
}

/**
 * 인프라 예외 (Redis 다운 등)
 * 이 프로젝트: src/shared/core/exceptions/infrastructure-exceptions.ts
 */
class ExServiceUnavailableException extends Error {
    public readonly isInfrastructureException = true as const
    public readonly serviceName: string

    constructor(service: string) {
        super(`${service} is currently unavailable`)
        this.name = "ExServiceUnavailableException"
        this.serviceName = service
    }
}

// ============================================================
// 2. 판별 함수 (Minification-safe)
// ============================================================

function isDomainError(error: unknown): error is ExDomainException {
    return (
        error instanceof ExDomainException ||
        (error != null &&
            typeof error === "object" &&
            "isDomainException" in error &&
            error.isDomainException === true)
    )
}

function isServiceUnavailableError(error: unknown): error is ExServiceUnavailableException {
    return (
        error instanceof ExServiceUnavailableException ||
        (error != null &&
            typeof error === "object" &&
            "isInfrastructureException" in error &&
            error.isInfrastructureException === true)
    )
}

// ============================================================
// 3. globalErrorHandler 시뮬레이션
// ============================================================

/**
 * 에러를 처리하고 HTTP 응답을 생성하는 함수
 * 이 프로젝트: src/shared/presentation/middlewares/error.handler.ts
 */
function handleError(error: Error): { status: number; body: Record<string, unknown> } {
    // 인프라 예외 (503)
    if (isServiceUnavailableError(error)) {
        console.log(`  [ERROR] 인프라 장애: ${error.message}`)
        return {
            status: 503,
            body: {
                success: false,
                message: "서비스를 일시적으로 사용할 수 없습니다",
                errorCode: "SERVICE_UNAVAILABLE",
            },
        }
    }

    // 도메인 예외 (해당 statusCode)
    if (isDomainError(error)) {
        console.log(`  [WARN] 도메인 예외: ${error.name} - ${error.message}`)
        return {
            status: error.statusCode,
            body: {
                success: false,
                message: error.message,
                errorCode: error.errorCode || error.name,
                ...(error.metadata && { metadata: error.metadata }),
            },
        }
    }

    // 알 수 없는 에러 (500)
    console.log(`  [ERROR] 알 수 없는 에러: ${error.message}`)
    return {
        status: 500,
        body: {
            success: false,
            message: "Internal Server Error",
            code: "INTERNAL_ERROR",
        },
    }
}

// ============================================================
// 4. 시뮬레이션 실행
// ============================================================

console.log("=== 예외 처리 시스템 시뮬레이션 ===\n")

// --- 1. ValidationException (400) ---
console.log("--- 1. ValidationException ---")
try {
    throw new ExValidationException("validation.email.invalid_format", "INVALID_EMAIL", {
        field: "email",
        value: "not-an-email",
    })
} catch (error: unknown) {
    const response = handleError(error as Error)
    console.log(`  응답: ${response.status} ${JSON.stringify(response.body)}\n`)
}

// --- 2. UnauthorizedException (401) ---
console.log("--- 2. UnauthorizedException ---")
try {
    throw new ExUnauthorizedException("validation.token.invalid", "INVALID_TOKEN")
} catch (error: unknown) {
    const response = handleError(error as Error)
    console.log(`  응답: ${response.status} ${JSON.stringify(response.body)}\n`)
}

// --- 3. NotFoundException (404) ---
console.log("--- 3. NotFoundException ---")
try {
    throw new ExNotFoundException("auth.user_not_found", "USER_NOT_FOUND")
} catch (error: unknown) {
    const response = handleError(error as Error)
    console.log(`  응답: ${response.status} ${JSON.stringify(response.body)}\n`)
}

// --- 4. ConflictException (409) ---
console.log("--- 4. ConflictException ---")
try {
    throw new ExConflictException("auth.email_in_use", "EMAIL_IN_USE")
} catch (error: unknown) {
    const response = handleError(error as Error)
    console.log(`  응답: ${response.status} ${JSON.stringify(response.body)}\n`)
}

// --- 5. ServiceUnavailableException (503) ---
console.log("--- 5. ServiceUnavailableException ---")
try {
    throw new ExServiceUnavailableException("Redis")
} catch (error: unknown) {
    const response = handleError(error as Error)
    console.log(`  응답: ${response.status} ${JSON.stringify(response.body)}\n`)
}

// --- 6. 일반 Error (500) ---
console.log("--- 6. 일반 Error (알 수 없는 에러) ---")
try {
    throw new Error("Something unexpected happened")
} catch (error: unknown) {
    const response = handleError(error as Error)
    console.log(`  응답: ${response.status} ${JSON.stringify(response.body)}\n`)
}

// --- 7. 도메인 로직에서 예외 사용 ---
console.log("--- 7. 도메인 로직 예제 ---")

enum ExAssessmentStatus {
    PENDING = "PENDING",
    ANALYZING = "ANALYZING",
    COMPLETED = "COMPLETED",
}

class ExAssessment {
    status: ExAssessmentStatus = ExAssessmentStatus.PENDING

    startAnalysis(): void {
        if (this.status !== ExAssessmentStatus.PENDING) {
            throw new ExValidationException(
                "assessment.invalid_status_for_analysis",
                "INVALID_ASSESSMENT_STATUS",
                { currentStatus: this.status }
            )
        }
        this.status = ExAssessmentStatus.ANALYZING
        console.log(`  상태 전이: PENDING → ANALYZING`)
    }

    completeAnalysis(): void {
        if (this.status !== ExAssessmentStatus.ANALYZING) {
            throw new ExValidationException(
                "assessment.invalid_status_for_completion",
                "INVALID_ASSESSMENT_STATUS",
                { currentStatus: this.status }
            )
        }
        this.status = ExAssessmentStatus.COMPLETED
        console.log(`  상태 전이: ANALYZING → COMPLETED`)
    }
}

const assessment = new ExAssessment()
assessment.startAnalysis()
assessment.completeAnalysis()

// COMPLETED 상태에서 다시 분석 시작 시도
try {
    assessment.startAnalysis() // ❌ COMPLETED에서는 불가
} catch (error: unknown) {
    const response = handleError(error as Error)
    console.log(`  응답: ${response.status}`)
    console.log(`  metadata: ${JSON.stringify(response.body.metadata)}`)
}

console.log("\n✅ 예외 처리 시스템 예제 완료!")
