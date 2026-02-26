import { calculateAssessmentXp, calculateGameSessionXp, XP_DEFAULTS } from "@features/gamification/domain/xp-rules"

describe("XP Rules (XP 계산 규칙)", () => {
    describe("calculateAssessmentXp (Assessment XP 계산)", () => {
        it("기본 XP를 반환한다 (score < 90)", () => {
            expect(calculateAssessmentXp(50)).toBe(XP_DEFAULTS.ASSESSMENT_COMPLETE)
            expect(calculateAssessmentXp(89)).toBe(XP_DEFAULTS.ASSESSMENT_COMPLETE)
        })

        it("90점 이상이면 보너스를 추가한다", () => {
            const expected = XP_DEFAULTS.ASSESSMENT_COMPLETE + XP_DEFAULTS.ASSESSMENT_HIGH_SCORE_BONUS
            expect(calculateAssessmentXp(90)).toBe(expected)
            expect(calculateAssessmentXp(100)).toBe(expected)
        })

        it("경계값 89 → 보너스 없음, 90 → 보너스 있음", () => {
            expect(calculateAssessmentXp(89)).toBe(50)
            expect(calculateAssessmentXp(90)).toBe(75)
        })
    })

    describe("calculateGameSessionXp (게임 세션 XP 계산)", () => {
        it("기본 XP를 반환한다 (accuracy < 80)", () => {
            expect(calculateGameSessionXp(50)).toBe(XP_DEFAULTS.GAME_COMPLETE)
            expect(calculateGameSessionXp(79)).toBe(XP_DEFAULTS.GAME_COMPLETE)
        })

        it("80% 이상 정답률이면 보너스를 추가한다", () => {
            const expected = XP_DEFAULTS.GAME_COMPLETE + XP_DEFAULTS.GAME_HIGH_ACCURACY_BONUS
            expect(calculateGameSessionXp(80)).toBe(expected)
            expect(calculateGameSessionXp(100)).toBe(expected)
        })

        it("경계값 79 → 보너스 없음, 80 → 보너스 있음", () => {
            expect(calculateGameSessionXp(79)).toBe(30)
            expect(calculateGameSessionXp(80)).toBe(45)
        })
    })
})
