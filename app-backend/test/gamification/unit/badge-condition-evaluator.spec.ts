import "reflect-metadata"
import { BadgeConditionEvaluator } from "@features/gamification/domain/badge-condition-evaluator"
import type { BadgeConditionCache } from "@features/gamification/domain/badge-condition.interface"

describe("BadgeConditionEvaluator (뱃지 조건 평가 도메인 서비스)", () => {
    let evaluator: BadgeConditionEvaluator

    beforeEach(() => {
        evaluator = new BadgeConditionEvaluator()
    })

    /** 빈 캐시 헬퍼 */
    function emptyCache(overrides?: Partial<BadgeConditionCache>): BadgeConditionCache {
        return { scoreThresholds: new Map(), ...overrides }
    }

    describe("streak 조건", () => {
        it("longestStreak이 value 이상이면 true를 반환한다", () => {
            const cache = emptyCache({ streak: { longestStreak: 10 } })
            expect(evaluator.evaluate({ type: "streak", value: 7 }, cache)).toBe(true)
        })

        it("longestStreak이 value 미만이면 false를 반환한다", () => {
            const cache = emptyCache({ streak: { longestStreak: 5 } })
            expect(evaluator.evaluate({ type: "streak", value: 7 }, cache)).toBe(false)
        })
    })

    describe("score 조건", () => {
        it("scoreThresholds에 해당 값이 true이면 true를 반환한다", () => {
            const cache = emptyCache()
            cache.scoreThresholds.set(90, true)
            expect(evaluator.evaluate({ type: "score", value: 90 }, cache)).toBe(true)
        })

        it("scoreThresholds에 해당 값이 false이면 false를 반환한다", () => {
            const cache = emptyCache()
            cache.scoreThresholds.set(90, false)
            expect(evaluator.evaluate({ type: "score", value: 90 }, cache)).toBe(false)
        })
    })

    describe("count 조건", () => {
        it("completedLessons이 value 이상이면 true를 반환한다", () => {
            const cache = emptyCache({ stats: { completedLessons: 10 } })
            expect(evaluator.evaluate({ type: "count", value: 5 }, cache)).toBe(true)
        })
    })

    describe("level 조건", () => {
        it("level이 value 이상이면 true를 반환한다", () => {
            const cache = emptyCache({ level: { level: 5 } })
            expect(evaluator.evaluate({ type: "level", value: 5 }, cache)).toBe(true)
        })
    })

    describe("알 수 없는 type", () => {
        it("알 수 없는 type이면 false를 반환한다", () => {
            const cache = emptyCache()
            expect(evaluator.evaluate({ type: "unknown", value: 1 }, cache)).toBe(false)
        })
    })

    describe("캐시 데이터 누락", () => {
        it("streak 캐시가 없으면 false를 반환한다", () => {
            const cache = emptyCache()
            expect(evaluator.evaluate({ type: "streak", value: 1 }, cache)).toBe(false)
        })

        it("stats 캐시가 없으면 false를 반환한다", () => {
            const cache = emptyCache()
            expect(evaluator.evaluate({ type: "count", value: 1 }, cache)).toBe(false)
        })

        it("level 캐시가 없으면 false를 반환한다", () => {
            const cache = emptyCache()
            expect(evaluator.evaluate({ type: "level", value: 1 }, cache)).toBe(false)
        })
    })
})
