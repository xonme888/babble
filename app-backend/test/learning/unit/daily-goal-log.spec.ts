import "reflect-metadata"
import { DailyGoalLog } from "@features/learning/domain/daily-goal-log.entity"

describe("DailyGoalLog (일일 목표 엔티티)", () => {
    function createLog(completedCount: number = 0, isGoalAchieved: boolean = false): DailyGoalLog {
        const log = new DailyGoalLog()
        log.userId = 1
        log.date = "2026-02-21"
        log.completedCount = completedCount
        log.isGoalAchieved = isGoalAchieved
        return log
    }

    describe("increment (카운트 증가)", () => {
        it("completedCount를 1 증가시켜야 한다", () => {
            // Given
            const log = createLog(0)

            // When
            log.increment(3)

            // Then
            expect(log.completedCount).toBe(1)
        })

        it("목표 미달성 시 false를 반환해야 한다", () => {
            // Given
            const log = createLog(0)

            // When
            const result = log.increment(3)

            // Then
            expect(result).toBe(false)
            expect(log.isGoalAchieved).toBe(false)
        })

        it("목표 달성 시 isGoalAchieved를 true로 설정하고 true를 반환해야 한다", () => {
            // Given
            const log = createLog(2) // 목표 3, 현재 2

            // When
            const result = log.increment(3) // 3 >= 3 → 달성

            // Then
            expect(result).toBe(true)
            expect(log.isGoalAchieved).toBe(true)
            expect(log.completedCount).toBe(3)
        })

        it("이미 달성한 후 추가 increment 시 false를 반환해야 한다", () => {
            // Given
            const log = createLog(3, true) // 이미 달성

            // When
            const result = log.increment(3)

            // Then
            expect(result).toBe(false) // 이미 달성 상태 → 처음 달성이 아님
            expect(log.completedCount).toBe(4)
        })

        it("목표를 초과 달성해도 isGoalAchieved는 true를 유지해야 한다", () => {
            // Given
            const log = createLog(4, true)

            // When
            log.increment(3)

            // Then
            expect(log.completedCount).toBe(5)
            expect(log.isGoalAchieved).toBe(true)
        })

        it("dailyGoalTarget이 1이면 첫 번째 increment에서 달성해야 한다", () => {
            // Given
            const log = createLog(0)

            // When
            const result = log.increment(1)

            // Then
            expect(result).toBe(true)
            expect(log.completedCount).toBe(1)
            expect(log.isGoalAchieved).toBe(true)
        })
    })
})
