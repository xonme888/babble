import "reflect-metadata"
import { GameSlotCalculator } from "@features/game/domain/game-slot-calculator"
import type { AdaptiveDifficultyConfig } from "@features/game/domain/game-slot-calculator"
import { Script, ScriptDifficulty } from "@features/script/domain/script.entity"
import { GameScriptCompletion } from "@features/game/domain/game-script-completion.entity"

describe("GameSlotCalculator (슬롯 분배 + DTO 변환)", () => {
    let calculator: GameSlotCalculator

    beforeEach(() => {
        calculator = new GameSlotCalculator()
    })

    // ==================== calculateSlotDistribution ====================

    describe("calculateSlotDistribution (슬롯 분배)", () => {
        it("todayCount가 ceil(ratio*count)보다 작으면 todayCount만큼 할당한다", () => {
            // Given: count=5, todayCount=3, ratio=0.7
            // ceil(0.7 * 5) = 4, min(4, 3) = 3

            // When
            const result = calculator.calculateSlotDistribution(5, 3, 0.7)

            // Then
            expect(result).toEqual({ todaySlots: 3, remainSlots: 2 })
        })

        it("todayCount가 0이면 전체 remainSlots로 할당한다", () => {
            // Given
            const result = calculator.calculateSlotDistribution(5, 0, 0.7)

            // Then
            expect(result).toEqual({ todaySlots: 0, remainSlots: 5 })
        })

        it("todayCount가 count보다 커도 todaySlots는 count 이내이다", () => {
            // Given: count=5, todayCount=10, ratio=0.7
            // ceil(0.7 * 5) = 4, min(4, 10) = 4

            // When
            const result = calculator.calculateSlotDistribution(5, 10, 0.7)

            // Then
            expect(result.todaySlots).toBeLessThanOrEqual(5)
            expect(result).toEqual({ todaySlots: 4, remainSlots: 1 })
        })

        it("ratio=1.0이면 가능한 만큼 오늘 슬롯에 할당한다", () => {
            // Given: count=5, todayCount=3, ratio=1.0
            // ceil(1.0 * 5) = 5, min(5, 3) = 3

            // When
            const result = calculator.calculateSlotDistribution(5, 3, 1.0)

            // Then
            expect(result).toEqual({ todaySlots: 3, remainSlots: 2 })
        })

        it("ratio=0이면 전부 remainSlots로 할당한다", () => {
            // Given
            const result = calculator.calculateSlotDistribution(5, 3, 0)

            // Then
            expect(result).toEqual({ todaySlots: 0, remainSlots: 5 })
        })
    })

    // ==================== toWordGameScriptDtos ====================

    describe("toWordGameScriptDtos (DTO 변환)", () => {
        const makeScript = (id: number): Script => {
            const s = new Script()
            s.id = id
            s.title = `Script ${id}`
            s.content = `Content ${id}`
            s.difficulty = ScriptDifficulty.EASY
            return s
        }

        const defaultConfig: AdaptiveDifficultyConfig = {
            enabled: true,
            highThreshold: 85,
            highBlanks: { min: 5, max: 8 },
            lowBlanks: { min: 1, max: 3 },
        }

        it("점수 >= highThreshold이면 highBlanks를 적용한다", () => {
            // Given
            const scripts = [makeScript(1)]
            const completionMap = new Map()
            const scoreMap = new Map([[1, 90]])

            // When
            const result = calculator.toWordGameScriptDtos(
                scripts,
                completionMap,
                scoreMap,
                defaultConfig
            )

            // Then
            expect(result[0].recommendedBlanks).toEqual({ min: 5, max: 8 })
            expect(result[0].todayScore).toBe(90)
        })

        it("점수 < highThreshold이면 lowBlanks를 적용한다", () => {
            // Given
            const scripts = [makeScript(1)]
            const completionMap = new Map()
            const scoreMap = new Map([[1, 60]])

            // When
            const result = calculator.toWordGameScriptDtos(
                scripts,
                completionMap,
                scoreMap,
                defaultConfig
            )

            // Then
            expect(result[0].recommendedBlanks).toEqual({ min: 1, max: 3 })
        })

        it("적응형 비활성화(enabled=false)이면 recommendedBlanks는 null이다", () => {
            // Given
            const scripts = [makeScript(1)]
            const scoreMap = new Map([[1, 90]])
            const disabledConfig: AdaptiveDifficultyConfig = {
                ...defaultConfig,
                enabled: false,
            }

            // When
            const result = calculator.toWordGameScriptDtos(
                scripts,
                new Map(),
                scoreMap,
                disabledConfig
            )

            // Then
            expect(result[0].recommendedBlanks).toBeNull()
        })

        it("todayScore가 없으면 recommendedBlanks는 null이다", () => {
            // Given
            const scripts = [makeScript(1)]
            const scoreMap = new Map<number, number>()

            // When
            const result = calculator.toWordGameScriptDtos(
                scripts,
                new Map(),
                scoreMap,
                defaultConfig
            )

            // Then
            expect(result[0].todayScore).toBeNull()
            expect(result[0].recommendedBlanks).toBeNull()
        })

        it("completion이 있으면 isFirstPlay=false, lastPlayedAt 반환", () => {
            // Given
            const scripts = [makeScript(1)]
            const completion = GameScriptCompletion.create({
                userId: 1,
                scriptId: 1,
                accuracy: 80,
                correct: 8,
                wrong: 2,
            })
            const completionMap = new Map([[1, completion]])
            const scoreMap = new Map<number, number>()

            // When
            const result = calculator.toWordGameScriptDtos(
                scripts,
                completionMap,
                scoreMap,
                defaultConfig
            )

            // Then
            expect(result[0].isFirstPlay).toBe(false)
            expect(result[0].lastPlayedAt).toBeInstanceOf(Date)
        })

        it("completion이 없으면 isFirstPlay=true, lastPlayedAt=null", () => {
            // Given
            const scripts = [makeScript(1)]
            const completionMap = new Map()
            const scoreMap = new Map<number, number>()

            // When
            const result = calculator.toWordGameScriptDtos(
                scripts,
                completionMap,
                scoreMap,
                defaultConfig
            )

            // Then
            expect(result[0].isFirstPlay).toBe(true)
            expect(result[0].lastPlayedAt).toBeNull()
        })
    })
})
