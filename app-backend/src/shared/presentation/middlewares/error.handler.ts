import { Request, Response, NextFunction } from "express"
import { DomainException } from "@shared/core/exceptions/domain-exceptions"
import { ServiceUnavailableException } from "@shared/core/exceptions/infrastructure-exceptions"
import { ErrorCodes } from "@shared/core/constants/error-codes"
import { ILogger } from "@shared/core/logger.interface"
import { DI_TOKENS } from "@shared/core/di-tokens"
import { container } from "tsyringe"

/**
 * Non-Error 객체를 안전하게 문자열로 변환
 * throw "string" / throw { code: 123 } / throw null 등 모든 케이스 처리
 */
function toErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message
    if (typeof error === "string") return error
    if (error === null || error === undefined) return "Unknown error (null/undefined)"
    try {
        return JSON.stringify(error)
    } catch {
        return String(error)
    }
}

/** HTTP 상태 코드 상수 */
const HTTP_STATUS = {
    BAD_REQUEST: 400,
    INTERNAL_SERVER_ERROR: 500,
    SERVICE_UNAVAILABLE: 503,
} as const

/**
 * Minification-safe 도메인 예외 판별
 * instanceof와 isDomainException 플래그를 함께 사용
 */
function isDomainError(error: unknown): error is DomainException {
    return (
        error instanceof DomainException ||
        (error !== null &&
            error !== undefined &&
            typeof error === "object" &&
            "isDomainException" in error &&
            (error as DomainException).isDomainException === true)
    )
}

function isServiceUnavailableError(
    error: unknown
): error is ServiceUnavailableException {
    return (
        error instanceof ServiceUnavailableException ||
        (error !== null &&
            error !== undefined &&
            typeof error === "object" &&
            "isInfrastructureException" in error &&
            (error as ServiceUnavailableException).isInfrastructureException === true)
    )
}

export function globalErrorHandler(
    error: unknown,
    req: Request,
    res: Response,
    _next: NextFunction
) {
    const logger = container.resolve<ILogger>(DI_TOKENS.ILogger)

    // 에러 로그 공통 컨텍스트 — 프로덕션에서 에러 추적 가능하도록 method, url 포함
    const reqCtx = { method: req.method, url: req.originalUrl }

    // 인프라 예외 처리 (Redis 등 필수 서비스 미연결)
    if (isServiceUnavailableError(error)) {
        logger.error(`Service Unavailable: ${error.message}`, error, reqCtx)
        const message = req.t
            ? req.t("error.service_unavailable")
            : "Service temporarily unavailable"
        return res.status(HTTP_STATUS.SERVICE_UNAVAILABLE).json({
            success: false,
            message,
            errorCode: ErrorCodes.SERVICE_UNAVAILABLE,
        })
    }

    // JSON 파싱 에러 (잘못된 요청 body)
    if (error instanceof SyntaxError && "status" in error && (error as Record<string, unknown>).status === HTTP_STATUS.BAD_REQUEST) {
        logger.warn(`JSON Parse Error: ${error.message}`, reqCtx)
        const message = req.t ? req.t("error.invalid_json") : "Invalid JSON in request body"
        return res.status(HTTP_STATUS.BAD_REQUEST).json({
            success: false,
            message,
            errorCode: ErrorCodes.VALIDATION_ERROR,
            errorKey: "error.invalid_json",
        })
    }

    // 도메인 예외 처리 (statusCode가 각 예외 클래스에 내장)
    if (isDomainError(error)) {
        const status = error.statusCode || HTTP_STATUS.BAD_REQUEST

        logger.warn(`Domain Exception: ${error.message}`, {
            ...reqCtx,
            type: error.name,
            statusCode: status,
        })

        // i18n 번역 적용
        const message = req.t ? req.t(error.message) : error.message

        return res.status(status).json({
            success: false,
            message: message,
            errorCode: error.errorCode || error.name,
            errorKey: error.message,
            ...(error.metadata && { metadata: error.metadata }),
        })
    }

    // 알 수 없는 서버 에러 (non-Error 객체 방어)
    const errorMessage = toErrorMessage(error)
    logger.error(
        `Unhandled Exception: ${errorMessage}`,
        error instanceof Error ? error : undefined,
        reqCtx
    )

    const message = req.t ? req.t("error.default") : "Internal Server Error"

    return res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: message,
        errorCode: ErrorCodes.INTERNAL_ERROR,
        errorKey: "error.default",
    })
}
