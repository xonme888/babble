export {}

import { DateUtils } from "@shared/utils/date.utils"

describe("DateUtils (날짜 유틸리티)", () => {
    describe("toKSTDateString", () => {
        it("UTC 날짜를 KST yyyy-MM-dd 문자열로 변환한다", () => {
            // Given — 2026-02-19 15:00 UTC = 2026-02-20 00:00 KST
            const utcDate = new Date("2026-02-19T15:00:00Z")

            // When
            const result = DateUtils.toKSTDateString(utcDate)

            // Then
            expect(result).toBe("2026-02-20")
        })
    })

    describe("getKSTDayBoundary", () => {
        it("KST 기준 하루 경계를 UTC Date 쌍으로 반환한다", () => {
            // Given — 2026-02-19 10:00 KST = 2026-02-19 01:00 UTC
            const date = new Date("2026-02-19T01:00:00Z")

            // When
            const { start, end } = DateUtils.getKSTDayBoundary(date)

            // Then — KST 2026-02-19 00:00 = UTC 2026-02-18 15:00
            expect(start.toISOString()).toBe("2026-02-18T15:00:00.000Z")
            // KST 2026-02-20 00:00 = UTC 2026-02-19 15:00
            expect(end.toISOString()).toBe("2026-02-19T15:00:00.000Z")
        })

        it("KST 자정 직전(UTC 14:59)은 전날 경계에 속한다", () => {
            // Given — 2026-02-19 14:59 UTC = 2026-02-19 23:59 KST
            const date = new Date("2026-02-19T14:59:00Z")

            // When
            const { start } = DateUtils.getKSTDayBoundary(date)

            // Then — KST 2026-02-19 시작
            expect(start.toISOString()).toBe("2026-02-18T15:00:00.000Z")
        })

        it("KST 자정 이후(UTC 15:00)는 다음날 경계에 속한다", () => {
            // Given — 2026-02-19 15:00 UTC = 2026-02-20 00:00 KST
            const date = new Date("2026-02-19T15:00:00Z")

            // When
            const { start } = DateUtils.getKSTDayBoundary(date)

            // Then — KST 2026-02-20 시작
            expect(start.toISOString()).toBe("2026-02-19T15:00:00.000Z")
        })
    })

    describe("getKSTWeekStart", () => {
        it("KST 기준 이번 주 월요일 00:00을 UTC로 반환한다", () => {
            // Given — 2026-02-19 목요일 (KST)
            const thursday = new Date("2026-02-19T01:00:00Z") // KST 10:00

            // When
            const monday = DateUtils.getKSTWeekStart(thursday)

            // Then — KST 2026-02-16 월요일 00:00 = UTC 2026-02-15 15:00
            expect(monday.toISOString()).toBe("2026-02-15T15:00:00.000Z")
        })

        it("일요일은 이전 주 월요일을 반환한다", () => {
            // Given — 2026-02-22 일요일 (KST)
            const sunday = new Date("2026-02-22T01:00:00Z") // KST 10:00

            // When
            const monday = DateUtils.getKSTWeekStart(sunday)

            // Then — KST 2026-02-16 월요일
            expect(monday.toISOString()).toBe("2026-02-15T15:00:00.000Z")
        })

        it("월요일은 당일을 반환한다", () => {
            // Given — 2026-02-16 월요일 (KST)
            const mondayInput = new Date("2026-02-16T01:00:00Z") // KST 10:00

            // When
            const result = DateUtils.getKSTWeekStart(mondayInput)

            // Then
            expect(result.toISOString()).toBe("2026-02-15T15:00:00.000Z")
        })
    })
})
