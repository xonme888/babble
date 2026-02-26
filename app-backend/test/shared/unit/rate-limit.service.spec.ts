import "reflect-metadata"

import { RateLimitService } from "@shared/core/rate-limit.service"
import { createMockRedisService, createMockLogger } from "../../utils/mock-factories"

import type { IRedisService } from "@shared/core/redis-service.interface"
import type { IConfigService } from "@shared/core/config.interface"

describe("RateLimitService (Rate Limit 서비스)", () => {
    let rateLimitService: RateLimitService
    let redisService: jest.Mocked<IRedisService>

    beforeEach(() => {
        redisService = createMockRedisService()
        const mockLogger = createMockLogger()
        const mockConfigService = { config: { env: "test" } } as unknown as IConfigService
        rateLimitService = new RateLimitService(redisService, mockLogger, mockConfigService)
    })

    describe("checkAndIncrement (제한 체크 및 카운터 증가)", () => {
        it("알 수 없는 정책이면 허용하고 remainingAttempts 999를 반환한다", async () => {
            // Given
            const unknownAction = "unknown-action"
            const identifier = "user@example.com"

            // When
            const result = await rateLimitService.checkAndIncrement(unknownAction, identifier)

            // Then
            expect(result).toEqual({
                allowed: true,
                remainingAttempts: 999,
                resetTimeSeconds: 0,
            })
            expect(redisService.incrWithExpire).not.toHaveBeenCalled()
        })

        it("첫 시도이면 카운터를 1로 설정하고 허용한다", async () => {
            // Given
            const action = "verification-resend"
            const identifier = "user@example.com"
            redisService.incrWithExpire.mockResolvedValue(1)
            redisService.ttl.mockResolvedValue(300)

            // When
            const result = await rateLimitService.checkAndIncrement(action, identifier)

            // Then
            expect(result).toEqual({
                allowed: true,
                remainingAttempts: 2, // maxAttempts(3) - 1
                resetTimeSeconds: 300,
            })
            expect(redisService.incrWithExpire).toHaveBeenCalledWith(
                "ratelimit:verification-resend:user@example.com",
                300
            )
        })

        it("제한 내 시도이면 카운터를 증가시키고 허용한다", async () => {
            // Given
            const action = "login-attempt"
            const identifier = "192.168.1.1"
            redisService.incrWithExpire.mockResolvedValue(3) // 현재 3회
            redisService.ttl.mockResolvedValue(600)

            // When
            const result = await rateLimitService.checkAndIncrement(action, identifier)

            // Then
            expect(result).toEqual({
                allowed: true,
                remainingAttempts: 2, // maxAttempts(5) - 3
                resetTimeSeconds: 600,
            })
        })

        it("제한 횟수에 도달하면 마지막 요청은 허용한다 (INCR 후 count === maxAttempts)", async () => {
            // Given
            const action = "verification-resend"
            const identifier = "user@example.com"
            redisService.incrWithExpire.mockResolvedValue(3) // maxAttempts(3)에 도달
            redisService.ttl.mockResolvedValue(120)

            // When
            const result = await rateLimitService.checkAndIncrement(action, identifier)

            // Then
            expect(result).toEqual({
                allowed: true,
                remainingAttempts: 0,
                resetTimeSeconds: 120,
            })
        })

        it("제한 횟수를 초과하면 차단한다", async () => {
            // Given
            const action = "verification-resend"
            const identifier = "user@example.com"
            redisService.incrWithExpire.mockResolvedValue(4) // maxAttempts(3) 초과
            redisService.ttl.mockResolvedValue(120)

            // When
            const result = await rateLimitService.checkAndIncrement(action, identifier)

            // Then
            expect(result).toEqual({
                allowed: false,
                remainingAttempts: 0,
                resetTimeSeconds: 120,
            })
        })

        it("제한 초과 시 TTL이 0 이하이면 windowSeconds를 반환한다", async () => {
            // Given
            const action = "registration"
            const identifier = "user@example.com"
            redisService.incrWithExpire.mockResolvedValue(4) // maxAttempts(3) 초과
            redisService.ttl.mockResolvedValue(-1) // TTL 만료

            // When
            const result = await rateLimitService.checkAndIncrement(action, identifier)

            // Then
            expect(result.resetTimeSeconds).toBe(600) // windowSeconds fallback
        })

        it("제한 내 시도 시 TTL이 0 이하이면 windowSeconds를 반환한다", async () => {
            // Given
            const action = "login-attempt"
            const identifier = "192.168.1.1"
            redisService.incrWithExpire.mockResolvedValue(2)
            redisService.ttl.mockResolvedValue(0) // TTL 만료

            // When
            const result = await rateLimitService.checkAndIncrement(action, identifier)

            // Then
            expect(result.resetTimeSeconds).toBe(900) // windowSeconds fallback
        })

        it("Redis 장애 시 fail-closed로 차단한다", async () => {
            // Given
            const action = "verification-resend"
            const identifier = "user@example.com"
            redisService.incrWithExpire.mockRejectedValue(new Error("Redis connection failed"))

            // When
            const result = await rateLimitService.checkAndIncrement(action, identifier)

            // Then
            expect(result).toEqual({
                allowed: false,
                remainingAttempts: 0,
                resetTimeSeconds: 60,
            })
        })
    })

    describe("reset (Rate Limit 리셋)", () => {
        it("지정된 액션과 식별자의 키를 삭제한다", async () => {
            // Given
            const action = "login-attempt"
            const identifier = "user@example.com"

            // When
            await rateLimitService.reset(action, identifier)

            // Then
            expect(redisService.delete).toHaveBeenCalledWith(
                "ratelimit:login-attempt:user@example.com"
            )
        })
    })

    describe("getStatus (현재 상태 조회)", () => {
        it("알 수 없는 정책이면 기본 상태를 반환한다", async () => {
            // Given
            const unknownAction = "unknown-action"
            const identifier = "user@example.com"

            // When
            const result = await rateLimitService.getStatus(unknownAction, identifier)

            // Then
            expect(result).toEqual({
                attempts: 0,
                maxAttempts: 999,
                resetTimeSeconds: 0,
            })
            expect(redisService.get).not.toHaveBeenCalled()
        })

        it("카운트가 존재하면 현재 시도 횟수를 반환한다", async () => {
            // Given
            const action = "verification-resend"
            const identifier = "user@example.com"
            redisService.get.mockResolvedValue("2")
            redisService.ttl.mockResolvedValue(180)

            // When
            const result = await rateLimitService.getStatus(action, identifier)

            // Then
            expect(result).toEqual({
                attempts: 2,
                maxAttempts: 3,
                resetTimeSeconds: 180,
            })
            expect(redisService.get).toHaveBeenCalledWith(
                "ratelimit:verification-resend:user@example.com"
            )
        })

        it("카운트가 없으면 attempts 0을 반환한다", async () => {
            // Given
            const action = "login-attempt"
            const identifier = "192.168.1.1"
            redisService.get.mockResolvedValue(null)
            redisService.ttl.mockResolvedValue(-2) // 키 없음

            // When
            const result = await rateLimitService.getStatus(action, identifier)

            // Then
            expect(result).toEqual({
                attempts: 0,
                maxAttempts: 5,
                resetTimeSeconds: 0, // TTL <= 0이면 0
            })
        })
    })
})
