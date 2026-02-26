import "reflect-metadata"

import { PasswordResetService } from "@features/auth/application/password-reset.service"
import { User } from "@features/user/domain/user.entity"
import {
    NotFoundException,
    ValidationException,
} from "@shared/core/exceptions/domain-exceptions"
import {
    createMockUserRepository,
    createMockNotificationService,
    createMockRedisService,
    createMockConfigService,
    createMockPasswordHasher,
    createMockTokenRotationService,
} from "../../utils/mock-factories"

import type { UserRepository } from "@features/user/infrastructure/user.repository"
import type { NotificationService } from "@features/notification/application/notification.service"
import type { IRedisService } from "@shared/core/redis-service.interface"
import type { IConfigService } from "@shared/core/config.interface"
import type { IPasswordHasher } from "@shared/core/password-hasher.interface"
import type { TokenRotationService } from "@features/auth/application/token-rotation.service"

export {}

describe("PasswordResetService (비밀번호 재설정 서비스)", () => {
    let passwordResetService: PasswordResetService
    let userRepository: jest.Mocked<UserRepository>
    let redisService: jest.Mocked<IRedisService>
    let configService: jest.Mocked<IConfigService>
    let passwordHasher: jest.Mocked<IPasswordHasher>
    let notificationService: jest.Mocked<NotificationService>
    let tokenRotationService: jest.Mocked<TokenRotationService>

    beforeEach(() => {
        userRepository = createMockUserRepository()
        redisService = createMockRedisService()
        configService = createMockConfigService()
        passwordHasher = createMockPasswordHasher()
        notificationService = createMockNotificationService()
        tokenRotationService = createMockTokenRotationService()

        passwordResetService = new PasswordResetService(
            userRepository,
            redisService,
            configService,
            passwordHasher,
            notificationService,
            tokenRotationService
        )
    })

    describe("requestPasswordReset (비밀번호 재설정 요청)", () => {
        it("사용자가 존재하면 재설정 코드를 이메일로 보내야 한다", async () => {
            // Given
            const user = new User()
            user.email = "test@example.com"
            userRepository.findByEmail.mockResolvedValue(user)

            // When
            await passwordResetService.requestPasswordReset("test@example.com")

            // Then
            expect(notificationService.send).toHaveBeenCalled()
            expect(redisService.setRequired).toHaveBeenCalled()
        })

        it("사용자가 없어도 조용히 반환해야 한다 (이메일 노출 방지)", async () => {
            // Given
            userRepository.findByEmail.mockResolvedValue(null)

            // When & Then — 에러 없이 완료
            await expect(
                passwordResetService.requestPasswordReset("noone@example.com")
            ).resolves.toBeUndefined()
            expect(notificationService.send).not.toHaveBeenCalled()
        })
    })

    describe("resetPassword (비밀번호 재설정)", () => {
        it("유효한 코드로 비밀번호를 재설정해야 한다", async () => {
            // Given — getAndDeleteRequired (원자적 조회+삭제)
            redisService.getAndDeleteRequired.mockResolvedValue("123456")
            const user = new User()
            user.id = 1
            user.email = "test@example.com"
            user.isVerified = true
            user.changePassword = jest.fn()
            userRepository.findByEmail.mockResolvedValue(user)
            userRepository.save.mockResolvedValue(user)

            // When
            await passwordResetService.resetPassword("test@example.com", "123456", "NewPassword123!")

            // Then
            expect(user.changePassword).toHaveBeenCalled()
            expect(userRepository.save).toHaveBeenCalledWith(user)
            expect(redisService.getAndDeleteRequired).toHaveBeenCalled()
            expect(tokenRotationService.clearAllClientTokens).toHaveBeenCalledWith(1)
        })

        it("코드가 틀리면 ValidationException을 던져야 한다", async () => {
            // Given
            redisService.getAndDeleteRequired.mockResolvedValue("654321")

            // When & Then
            await expect(
                passwordResetService.resetPassword("test@example.com", "123456", "NewPassword123!")
            ).rejects.toThrow(ValidationException)
        })

        it("사용자가 없으면 NotFoundException을 던져야 한다", async () => {
            // Given
            redisService.getAndDeleteRequired.mockResolvedValue("123456")
            userRepository.findByEmail.mockResolvedValue(null)

            // When & Then
            await expect(
                passwordResetService.resetPassword("test@example.com", "123456", "NewPassword123!")
            ).rejects.toThrow(NotFoundException)
        })

        it("미인증 사용자면 ValidationException을 던져야 한다", async () => {
            // Given
            redisService.getAndDeleteRequired.mockResolvedValue("123456")
            const user = new User()
            user.isVerified = false
            userRepository.findByEmail.mockResolvedValue(user)

            // When & Then
            await expect(
                passwordResetService.resetPassword("test@example.com", "123456", "NewPassword123!")
            ).rejects.toThrow(ValidationException)
        })
    })
})
