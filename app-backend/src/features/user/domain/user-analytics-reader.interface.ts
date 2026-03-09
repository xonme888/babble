/**
 * IUserAnalyticsReader — Admin Analytics 전용 읽기 Port
 *
 * UserRepository의 분석 메서드만 노출한다 (ISP).
 */
export interface IUserAnalyticsReader {
    countActive(): Promise<number>
    getCohortRetention(weeks: number): Promise<Array<{ week: number; retention: number }>>
    findAtRiskUsers(inactiveDays: number): Promise<Array<{
        id: number
        firstName: string | null
        lastName: string | null
        email: string
        lastActiveAt: Date | null
        daysSinceActive: number | null
    }>>
}
