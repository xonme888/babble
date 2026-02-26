import "reflect-metadata"
import { StreakCalculator } from "@features/learning/domain/streak-calculator"
import { formatInTimeZone } from "date-fns-tz"
import { subDays } from "date-fns"

export {}

const KST = "Asia/Seoul"

/** KST 기준 오늘 날짜 문자열 */
function todayKST(): string {
    return formatInTimeZone(new Date(), KST, "yyyy-MM-dd")
}

/** KST 기준 N일 전 날짜 문자열 */
function daysAgoKST(n: number): string {
    return formatInTimeZone(subDays(new Date(), n), KST, "yyyy-MM-dd")
}

describe("StreakCalculator", () => {
    let calculator: StreakCalculator

    beforeEach(() => {
        calculator = new StreakCalculator()
    })

    it("빈 배열 → { currentStreak: 0, longestStreak: 0 }", () => {
        const result = calculator.calculate([])

        expect(result).toEqual({ currentStreak: 0, longestStreak: 0 })
    })

    it("하루만 (오늘) → { currentStreak: 1, longestStreak: 1 }", () => {
        const result = calculator.calculate([todayKST()])

        expect(result).toEqual({ currentStreak: 1, longestStreak: 1 })
    })

    it("연속 3일 (오늘 포함) → { currentStreak: 3, longestStreak: 3 }", () => {
        const dates = [daysAgoKST(2), daysAgoKST(1), todayKST()]

        const result = calculator.calculate(dates)

        expect(result).toEqual({ currentStreak: 3, longestStreak: 3 })
    })

    it("중간 끊김 → currentStreak < longestStreak", () => {
        // 5일 전~3일 전 연속(3일), 1일 전~오늘 연속(2일), 중간에 2일 전 빠짐
        const dates = [daysAgoKST(5), daysAgoKST(4), daysAgoKST(3), daysAgoKST(1), todayKST()]

        const result = calculator.calculate(dates)

        expect(result.longestStreak).toBe(3)
        expect(result.currentStreak).toBe(2)
    })

    it("어제까지만 → currentStreak 유지 (어제도 유효)", () => {
        const dates = [daysAgoKST(3), daysAgoKST(2), daysAgoKST(1)]

        const result = calculator.calculate(dates)

        expect(result.currentStreak).toBe(3)
        expect(result.longestStreak).toBe(3)
    })

    it("그저께까지만 → currentStreak: 0", () => {
        const dates = [daysAgoKST(4), daysAgoKST(3), daysAgoKST(2)]

        const result = calculator.calculate(dates)

        expect(result.currentStreak).toBe(0)
        expect(result.longestStreak).toBe(3)
    })

    it("중복 날짜 자동 제거", () => {
        const dates = [todayKST(), todayKST(), daysAgoKST(1), daysAgoKST(1)]

        const result = calculator.calculate(dates)

        expect(result).toEqual({ currentStreak: 2, longestStreak: 2 })
    })

    it("정렬되지 않은 입력도 처리", () => {
        const dates = [todayKST(), daysAgoKST(2), daysAgoKST(1)]

        const result = calculator.calculate(dates)

        expect(result).toEqual({ currentStreak: 3, longestStreak: 3 })
    })
})
