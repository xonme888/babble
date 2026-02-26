import "reflect-metadata"

import { VerificationService } from "@features/auth/application/verification.service"
import { User } from "@features/user/domain/user.entity"
import {
    NotFoundException,
    ValidationException,
} from "@shared/core/exceptions/domain-exceptions"
import {
    createMockUserRepository,
    createMockNotificationService,
    createMockRedisService,
    createMockDomainEventDispatcher,
    createMockConfigService,
} from "../../utils/mock-factories"

import type { UserRepository } from "@features/user/infrastructure/user.repository"
import type { NotificationService } from "@features/notification/application/notification.service"
import type { IRedisService } from "@shared/core/redis-service.interface"
import type { IDomainEventDispatcher } from "@shared/core/domain-event-dispatcher.interface"
import type { IConfigService } from "@shared/core/config.interface"

export {}

describe("VerificationService (이메일 인증 서비스)", () => {
    let verificationService: VerificationService
    let userRepository: jest.Mocked<UserRepository>
    let redisService: jest.Mocked<IRedisService>
    let notificationService: jest.Mocked<NotificationService>
    let eventDispatcher: jest.Mocked<IDomainEventDispatcher>
    let configService: jest.Mocked<IConfigService>

    beforeEach(() => {
        userRepository = createMockUserRepository()
        redisService = createMockRedisService()
        eventDispatcher = createMockDomainEventDispatcher()
        configService = createMockConfigService()
        notificationService = createMockNotificationService()

        verificationService = new VerificationService(
            userRepository,
            redisService,
            eventDispatcher,
            configService,
            notificationService
        )
    })

    describe("verifyEmail (이메일 인증)", () => {
        it("성공적으로 이메일을 인증해야 한다", async () => {
            // Given
            redisService.getAndDeleteRequired.mockResolvedValue("123456")
            const mockUser = new User()
            mockUser.email = "test@example.com"
            mockUser.isVerified = false
            userRepository.findByEmail.mockResolvedValue(mockUser)

            // When
            const result = await verificationService.verifyEmail("test@example.com", "123456")

            // Then
            expect(result.success).toBe(true)
            expect(mockUser.isVerified).toBe(true)
            expect(userRepository.save).toHaveBeenCalled()
            expect(redisService.getAndDeleteRequired).toHaveBeenCalledWith("verify:test@example.com")
            expect(eventDispatcher.publishFromAggregate).toHaveBeenCalledWith(mockUser)
        })

        it("코드가 유효하지 않은 경우 ValidationException을 던져야 한다", async () => {
            // Given
            redisService.getAndDeleteRequired.mockResolvedValue("654321")

            // When & Then
            await expect(verificationService.verifyEmail("test@example.com", "123456")).rejects.toThrow(
                ValidationException
            )
        })

        it("인증을 위한 사용자를 찾지 못한 경우 NotFoundException을 던져야 한다", async () => {
            // Given
            redisService.getAndDeleteRequired.mockResolvedValue("123456")
            userRepository.findByEmail.mockResolvedValue(null)

            // When & Then
            await expect(verificationService.verifyEmail("test@example.com", "123456")).rejects.toThrow(
                NotFoundException
            )
        })
    })

    describe("resendVerificationCode (인증코드 재발송)", () => {
        it("미인증 사용자에게 인증 코드를 재발송해야 한다", async () => {
            // Given
            const user = new User()
            user.email = "test@example.com"
            user.isVerified = false
            userRepository.findByEmail.mockResolvedValue(user)

            // When
            await verificationService.resendVerificationCode("test@example.com")

            // Then
            expect(redisService.setRequired).toHaveBeenCalled()
            expect(notificationService.send).toHaveBeenCalled()
        })

        it("사용자가 없으면 NotFoundException을 던져야 한다", async () => {
            // Given
            userRepository.findByEmail.mockResolvedValue(null)

            // When & Then
            await expect(
                verificationService.resendVerificationCode("noone@example.com")
            ).rejects.toThrow(NotFoundException)
        })

        it("이미 인증된 사용자면 ValidationException을 던져야 한다", async () => {
            // Given
            const user = new User()
            user.email = "test@example.com"
            user.isVerified = true
            userRepository.findByEmail.mockResolvedValue(user)

            // When & Then
            await expect(
                verificationService.resendVerificationCode("test@example.com")
            ).rejects.toThrow(ValidationException)
        })
    })

    describe("sendVerificationEmail (인증 이메일 발송)", () => {
        it("인증 코드를 생성하고 Redis에 저장하고 이메일을 발송해야 한다", async () => {
            // When
            await verificationService.sendVerificationEmail("test@example.com")

            // Then
            expect(redisService.setRequired).toHaveBeenCalledWith(
                "verify:test@example.com",
                expect.any(String),
                expect.any(Number)
            )
            expect(notificationService.send).toHaveBeenCalledWith(
                "test@example.com",
                expect.any(String),
                expect.any(String)
            )
        })
    })
})
