import "reflect-metadata"
import { UserService } from "@features/user/application/user.service"
import { User, UserRole } from "@features/user/domain/user.entity"
import {
    NotFoundException,
    ValidationException,
} from "@shared/core/exceptions/domain-exceptions"
import {
    createMockUserRepository,
    createMockDomainEventDispatcher,
    createMockPasswordHasher,
    createMockTokenRotationService,
    createMockLogger,
    createMockUserStatsService,
} from "../../utils/mock-factories"
import type { UserRepository } from "@features/user/infrastructure/user.repository"
import type { IPasswordHasher } from "@shared/core/password-hasher.interface"
import type { IDomainEventDispatcher } from "@shared/core/domain-event-dispatcher.interface"
import type { TokenRotationService } from "@features/auth/application/token-rotation.service"
import type { UserStatsService } from "@features/user/application/user-stats.service"

describe("UserService", () => {
    let userService: UserService
    let userRepository: jest.Mocked<UserRepository>
    let mockEventDispatcher: jest.Mocked<IDomainEventDispatcher>
    let mockPasswordHasher: jest.Mocked<IPasswordHasher>
    let mockTokenRotationService: jest.Mocked<TokenRotationService>
    let mockStatsService: jest.Mocked<UserStatsService>

    beforeEach(() => {
        userRepository = createMockUserRepository()
        mockPasswordHasher = createMockPasswordHasher()
        mockEventDispatcher = createMockDomainEventDispatcher()
        mockTokenRotationService = createMockTokenRotationService()
        const mockLogger = createMockLogger()
        mockStatsService = createMockUserStatsService()

        userService = new UserService(
            userRepository,
            mockEventDispatcher,
            mockPasswordHasher,
            mockTokenRotationService,
            mockLogger,
            mockStatsService
        )
    })

    describe("getById", () => {
        it("성공적으로 사용자를 반환해야 한다", async () => {
            // Given
            const mockUser = new User()
            mockUser.id = 1
            userRepository.findByIdOrThrow.mockResolvedValue(mockUser)

            // When
            const result = await userService.getById(1)

            // Then
            expect(result).toBe(mockUser)
            expect(userRepository.findByIdOrThrow).toHaveBeenCalledWith(1)
        })

        it("사용자를 찾지 못한 경우 NotFoundException을 던져야 한다", async () => {
            // Given
            userRepository.findByIdOrThrow.mockRejectedValue(
                new NotFoundException("auth.user_not_found")
            )

            // When & Then
            await expect(userService.getById(1)).rejects.toThrow(NotFoundException)
        })
    })

    describe("updateProfile (프로필 수정)", () => {
        it("성공적으로 프로필을 업데이트해야 한다", async () => {
            // Given
            const mockUser = new User()
            mockUser.id = 1
            mockUser.firstName = "Old"
            userRepository.findByIdOrThrow.mockResolvedValue(mockUser)
            userRepository.save.mockResolvedValue(mockUser)

            // When
            await userService.updateProfile(1, "New", "Name")

            // Then
            expect(mockUser.firstName).toBe("New")
            expect(mockUser.lastName).toBe("Name")
            expect(userRepository.save).toHaveBeenCalledWith(mockUser)
        })

        it("업데이트 대상 사용자를 찾지 못한 경우 NotFoundException을 던져야 한다", async () => {
            // Given
            userRepository.findByIdOrThrow.mockRejectedValue(
                new NotFoundException("auth.user_not_found")
            )

            // When & Then
            await expect(userService.updateProfile(1, "New", "Name")).rejects.toThrow(
                NotFoundException
            )
        })
    })

    describe("withdraw (회원 탈퇴)", () => {
        it("사용자를 삭제해야 한다", async () => {
            // Given
            const mockUser = new User()
            mockUser.id = 1
            userRepository.findByIdOrThrow.mockResolvedValue(mockUser)

            // When
            await userService.withdraw(1)

            // Then
            expect(userRepository.delete).toHaveBeenCalledWith(1)
        })

        it("탈퇴 대상 사용자를 찾지 못한 경우 NotFoundException을 던져야 한다", async () => {
            // Given
            userRepository.findByIdOrThrow.mockRejectedValue(
                new NotFoundException("auth.user_not_found")
            )

            // When & Then
            await expect(userService.withdraw(1)).rejects.toThrow(NotFoundException)
        })
    })

    describe("getStats (UserStatsService에 위임)", () => {
        it("statsService.getStats에 위임해야 한다", async () => {
            // Given
            const mockRawStats = {
                userId: 1,
                user: new User(),
                stats: { totalLessons: 10, completedLessons: 8, averageScore: 85, totalPracticeSeconds: 3600 },
                todayCompleted: 3,
                weeklyData: [],
                streaks: { currentStreak: 5, longestStreak: 10 },
                dailyGoal: { completedCount: 2, dailyGoalTarget: 3, isGoalAchieved: false },
            }
            mockStatsService.getStats.mockResolvedValue(mockRawStats)

            // When
            const result = await userService.getStats(1)

            // Then
            expect(result).toBe(mockRawStats)
            expect(mockStatsService.getStats).toHaveBeenCalledWith(1)
        })
    })

    describe("getByEmail (이메일 조회)", () => {
        it("이메일로 사용자를 조회해야 한다", async () => {
            // Given
            const mockUser = new User()
            mockUser.email = "test@example.com"
            userRepository.findByEmail.mockResolvedValue(mockUser)

            // When
            const result = await userService.getByEmail("test@example.com")

            // Then
            expect(result).toBe(mockUser)
            expect(userRepository.findByEmail).toHaveBeenCalledWith("test@example.com")
        })

        it("존재하지 않는 이메일이면 null을 반환해야 한다", async () => {
            // Given
            userRepository.findByEmail.mockResolvedValue(null)

            // When
            const result = await userService.getByEmail("unknown@example.com")

            // Then
            expect(result).toBeNull()
        })
    })

    describe("getAll (전체 사용자 조회)", () => {
        it("페이지네이션된 사용자 목록을 반환해야 한다", async () => {
            // Given
            const mockResult = { items: [new User()], total: 1 }
            userRepository.findAll.mockResolvedValue(mockResult)

            // When
            const result = await userService.getAll(10, 0)

            // Then
            expect(result).toEqual(mockResult)
            expect(userRepository.findAll).toHaveBeenCalledWith(10, 0)
        })

        it("기본값 limit=50, offset=0을 사용해야 한다", async () => {
            // Given
            userRepository.findAll.mockResolvedValue({ items: [], total: 0 })

            // When
            await userService.getAll()

            // Then
            expect(userRepository.findAll).toHaveBeenCalledWith(50, 0)
        })
    })

    describe("getScriptProgress (스크립트 진행도 조회)", () => {
        it("statsService.getScriptProgress에 위임해야 한다", async () => {
            // Given
            const mockProgress = { completedScriptIds: [1, 2], bestScores: { 1: 90 } }
            mockStatsService.getScriptProgress.mockResolvedValue(mockProgress)

            // When
            const result = await userService.getScriptProgress(1)

            // Then
            expect(result).toEqual(mockProgress)
            expect(mockStatsService.getScriptProgress).toHaveBeenCalledWith(1)
        })
    })

    describe("updateWeeklyGoal (주간 목표 수정)", () => {
        it("주간 목표를 업데이트해야 한다", async () => {
            // Given
            const mockUser = new User()
            mockUser.id = 1
            mockUser.weeklyGoal = 3
            userRepository.findByIdOrThrow.mockResolvedValue(mockUser)

            // When
            await userService.updateWeeklyGoal(1, 7)

            // Then
            expect(mockUser.weeklyGoal).toBe(7)
            expect(userRepository.save).toHaveBeenCalledWith(mockUser)
        })
    })

    describe("verifyEmail (이메일 인증)", () => {
        it("이메일을 인증하고 도메인 이벤트를 발행해야 한다", async () => {
            // Given
            const mockUser = new User()
            mockUser.id = 1
            mockUser.isVerified = false
            userRepository.findByIdOrThrow.mockResolvedValue(mockUser)

            // When
            await userService.verifyEmail(1)

            // Then
            expect(mockUser.isVerified).toBe(true)
            expect(userRepository.save).toHaveBeenCalledWith(mockUser)
            expect(mockEventDispatcher.publishFromAggregate).toHaveBeenCalledWith(mockUser)
        })
    })

    describe("changePassword (비밀번호 변경)", () => {
        it("현재 비밀번호가 맞으면 새 비밀번호로 변경해야 한다", async () => {
            // Given
            const mockUser = new User()
            mockUser.id = 1
            mockUser.password = "$2a$10$oldhash"
            userRepository.findByIdOrThrow.mockResolvedValue(mockUser)
            mockPasswordHasher.compare.mockResolvedValue(true)
            mockPasswordHasher.hash.mockResolvedValue("$2a$10$newhash")

            // When
            await userService.changePassword(1, "oldPass", "newPassword123!")

            // Then
            expect(userRepository.save).toHaveBeenCalled()
            // 세션 무효화 확인 — TokenRotationService 위임
            expect(mockTokenRotationService.clearAllClientTokens).toHaveBeenCalledWith(1)
        })

        it("현재 비밀번호가 틀리면 ValidationException을 던져야 한다", async () => {
            // Given
            const mockUser = new User()
            mockUser.id = 1
            mockUser.password = "$2a$10$oldhash"
            userRepository.findByIdOrThrow.mockResolvedValue(mockUser)
            mockPasswordHasher.compare.mockResolvedValue(false)

            // When & Then
            await expect(
                userService.changePassword(1, "wrongPass", "newPassword123!")
            ).rejects.toThrow(ValidationException)
        })
    })

    describe("adminUpdateUser (관리자 사용자 업데이트)", () => {
        it("이름을 업데이트해야 한다", async () => {
            // Given
            const mockUser = new User()
            mockUser.id = 1
            mockUser.firstName = "Old"
            userRepository.findByIdOrThrow.mockResolvedValue(mockUser)

            // When
            await userService.adminUpdateUser(1, { firstName: "New" })

            // Then
            expect(mockUser.firstName).toBe("New")
            expect(userRepository.save).toHaveBeenCalled()
        })

        it("비밀번호를 업데이트해야 한다", async () => {
            // Given
            const mockUser = new User()
            mockUser.id = 1
            userRepository.findByIdOrThrow.mockResolvedValue(mockUser)
            mockPasswordHasher.hash.mockResolvedValue("$2a$10$adminhash")

            // When
            await userService.adminUpdateUser(1, { password: "newAdminPass1!" })

            // Then
            expect(mockPasswordHasher.hash).toHaveBeenCalledWith("newAdminPass1!")
            expect(userRepository.save).toHaveBeenCalled()
        })

        it("역할을 업데이트해야 한다", async () => {
            // Given
            const mockUser = new User()
            mockUser.id = 1
            mockUser.role = UserRole.USER
            userRepository.findByIdOrThrow.mockResolvedValue(mockUser)

            // When
            await userService.adminUpdateUser(1, { role: "ADMIN" })

            // Then
            expect(mockUser.role).toBe(UserRole.ADMIN)
            expect(userRepository.save).toHaveBeenCalled()
        })

        it("주간 목표를 업데이트해야 한다", async () => {
            // Given
            const mockUser = new User()
            mockUser.id = 1
            mockUser.weeklyGoal = 3
            userRepository.findByIdOrThrow.mockResolvedValue(mockUser)

            // When
            await userService.adminUpdateUser(1, { weeklyGoal: 10 })

            // Then
            expect(mockUser.weeklyGoal).toBe(10)
        })

        it("활성 상태를 업데이트해야 한다", async () => {
            // Given
            const mockUser = new User()
            mockUser.id = 1
            mockUser.isActive = true
            userRepository.findByIdOrThrow.mockResolvedValue(mockUser)

            // When
            await userService.adminUpdateUser(1, { isActive: false })

            // Then
            expect(mockUser.isActive).toBe(false)
        })

        it("여러 필드를 동시에 업데이트해야 한다", async () => {
            // Given
            const mockUser = new User()
            mockUser.id = 1
            mockUser.firstName = "Old"
            mockUser.weeklyGoal = 3
            userRepository.findByIdOrThrow.mockResolvedValue(mockUser)

            // When
            await userService.adminUpdateUser(1, {
                firstName: "New",
                weeklyGoal: 7,
                isActive: true,
            })

            // Then
            expect(mockUser.firstName).toBe("New")
            expect(mockUser.weeklyGoal).toBe(7)
            expect(mockUser.isActive).toBe(true)
            expect(userRepository.save).toHaveBeenCalledTimes(1)
        })
    })
})
