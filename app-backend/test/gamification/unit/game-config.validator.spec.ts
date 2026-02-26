import { validateGameConfigValue } from "@features/gamification/domain/game-config.validator"

describe("GameConfigValidator (게임 설정 유효성 검증)", () => {
    describe("XP 값 검증 (xp.*)", () => {
        it("유효한 정수를 통과시킨다", () => {
            expect(validateGameConfigValue("xp.game.firstClear", 20).valid).toBe(true)
            expect(validateGameConfigValue("xp.game.repeat", 0).valid).toBe(true)
            expect(validateGameConfigValue("xp.game.sessionCap", 500).valid).toBe(true)
        })

        it("음수 XP를 거부한다", () => {
            const result = validateGameConfigValue("xp.game.firstClear", -1)
            expect(result.valid).toBe(false)
        })

        it("500 초과를 거부한다", () => {
            const result = validateGameConfigValue("xp.game.firstClear", 501)
            expect(result.valid).toBe(false)
        })

        it("실수를 거부한다", () => {
            const result = validateGameConfigValue("xp.game.firstClear", 10.5)
            expect(result.valid).toBe(false)
        })

        it("문자열을 거부한다", () => {
            const result = validateGameConfigValue("xp.game.firstClear", "invalid")
            expect(result.valid).toBe(false)
        })
    })

    describe("배율 검증 (*.multiplier)", () => {
        it("유효한 실수를 통과시킨다", () => {
            expect(validateGameConfigValue("xp.overtime.multiplier", 1.0).valid).toBe(true)
            expect(validateGameConfigValue("xp.overtime.multiplier", 2.5).valid).toBe(true)
            expect(validateGameConfigValue("xp.overtime.multiplier", 5.0).valid).toBe(true)
        })

        it("1.0 미만을 거부한다", () => {
            const result = validateGameConfigValue("xp.overtime.multiplier", 0.9)
            expect(result.valid).toBe(false)
        })

        it("5.0 초과를 거부한다", () => {
            const result = validateGameConfigValue("xp.overtime.multiplier", 5.1)
            expect(result.valid).toBe(false)
        })
    })

    describe("boolean 검증 (*.enabled)", () => {
        it("true/false를 통과시킨다", () => {
            expect(validateGameConfigValue("xp.overtime.enabled", true).valid).toBe(true)
            expect(validateGameConfigValue("game.adaptiveDifficulty.enabled", false).valid).toBe(
                true
            )
        })

        it("문자열 'true'를 거부한다", () => {
            const result = validateGameConfigValue("xp.overtime.enabled", "true")
            expect(result.valid).toBe(false)
        })

        it("숫자 1을 거부한다", () => {
            const result = validateGameConfigValue("xp.overtime.enabled", 1)
            expect(result.valid).toBe(false)
        })
    })

    describe("콤보 배율 배열 검증 (xp.combo.multipliers)", () => {
        it("유효한 배열을 통과시킨다", () => {
            expect(
                validateGameConfigValue("xp.combo.multipliers", [1.0, 1.2, 1.5, 2.0]).valid
            ).toBe(true)
        })

        it("요소 수 1개 (최소 2개 미만)를 거부한다", () => {
            const result = validateGameConfigValue("xp.combo.multipliers", [1.0])
            expect(result.valid).toBe(false)
        })

        it("요소가 1.0 미만인 경우 거부한다", () => {
            const result = validateGameConfigValue("xp.combo.multipliers", [0.5, 1.0])
            expect(result.valid).toBe(false)
        })

        it("요소가 5.0 초과인 경우 거부한다", () => {
            const result = validateGameConfigValue("xp.combo.multipliers", [1.0, 6.0])
            expect(result.valid).toBe(false)
        })

        it("배열이 아닌 값을 거부한다", () => {
            const result = validateGameConfigValue("xp.combo.multipliers", "not_array")
            expect(result.valid).toBe(false)
        })
    })

    describe("비율 검증 (game.todayFirstRatio)", () => {
        it("0.0 ~ 1.0 범위를 통과시킨다", () => {
            expect(validateGameConfigValue("game.todayFirstRatio", 0.0).valid).toBe(true)
            expect(validateGameConfigValue("game.todayFirstRatio", 0.7).valid).toBe(true)
            expect(validateGameConfigValue("game.todayFirstRatio", 1.0).valid).toBe(true)
        })

        it("음수를 거부한다", () => {
            const result = validateGameConfigValue("game.todayFirstRatio", -0.1)
            expect(result.valid).toBe(false)
        })

        it("1.0 초과를 거부한다", () => {
            const result = validateGameConfigValue("game.todayFirstRatio", 1.1)
            expect(result.valid).toBe(false)
        })
    })

    describe("빈칸 범위 검증 (*Blanks)", () => {
        it("유효한 {min, max}를 통과시킨다", () => {
            expect(
                validateGameConfigValue("game.adaptiveDifficulty.highScoreBlanks", {
                    min: 5,
                    max: 8,
                }).valid
            ).toBe(true)
            expect(
                validateGameConfigValue("game.adaptiveDifficulty.lowScoreBlanks", {
                    min: 1,
                    max: 3,
                }).valid
            ).toBe(true)
        })

        it("min > max를 거부한다", () => {
            const result = validateGameConfigValue("game.adaptiveDifficulty.highScoreBlanks", {
                min: 8,
                max: 5,
            })
            expect(result.valid).toBe(false)
        })

        it("15 초과를 거부한다", () => {
            const result = validateGameConfigValue("game.adaptiveDifficulty.highScoreBlanks", {
                min: 5,
                max: 16,
            })
            expect(result.valid).toBe(false)
        })

        it("객체가 아닌 값을 거부한다", () => {
            const result = validateGameConfigValue(
                "game.adaptiveDifficulty.highScoreBlanks",
                "invalid"
            )
            expect(result.valid).toBe(false)
        })

        it("실수 min/max를 거부한다", () => {
            const result = validateGameConfigValue("game.adaptiveDifficulty.highScoreBlanks", {
                min: 1.5,
                max: 3,
            })
            expect(result.valid).toBe(false)
        })
    })

    describe("힌트 설정 검증", () => {
        it("hint.maxPerSentence 유효 범위를 통과시킨다", () => {
            expect(validateGameConfigValue("hint.maxPerSentence", 0).valid).toBe(true)
            expect(validateGameConfigValue("hint.maxPerSentence", 10).valid).toBe(true)
        })

        it("hint.maxPerSentence 범위 초과를 거부한다", () => {
            expect(validateGameConfigValue("hint.maxPerSentence", 11).valid).toBe(false)
        })

        it("hint.xpPenalty 유효 범위를 통과시킨다", () => {
            expect(validateGameConfigValue("hint.xpPenalty", 0).valid).toBe(true)
            expect(validateGameConfigValue("hint.xpPenalty", 50).valid).toBe(true)
        })

        it("hint.xpPenalty 범위 초과를 거부한다", () => {
            expect(validateGameConfigValue("hint.xpPenalty", 51).valid).toBe(false)
        })

        it("hint.types 유효한 문자열 배열을 통과시킨다", () => {
            expect(
                validateGameConfigValue("hint.types", ["firstLetter", "translation"]).valid
            ).toBe(true)
        })

        it("hint.types 빈 배열을 거부한다", () => {
            expect(validateGameConfigValue("hint.types", []).valid).toBe(false)
        })

        it("hint.autoShowAfterWrong 유효 범위를 통과시킨다", () => {
            expect(validateGameConfigValue("hint.autoShowAfterWrong", 1).valid).toBe(true)
            expect(validateGameConfigValue("hint.autoShowAfterWrong", 10).valid).toBe(true)
        })
    })

    describe("알 수 없는 키", () => {
        it("매칭 규칙이 없는 키는 통과시킨다", () => {
            expect(validateGameConfigValue("unknown.custom.key", "any_value").valid).toBe(true)
        })
    })
})
