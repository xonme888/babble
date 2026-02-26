import "reflect-metadata"

// typeorm-transactional을 no-op mock (단위 테스트에서 DB 불필요)
jest.mock("typeorm-transactional", () => ({
    Transactional:
        () => (_target: Record<string, unknown>, _key: string, descriptor: PropertyDescriptor) =>
            descriptor,
    initializeTransactionalContext: jest.fn(),
    addTransactionalDataSource: (dataSource: unknown) => dataSource,
}))

import { AuthService } from "@features/auth/application/auth.service"
import { User, UserRole } from "@features/user/domain/user.entity"
import {
    ConflictException,
    ValidationException,
} from "@shared/core/exceptions/domain-exceptions"
import {
    createMockUserRepository,
    createMockTokenProvider,
    createMockLoginStrategyFactory,
    createMockLoginStrategy,
    createMockRedisService,
    createMockDomainEventDispatcher,
    createMockConfigService,
    createMockPasswordHasher,
    createMockTokenRotationService,
    createMockVerificationService,
    createMockLogger,
} from "../../utils/mock-factories"

import type { UserRepository } from "@features/user/infrastructure/user.repository"
import type { ITokenProvider } from "@features/auth/domain/token-provider.interface"
import type { IPasswordHasher } from "@shared/core/password-hasher.interface"
import type { LoginStrategyFactory } from "@features/auth/application/login-strategy.factory"
import type { IRedisService } from "@shared/core/redis-service.interface"
import type { ILoginStrategy } from "@features/auth/application/login-strategy.interface"
import type { TokenRotationService } from "@features/auth/application/token-rotation.service"
import type { VerificationService } from "@features/auth/application/verification.service"

export {}

