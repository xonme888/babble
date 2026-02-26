import { injectable, inject } from "tsyringe"
import { ITokenProvider, TokenVerifyResult } from "../domain/token-provider.interface"
import { TokenRefreshPolicy } from "../domain/token-refresh-policy"
import { AuthRedisKeys, CLIENT_TYPES } from "../domain/auth-redis-keys"
import { UnauthorizedException } from "@shared/core/exceptions/domain-exceptions"
import { IRedisService } from "@shared/core/redis-service.interface"
import { IConfigService } from "@shared/core/config.interface"
import { DI_TOKENS } from "@shared/core/di-tokens"
import type { IUserRepository } from "@features/user/domain/user-repository.interface"
import type { ClientType } from "../domain/client-type"
import type { ISessionTokenManager } from "../domain/session-token-manager.interface"

/**
 * TokenRotationService (Application Service)
 *
 * 토큰 갱신/로그아웃 오케스트레이션
 * - TokenRefreshPolicy(Domain)로 상태 판정
 * - Redis로 토큰 저장/삭제
 */
@injectable()
export class TokenRotationService implements ISessionTokenManager {
    constructor(
        @inject(DI_TOKENS.ITokenProvider) private tokenProvider: ITokenProvider,
        @inject(DI_TOKENS.IRedisService) private redisService: IRedisService,
        @inject(DI_TOKENS.IConfigService) private configService: IConfigService,
        @inject(TokenRefreshPolicy) private policy: TokenRefreshPolicy,
        @inject(DI_TOKENS.IUserRepository) private userRepository: IUserRepository
    ) {}

    /** 락 획득 재시도 설정 */
    private static readonly LOCK_TTL_SECONDS = 5
    private static readonly LOCK_RETRY_COUNT = 3
    private static readonly LOCK_RETRY_DELAY_MS = 200

    /** 토큰 갱신 — 분산 락으로 동일 사용자의 동시 refresh 직렬화 */
    async refresh(
        token: string,
        clientType: ClientType
    ): Promise<{ accessToken: string; refreshToken: string }> {
        // Refresh Token 검증 (refresh 시크릿 사용)
        const result: TokenVerifyResult = this.tokenProvider.verifyToken(token, "refresh")
        if (!result.valid) {
            const errorCode =
                result.reason === "expired" ? "EXPIRED_REFRESH_TOKEN" : "INVALID_REFRESH_TOKEN"
            throw new UnauthorizedException("validation.token.invalid_refresh", errorCode)
        }

        const { userId } = result.payload
        const lockKey = AuthRedisKeys.refreshLock(userId, clientType)

        // 분산 락 획득 (재시도 포함)
        let unlock: (() => Promise<void>) | null = null
        for (let i = 0; i < TokenRotationService.LOCK_RETRY_COUNT; i++) {
            unlock = await this.redisService.acquireLock(lockKey, TokenRotationService.LOCK_TTL_SECONDS)
            if (unlock) break
            await new Promise((r) => setTimeout(r, TokenRotationService.LOCK_RETRY_DELAY_MS))
        }

        if (!unlock) {
            throw new UnauthorizedException("validation.token.refresh_busy", "REFRESH_BUSY")
        }

        try {
            return await this.refreshInternal(token, userId, clientType)
        } finally {
            await unlock()
        }
    }

