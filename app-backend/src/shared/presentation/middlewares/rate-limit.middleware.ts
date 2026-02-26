import { Request, Response, NextFunction } from "express"
import { container } from "tsyringe"
import { RateLimitService } from "@shared/core/rate-limit.service"
import { ILogger } from "@shared/core/logger.interface"
import { DI_TOKENS } from "@shared/core/di-tokens"

/**
 * Rate Limiting 미들웨어 팩토리
 *
 * RateLimitService를 Express 미들웨어로 래핑
 * @param action - Rate limit 정책 이름 (e.g. 'login-attempt', 'registration')
 * @param identifierFn - 요청에서 식별자를 추출하는 함수 (기본값: req.ip)
 */
export function rateLimitMiddleware(action: string, identifierFn?: (req: Request) => string) {
    return async (req: Request, res: Response, next: NextFunction) => {
        const rateLimitService = container.resolve(RateLimitService)
        const identifier = identifierFn ? identifierFn(req) : req.ip || "unknown"

        let result
        try {
            result = await rateLimitService.checkAndIncrement(action, identifier)
        } catch (error) {
            // Redis 장애 시 fail-open — 요청 허용하되 경고 로그
            const logger = container.resolve<ILogger>(DI_TOKENS.ILogger)
            logger.warn(`[RateLimit] Redis unavailable for action=${action}, fail-open`, error)
            return next()
        }

        res.setHeader("X-RateLimit-Remaining", result.remainingAttempts.toString())
        res.setHeader("X-RateLimit-Reset", result.resetTimeSeconds.toString())

        if (!result.allowed) {
            res.setHeader("Retry-After", result.resetTimeSeconds.toString())
            return res.status(429).json({
                success: false,
                message: "Too many requests. Please try again later.",
                retryAfter: result.resetTimeSeconds,
            })
        }

        next()
    }
}
