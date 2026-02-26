import { xpRequiredForLevel, levelForXp, MAX_LEVEL } from "@features/gamification/domain/level-rules"

describe("Level Rules (레벨 시스템 규칙)", () => {
    describe("xpRequiredForLevel (레벨 필요 XP)", () => {
        it("레벨 1은 0 XP가 필요하다", () => {
            expect(xpRequiredForLevel(1)).toBe(0)
        })

        it("레벨 0 이하도 0 XP를 반환한다", () => {
            expect(xpRequiredForLevel(0)).toBe(0)
            expect(xpRequiredForLevel(-1)).toBe(0)
        })

        it("레벨 2는 240 XP가 필요하다", () => {
            // 공식: 2 * 100 * (1 + (2-1) * 0.2) = 200 * 1.2 = 240
            expect(xpRequiredForLevel(2)).toBe(240)
        })

        it("레벨이 높아질수록 필요 XP가 점진적으로 증가한다", () => {
            let prev = xpRequiredForLevel(1)
            for (let level = 2; level <= 10; level++) {
                const current = xpRequiredForLevel(level)
                expect(current).toBeGreaterThan(prev)
                prev = current
            }
        })
    })

    describe("levelForXp (XP → 레벨 변환)", () => {
        it("0 XP이면 레벨 1이다", () => {
            expect(levelForXp(0)).toBe(1)
        })

        it("레벨 2 미만 XP면 레벨 1이다", () => {
            expect(levelForXp(239)).toBe(1)
        })

        it("레벨 2 이상 XP면 레벨 2이다", () => {
            expect(levelForXp(240)).toBe(2)
        })

        it("xpRequiredForLevel과 역변환 관계를 유지한다", () => {
            for (let level = 1; level <= 10; level++) {
                const xp = xpRequiredForLevel(level)
                expect(levelForXp(xp)).toBe(level)
            }
        })
    })

    describe("MAX_LEVEL", () => {
        it("최대 레벨은 50이다", () => {
            expect(MAX_LEVEL).toBe(50)
        })
    })
})
