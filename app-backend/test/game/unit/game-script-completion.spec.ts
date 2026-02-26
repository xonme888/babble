export {}

import { GameScriptCompletion } from "@features/game/domain/game-script-completion.entity"

describe("GameScriptCompletion.calculateStats (정확도 통계 계산)", () => {
    it("전체 정답이면 accuracy 100, wrong 0을 반환한다", () => {
        // Given
        const words = [{ isCorrect: true }, { isCorrect: true }, { isCorrect: true }]

        // When
        const result = GameScriptCompletion.calculateStats(words)

        // Then
        expect(result).toEqual({ accuracy: 100, correct: 3, wrong: 0 })
    })

    it("전체 오답이면 accuracy 0을 반환한다", () => {
        // Given
        const words = [{ isCorrect: false }, { isCorrect: false }]

        // When
        const result = GameScriptCompletion.calculateStats(words)

        // Then
        expect(result).toEqual({ accuracy: 0, correct: 0, wrong: 2 })
    })

    it("혼합 결과의 정확도를 반올림 정수로 계산한다", () => {
        // Given — 2/3 = 66.666... → 67
        const words = [{ isCorrect: true }, { isCorrect: true }, { isCorrect: false }]

        // When
        const result = GameScriptCompletion.calculateStats(words)

        // Then
        expect(result).toEqual({ accuracy: 67, correct: 2, wrong: 1 })
    })

    it("빈 배열이면 accuracy 0, correct 0, wrong 0을 반환한다", () => {
        // When
        const result = GameScriptCompletion.calculateStats([])

        // Then
        expect(result).toEqual({ accuracy: 0, correct: 0, wrong: 0 })
    })

    it("단일 정답은 accuracy 100을 반환한다", () => {
        // When
        const result = GameScriptCompletion.calculateStats([{ isCorrect: true }])

        // Then
        expect(result).toEqual({ accuracy: 100, correct: 1, wrong: 0 })
    })
})
