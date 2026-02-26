import { injectable, inject } from "tsyringe"
import { DI_TOKENS } from "@shared/core/di-tokens"
import { IRedisService } from "@shared/core/redis-service.interface"
import { ILogger } from "@shared/core/logger.interface"
import { RATE_LIMIT_POLICIES } from "@shared/core/rate-limit-policies"
import type { RateLimitPolicy } from "@shared/core/rate-limit-policies"
import type { IConfigService } from "@shared/core/config.interface"

const FAIL_CLOSED_RESET_SECONDS = 60

const RATE_LIMIT_UNLIMITED = 999

@injectable()
export class RateLimitService {
    private policies: Record<string, RateLimitPolicy> = RATE_LIMIT_POLICIES

    constructor(
        @inject(DI_TOKENS.IRedisService) private redisService: IRedisService,
        @inject(DI_TOKENS.ILogger) private logger: ILogger,
        @inject(DI_TOKENS.IConfigService) private configService: IConfigService
    ) {}

    /**
     * Rate Limit 체크 및 카운터 증가
     * 원자적 INCR 패턴 — get→set 레이스 컨디션 방지
     * Redis 장애 시 fail-closed (요청 차단)
     */
    async checkAndIncrement(
        action: string,
        identifier: string
    ): Promise<{ allowed: boolean; remainingAttempts: number; resetTimeSeconds: number }> {
        const policy = this.policies[action]
        if (!policy) {
            this.logger.warn(`[RateLimitService] 미등록 rate limit 정책: ${action}`)
            // Production에서는 fail-closed (미등록 정책은 차단)
            if (this.configService.config.env === "production") {
                return { allowed: false, remainingAttempts: 0, resetTimeSeconds: FAIL_CLOSED_RESET_SECONDS }
            }
            return { allowed: true, remainingAttempts: RATE_LIMIT_UNLIMITED, resetTimeSeconds: 0 }
        }

        try {
            const key = `ratelimit:${action}:${identifier}`

            // 원자적 INCR + EXPIRE — 첫 요청 시 TTL 자동 설정
            const count = await this.redisService.incrWithExpire(key, policy.windowSeconds)

            if (count > policy.maxAttempts) {
                // 제한 초과 — ttl은 정보성이므로 graceful 메서드 사용
                const ttl = await this.redisService.ttl(key)
                return {
                    allowed: false,
                    remainingAttempts: 0,
                    resetTimeSeconds: ttl > 0 ? ttl : policy.windowSeconds,
                }
            }

            const ttl = await this.redisService.ttl(key)
            return {
                allowed: true,
                remainingAttempts: policy.maxAttempts - count,
                resetTimeSeconds: ttl > 0 ? ttl : policy.windowSeconds,
            }
        } catch (err: unknown) {
            // Redis 장애 시 fail-closed
            this.logger.error(
                `[RateLimitService] Redis error during checkAndIncrement: ${err instanceof Error ? err.message : String(err)}`
            )
            return { allowed: false, remainingAttempts: 0, resetTimeSeconds: FAIL_CLOSED_RESET_SECONDS }
        }
    }

    /**
     * Rate Limit 리셋 (관리자 기능)
     */
    async reset(action: string, identifier: string): Promise<void> {
        const key = `ratelimit:${action}:${identifier}`
        await this.redisService.delete(key)
    }

    /**
     * 현재 상태 조회
     */
    async getStatus(
        action: string,
        identifier: string
    ): Promise<{ attempts: number; maxAttempts: number; resetTimeSeconds: number }> {
        const policy = this.policies[action]
        if (!policy) {
            return { attempts: 0, maxAttempts: RATE_LIMIT_UNLIMITED, resetTimeSeconds: 0 }
        }

        const key = `ratelimit:${action}:${identifier}`
        const currentCount = await this.redisService.get(key)
        const ttl = await this.redisService.ttl(key)

        return {
            attempts: currentCount ? parseInt(currentCount, 10) : 0,
            maxAttempts: policy.maxAttempts,
            resetTimeSeconds: ttl > 0 ? ttl : 0,
        }
    }
}
