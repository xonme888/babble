import "reflect-metadata"
import { UserService } from "@features/user/application/user.service"
import { User } from "@features/user/domain/user.entity"
import {
    createMockUserRepository,
    createMockDomainEventDispatcher,
    createMockPasswordHasher,
    createMockTokenRotationService,
    createMockLogger,
    createMockUserStatsService,
} from "../../utils/mock-factories"
import type { UserStatsService } from "@features/user/application/user-stats.service"

describe("사용자 통계 위임 (단위 테스트)", () => {
    let userService: UserService
    let mockStatsService: jest.Mocked<UserStatsService>

    beforeEach(() => {
        mockStatsService = createMockUserStatsService()

        userService = new UserService(
            createMockUserRepository(),
            createMockDomainEventDispatcher(),
            createMockPasswordHasher(),
            createMockTokenRotationService(),
            createMockLogger(),
            mockStatsService
        )
    })

    describe("getStats", () => {
        it("statsService에 위임해야 한다", async () => {
            // Given
            const mockRawStats = {
                userId: 1,
                user: new User(),
                stats: {
                    totalLessons: 3,
                    completedLessons: 2,
                    averageScore: 85,
                    totalPracticeSeconds: 300,
                },
                todayCompleted: 1,
                weeklyData: [],
                streaks: { currentStreak: 3, longestStreak: 7 },
                dailyGoal: { completedCount: 1, dailyGoalTarget: 3, isGoalAchieved: false },
            }
            mockStatsService.getStats.mockResolvedValue(mockRawStats)

            // When
            const rawStats = await userService.getStats(1)

            // Then
            expect(rawStats).toBe(mockRawStats)
            expect(mockStatsService.getStats).toHaveBeenCalledWith(1)
        })
    })
})
