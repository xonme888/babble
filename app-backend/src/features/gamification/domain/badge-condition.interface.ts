/**
 * 뱃지 조건 평가용 캐시 데이터 타입
 * prefetchConditionData에서 반환, BadgeConditionEvaluator에서 소비
 */
export interface BadgeConditionCache {
    streak?: { longestStreak: number }
    stats?: { completedLessons: number }
    level?: { level: number }
    scoreThresholds: Map<number, boolean>
}
