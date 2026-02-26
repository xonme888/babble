/**
 * IAssessmentStatsProvider — cross-feature 소비자용 읽기 전용 Port
 *
 * AssessmentRepository의 집계 메서드만 노출한다.
 * Application 레이어 위반(서비스→다른 피처 Repository 직접 주입)을 해소하기 위한 인터페이스.
 */
export interface IAssessmentStatsProvider {
    getScriptProgress(userId: number): Promise<{
        completedScriptIds: number[]
        bestScores: Record<number, number>
    }>
    getStatsByUserId(userId: number): Promise<{
        totalLessons: number
        completedLessons: number
        averageScore: number
        totalPracticeSeconds: number
    }>
    getTodayCompletedCount(userId: number, todayStart: Date, todayEnd: Date): Promise<number>
    getWeeklyActivity(
        userId: number,
        weekStartDate: Date
    ): Promise<Array<{ dayOfWeek: number; totalMinutes: number }>>
    hasScoreAbove(userId: number, minScore: number): Promise<boolean>
    findTodayCompletedByUser(
        userId: number,
        start: Date,
        end: Date
    ): Promise<Array<{ scriptId: number; bestScore: number }>>
}
