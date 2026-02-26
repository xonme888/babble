export {}

import { GameScriptCompletion } from "@features/game/domain/game-script-completion.entity"

describe("GameScriptCompletion Entity", () => {
    describe("isReviewEligible", () => {
        it("cooldown 경과 시 true를 반환한다", () => {
            const completion = GameScriptCompletion.create({
                userId: 1,
                scriptId: 1,
                accuracy: 80,
                correct: 8,
                wrong: 2,
            })
            // 4일 전으로 설정
            completion.lastPlayedAt = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)

            expect(completion.isReviewEligible(3)).toBe(true)
        })

        it("cooldown 미경과 시 false를 반환한다", () => {
            const completion = GameScriptCompletion.create({
                userId: 1,
                scriptId: 1,
                accuracy: 80,
                correct: 8,
                wrong: 2,
            })
            // 1일 전으로 설정
            completion.lastPlayedAt = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)

            expect(completion.isReviewEligible(3)).toBe(false)
        })

        it("정확히 cooldown일 경과 시 true를 반환한다", () => {
            const completion = GameScriptCompletion.create({
                userId: 1,
                scriptId: 1,
                accuracy: 80,
                correct: 8,
                wrong: 2,
            })
            // 정확히 3일 전
            completion.lastPlayedAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)

            expect(completion.isReviewEligible(3)).toBe(true)
        })
    })

    describe("recordPlay", () => {
        it("playCount를 증가시킨다", () => {
            const completion = GameScriptCompletion.create({
                userId: 1,
                scriptId: 1,
                accuracy: 80,
                correct: 8,
                wrong: 2,
            })
            expect(completion.playCount).toBe(1)

            completion.recordPlay(90, 9, 1)
            expect(completion.playCount).toBe(2)
        })

        it("더 높은 정확도로 bestAccuracy를 갱신한다", () => {
            const completion = GameScriptCompletion.create({
                userId: 1,
                scriptId: 1,
                accuracy: 80,
                correct: 8,
                wrong: 2,
            })
            expect(completion.bestAccuracy).toBe(80)

            completion.recordPlay(95, 19, 1)
            expect(completion.bestAccuracy).toBe(95)
        })

        it("더 낮은 정확도에서는 bestAccuracy를 갱신하지 않는다", () => {
            const completion = GameScriptCompletion.create({
                userId: 1,
                scriptId: 1,
                accuracy: 80,
                correct: 8,
                wrong: 2,
            })

            completion.recordPlay(60, 6, 4)
            expect(completion.bestAccuracy).toBe(80)
        })

        it("totalCorrect, totalWrong을 누적한다", () => {
            const completion = GameScriptCompletion.create({
                userId: 1,
                scriptId: 1,
                accuracy: 80,
                correct: 8,
                wrong: 2,
            })

            completion.recordPlay(70, 7, 3)
            expect(completion.totalCorrect).toBe(15)
            expect(completion.totalWrong).toBe(5)
        })

        it("lastPlayedAt을 갱신한다", () => {
            const completion = GameScriptCompletion.create({
                userId: 1,
                scriptId: 1,
                accuracy: 80,
                correct: 8,
                wrong: 2,
            })
            const original = completion.lastPlayedAt

            // 약간 지연 후 갱신
            completion.recordPlay(80, 8, 2)
            expect(completion.lastPlayedAt.getTime()).toBeGreaterThanOrEqual(original.getTime())
        })
    })

    describe("create", () => {
        it("팩토리 메서드로 올바른 초기값을 설정한다", () => {
            const completion = GameScriptCompletion.create({
                userId: 1,
                scriptId: 10,
                accuracy: 90,
                correct: 9,
                wrong: 1,
            })

            expect(completion.userId).toBe(1)
            expect(completion.scriptId).toBe(10)
            expect(completion.playCount).toBe(1)
            expect(completion.bestAccuracy).toBe(90)
            expect(completion.totalCorrect).toBe(9)
            expect(completion.totalWrong).toBe(1)
            expect(completion.firstClearedAt).toBeInstanceOf(Date)
            expect(completion.lastPlayedAt).toBeInstanceOf(Date)
        })
    })
})
