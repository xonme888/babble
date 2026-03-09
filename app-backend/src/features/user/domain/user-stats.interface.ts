import type { User } from "./user.entity"

/** getStats raw 데이터 통합 인터페이스 */
export interface RawStatsData {
    userId: number
    user: User
    stats: {
        totalLessons: number
        completedLessons: number
        averageScore: number
        totalPracticeSeconds: number
    }
    todayCompleted: number
    weeklyData: { dayOfWeek: number; totalMinutes: number }[]
    streaks: { currentStreak: number; longestStreak: number }
    dailyGoal: { completedCount: number; dailyGoalTarget: number; isGoalAchieved: boolean }
}
