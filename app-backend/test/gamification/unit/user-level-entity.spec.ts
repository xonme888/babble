import { UserLevel } from "@features/gamification/domain/user-level.entity"
import { xpRequiredForLevel, MAX_LEVEL } from "@features/gamification/domain/level-rules"

describe("UserLevel Entity (사용자 레벨 엔티티)", () => {
    describe("create (팩토리)", () => {
        it("레벨 1, XP 0으로 초기화된다", () => {
            const ul = UserLevel.create(42)
            expect(ul.userId).toBe(42)
            expect(ul.level).toBe(1)
            expect(ul.totalXp).toBe(0)
            expect(ul.lastSeenLevel).toBe(1)
        })
    })

    describe("addXp (XP 추가)", () => {
        it("레벨업 없이 XP를 누적한다", () => {
            const ul = UserLevel.create(1)
            const leveledUp = ul.addXp(100)

            expect(leveledUp).toBe(false)
            expect(ul.totalXp).toBe(100)
            expect(ul.level).toBe(1)
        })

        it("충분한 XP를 추가하면 레벨업한다", () => {
            const ul = UserLevel.create(1)
            // 레벨 2 필요 XP: 240
            const leveledUp = ul.addXp(240)

            expect(leveledUp).toBe(true)
            expect(ul.level).toBe(2)
            expect(ul.totalXp).toBe(240)
        })

        it("연속 XP 추가로 다중 레벨업이 가능하다", () => {
            const ul = UserLevel.create(1)
            ul.addXp(100)
            expect(ul.level).toBe(1)

            // 추가 XP로 레벨업
            const leveledUp = ul.addXp(200)
            expect(leveledUp).toBe(true)
            expect(ul.totalXp).toBe(300)
            expect(ul.level).toBe(2)
        })

        it("MAX_LEVEL을 초과하지 않는다", () => {
            const ul = UserLevel.create(1)
            ul.addXp(999999999)
            expect(ul.level).toBeLessThanOrEqual(MAX_LEVEL)
        })
    })

    describe("xpToNextLevel (다음 레벨까지 필요 XP)", () => {
        it("레벨 1에서 다음 레벨까지 필요 XP를 반환한다", () => {
            const ul = UserLevel.create(1)
            expect(ul.xpToNextLevel).toBe(xpRequiredForLevel(2))
        })

        it("MAX_LEVEL에서는 0을 반환한다", () => {
            const ul = UserLevel.create(1)
            ul.level = MAX_LEVEL
            expect(ul.xpToNextLevel).toBe(0)
        })

        it("XP를 일부 모은 후에는 남은 XP를 반환한다", () => {
            const ul = UserLevel.create(1)
            ul.addXp(100)
            expect(ul.xpToNextLevel).toBe(xpRequiredForLevel(2) - 100)
        })
    })

    describe("getUnseenLevelUp (미확인 레벨업)", () => {
        it("레벨업이 있으면 fromLevel/toLevel을 반환한다", () => {
            const ul = UserLevel.create(1)
            ul.addXp(240) // 레벨 2로 레벨업
            // lastSeenLevel은 여전히 1

            const result = ul.getUnseenLevelUp()
            expect(result).toEqual({ fromLevel: 1, toLevel: 2 })
        })

        it("레벨업이 없으면 null을 반환한다", () => {
            const ul = UserLevel.create(1)
            expect(ul.getUnseenLevelUp()).toBeNull()
        })

        it("lastSeenLevel === level이면 null을 반환한다", () => {
            const ul = UserLevel.create(1)
            ul.level = 3
            ul.lastSeenLevel = 3
            expect(ul.getUnseenLevelUp()).toBeNull()
        })
    })

    describe("canAcknowledgeLevel (레벨 확인 가능 여부)", () => {
        it("lastSeenLevel < level <= currentLevel이면 true를 반환한다", () => {
            const ul = UserLevel.create(1)
            ul.level = 5
            ul.lastSeenLevel = 3

            expect(ul.canAcknowledgeLevel(4)).toBe(true)
            expect(ul.canAcknowledgeLevel(5)).toBe(true)
        })

        it("level <= lastSeenLevel이면 false를 반환한다", () => {
            const ul = UserLevel.create(1)
            ul.level = 5
            ul.lastSeenLevel = 3

            expect(ul.canAcknowledgeLevel(3)).toBe(false)
            expect(ul.canAcknowledgeLevel(2)).toBe(false)
        })

        it("level > currentLevel이면 false를 반환한다", () => {
            const ul = UserLevel.create(1)
            ul.level = 5
            ul.lastSeenLevel = 3

            expect(ul.canAcknowledgeLevel(6)).toBe(false)
        })
    })

    describe("levelProgress (레벨 내 진행도)", () => {
        it("XP 0이면 진행도 0이다", () => {
            const ul = UserLevel.create(1)
            expect(ul.levelProgress).toBe(0)
        })

        it("다음 레벨 XP의 절반이면 진행도 약 0.5이다", () => {
            const ul = UserLevel.create(1)
            const halfXp = Math.floor(xpRequiredForLevel(2) / 2)
            ul.addXp(halfXp)
            expect(ul.levelProgress).toBeCloseTo(0.5, 1)
        })

        it("MAX_LEVEL이면 진행도 1이다", () => {
            const ul = UserLevel.create(1)
            ul.level = MAX_LEVEL
            expect(ul.levelProgress).toBe(1)
        })
    })
})