describe("AuthService (인증 서비스)", () => {
    let authService: AuthService
    let userRepository: jest.Mocked<UserRepository>
    let tokenProvider: jest.Mocked<ITokenProvider>
    let loginStrategyFactory: jest.Mocked<LoginStrategyFactory>
    let redisService: jest.Mocked<IRedisService>
    let mockPasswordHasher: jest.Mocked<IPasswordHasher>
    let mockStrategy: jest.Mocked<ILoginStrategy>
    let tokenRotationService: jest.Mocked<TokenRotationService>
    let verificationService: jest.Mocked<VerificationService>

    beforeEach(() => {
        mockStrategy = createMockLoginStrategy()
        userRepository = createMockUserRepository()
        tokenProvider = createMockTokenProvider()
        loginStrategyFactory = createMockLoginStrategyFactory(mockStrategy)
        redisService = createMockRedisService()
        mockPasswordHasher = createMockPasswordHasher()
        const mockEventDispatcher = createMockDomainEventDispatcher()
        const mockConfigService = createMockConfigService()
        tokenRotationService = createMockTokenRotationService()
        verificationService = createMockVerificationService()

        authService = new AuthService(
            userRepository,
            tokenProvider,
            loginStrategyFactory,
            redisService,
            mockEventDispatcher,
            mockConfigService,
            mockPasswordHasher,
            tokenRotationService,
            verificationService,
            createMockLogger()
        )
    })

    describe("register (등록)", () => {
        const registerDto = {
            email: "test@example.com",
            password: "Password123!",
            firstName: "John",
        }

        it("성공적으로 등록해야 한다", async () => {
            // Given
            userRepository.findByEmail.mockResolvedValue(null)
            userRepository.save.mockImplementation(async (u) => {
                u.id = 1
                return u
            })

            // When
            const result = await authService.register(
                registerDto.email,
                registerDto.password,
                registerDto.firstName,
                undefined,
                true
            )

            // Then
            expect(result).toBeInstanceOf(User)
            expect(result.email).toBe(registerDto.email)
            expect(userRepository.save).toHaveBeenCalled()
            expect(verificationService.sendVerificationEmail).toHaveBeenCalledWith(registerDto.email)
        })

        it("이미 인증된 사용자가 재가입 시도 시 ConflictException을 던져야 한다", async () => {
            // Given
            const existingUser = new User()
            existingUser.isVerified = true
            userRepository.findByEmail.mockResolvedValue(existingUser)

            // When & Then
            await expect(
                authService.register(registerDto.email, registerDto.password, registerDto.firstName, undefined, true)
            ).rejects.toThrow(new ConflictException("auth.email_in_use"))
        })

        it("약관 미동의 시 ValidationException을 던져야 한다", async () => {
            // When & Then
            await expect(
                authService.register(registerDto.email, registerDto.password, registerDto.firstName, undefined, false)
            ).rejects.toThrow(ValidationException)
        })

        it("agreedToTerms 누락 시 ValidationException을 던져야 한다", async () => {
            // When & Then
            await expect(
                authService.register(registerDto.email, registerDto.password, registerDto.firstName)
            ).rejects.toThrow(ValidationException)
        })
    })

    describe("login (로그인)", () => {
        it("성공적으로 로그인해야 한다 (모바일)", async () => {
            // Given
            const mockUser = new User()
            mockUser.id = 1
            mockUser.role = "USER" as any
            mockStrategy.login.mockResolvedValue(mockUser)
            tokenProvider.generateAccessToken.mockReturnValue("access_token")
            tokenProvider.generateRefreshToken.mockReturnValue("refresh_token")

            // When
            const result = await authService.login(
                "email",
                { email: "test@example.com", password: "pw" },
                "mobile"
            )

            // Then
            expect(result).toEqual({
                accessToken: "access_token",
                refreshToken: "refresh_token",
                user: mockUser,
            })
            expect(tokenProvider.generateAccessToken).toHaveBeenCalledWith(1, "USER")
            expect(redisService.setRequired).toHaveBeenCalledWith(
                "refresh:1:mobile",
                "refresh_token",
                expect.any(Number)
            )
        })

        it("성공적으로 로그인해야 한다 (어드민)", async () => {
            // Given
            const mockUser = new User()
            mockUser.id = 1
            mockUser.role = "ADMIN" as any
            mockStrategy.login.mockResolvedValue(mockUser)
            tokenProvider.generateAccessToken.mockReturnValue("access_token")
            tokenProvider.generateRefreshToken.mockReturnValue("refresh_token")

            // When
            const _result = await authService.login(
                "email",
                { email: "test@example.com", password: "pw" },
                "admin"
            )

            // Then
            expect(tokenProvider.generateAccessToken).toHaveBeenCalledWith(1, "ADMIN")
            expect(redisService.setRequired).toHaveBeenCalledWith(
                "refresh:1:admin",
                "refresh_token",
                expect.any(Number)
            )
        })
    })

    describe("register — DB 에러 분기", () => {
        it("중복 키 에러 발생 시 ConflictException을 던져야 한다", async () => {
            // Given — 신규 사용자 (findByEmail null)
            userRepository.findByEmail.mockResolvedValue(null)
            userRepository.save.mockRejectedValue({ code: "23505", message: "duplicate key value" })

            // When & Then
            await expect(
                authService.register("test@example.com", "Password123!", "John", undefined, true)
            ).rejects.toThrow(ConflictException)
        })

        it("일반 DB 에러 발생 시 ServiceUnavailableException을 던져야 한다", async () => {
            // Given
            userRepository.findByEmail.mockResolvedValue(null)
            userRepository.save.mockRejectedValue(new Error("Connection refused"))

            // When & Then
            await expect(
                authService.register("test@example.com", "Password123!", "John", undefined, true)
            ).rejects.toThrow("Database")
        })
    })

    describe("refreshToken (토큰 갱신)", () => {
        it("TokenRotationService.refresh에 위임한다", async () => {
            // Given
            tokenRotationService.refresh.mockResolvedValue({
                accessToken: "new_access",
                refreshToken: "new_refresh",
            })

            // When
            const result = await authService.refreshToken("old_refresh_token", "mobile")

            // Then
            expect(tokenRotationService.refresh).toHaveBeenCalledWith("old_refresh_token", "mobile")
            expect(result).toEqual({
                accessToken: "new_access",
                refreshToken: "new_refresh",
            })
        })
    })

    describe("logout (로그아웃)", () => {
        it("TokenRotationService.revoke에 위임한다", async () => {
            // When
            await authService.logout("access_token", "mobile")

            // Then
            expect(tokenRotationService.revoke).toHaveBeenCalledWith("access_token", "mobile")
        })
    })

    describe("logoutAll (전체 로그아웃)", () => {
        it("TokenRotationService.revokeAll에 위임한다", async () => {
            // When
            await authService.logoutAll("access_token")

            // Then
            expect(tokenRotationService.revokeAll).toHaveBeenCalledWith("access_token")
        })
    })

    describe("createGuestAccount (게스트 계정 생성)", () => {
        const deviceId = "device-abc-123"
        const serviceConsentVersion = "v1.0"

        it("기존 게스트가 있으면 기존 토큰을 반환한다", async () => {
            // Given
            const existingGuest = new User()
            existingGuest.id = 10
            existingGuest.role = UserRole.GUEST
            userRepository.findGuestByDeviceId.mockResolvedValue(existingGuest)
            tokenProvider.generateAccessToken.mockReturnValue("guest_access")
            tokenProvider.generateRefreshToken.mockReturnValue("guest_refresh")

            // When
            const result = await authService.createGuestAccount(deviceId, serviceConsentVersion, "mobile")

            // Then
            expect(result).toEqual({ accessToken: "guest_access", refreshToken: "guest_refresh" })
            expect(userRepository.findUpgradedUserByDeviceId).not.toHaveBeenCalled()
            expect(userRepository.save).not.toHaveBeenCalled()
        })

        it("upgrade된 사용자가 있으면 DEVICE_ALREADY_UPGRADED 예외를 던진다", async () => {
            // Given
            const upgradedUser = new User()
            upgradedUser.id = 20
            upgradedUser.email = "john@example.com"
            upgradedUser.role = UserRole.USER
            userRepository.findGuestByDeviceId.mockResolvedValue(null)
            userRepository.findUpgradedUserByDeviceId.mockResolvedValue(upgradedUser)

            // When & Then
            await expect(
                authService.createGuestAccount(deviceId, serviceConsentVersion, "mobile")
            ).rejects.toThrow(ConflictException)

            await expect(
                authService.createGuestAccount(deviceId, serviceConsentVersion, "mobile")
            ).rejects.toMatchObject({
                errorCode: "DEVICE_ALREADY_UPGRADED",
            })
        })

        it("게스트도 upgrade된 사용자도 없으면 신규 게스트를 생성한다", async () => {
            // Given
            userRepository.findGuestByDeviceId.mockResolvedValue(null)
            userRepository.findUpgradedUserByDeviceId.mockResolvedValue(null)
            userRepository.save.mockImplementation(async (u) => {
                u.id = 30
                return u
            })
            tokenProvider.generateAccessToken.mockReturnValue("new_access")
            tokenProvider.generateRefreshToken.mockReturnValue("new_refresh")

            // When
            const result = await authService.createGuestAccount(deviceId, serviceConsentVersion, "mobile")

            // Then
            expect(result).toEqual({ accessToken: "new_access", refreshToken: "new_refresh" })
            expect(userRepository.save).toHaveBeenCalledWith(
                expect.objectContaining({ deviceId, role: UserRole.GUEST })
            )
        })
    })

    describe("mergeGuestToUser (게스트 데이터 병합)", () => {
        it("게스트의 deviceId를 대상 사용자에 복사한다", async () => {
            // Given
            const guest = new User()
            guest.id = 100
            guest.role = UserRole.GUEST
            guest.deviceId = "device-xyz"

            const target = new User()
            target.id = 200
            target.role = UserRole.USER
            target.deviceId = null

            userRepository.findByIdOrThrow.mockImplementation(async (id) => {
                if (id === 100) return guest
                if (id === 200) return target
                throw new Error("unexpected id")
            })

            // When
            await authService.mergeGuestToUser(100, 200)

            // Then
            expect(target.deviceId).toBe("device-xyz")
            expect(userRepository.save).toHaveBeenCalledWith(
                expect.objectContaining({ id: 200, deviceId: "device-xyz" })
            )
            expect(userRepository.mergeGuestData).toHaveBeenCalledWith(100, 200)
        })
    })
})
