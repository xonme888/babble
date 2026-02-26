import "reflect-metadata"
import { AssessmentXpHandler, DailyGoalXpHandler } from "@features/gamification/handlers/xp.handler"
import { AssessmentCompletedEvent } from "@features/assessment/domain/events/assessment-completed.event"
import { DailyGoalAchievedEvent } from "@features/learning/domain/events/daily-goal-achieved.event"
import { XpSource } from "@features/gamification/domain/xp-transaction.entity"
import { XP_DEFAULTS } from "@features/gamification/domain/xp-rules"
import { createMockLogger, createMockXpService } from "../../utils/mock-factories"

describe("XP 핸들러", () => {
    let xpService: ReturnType<typeof createMockXpService>
    let logger: ReturnType<typeof createMockLogger>

    beforeEach(() => {
        xpService = createMockXpService()
        logger = createMockLogger()
    })

    describe("AssessmentXpHandler", () => {
        let handler: AssessmentXpHandler

        beforeEach(() => {
            handler = new AssessmentXpHandler(xpService as any, logger)
        })

        it("eventType이 AssessmentCompletedEvent를 반환한다", () => {
            expect(handler.eventType()).toBe("AssessmentCompletedEvent")
        })

        it("score 기반 XP를 부여한다 (고득점 보너스 포함)", async () => {
            // Given — score 95 >= 90 이므로 보너스 포함
            const event = new AssessmentCompletedEvent(1, 10, 95, "hello world")

            // When
            await handler.handle(event)

            // Then
            const expectedAmount = XP_DEFAULTS.ASSESSMENT_COMPLETE + XP_DEFAULTS.ASSESSMENT_HIGH_SCORE_BONUS
            expect(xpService.awardXp).toHaveBeenCalledWith({
                userId: 10,
                amount: expectedAmount,
                source: XpSource.ASSESSMENT,
                referenceId: 1,
                description: expect.stringContaining("95"),
            })
        })

        it("score가 기준 미만이면 기본 XP만 부여한다", async () => {
            // Given
            const event = new AssessmentCompletedEvent(2, 20, 70, "test text")

            // When
            await handler.handle(event)

            // Then
            expect(xpService.awardXp).toHaveBeenCalledWith({
                userId: 20,
                amount: XP_DEFAULTS.ASSESSMENT_COMPLETE,
                source: XpSource.ASSESSMENT,
                referenceId: 2,
                description: expect.stringContaining("70"),
            })
        })

        it("awardXp 예외 시 throw하지 않고 logger.error를 호출한다", async () => {
            // Given
            const error = new Error("DB 장애")
            xpService.awardXp.mockRejectedValue(error)
            const event = new AssessmentCompletedEvent(3, 30, 80, "test")

            // When
            await handler.handle(event)

            // Then
            expect(logger.error).toHaveBeenCalledWith(
                expect.stringContaining("Assessment XP 부여 실패"),
                error
            )
        })
    })

    describe("DailyGoalXpHandler", () => {
        let handler: DailyGoalXpHandler

        beforeEach(() => {
            handler = new DailyGoalXpHandler(xpService as any, logger)
        })

        it("eventType이 DailyGoalAchievedEvent를 반환한다", () => {
            expect(handler.eventType()).toBe("DailyGoalAchievedEvent")
        })

        it("고정 XP를 부여한다", async () => {
            // Given
            const event = new DailyGoalAchievedEvent(10, "2026-02-21", 3)

            // When
            await handler.handle(event)

            // Then
            expect(xpService.awardXp).toHaveBeenCalledWith({
                userId: 10,
                amount: XP_DEFAULTS.DAILY_GOAL_ACHIEVED,
                source: XpSource.DAILY_GOAL,
                referenceId: 20260221,
                description: expect.stringContaining("2026-02-21"),
            })
        })

        it("awardXp 예외 시 throw하지 않고 logger.error를 호출한다", async () => {
            // Given
            const error = new Error("XP 저장 실패")
            xpService.awardXp.mockRejectedValue(error)
            const event = new DailyGoalAchievedEvent(20, "2026-02-21", 5)

            // When
            await handler.handle(event)

            // Then
            expect(logger.error).toHaveBeenCalledWith(
                expect.stringContaining("일일 목표 XP 부여 실패"),
                error
            )
        })
    })
})
