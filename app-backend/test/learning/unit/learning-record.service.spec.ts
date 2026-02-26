import "reflect-metadata"
import { LearningRecordService } from "@features/learning/application/learning-record.service"
import { StreakCalculator } from "@features/learning/domain/streak-calculator"
import { ActivityType } from "@features/learning/domain/learning-record.entity"
import { User } from "@features/user/domain/user.entity"
import { createMockDomainEventDispatcher, createMockLogger, createMockRedisService } from "../../utils/mock-factories"

import type { LearningRecordRepository } from "@features/learning/infrastructure/learning-record.repository"
import type { DailyGoalLogRepository } from "@features/learning/infrastructure/daily-goal-log.repository"
import type { UserRepository } from "@features/user/infrastructure/user.repository"

/** weeklyGoal이 설정된 테스트용 User 인스턴스 */
function makeUser(weeklyGoal: number): User {
    const user = new User()
    user.id = 1
    user.weeklyGoal = weeklyGoal
    return user
}

describe("LearningRecordService (학습 기록 서비스)", () => {
    let service: LearningRecordService
    let recordRepo: jest.Mocked<LearningRecordRepository>
    let dailyGoalRepo: jest.Mocked<DailyGoalLogRepository>
    let userRepo: jest.Mocked<UserRepository>
    let eventDispatcher: ReturnType<typeof createMockDomainEventDispatcher>

    beforeEach(() => {
        recordRepo = {
            save: jest.fn().mockImplementation(async (r) => ({ ...r, id: 1 })),
            getActivityDates: jest.fn().mockResolvedValue([]),
        } as unknown as jest.Mocked<LearningRecordRepository>

        dailyGoalRepo = {
            findOrCreateForToday: jest.fn().mockResolvedValue({
                completedCount: 0,
                isGoalAchieved: false,
                increment: jest.fn().mockReturnValue(false),
            }),
            save: jest.fn(),
            findByUserAndDate: jest.fn(),
        } as unknown as jest.Mocked<DailyGoalLogRepository>

        userRepo = {
            findById: jest.fn().mockResolvedValue(makeUser(21)),
        } as unknown as jest.Mocked<UserRepository>

        eventDispatcher = createMockDomainEventDispatcher()

        service = new LearningRecordService(
            recordRepo,
            dailyGoalRepo,
            userRepo,
            eventDispatcher,
            createMockRedisService(),
            new StreakCalculator(),
            createMockLogger()
        )
    })

    describe("getStreak (스트릭 조회)", () => {
        it("활동 기록이 없으면 스트릭 0을 반환한다", async () => {
            recordRepo.getActivityDates.mockResolvedValue([])

            const result = await service.getStreak(1)

            expect(result).toEqual({ currentStreak: 0, longestStreak: 0 })
        })

        it("연속 활동일의 최장 스트릭을 계산한다", async () => {
            recordRepo.getActivityDates.mockResolvedValue([
                "2026-02-01", "2026-02-02", "2026-02-03", // 3일 연속
                "2026-02-10", "2026-02-11", // 2일 연속
            ])

            const result = await service.getStreak(1)

            expect(result.longestStreak).toBe(3)
        })

        it("오늘까지 연속이면 currentStreak를 반환한다", async () => {
            // 오늘 날짜 기반으로 연속 날짜 생성
            const today = new Date()
            const dates = []
            for (let i = 2; i >= 0; i--) {
                const d = new Date(today)
                d.setDate(d.getDate() - i)
                dates.push(d.toISOString().split("T")[0])
            }
            recordRepo.getActivityDates.mockResolvedValue(dates)

            const result = await service.getStreak(1)

            expect(result.currentStreak).toBeGreaterThanOrEqual(1)
        })

        it("하루 건너뛰면 currentStreak가 0이다", async () => {
            // 3일 전 활동만 있는 경우
            const threeDaysAgo = new Date()
            threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
            recordRepo.getActivityDates.mockResolvedValue([
                threeDaysAgo.toISOString().split("T")[0],
            ])

            const result = await service.getStreak(1)

            expect(result.currentStreak).toBe(0)
        })
    })

    describe("getDailyGoal (일일 목표 현황)", () => {
        it("로그가 없으면 기본값을 반환한다", async () => {
            dailyGoalRepo.findByUserAndDate.mockResolvedValue(null)

            const result = await service.getDailyGoal(1)

            expect(result.completedCount).toBe(0)
            expect(result.isGoalAchieved).toBe(false)
        })

        it("로그가 있으면 해당 값을 반환한다", async () => {
            dailyGoalRepo.findByUserAndDate.mockResolvedValue({
                completedCount: 3,
                isGoalAchieved: true,
            } as any)

            const result = await service.getDailyGoal(1)

            expect(result.completedCount).toBe(3)
            expect(result.isGoalAchieved).toBe(true)
        })

        it("weeklyGoal로부터 dailyGoalTarget을 계산한다", async () => {
            // weeklyGoal = 21 → dailyGoalTarget = ceil(21/7) = 3
            const result = await service.getDailyGoal(1)

            expect(result.dailyGoalTarget).toBe(3)
        })

        it("사용자가 없으면 기본 dailyGoalTarget(User.DEFAULT_DAILY_GOAL)을 사용한다", async () => {
            userRepo.findById.mockResolvedValue(null)

            const result = await service.getDailyGoal(1)

            // User.DEFAULT_DAILY_GOAL = Math.ceil(35 / 7) = 5
            expect(result.dailyGoalTarget).toBe(5)
        })
    })

    describe("isOvertime (오버타임 판정)", () => {
        it("일일 목표를 달성했으면 true를 반환한다", async () => {
            dailyGoalRepo.findByUserAndDate.mockResolvedValue({
                isGoalAchieved: true,
            } as any)

            expect(await service.isOvertime(1)).toBe(true)
        })

        it("일일 목표를 달성하지 않았으면 false를 반환한다", async () => {
            dailyGoalRepo.findByUserAndDate.mockResolvedValue({
                isGoalAchieved: false,
            } as any)

            expect(await service.isOvertime(1)).toBe(false)
        })

        it("로그가 없으면 false를 반환한다", async () => {
            dailyGoalRepo.findByUserAndDate.mockResolvedValue(null)

            expect(await service.isOvertime(1)).toBe(false)
        })
    })

    describe("recordActivity (학습 활동 기록)", () => {
        it("학습 기록을 저장한다", async () => {
            const result = await service.recordActivity({
                userId: 1,
                activityType: ActivityType.ASSESSMENT,
                score: 85,
            })

            expect(recordRepo.save).toHaveBeenCalled()
            expect(result).toBeDefined()
        })

        it("사용자가 없으면 일일 목표 처리를 건너뛴다", async () => {
            userRepo.findById.mockResolvedValue(null)

            await service.recordActivity({
                userId: 999,
                activityType: ActivityType.ASSESSMENT,
            })

            expect(dailyGoalRepo.findOrCreateForToday).not.toHaveBeenCalled()
        })
    })
})
