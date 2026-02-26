import "reflect-metadata"
import { UserStatsService } from "@features/user/application/user-stats.service"
import { User } from "@features/user/domain/user.entity"
import {
    createMockUserRepository,
    createMockAssessmentRepository,
    createMockLearningRecordService,
    createMockRedisService,
    createMockLogger,
} from "../../utils/mock-factories"
import type { UserRepository } from "@features/user/infrastructure/user.repository"
import type { AssessmentRepository } from "@features/assessment/infrastructure/assessment.repository"
import type { LearningRecordService } from "@features/learning/application/learning-record.service"
import type { IRedisService } from "@shared/core/redis-service.interface"
import type { ILogger } from "@shared/core/logger.interface"

export {}

describe("UserStatsService (사용자 통계 서비스)", () => {
    let statsService: UserStatsService
    let userRepository: jest.Mocked<UserRepository>
    let assessmentRepository: jest.Mocked<AssessmentRepository>
    let learningRecordService: jest.Mocked<LearningRecordService>
    let redisService: jest.Mocked<IRedisService>
    let logger: jest.Mocked<ILogger>

    beforeEach(() => {
        userRepository = createMockUserRepository()
        assessmentRepository = createMockAssessmentRepository()
        learningRecordService = createMockLearningRecordService()
        redisService = createMockRedisService()
        logger = createMockLogger()

        statsService = new UserStatsService(
            userRepository,
            assessmentRepository,
            learningRecordService,
            redisService,
            logger
        )
    })

    describe("getStats (통계 조회)", () => {
        /** getStats 호출에 필요한 공통 mock 설정 */
        function setupMocks() {
            const mockUser = new User()
            mockUser.id = 1
            mockUser.weeklyGoal = 5
            userRepository.findByIdOrThrow.mockResolvedValue(mockUser)
            assessmentRepository.getStatsByUserId.mockResolvedValue({
                totalLessons: 10,
                completedLessons: 8,
                averageScore: 85,
                totalPracticeSeconds: 3600,
            })
            assessmentRepository.getTodayCompletedCount.mockResolvedValue(3)
            assessmentRepository.getWeeklyActivity.mockResolvedValue([])
            learningRecordService.getStreak.mockResolvedValue({ currentStreak: 5, longestStreak: 10 })
            learningRecordService.getDailyGoal.mockResolvedValue({ completedCount: 2, dailyGoalTarget: 3, isGoalAchieved: false })
        }

        it("5개 소스를 병렬로 호출해야 한다", async () => {
            setupMocks()

            await statsService.getStats(1)

            expect(assessmentRepository.getStatsByUserId).toHaveBeenCalledWith(1)
            expect(assessmentRepository.getTodayCompletedCount).toHaveBeenCalled()
            expect(assessmentRepository.getWeeklyActivity).toHaveBeenCalled()
            expect(learningRecordService.getStreak).toHaveBeenCalledWith(1)
            expect(learningRecordService.getDailyGoal).toHaveBeenCalledWith(1)
        })

        it("반환값에 userId, user, stats, todayCompleted, weeklyData, streaks, dailyGoal 포함", async () => {
            setupMocks()

            const result = await statsService.getStats(1)

            expect(result.userId).toBe(1)
            expect(result.user).toBeDefined()
            expect(result.stats).toBeDefined()
            expect(result.todayCompleted).toBe(3)
            expect(result.weeklyData).toBeDefined()
            expect(result.streaks).toEqual({ currentStreak: 5, longestStreak: 10 })
            expect(result.dailyGoal).toBeDefined()
        })

        it("assessmentRepository 실패 시 에러를 전파해야 한다", async () => {
            const mockUser = new User()
            mockUser.id = 1
            userRepository.findByIdOrThrow.mockResolvedValue(mockUser)
            assessmentRepository.getStatsByUserId.mockRejectedValue(new Error("DB error"))

            await expect(statsService.getStats(1)).rejects.toThrow("DB error")
        })
    })

    describe("getScriptProgress (스크립트 진행도)", () => {
        it("assessmentRepository에 위임해야 한다", async () => {
            const mockProgress = { completedScriptIds: [1, 2], bestScores: { 1: 90 } }
            assessmentRepository.getScriptProgress.mockResolvedValue(mockProgress)

            const result = await statsService.getScriptProgress(1)

            expect(result).toEqual(mockProgress)
            expect(assessmentRepository.getScriptProgress).toHaveBeenCalledWith(1)
        })
    })
})