    /** 락 내부에서 실행되는 토큰 갱신 로직 */
    private async refreshInternal(
        token: string,
        userId: number,
        clientType: ClientType
    ): Promise<{ accessToken: string; refreshToken: string }> {
        const redisKey = AuthRedisKeys.refreshToken(userId, clientType)

        // Redis에서 현재 토큰 + grace period 이전 토큰 조회
        const storedToken = await this.redisService.getRequired(redisKey)
        const prevToken = await this.redisService.getRequired(
            AuthRedisKeys.refreshTokenPrev(userId, clientType)
        )

        // 도메인 정책으로 토큰 상태 판정
        const status = this.policy.determineTokenStatus(storedToken, prevToken, token)

        // refresh 시 role이 필요 — DB 조회 1회 (15분에 1회이므로 성능 영향 무시)
        const user = await this.userRepository.findById(userId)
        if (!user) {
            throw new UnauthorizedException("auth.user_not_found")
        }

        switch (status) {
            case "current":
                return this.rotateTokens(userId, clientType, token, user.role)
            case "previous": {
                // 이미 로테이션된 새 토큰 반환 (grace period 내 재시도)
                if (!storedToken) {
                    throw new UnauthorizedException("validation.token.invalid", "TOKEN_INVALID")
                }
                const accessToken = this.tokenProvider.generateAccessToken(userId, user.role)
                return { accessToken, refreshToken: storedToken }
            }
            case "revoked":
                throw new UnauthorizedException("validation.token.revoked", "TOKEN_REVOKED")
        }
    }

    /** Token Rotation: 새 토큰 생성 + 이전 토큰을 grace period 키에 보관 */
    private async rotateTokens(
        userId: number,
        clientType: ClientType,
        previousToken: string,
        role?: string
    ): Promise<{ accessToken: string; refreshToken: string }> {
        const accessToken = this.tokenProvider.generateAccessToken(userId, role)
        const refreshToken = this.tokenProvider.generateRefreshToken(userId)
        const redisKey = AuthRedisKeys.refreshToken(userId, clientType)

        // 이전 토큰을 grace period 키에 저장
        await this.redisService.setRequired(
            AuthRedisKeys.refreshTokenPrev(userId, clientType),
            previousToken,
            TokenRefreshPolicy.GRACE_PERIOD_SECONDS
        )

        // 새 토큰으로 교체
        await this.redisService.setRequired(
            redisKey,
            refreshToken,
            this.configService.config.auth.refreshTokenTTL
        )

        return { accessToken, refreshToken }
    }

    /** 로그아웃 (특정 클라이언트 타입만) */
    async revoke(accessToken: string, clientType: ClientType): Promise<void> {
        const result = this.tokenProvider.verifyToken(accessToken)
        if (!result.valid) {
            // 의도적 skip: 만료/무효 토큰의 로그아웃 요청에 200 응답하여 토큰 유효 여부 노출 방지
            return
        }

        const { userId, exp } = result.payload

        // 해당 클라이언트 타입의 Refresh Token + grace period 키만 삭제
        await this.redisService.deleteRequired(AuthRedisKeys.refreshToken(userId, clientType))
        await this.redisService.deleteRequired(AuthRedisKeys.refreshTokenPrev(userId, clientType))

        await this.blacklistAccessToken(accessToken, exp)
    }

    /** 전체 로그아웃 (모든 클라이언트 세션 종료) */
    async revokeAll(accessToken: string): Promise<void> {
        const result = this.tokenProvider.verifyToken(accessToken)
        if (!result.valid) {
            // 의도적 skip: 만료/무효 토큰의 전체 로그아웃 요청에 200 응답하여 토큰 유효 여부 노출 방지
            return
        }

        const { userId, exp } = result.payload

        // 모든 클라이언트 타입의 Refresh Token 삭제
        await this.clearAllClientTokens(userId)

        await this.blacklistAccessToken(accessToken, exp)
    }

    /** Access Token을 블랙리스트에 추가 (남은 TTL만큼) */
    private async blacklistAccessToken(accessToken: string, exp: number | undefined): Promise<void> {
        const ttl = (exp ?? 0) - Math.floor(Date.now() / 1000)
        if (ttl > 0) {
            await this.redisService.setRequired(AuthRedisKeys.blacklist(accessToken), "1", ttl)
        }
    }

    /** 모든 클라이언트 타입의 Refresh Token + Grace period 키 삭제 */
    async clearAllClientTokens(userId: number): Promise<void> {
        await Promise.all(
            CLIENT_TYPES.flatMap((ct) => [
                this.redisService.deleteRequired(AuthRedisKeys.refreshToken(userId, ct)),
                this.redisService.deleteRequired(AuthRedisKeys.refreshTokenPrev(userId, ct)),
            ])
        )
    }
}
