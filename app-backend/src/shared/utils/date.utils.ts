import { formatInTimeZone, toZonedTime } from "date-fns-tz"

const KST = "Asia/Seoul"

export class DateUtils {
    /**
     * Date를 KST yyyy-MM-dd 문자열로 변환
     */
    static toKSTDateString(date: Date): string {
        return formatInTimeZone(date, KST, "yyyy-MM-dd")
    }

    /**
     * KST 기준 하루 경계 (00:00:00 ~ 다음날 00:00:00) — UTC Date 쌍 반환
     */
    static getKSTDayBoundary(date: Date = new Date()): { start: Date; end: Date } {
        const kstDateStr = formatInTimeZone(date, KST, "yyyy-MM-dd")
        const start = new Date(`${kstDateStr}T00:00:00+09:00`)
        const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
        return { start, end }
    }

    /**
     * KST 기준 이번 주 월요일 00:00:00 — UTC Date 반환
     */
    static getKSTWeekStart(date: Date = new Date()): Date {
        const { start: todayStart } = DateUtils.getKSTDayBoundary(date)
        const kstDay = toZonedTime(date, KST).getDay()
        const daysToMonday = kstDay === 0 ? -6 : 1 - kstDay
        return new Date(todayStart.getTime() + daysToMonday * 24 * 60 * 60 * 1000)
    }

    /**
     * 오늘 날짜를 KST yyyy-MM-dd 문자열로 반환
     */
    static getKSTToday(): string {
        return DateUtils.toKSTDateString(new Date())
    }

    /** KST 기준 어제 날짜를 yyyy-MM-dd 문자열로 반환 */
    static getKSTYesterday(): string {
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
        return DateUtils.toKSTDateString(yesterday)
    }

    /** 두 날짜 문자열(yyyy-MM-dd) 사이 일수 차이 */
    static dayDiffFromStrings(d1: string, d2: string): number {
        const date1 = new Date(d1)
        const date2 = new Date(d2)
        return Math.round(Math.abs(date2.getTime() - date1.getTime()) / (1000 * 60 * 60 * 24))
    }
}
