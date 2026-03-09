import "reflect-metadata"
import { TokenRotationService } from "@features/auth/application/token-rotation.service"
import { UnauthorizedException } from "@shared/core/exceptions/domain-exceptions"
import {
    createMockTokenProvider,
    createMockRedisService,
    createMockIConfigService,
    createMockUserRepository,
} from "../../utils/mock-factories"
import { TokenRefreshPolicy } from "@features/auth/domain/token-refresh-policy"
import type { ITokenProvider } from "@features/auth/domain/token-provider.interface"
import type { IRedisService } from "@shared/core/redis-service.interface"
import type { IConfigService } from "@shared/core/config.interface"
import type { UserRepository } from "@features/user/infrastructure/user.repository"

export {}

describe("TokenRotationService (토큰 회전 서비스)", () => {
    let service: TokenRotationService
    let tokenProvider: jest.Mocked<ITokenProvider>
    let redisService: jest.Mocked<IRedisService>
    let configService: jest.Mocked<IConfigService>
    let policy: TokenRefreshPolicy
    let userRepository: jest.Mocked<UserRepository>

    beforeEach(() => {
        tokenProvider = createMockTokenProvider()
        redisService = createMockRedisService()
        configService = createMockIConfigService()
        policy = new TokenRefreshPolicy()
        userRepository = createMockUserRepository()

        service = new TokenRotationService(tokenProvider, redisService, configService, policy, userRepository)
    })

    describe("refresh (토큰 갱신)", () => {
        it("유효한 현재 토큰이면 새 토큰 쌍을 반환한다", async () => {
            // Given
            tokenProvider.verifyToken.mockReturnValue({
                valid: true,
                payload: { userId: 1, exp: 9999999999 },
            })
            redisService.getRequired
                .mockResolvedValueOnce("current-refresh")  // stored
                .mockResolvedValueOnce(null)                // prev (없음)
            userRepository.findById.mockResolvedValue({ id: 1, role: "USER" } as any)
            tokenProvider.generateAccessToken.mockReturnValue("new-access")
            tokenProvider.generateRefreshToken.mockReturnValue("new-refresh")

            // When
            const result = await service.refresh("current-refresh", "mobile")

            // Then
            expect(result.accessToken).toBe("new-access")
            expect(result.refreshToken).toBe("new-refresh")
            expect(userRepository.findById).toHaveBeenCalledWith(1)
            expect(tokenProvider.generateAccessToken).toHaveBeenCalledWith(1, "USER")
            // 이전 토큰을 grace period 키에 저장했는지 확인
            expect(redisService.setRequired).toHaveBeenCalledWith(
                "refresh:1:mobile:prev",
                "current-refresh",
                10
            )
            // 새 토큰으로 교체했는지 확인
            expect(redisService.setRequired).toHaveBeenCalledWith(
                "refresh:1:mobile",
                "new-refresh",
                expect.any(Number)
            )
        })

        it("이전 토큰이면 현재 저장된 토큰을 반환한다 (grace period)", async () => {
            // Given
            tokenProvider.verifyToken.mockReturnValue({
                valid: true,
                payload: { userId: 1, exp: 9999999999 },
            })
            redisService.getRequired
                .mockResolvedValueOnce("current-stored")  // stored (현재)
                .mockResolvedValueOnce("old-token")       // prev
            userRepository.findById.mockResolvedValue({ id: 1, role: "USER" } as any)
            tokenProvider.generateAccessToken.mockReturnValue("new-access")

            // When
            const result = await service.refresh("old-token", "mobile")

            // Then
            expect(result.accessToken).toBe("new-access")
            expect(result.refreshToken).toBe("current-stored")
            expect(tokenProvider.generateAccessToken).toHaveBeenCalledWith(1, "USER")
        })

        it("revoked 토큰이면 UnauthorizedException을 던진다", async () => {
            // Given
            tokenProvider.verifyToken.mockReturnValue({
                valid: true,
                payload: { userId: 1, exp: 9999999999 },
            })
            redisService.getRequired
                .mockResolvedValueOnce("stored")
                .mockResolvedValueOnce("prev")
            userRepository.findById.mockResolvedValue({ id: 1, role: "USER" } as any)

            // When & Then
            await expect(service.refresh("unknown-token", "mobile")).rejects.toThrow(
                UnauthorizedException
            )
        })

        it("사용자가 존재하지 않으면 UnauthorizedException을 던진다", async () => {
            // Given
            tokenProvider.verifyToken.mockReturnValue({
                valid: true,
                payload: { userId: 1, exp: 9999999999 },
            })
            redisService.getRequired
                .mockResolvedValueOnce("current-refresh")
                .mockResolvedValueOnce(null)
            userRepository.findById.mockResolvedValue(null)

            // When & Then
            await expect(service.refresh("current-refresh", "mobile")).rejects.toThrow(
                UnauthorizedException
            )
        })

        it("만료된 refresh 토큰이면 EXPIRED_REFRESH_TOKEN 에러", async () => {
            // Given
            tokenProvider.verifyToken.mockReturnValue({ valid: false, reason: "expired" })

            // When & Then
            await expect(service.refresh("expired-token", "mobile")).rejects.toThrow(
                UnauthorizedException
            )
        })

        it("무효한 refresh 토큰이면 INVALID_REFRESH_TOKEN 에러", async () => {
            // Given
            tokenProvider.verifyToken.mockReturnValue({ valid: false, reason: "invalid" })

            // When & Then
            await expect(service.refresh("bad-token", "mobile")).rejects.toThrow(
                UnauthorizedException
            )
        })
    })

    describe("revoke (로그아웃)", () => {
        it("refresh 삭제 + access 블랙리스트 등록", async () => {
            // Given
            tokenProvider.verifyToken.mockReturnValue({
                valid: true,
                payload: { userId: 1, exp: Math.floor(Date.now() / 1000) + 900 },
            })

            // When
            await service.revoke("access-token", "mobile")

            // Then
            expect(redisService.deleteRequired).toHaveBeenCalledWith("refresh:1:mobile")
            expect(redisService.deleteRequired).toHaveBeenCalledWith("refresh:1:mobile:prev")
            expect(redisService.setRequired).toHaveBeenCalledWith(
                "blacklist:access-token",
                "1",
                expect.any(Number)
            )
        })

        it("무효 토큰의 로그아웃은 조용히 무시한다", async () => {
            // Given
            tokenProvider.verifyToken.mockReturnValue({ valid: false, reason: "expired" })

            // When
            await service.revoke("expired-token", "mobile")

            // Then
            expect(redisService.deleteRequired).not.toHaveBeenCalled()
        })
    })

    describe("revokeAll (전체 로그아웃)", () => {
        it("모든 클라이언트 타입의 토큰을 삭제한다", async () => {
            // Given
            tokenProvider.verifyToken.mockReturnValue({
                valid: true,
                payload: { userId: 1, exp: Math.floor(Date.now() / 1000) + 900 },
            })

            // When
            await service.revokeAll("access-token")

            // Then
            expect(redisService.deleteRequired).toHaveBeenCalledWith("refresh:1:mobile")
            expect(redisService.deleteRequired).toHaveBeenCalledWith("refresh:1:mobile:prev")
            expect(redisService.deleteRequired).toHaveBeenCalledWith("refresh:1:admin")
            expect(redisService.deleteRequired).toHaveBeenCalledWith("refresh:1:admin:prev")
            expect(redisService.setRequired).toHaveBeenCalledWith(
                "blacklist:access-token",
                "1",
                expect.any(Number)
            )
        })
    })

    describe("clearAllClientTokens (모든 클라이언트 토큰 삭제)", () => {
        it("모든 클라이언트 타입의 refresh + prev 키를 삭제한다", async () => {
            // When
            await service.clearAllClientTokens(1)

            // Then
            expect(redisService.deleteRequired).toHaveBeenCalledWith("refresh:1:mobile")
            expect(redisService.deleteRequired).toHaveBeenCalledWith("refresh:1:mobile:prev")
            expect(redisService.deleteRequired).toHaveBeenCalledWith("refresh:1:admin")
            expect(redisService.deleteRequired).toHaveBeenCalledWith("refresh:1:admin:prev")
            expect(redisService.deleteRequired).toHaveBeenCalledWith("refresh:1:therapy")
            expect(redisService.deleteRequired).toHaveBeenCalledWith("refresh:1:therapy:prev")
            expect(redisService.deleteRequired).toHaveBeenCalledTimes(6)
        })
    })
})
