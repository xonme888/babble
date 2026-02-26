import { Request, Response, NextFunction } from "express"
import { container } from "tsyringe"
import {
    ITokenProvider,
    TokenVerifyResult,
} from "../../domain/token-provider.interface"
import { UnauthorizedException } from "@shared/core/exceptions/domain-exceptions"
import { IRedisService } from "@shared/core/redis-service.interface"
import { ILogger } from "@shared/core/logger.interface"
import { DI_TOKENS } from "@shared/core/di-tokens"
import { AuthRedisKeys } from "../../domain/auth-redis-keys"

/**
 * JWT 인증 미들웨어 (Auth Feature)
 * - 요청 헤더의 Authorization: Bearer <token> 을 파싱하여 검증
 */
export async function authGuard(req: Request, res: Response, next: NextFunction) {
    const tokenProvider = container.resolve<ITokenProvider>(DI_TOKENS.ITokenProvider)
    const logger = container.resolve<ILogger>(DI_TOKENS.ILogger)

    let token = ""
    const authHeader = req.headers.authorization
    if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1]
    }

    if (!token) {
        return next(new UnauthorizedException("validation.token.missing"))
    }

    // 로그아웃 블랙리스트 확인 (Redis 장애 시 fail-closed)
    try {
        const redisService = container.resolve<IRedisService>(DI_TOKENS.IRedisService)
        const isBlacklisted = await redisService.existsRequired(AuthRedisKeys.blacklist(token))
        if (isBlacklisted) {
            return next(new UnauthorizedException("validation.token.revoked"))
        }
    } catch (error) {
        // Redis 장애 시 요청 거부 (fail-closed: 블랙리스트 검사 불가 시 안전하게 차단)
        logger.error("Redis unavailable for blacklist check, rejecting request", { error })
        return next(new UnauthorizedException("auth.service_unavailable"))
    }

    // 토큰 검증 — 만료/무효 구분 (이슈 5)
    const result: TokenVerifyResult = tokenProvider.verifyToken(token)

    if (!result.valid) {
        const errorKey =
            result.reason === "expired" ? "validation.token.expired" : "validation.token.invalid"
        return next(new UnauthorizedException(errorKey))
    }

    // 요청 객체에 유저 정보 첨부 (req.user)
    logger.debug(`AuthGuard: Accessing ${req.method} ${req.path} for user ${result.payload.userId}`)
    req.user = { id: result.payload.userId, role: result.payload.role }
    next()
}
