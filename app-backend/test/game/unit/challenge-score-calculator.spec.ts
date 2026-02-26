export {}

import { calculateCompositeScore } from "@features/game/domain/challenge-score-calculator"

describe("ChallengeScoreCalculator", () => {
    describe("calculateCompositeScore", () => {
        it("전부 정답 + 빠른 속도 + 풀콤보 시 만점에 가까운 점수를 반환한다", () => {
            const score = calculateCompositeScore({
                correctCount: 10,
                totalCount: 10,
                duration: 0,
                comboMaxStreak: 10,
            })

            // 정확도: (10/10) × 6000 = 6000
            // 속도: (300-0)/300 × 2500 = 2500
            // 콤보: min(10/10, 1) × 1500 = 1500
            expect(score).toBe(10000)
        })

        it("totalCount가 0이면 0을 반환한다", () => {
            const score = calculateCompositeScore({
                correctCount: 0,
                totalCount: 0,
                duration: 100,
                comboMaxStreak: 0,
            })

            expect(score).toBe(0)
        })

        it("정확도 50% + 150초 + 콤보 0일 때 적절한 점수를 반환한다", () => {
            const score = calculateCompositeScore({
                correctCount: 5,
                totalCount: 10,
                duration: 150,
                comboMaxStreak: 0,
            })

            // 정확도: (5/10) × 6000 = 3000
            // 속도: (300-150)/300 × 2500 = 1250
            // 콤보: 0/10 × 1500 = 0
            expect(score).toBe(4250)
        })

        it("속도 기준(300초)을 초과하면 속도 점수가 0이다", () => {
            const score = calculateCompositeScore({
                correctCount: 10,
                totalCount: 10,
                duration: 400,
                comboMaxStreak: 10,
            })

            // 정확도: 6000, 속도: 0, 콤보: 1500
            expect(score).toBe(7500)
        })

        it("결과를 반올림한 정수로 반환한다", () => {
            const score = calculateCompositeScore({
                correctCount: 7,
                totalCount: 10,
                duration: 100,
                comboMaxStreak: 3,
            })

            // 정확도: (7/10) × 6000 = 4200
            // 속도: (300-100)/300 × 2500 = 1666.666...
            // 콤보: (3/10) × 1500 = 450
            // 합계: 6316.666... → 반올림 6317
            expect(score).toBe(6317)
        })

        it("콤보가 totalCount를 초과해도 1로 클램핑된다", () => {
            const score = calculateCompositeScore({
                correctCount: 5,
                totalCount: 5,
                duration: 0,
                comboMaxStreak: 10,
            })

            // 콤보: min(10/5, 1) = 1 → 1500
            // 정확도: 6000, 속도: 2500
            expect(score).toBe(10000)
        })
    })
})
