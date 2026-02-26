export {}

import "reflect-metadata"
import {
    GameXpCalculator,
    XP_CALC_DEFAULTS,
    WordResultInput,
} from "@features/game/domain/game-xp-calculator"
import { CompletionSnapshot } from "@features/game/domain/completion-snapshot"
import { GameScriptCompletion } from "@features/game/domain/game-script-completion.entity"
import { createMockGameConfigService } from "../../utils/mock-factories"

describe("GameXpCalculator", () => {
    let calculator: GameXpCalculator
    let mockConfigService: ReturnType<typeof createMockGameConfigService>

    beforeEach(() => {
        mockConfigService = createMockGameConfigService({
            // get에서 항상 기본값 반환 (GameConfig 미설정 시나리오)
            get: jest
                .fn()
                .mockImplementation((_key: string, defaultValue: unknown) => defaultValue),
        })
        calculator = new GameXpCalculator(mockConfigService, new CompletionSnapshot())
    })

    /** 헬퍼: 단일 스크립트 wordResults 생성 */
    function makeWords(
        scriptId: number,
        words: { isCorrect: boolean; hintUsed?: boolean }[]
    ): WordResultInput[] {
        return words.map((w, i) => ({
            scriptId,
            word: `word_${i}`,
            wordIndex: i,
            isCorrect: w.isCorrect,
            attempts: 1,
            hintUsed: w.hintUsed ?? false,
        }))
    }

    /** 헬퍼: 기존 completion 생성 (반복 판정용) */
    function makeCompletion(scriptId: number, daysAgo: number = 0): GameScriptCompletion {
        const c = GameScriptCompletion.create({
            userId: 1,
            scriptId,
            accuracy: 80,
            correct: 8,
            wrong: 2,
        })
        c.lastPlayedAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)
        return c
    }

    describe("최초 클리어", () => {
        it("최초 클리어 시 FIRST_CLEAR XP를 부여한다", () => {
            const wordResults = makeWords(1, [
                { isCorrect: true },
                { isCorrect: true },
                { isCorrect: false },
            ])

            const result = calculator.calculate({
                wordResults,
                completions: new Map(),
                isOvertime: false,
            })

            expect(result.scripts).toHaveLength(1)
            expect(result.scripts[0].type).toBe("first_clear")
            expect(result.scripts[0].baseXp).toBe(XP_CALC_DEFAULTS.FIRST_CLEAR)
        })
    })

    describe("반복 플레이", () => {
        it("completion 존재 + cooldown 미경과 시 REPEAT XP를 부여한다", () => {
            const wordResults = makeWords(1, [{ isCorrect: true }, { isCorrect: true }])
            const completions = new Map([[1, makeCompletion(1, 1)]]) // 1일 전

            const result = calculator.calculate({
                wordResults,
                completions,
                isOvertime: false,
            })

            expect(result.scripts[0].type).toBe("repeat")
            expect(result.scripts[0].baseXp).toBe(XP_CALC_DEFAULTS.REPEAT)
        })
    })

    describe("복습 보너스", () => {
        it("completion 존재 + cooldown 경과 시 REPEAT + REVIEW_BONUS XP를 부여한다", () => {
            const wordResults = makeWords(1, [{ isCorrect: true }, { isCorrect: true }])
            const completions = new Map([[1, makeCompletion(1, 5)]]) // 5일 전 (cooldown 3일 경과)

            const result = calculator.calculate({
                wordResults,
                completions,
                isOvertime: false,
            })

            expect(result.scripts[0].type).toBe("review")
            expect(result.scripts[0].baseXp).toBe(
                XP_CALC_DEFAULTS.REPEAT + XP_CALC_DEFAULTS.REVIEW_BONUS
            )
        })
    })

    describe("퍼펙트 보너스", () => {
        it("모든 단어 정답 + 힌트 미사용 시 퍼펙트 보너스를 추가한다", () => {
            const wordResults = makeWords(1, [{ isCorrect: true }, { isCorrect: true }])

            const result = calculator.calculate({
                wordResults,
                completions: new Map(),
                isOvertime: false,
            })

            expect(result.scripts[0].perfectBonus).toBe(XP_CALC_DEFAULTS.PERFECT_BONUS)
        })

        it("오답이 있으면 퍼펙트 보너스를 부여하지 않는다", () => {
            const wordResults = makeWords(1, [{ isCorrect: true }, { isCorrect: false }])

            const result = calculator.calculate({
                wordResults,
                completions: new Map(),
                isOvertime: false,
            })

            expect(result.scripts[0].perfectBonus).toBe(0)
        })

        it("힌트 사용 시 퍼펙트 보너스를 부여하지 않는다", () => {
            const wordResults = makeWords(1, [
                { isCorrect: true, hintUsed: true },
                { isCorrect: true },
            ])

            const result = calculator.calculate({
                wordResults,
                completions: new Map(),
                isOvertime: false,
            })

            expect(result.scripts[0].perfectBonus).toBe(0)
        })
    })

    describe("힌트 패널티", () => {
        it("힌트 사용 수만큼 패널티를 적용한다", () => {
            const wordResults = makeWords(1, [
                { isCorrect: true, hintUsed: true },
                { isCorrect: true, hintUsed: true },
                { isCorrect: true, hintUsed: true },
            ])

            const result = calculator.calculate({
                wordResults,
                completions: new Map(),
                isOvertime: false,
            })

            expect(result.scripts[0].hintPenalty).toBe(3 * XP_CALC_DEFAULTS.HINT_PENALTY)
        })
    })

    describe("콤보 배율", () => {
        it("3연속 정답 이후 콤보 보너스를 부여한다", () => {
            const wordResults = makeWords(1, [
                { isCorrect: true },
                { isCorrect: true },
                { isCorrect: true }, // 3연속 → 콤보 시작
                { isCorrect: true }, // 4연속 → 콤보 보너스
            ])

            const result = calculator.calculate({
                wordResults,
                completions: new Map(),
                isOvertime: false,
            })

            // 3번째, 4번째 단어에서 콤보 보너스 = 2 * COMBO_BONUS_PER_WORD
            expect(result.scripts[0].comboBonus).toBe(2 * XP_CALC_DEFAULTS.COMBO_BONUS_PER_WORD)
        })

        it("오답 시 콤보가 리셋된다", () => {
            const wordResults = makeWords(1, [
                { isCorrect: true },
                { isCorrect: true },
                { isCorrect: false }, // 리셋
                { isCorrect: true },
                { isCorrect: true },
            ])

            const result = calculator.calculate({
                wordResults,
                completions: new Map(),
                isOvertime: false,
            })

            expect(result.scripts[0].comboBonus).toBe(0)
        })
    })

    describe("스크립트 경계 넘어 콤보 유지", () => {
        it("다른 스크립트로 넘어가도 콤보가 유지된다", () => {
            // 스크립트 1: 2개 정답
            const words1 = makeWords(1, [{ isCorrect: true }, { isCorrect: true }])
            // 스크립트 2: 2개 정답 (이어서 총 4연속)
            const words2 = makeWords(2, [
                { isCorrect: true }, // 3연속
                { isCorrect: true }, // 4연속
            ])

            const result = calculator.calculate({
                wordResults: [...words1, ...words2],
                completions: new Map(),
                isOvertime: false,
            })

            // 3연속, 4연속 시 콤보 보너스 (스크립트 2에 할당)
            expect(result.scripts.find((s) => s.scriptId === 2)!.comboBonus).toBe(
                2 * XP_CALC_DEFAULTS.COMBO_BONUS_PER_WORD
            )
        })
    })

    describe("열공 배율", () => {
        it("isOvertime=true 시 열공 배율을 적용한다", () => {
            const wordResults = makeWords(1, [{ isCorrect: true }, { isCorrect: true }])

            const result = calculator.calculate({
                wordResults,
                completions: new Map(),
                isOvertime: true,
            })

            const expectedRaw = XP_CALC_DEFAULTS.FIRST_CLEAR + XP_CALC_DEFAULTS.PERFECT_BONUS
            expect(result.cappedTotal).toBe(expectedRaw)
            expect(result.overtimeMultiplier).toBe(XP_CALC_DEFAULTS.OVERTIME_MULTIPLIER)
            expect(result.finalXp).toBe(
                Math.floor(expectedRaw * XP_CALC_DEFAULTS.OVERTIME_MULTIPLIER)
            )
        })

        it("isOvertime=false 시 배율 1을 적용한다", () => {
            const wordResults = makeWords(1, [{ isCorrect: true }, { isCorrect: true }])

            const result = calculator.calculate({
                wordResults,
                completions: new Map(),
                isOvertime: false,
            })

            expect(result.overtimeMultiplier).toBe(1)
            expect(result.finalXp).toBe(result.cappedTotal)
        })
    })

    describe("XP 음수 방지", () => {
        it("힌트 패널티가 base를 초과해도 0 미만이 되지 않는다", () => {
            // 반복(5XP) + 힌트 10개 사용 = -15 → 0으로 보정
            const wordResults: WordResultInput[] = Array.from({ length: 10 }, (_, i) => ({
                scriptId: 1,
                word: `word_${i}`,
                wordIndex: i,
                isCorrect: true,
                attempts: 1,
                hintUsed: true,
            }))
            const completions = new Map([[1, makeCompletion(1, 1)]]) // 반복

            const result = calculator.calculate({
                wordResults,
                completions,
                isOvertime: false,
            })

            expect(result.scripts[0].subtotal).toBe(0)
            expect(result.finalXp).toBe(0)
        })
    })

    describe("세션 XP cap", () => {
        it("세션 합산이 cap을 초과하면 cap으로 제한한다", () => {
            // 최초 클리어 스크립트 5개 (각 20 + 10 = 30, 합 150 > cap 60)
            const wordResults = Array.from({ length: 5 }, (_, i) =>
                makeWords(i + 1, [{ isCorrect: true }, { isCorrect: true }])
            ).flat()

            const result = calculator.calculate({
                wordResults,
                completions: new Map(),
                isOvertime: false,
            })

            expect(result.rawTotal).toBeGreaterThan(XP_CALC_DEFAULTS.SESSION_CAP)
            expect(result.cappedTotal).toBe(XP_CALC_DEFAULTS.SESSION_CAP)
            expect(result.finalXp).toBe(XP_CALC_DEFAULTS.SESSION_CAP)
        })

        it("cap 적용 후 열공 배율을 적용한다", () => {
            const wordResults = Array.from({ length: 5 }, (_, i) =>
                makeWords(i + 1, [{ isCorrect: true }, { isCorrect: true }])
            ).flat()

            const result = calculator.calculate({
                wordResults,
                completions: new Map(),
                isOvertime: true,
            })

            expect(result.cappedTotal).toBe(XP_CALC_DEFAULTS.SESSION_CAP)
            expect(result.finalXp).toBe(
                Math.floor(XP_CALC_DEFAULTS.SESSION_CAP * XP_CALC_DEFAULTS.OVERTIME_MULTIPLIER)
            )
        })
    })

    describe("복합 시나리오", () => {
        it("최초 클리어 + 반복 혼합 세션을 올바르게 계산한다", () => {
            // 스크립트 1: 최초 클리어 (전부 정답, 힌트 없음 → 퍼펙트)
            const words1 = makeWords(1, [
                { isCorrect: true },
                { isCorrect: true },
                { isCorrect: true },
            ])
            // 스크립트 2: 반복 (1일 전 완료, 오답 포함)
            const words2 = makeWords(2, [{ isCorrect: true }, { isCorrect: false }])

            const completions = new Map([[2, makeCompletion(2, 1)]])

            const result = calculator.calculate({
                wordResults: [...words1, ...words2],
                completions,
                isOvertime: false,
            })

            const script1 = result.scripts.find((s) => s.scriptId === 1)!
            const script2 = result.scripts.find((s) => s.scriptId === 2)!

            // 스크립트 1: first_clear(20) + perfect(10) + combo(3연속=1)
            expect(script1.type).toBe("first_clear")
            expect(script1.baseXp).toBe(20)
            expect(script1.perfectBonus).toBe(10)

            // 스크립트 2: repeat(5), 오답 있으므로 퍼펙트 없음
            expect(script2.type).toBe("repeat")
            expect(script2.baseXp).toBe(5)
            expect(script2.perfectBonus).toBe(0)

            expect(result.finalXp).toBe(result.cappedTotal)
        })
    })
})
